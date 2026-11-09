"""Role-based access control. Demo directory of users, signed stateless bearer tokens,
a permission matrix, and ownership checks so a field rep only sees their own merchants and visits."""
import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import HTTPException, Request

import db
import security

ROLES = ("rep", "manager", "admin")

# Demo users. Passwords are demo-only test values for this local prototype.
USERS = {
    "admin@leadpilot.in": {"id": "U-ADMIN", "name": "Arjun Mehta", "role": "admin", "title": "Platform admin", "password": "admin123"},
    "manager@leadpilot.in": {"id": "U-MGR", "name": "Meera Iyer", "role": "manager", "title": "Sales manager · Pune", "password": "manager123"},
}
REP_LOGINS = {
    "R-01": "rahul.patil", "R-02": "sneha.kulkarni", "R-03": "amit.deshmukh", "R-04": "pooja.jadhav", "R-05": "vikram.shinde",
    "R-06": "neha.joshi", "R-07": "sanket.pawar", "R-08": "aarti.more", "R-09": "imran.shaikh", "R-10": "kiran.gaikwad",
}
for rid, handle in REP_LOGINS.items():
    USERS[f"{handle}@leadpilot.in"] = {"id": rid, "name": handle.replace(".", " ").title(), "role": "rep",
                                        "title": "Field sales rep", "password": "rep123", "rep_id": rid}

PERMS = {
    "leads:create": {"rep", "manager", "admin"},
    "leads:read_all": {"manager", "admin"},
    "leads:optout": {"rep", "manager", "admin"},
    "agent:control": {"rep", "manager", "admin"},
    "pii:reveal": {"admin"},
    "visits:read_all": {"manager", "admin"},
    "visits:outcome": {"rep", "manager", "admin"},
    "visits:reschedule": {"rep", "manager", "admin"},
    "visits:book": {"manager", "admin"},
    "leakage:read": {"manager", "admin"},
    "leakage:recover": {"manager", "admin"},
    "handoffs:read": {"manager", "admin"},
    "handoffs:resolve": {"manager", "admin"},
    "audit:read": {"manager", "admin"},
    "metrics:read": {"manager", "admin"},
    "assistant:ask": {"manager", "admin"},
    "settings:read": {"manager", "admin"},
    "settings:write": {"admin"},
    "admin:reset": {"admin"},
    "sim:run": {"manager", "admin"},
}



def public(u: dict) -> dict:
    return {k: v for k, v in u.items() if k != "password"} | {"permissions": sorted(p for p, r in PERMS.items() if u["role"] in r)}


TOKEN_TTL = 12 * 3600
_revoked: set[str] = set()


def _sign(payload: str) -> str:
    return hmac.new(security._SECRET, b"auth:" + payload.encode(), hashlib.sha256).hexdigest()[:40]


def login(email: str, password: str) -> dict:
    email = (email or "").strip().lower()
    u = USERS.get(email)
    if not u or not secrets.compare_digest(u["password"], password or ""):
        raise HTTPException(401, "Invalid email or password")
    payload = base64.urlsafe_b64encode(json.dumps({"e": email, "x": int(time.time()) + TOKEN_TTL, "n": secrets.token_hex(4)}).encode()).decode()
    tok = f"{payload}.{_sign(payload)}"
    return {"token": tok, "user": public({**u, "email": email})}


def logout(token: str):
    if token:
        _revoked.add(token)


def from_token(token: str | None) -> dict | None:
    """Stateless signed token: survives server restarts, expires after 12 h, revocable on sign-out."""
    if not token or token in _revoked or "." not in token:
        return None
    payload, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(sig, _sign(payload)):
        return None
    try:
        d = json.loads(base64.urlsafe_b64decode(payload.encode()))
    except ValueError:
        return None
    u = USERS.get(d.get("e", ""))
    if not u or d.get("x", 0) < time.time():
        return None
    return {**u, "email": d["e"]}


def current(request: Request) -> dict:
    h = request.headers.get("authorization", "")
    tok = h[7:] if h.lower().startswith("bearer ") else request.query_params.get("token")
    u = from_token(tok)
    if not u:
        raise HTTPException(401, "Sign in required")
    return u


def require(request: Request, perm: str) -> dict:
    u = current(request)
    if u["role"] not in PERMS[perm]:
        raise HTTPException(403, f"Your role ({u['role']}) is not allowed to do this")
    return u


def can(u: dict, perm: str) -> bool:
    return u["role"] in PERMS[perm]


def rep_lead_ids(u: dict) -> set[str]:
    """Leads a rep owns: assigned visits or leads they created."""
    rid = u.get("rep_id")
    rows = db.q("SELECT DISTINCT lead_id FROM visits WHERE agent_id = ?", (rid,))
    own = {r["lead_id"] for r in rows}
    own |= {r["id"] for r in db.q("SELECT id FROM leads WHERE created_by = ?", (u["id"],))}
    return own


def assert_lead_access(u: dict, lead_id: str):
    if can(u, "leads:read_all"):
        return
    if lead_id not in rep_lead_ids(u):
        raise HTTPException(403, "This merchant is not assigned to you")


def assert_visit_access(u: dict, visit: dict):
    if can(u, "visits:read_all"):
        return
    if visit.get("agent_id") != u.get("rep_id"):
        raise HTTPException(403, "This visit is not assigned to you")


def actor_label(u: dict) -> str:
    return f"{u['role']}:{u['name']}"
