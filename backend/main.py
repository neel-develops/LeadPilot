"""LeadPilot — Lead-to-Visit Sales Agent API (FastAPI). Every route is guarded by role-based access control."""
import asyncio
import json
import os
import random
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import agent
import auth
import bus
import db
import leakage
import metrics
import rules
import sarvam
import security
import seed
import tools
import visits as vmod

DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")


async def _leakage_loop():
    while True:
        try:
            leakage.scan()
            s = tools.get_settings()
            if s.get("auto_recover"):
                for f in db.q("SELECT id FROM leakage_flags WHERE status = 'open' AND rule IN ('L1','L5') LIMIT 2"):
                    leakage.recover(f["id"])
        except Exception as e:  # keep the detector alive
            print("leakage scan error:", e)
        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed.ensure_seeded()
    task = asyncio.create_task(_leakage_loop())
    yield
    task.cancel()


app = FastAPI(title="LeadPilot — Lead-to-Visit Sales Agent", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# --------------------------------------------------------------------------- models
class LoginIn(BaseModel):
    email: str
    password: str


class LeadIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    phone: str
    business_name: str | None = None
    source: str = "web_form"
    interest: str = "soundbox"
    language: str = "hi"
    pincode: str | None = None
    consent: bool = True
    mode: str = "voice"
    persona: str | None = None
    audio: bool = True


class ReplyIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class StartIn(BaseModel):
    mode: str = "auto"
    persona: str | None = None
    audio: bool = False


class AnswerIn(BaseModel):
    answer: bool = True


class TtsIn(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    lang: str = "hi"


class AskIn(BaseModel):
    question: str = Field(min_length=2, max_length=400)


class MissedCallIn(BaseModel):
    phone: str
    name: str | None = None


class OutcomeIn(BaseModel):
    outcome: str
    reason: str | None = None


class RescheduleIn(BaseModel):
    reason: str = "rep_unavailable"


class VisitIn(BaseModel):
    lead_id: str
    rep_id: str
    slot_start: float


class HandoffPatch(BaseModel):
    status: str = "resolved"


class BurstIn(BaseModel):
    count: int = Field(default=4, ge=1, le=10)


# --------------------------------------------------------------------------- helpers
def _next_id() -> str:
    last = db.scalar("SELECT MAX(CAST(SUBSTR(id, 4) AS INTEGER)) FROM leads") or 1000
    return f"LD-{last + 1}"


def create_lead(data: LeadIn, user: dict | None = None, start=True) -> dict:
    try:
        phone = security.normalize_phone(data.phone)
    except ValueError as e:
        raise HTTPException(422, str(e))
    if data.source not in ("web_form", "missed_call", "ad_feed"):
        raise HTTPException(422, "Unknown source")
    if data.mode not in ("auto", "interactive", "voice"):
        raise HTTPException(422, "Unknown mode")
    ph = security.phone_hash(phone)
    dup = db.one("SELECT id, status FROM leads WHERE phone_hash = ? AND created_at > ? AND status NOT IN ('CLOSED','BLOCKED') "
                 "ORDER BY created_at DESC LIMIT 1", (ph, time.time() - 30 * 86400))
    if dup:
        tools.log_action(dup["id"], "dedupe", {"source": data.source}, {"duplicate_of": dup["id"]}, "warn", "ingestion")
        return {"duplicate": True, "lead_id": dup["id"], "status": dup["status"]}
    lid = _next_id()
    persona = agent.PERSONAS.get(data.persona or "") if data.mode == "auto" else None
    language = data.language if data.language in ("hi", "en", "mr") else "hi"
    if persona:
        language = persona["lang"]
    now = time.time()
    db.ex("INSERT INTO leads(id, name, business_name, phone_hash, phone_enc, phone_masked, source, interest, created_at, consent, "
          "language, status, simulated, updated_at, created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          (lid, data.name.strip(), (data.business_name or "").strip() or None, ph, security.encrypt(phone), security.mask(phone),
           data.source, data.interest, now, 1 if data.consent else 0, language, "NEW", 0, now, (user or {}).get("id")))
    tools.consent_event(lid, "consent_captured" if data.consent else "consent_missing", f"Source: {data.source}")
    tools.log_action(lid, "ingest_lead", {"source": data.source, "phone": security.mask(phone), "interest": data.interest},
                     {"lead_id": lid, "phone_hash": ph[:12] + "…", "encrypted": True, "queued": True}, "ok",
                     auth.actor_label(user) if user else "ingestion")
    if data.pincode and data.pincode.strip():
        tools.save_profile(lid, {"pincode": data.pincode.strip()})
    bus.publish("lead_created", {"id": lid, "name": data.name, "source": data.source, "created_by": (user or {}).get("id")})
    if start:
        agent.start_session(tools.lead(lid), data.mode, data.persona, audio=data.audio)
    return {"duplicate": False, "lead_id": lid}


def _lead_row(L: dict) -> dict:
    L = dict(L)
    L.pop("phone_enc", None)
    L.pop("phone_hash", None)
    return L


def _lead_or_404(lead_id: str) -> dict:
    L = tools.lead(lead_id)
    if not L:
        raise HTTPException(404, "Lead not found")
    return L


# --------------------------------------------------------------------------- auth
@app.post("/api/auth/login")
async def login(data: LoginIn):
    res = auth.login(data.email, data.password)
    tools.log_action(None, "sign_in", {"email": res["user"]["email"]}, {"role": res["user"]["role"]}, "ok", auth.actor_label(res["user"]))
    return res


@app.post("/api/auth/logout")
async def logout(request: Request):
    h = request.headers.get("authorization", "")
    auth.logout(h[7:] if h.lower().startswith("bearer ") else "")
    return {"ok": True}


@app.get("/api/auth/me")
async def me(request: Request):
    return auth.public(auth.current(request))


@app.get("/api/auth/directory")
async def directory():
    """Demo sign-in directory (no passwords)."""
    return [{"email": e, "name": u["name"], "role": u["role"], "title": u["title"], "rep_id": u.get("rep_id")} for e, u in auth.USERS.items()]


# --------------------------------------------------------------------------- general
@app.get("/api/health")
async def health():
    return {"ok": True, "ts": time.time(), "sarvam": sarvam.enabled()}


@app.get("/api/meta")
async def meta(request: Request):
    auth.current(request)
    return {
        "personas": [{"key": k, "label": v["label"], "desc": v["desc"], "lang": v["lang"]} for k, v in agent.PERSONAS.items()],
        "shop_types": rules.SHOP_TYPES, "sales_bands": rules.SALES_BANDS, "setups": rules.SETUPS,
        "devices": rules.DEVICES, "rules": [{"id": r["id"], "desc": r["desc"]} for r in rules.RULES],
        "modifiers": [{"id": m["id"], "desc": m["desc"]} for m in rules.MODIFIERS],
        "areas": {k: {"area": v[0], "lat": v[1], "lng": v[2]} for k, v in rules.AREAS.items()},
        "outskirts": {k: {"area": v[0], "lat": v[1], "lng": v[2]} for k, v in rules.OUTSKIRTS.items()},
        "templates": tools.TEMPLATES, "leakage_rules": leakage.RULES, "states": agent.STATES,
        "sarvam": {"enabled": sarvam.enabled(), "chat": sarvam.CHAT_MODEL, "tts": sarvam.TTS_MODEL, "stt": sarvam.STT_MODEL},
        "permissions": auth.PERMS and {k: sorted(v) for k, v in auth.PERMS.items()},
    }


# --------------------------------------------------------------------------- leads
@app.post("/api/leads")
async def post_lead(data: LeadIn, request: Request):
    u = auth.require(request, "leads:create")
    if data.mode == "auto" and not auth.can(u, "sim:run"):
        data.mode = "voice"
    return create_lead(data, u)


@app.get("/api/leads")
async def list_leads(request: Request, status: str | None = None, q: str | None = None, temperature: str | None = None, limit: int = 500):
    u = auth.current(request)
    sql = ("SELECT l.*, p.shop_type, p.area, p.pincode, p.daily_sales_band, p.current_setup, r.device FROM leads l "
           "LEFT JOIN merchant_profiles p ON p.lead_id = l.id LEFT JOIN recommendations r ON r.lead_id = l.id WHERE 1=1")
    args = []
    if not auth.can(u, "leads:read_all"):
        own = sorted(auth.rep_lead_ids(u)) or ["__none__"]
        sql += f" AND l.id IN ({','.join('?' * len(own))})"
        args += own
    if status:
        sql += " AND l.status = ?"
        args.append(status)
    if temperature:
        sql += " AND l.temperature = ?"
        args.append(temperature)
    if q:
        sql += " AND (l.name LIKE ? OR l.business_name LIKE ? OR l.id LIKE ? OR p.area LIKE ?)"
        args += [f"%{q}%"] * 4
    sql += " ORDER BY l.created_at DESC LIMIT ?"
    args.append(min(limit, 2000))
    live = {k for k, s in agent.SESSIONS.items() if not s.ended}
    return [_lead_row(r) | {"live": r["id"] in live} for r in db.q(sql, args)]


@app.get("/api/leads/{lead_id}")
async def get_lead(lead_id: str, request: Request):
    u = auth.current(request)
    L = _lead_or_404(lead_id)
    auth.assert_lead_access(u, lead_id)
    staff = auth.can(u, "audit:read")
    return {
        "lead": _lead_row(L),
        "profile": tools.profile(lead_id),
        "recommendation": db.one("SELECT * FROM recommendations WHERE lead_id = ?", (lead_id,)),
        "interactions": db.q("SELECT * FROM interactions WHERE lead_id = ? ORDER BY id DESC", (lead_id,)),
        "visits": [dict(v, slot_label=rules.slot_label(v["slot_start"])) for v in
                   db.q("SELECT v.*, a.name AS rep_name FROM visits v JOIN field_agents a ON a.id = v.agent_id WHERE lead_id = ? ORDER BY created_at DESC", (lead_id,))],
        "actions": db.q("SELECT * FROM agent_actions WHERE lead_id = ? ORDER BY ts ASC, id ASC", (lead_id,)) if staff else [],
        "consent_log": db.q("SELECT * FROM consent_log WHERE lead_id = ? ORDER BY ts", (lead_id,)),
        "flags": db.q("SELECT * FROM leakage_flags WHERE lead_id = ? ORDER BY ts DESC", (lead_id,)) if staff else [],
        "handoffs": db.q("SELECT * FROM handoffs WHERE lead_id = ? ORDER BY ts DESC", (lead_id,)) if staff else [],
        "messages": db.q("SELECT * FROM messages WHERE lead_id = ? ORDER BY ts", (lead_id,)),
        "live": lead_id in agent.SESSIONS and not agent.SESSIONS[lead_id].ended,
    }


def _session_for(lead_id: str, u: dict):
    _lead_or_404(lead_id)
    auth.assert_lead_access(u, lead_id)
    return agent.SESSIONS.get(lead_id)


@app.post("/api/leads/{lead_id}/reply")
async def reply(lead_id: str, data: ReplyIn, request: Request):
    u = auth.require(request, "agent:control")
    s = _session_for(lead_id, u)
    if not s or s.ended:
        raise HTTPException(409, "No live session for this lead")
    if s.mode not in ("interactive", "voice"):
        raise HTTPException(409, "This session is driven by a simulated merchant")
    await s.inbox.put((data.text, None, {"via": "text"}))
    return {"ok": True}


@app.post("/api/leads/{lead_id}/start")
async def start(lead_id: str, data: StartIn, request: Request):
    u = auth.require(request, "agent:control")
    _session_for(lead_id, u)
    if data.mode == "auto" and not auth.can(u, "sim:run"):
        raise HTTPException(403, "Simulated merchants are for managers and admins")
    L = tools.lead(lead_id)
    if L["opted_out"]:
        raise HTTPException(409, "Merchant opted out — contact is blocked")
    p = tools.profile(lead_id)
    complete = all(p.get(k) for k in ("shop_type", "daily_sales_band", "current_setup", "pincode"))
    agent.start_session(L, data.mode, data.persona, callback=complete, audio=data.audio)
    return {"ok": True}


@app.post("/api/leads/{lead_id}/stop")
async def stop(lead_id: str, request: Request):
    u = auth.require(request, "agent:control")
    s = _session_for(lead_id, u)
    if s and not s.ended and s.task:
        s.answer(False)
        s.task.cancel()
    return {"ok": True}


@app.post("/api/leads/{lead_id}/optout")
async def optout(lead_id: str, request: Request):
    u = auth.require(request, "leads:optout")
    s = _session_for(lead_id, u)
    if s and not s.ended and s.task:
        s.task.cancel()
    return tools.opt_out(lead_id, source=auth.actor_label(u))


@app.post("/api/leads/{lead_id}/reveal-phone")
async def reveal(lead_id: str, request: Request):
    u = auth.current(request)
    _lead_or_404(lead_id)
    return tools.reveal_phone(lead_id, u["role"])


@app.post("/api/leads/{lead_id}/activate")
async def activate(lead_id: str, request: Request):
    u = auth.require(request, "visits:outcome")
    _session_for(lead_id, u)
    return vmod.activate(lead_id)


# --------------------------------------------------------------------------- sessions & voice
@app.get("/api/sessions")
async def sessions(request: Request):
    u = auth.current(request)
    own = None if auth.can(u, "leads:read_all") else auth.rep_lead_ids(u)
    out = []
    for lid, s in sorted(agent.SESSIONS.items(), key=lambda kv: -kv[1].started_at):
        if own is not None and lid not in own:
            continue
        out.append({"lead_id": lid, "name": s.lead_name, "state": s.state, "channel": s.channel, "mode": s.mode,
                    "persona_label": s.snapshot()["persona_label"], "audio": s.audio,
                    "ended": s.ended, "outcome": s.outcome, "started_at": s.started_at, "activity": s.activity})
    return out


@app.get("/api/sessions/{lead_id}")
async def session(lead_id: str, request: Request):
    u = auth.current(request)
    s = _session_for(lead_id, u)
    if s:
        return s.snapshot()
    snap = agent.stored_snapshot(lead_id)
    if not snap:
        raise HTTPException(404, "Lead not found")
    return snap


@app.get("/api/voice/status")
async def voice_status(request: Request):
    auth.current(request)
    return await sarvam.ping()


@app.post("/api/voice/{lead_id}/answer")
async def voice_answer(lead_id: str, data: AnswerIn, request: Request):
    u = auth.require(request, "agent:control")
    s = _session_for(lead_id, u)
    if not s or s.ended:
        raise HTTPException(409, "This call has already ended")
    s.answer(data.answer)
    return {"ok": True}


@app.post("/api/voice/{lead_id}/utterance")
async def voice_utterance(lead_id: str, request: Request, file: UploadFile = File(...)):
    u = auth.require(request, "agent:control")
    s = _session_for(lead_id, u)
    if not s or s.ended:
        raise HTTPException(409, "No live call for this lead")
    if s.mode != "voice":
        raise HTTPException(409, "This session is not a voice call")
    data = await file.read()
    if len(data) < 2000:
        return {"ok": False, "reason": "too_short"}
    t0 = time.perf_counter()
    res = await sarvam.stt(data, file.filename or "speech.wav", file.content_type or "audio/wav")
    if not res:
        raise HTTPException(502, "Speech recognition failed — check the Sarvam key or type your reply")
    text = res["transcript"]
    tools.log_action(lead_id, "sarvam_stt", {"bytes": len(data), "model": sarvam.STT_MODEL},
                     {"transcript": text, "language": res["language_code"]}, "ok" if text else "warn", "agent", t0)
    if not text:
        return {"ok": False, "reason": "no_speech"}
    en = None
    if not res["language_code"].startswith("en"):
        en = await sarvam.translate(text, res["language_code"] if res["language_code"] != "unknown" else "hi-IN")
    await s.inbox.put((text, en, {"via": "voice", "stt_lang": res["language_code"]}))
    return {"ok": True, "transcript": text, "en": en, "language": res["language_code"]}


@app.post("/api/voice/tts")
async def voice_tts(data: TtsIn, request: Request):
    auth.current(request)
    res = await sarvam.tts(data.text, data.lang)
    if not res:
        raise HTTPException(503, "Text-to-speech unavailable")
    return {"audio": res[0], "duration": res[1]}


@app.get("/api/voice/audio/{audio_id}")
async def voice_audio(audio_id: str):
    wav = sarvam.get_audio(audio_id)
    if not wav:
        raise HTTPException(404, "Audio expired")
    return Response(wav, media_type="audio/wav", headers={"Cache-Control": "max-age=3600"})


# --------------------------------------------------------------------------- AI assistant (Sarvam LLM)
@app.post("/api/assistant")
async def assistant(data: AskIn, request: Request):
    u = auth.require(request, "assistant:ask")
    ov = metrics.overview()
    ctx = {k: ov[k] for k in ("kpis", "comparison", "lost_reasons", "sources", "funnel")}
    ctx["top_reps"] = sorted(ov["rep_performance"], key=lambda r: -r["conversion"])[:5]
    t0 = time.perf_counter()
    ans = await sarvam.chat([
        {"role": "system", "content": "You are LeadPilot's analytics assistant for a Paytm sales manager in Pune. Answer in at most 3 short "
                                      "sentences using ONLY the JSON metrics provided. All data is simulated. Use plain text, no markdown."},
        {"role": "user", "content": f"Metrics JSON: {json.dumps(ctx, default=str)[:6000]}\n\nQuestion: {data.question}"},
    ], max_tokens=220, temperature=0.3)
    tools.log_action(None, "sarvam_assistant", {"question": data.question}, {"answered": bool(ans)}, "ok" if ans else "warn",
                     auth.actor_label(u), t0)
    if not ans:
        raise HTTPException(503, "Assistant unavailable")
    return {"answer": ans, "model": sarvam.CHAT_MODEL}


# --------------------------------------------------------------------------- simulated sources
@app.post("/api/webhooks/missed-call")
async def missed_call(data: MissedCallIn, request: Request):
    u = auth.require(request, "sim:run")
    personas = ["rakesh_kirana", "sunita_tea", "meena_whatsapp", "vikas_competitor"]
    return create_lead(LeadIn(name=data.name or "Missed-call merchant", phone=data.phone, source="missed_call",
                              mode="auto", persona=random.choice(personas), audio=False), u)


@app.post("/api/webhooks/ad-lead")
async def ad_lead(data: LeadIn, request: Request):
    u = auth.require(request, "sim:run")
    data.source = "ad_feed"
    return create_lead(data, u)


@app.post("/api/webhooks/telephony")
async def telephony(payload: dict, request: Request):
    auth.require(request, "sim:run")
    tools.log_action(payload.get("lead_id"), "telephony_webhook", payload, {"ack": True}, "ok", "telephony")
    return {"ack": True}


@app.post("/api/simulate/burst")
async def burst(data: BurstIn, request: Request):
    u = auth.require(request, "sim:run")
    names = ["Ganesh Pawar", "Lata Kale", "Farhan Shaikh", "Swati Joshi", "Mahesh More", "Ayesha Khan", "Nitin Chavan",
             "Deepa Salunkhe", "Ajay Yadav", "Kavita Mane"]
    personas = ["sunita_tea", "rakesh_kirana", "priya_restaurant", "meena_whatsapp", "vikas_competitor", "anil_chain",
                "voice_fail", "optout_raj", "never_answers"]
    out = []
    for i in range(data.count):
        phone = random.choice("6789") + "".join(random.choice("0123456789") for _ in range(9))
        out.append(create_lead(LeadIn(name=random.choice(names), phone=phone, source=random.choice(["ad_feed", "web_form", "missed_call"]),
                                      mode="auto", audio=False, persona=personas[(i + random.randint(0, 8)) % len(personas)]), u))
        await asyncio.sleep(0.15)
    return out


# --------------------------------------------------------------------------- field ops
@app.get("/api/reps")
async def reps(request: Request):
    auth.current(request)
    now = time.time()
    out = []
    for r in tools.reps():
        up = db.q("SELECT slot_start FROM visits WHERE agent_id = ? AND status IN ('BOOKED','CONFIRMED') AND slot_start >= ?", (r["id"], now - 3600))
        out.append(r | {"upcoming": len(up), "next_24h": sum(1 for v in up if v["slot_start"] < now + 86400)})
    return out


@app.get("/api/visits")
async def list_visits(request: Request, days_back: int = 1, days_fwd: int = 3):
    u = auth.current(request)
    rows = vmod.listing(days_back, days_fwd)
    if not auth.can(u, "visits:read_all"):
        rows = [v for v in rows if v["agent_id"] == u.get("rep_id")]
    return rows


@app.get("/api/me/day")
async def my_day(request: Request):
    u = auth.current(request)
    if u["role"] != "rep":
        raise HTTPException(403, "My Day is the field rep view")
    rows = [v for v in vmod.listing(1, 3) if v["agent_id"] == u["rep_id"]]
    rep = db.one("SELECT * FROM field_agents WHERE id = ?", (u["rep_id"],))
    done = db.q("SELECT outcome, wasted FROM visits WHERE agent_id = ? AND status = 'COMPLETED'", (u["rep_id"],))
    conv = sum(1 for v in done if v["outcome"] == "converted")
    return {"rep": rep, "visits": rows,
            "stats": {"completed": len(done), "converted": conv, "conversion": round(100 * conv / max(1, len(done)), 1),
                      "wasted": sum(v["wasted"] for v in done),
                      "upcoming": sum(1 for v in rows if v["status"] in ("BOOKED", "CONFIRMED") and v["slot_start"] >= time.time() - 3600)}}


@app.post("/api/visits")
async def post_visit(data: VisitIn, request: Request):
    u = auth.require(request, "visits:book")
    res = tools.book_visit(data.lead_id, data.rep_id, data.slot_start, actor=auth.actor_label(u))
    if not res.get("booked"):
        raise HTTPException(409, res.get("blocked_by", "Could not book"))
    tools.set_lead(data.lead_id, status="CONFIRMED")
    return res


def _visit_or_404(visit_id: str, u: dict) -> dict:
    v = db.one("SELECT * FROM visits WHERE id = ?", (visit_id,))
    if not v:
        raise HTTPException(404, "Visit not found")
    auth.assert_visit_access(u, v)
    return v


@app.patch("/api/visits/{visit_id}")
async def patch_visit(visit_id: str, data: OutcomeIn, request: Request):
    u = auth.require(request, "visits:outcome")
    _visit_or_404(visit_id, u)
    if data.outcome not in ("converted", "rejected", "revisit"):
        raise HTTPException(422, "Outcome must be converted, rejected or revisit")
    res = vmod.set_outcome(visit_id, data.outcome, data.reason, actor=auth.actor_label(u))
    if not res["ok"]:
        raise HTTPException(404, res["error"])
    return res


@app.post("/api/visits/{visit_id}/reschedule")
async def resched(visit_id: str, data: RescheduleIn, request: Request):
    u = auth.require(request, "visits:reschedule")
    _visit_or_404(visit_id, u)
    res = vmod.reschedule(visit_id, data.reason, actor=auth.actor_label(u))
    if not res["ok"]:
        raise HTTPException(409, res["error"])
    return res


# --------------------------------------------------------------------------- leakage, handoffs, audit
@app.get("/api/leakage")
async def flags(request: Request, status: str = "open"):
    auth.require(request, "leakage:read")
    return db.q("SELECT f.*, l.name, l.business_name, l.score, l.temperature, l.status AS lead_status FROM leakage_flags f "
                "JOIN leads l ON l.id = f.lead_id WHERE f.status = ? ORDER BY CASE f.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, f.ts DESC",
                (status,))


@app.post("/api/leakage/scan")
async def scan_now(request: Request):
    auth.require(request, "leakage:recover")
    return {"created": leakage.scan()}


@app.post("/api/leakage/{flag_id}/recover")
async def recover(flag_id: int, request: Request):
    auth.require(request, "leakage:recover")
    res = leakage.recover(flag_id)
    if not res.get("ok"):
        raise HTTPException(409, res.get("error"))
    return res


@app.get("/api/handoffs")
async def handoffs(request: Request, status: str | None = None):
    auth.require(request, "handoffs:read")
    sql = "SELECT h.*, l.name, l.business_name, l.score, l.language FROM handoffs h JOIN leads l ON l.id = h.lead_id"
    args = []
    if status:
        sql += " WHERE h.status = ?"
        args.append(status)
    return db.q(sql + " ORDER BY h.ts DESC LIMIT 100", args)


@app.patch("/api/handoffs/{hid}")
async def patch_handoff(hid: int, data: HandoffPatch, request: Request):
    u = auth.require(request, "handoffs:resolve")
    h = db.one("SELECT * FROM handoffs WHERE id = ?", (hid,))
    if not h:
        raise HTTPException(404, "Handoff not found")
    db.update("handoffs", "id", hid, {"status": data.status})
    tools.log_action(h["lead_id"], "resolve_handoff", {"handoff_id": hid}, {"status": data.status}, "ok", auth.actor_label(u))
    bus.publish("handoff", {"lead_id": h["lead_id"], "status": data.status})
    return {"ok": True}


@app.get("/api/audit")
async def audit(request: Request, lead_id: str | None = None, tool: str | None = None, actor: str | None = None, limit: int = 300):
    auth.require(request, "audit:read")
    sql = "SELECT * FROM agent_actions WHERE 1=1"
    args = []
    if lead_id:
        sql += " AND lead_id = ?"
        args.append(lead_id)
    if tool:
        sql += " AND tool = ?"
        args.append(tool)
    if actor:
        sql += " AND actor LIKE ?"
        args.append(f"{actor}%")
    sql += " ORDER BY ts DESC, id DESC LIMIT ?"
    args.append(min(limit, 2000))
    return db.q(sql, args)


@app.get("/api/audit/tools")
async def audit_tools(request: Request):
    auth.require(request, "audit:read")
    return db.q("SELECT tool, COUNT(*) AS n FROM agent_actions GROUP BY tool ORDER BY n DESC")


@app.get("/api/messages")
async def messages(request: Request, limit: int = 50):
    auth.require(request, "audit:read")
    return db.q("SELECT m.*, l.name FROM messages m LEFT JOIN leads l ON l.id = m.lead_id ORDER BY m.ts DESC LIMIT ?", (limit,))


# --------------------------------------------------------------------------- metrics
@app.get("/api/metrics/overview")
async def m_overview(request: Request):
    auth.require(request, "metrics:read")
    return metrics.overview()


@app.get("/api/metrics/funnel")
async def m_funnel(request: Request):
    auth.require(request, "metrics:read")
    return metrics.overview()["funnel"]


@app.get("/api/metrics/first-contact")
async def m_ttfc(request: Request):
    auth.require(request, "metrics:read")
    return metrics.first_contact()


# --------------------------------------------------------------------------- settings / admin
@app.get("/api/settings")
async def get_settings(request: Request):
    auth.require(request, "settings:read")
    return tools.get_settings()


@app.put("/api/settings")
async def put_settings(patch: dict, request: Request):
    u = auth.require(request, "settings:write")
    s = tools.put_settings(patch)
    tools.log_action(None, "update_settings", patch, {"saved": True}, "ok", auth.actor_label(u))
    return s


@app.get("/api/consent")
async def consent_log(request: Request, limit: int = 100):
    auth.require(request, "settings:read")
    return db.q("SELECT c.*, l.name FROM consent_log c LEFT JOIN leads l ON l.id = c.lead_id ORDER BY c.ts DESC LIMIT ?", (limit,))


@app.post("/api/admin/reset")
async def reset(request: Request):
    auth.require(request, "admin:reset")
    for s in list(agent.SESSIONS.values()):
        if s.task and not s.ended:
            s.task.cancel()
    agent.SESSIONS.clear()
    await asyncio.sleep(0.2)
    db.reset()
    seed.ensure_seeded()
    leakage.scan()
    bus.publish("reset", {})
    return {"ok": True}


# --------------------------------------------------------------------------- SSE (token via query string; reps get only their leads)
@app.get("/api/events")
async def events(request: Request, token: str = ""):
    u = auth.from_token(token)
    if not u:
        raise HTTPException(401, "Sign in required")
    q = bus.subscribe()
    is_rep = u["role"] == "rep"

    async def gen():
        own, own_ts = set(), 0.0
        try:
            yield "retry: 2000\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue
                d = ev["data"]
                if is_rep:
                    lid = d.get("lead_id") or d.get("id")
                    if ev["type"] in ("flag", "flags_changed", "handoff"):
                        continue
                    if lid and ev["type"] != "reset":
                        if time.time() - own_ts > 1.5 or lid not in own:
                            own, own_ts = auth.rep_lead_ids(u), time.time()
                        if lid not in own and d.get("created_by") != u["id"]:
                            continue
                yield f"event: {ev['type']}\ndata: {json.dumps(d, default=str, ensure_ascii=False)}\n\n"
        finally:
            bus.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})


# --------------------------------------------------------------------------- static frontend (production build)
if os.path.isdir(DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")

    @app.get("/{path:path}")
    async def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        f = os.path.join(DIST, path)
        if path and os.path.isfile(f):
            return FileResponse(f)
        return FileResponse(os.path.join(DIST, "index.html"))
