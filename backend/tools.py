"""Deterministic tool layer the agent calls. Every call is guardrail-checked, logged to agent_actions
with input/output/duration, and streamed to the dashboard."""
import time
import uuid
from datetime import datetime

import bus
import db
import rules
import security

DEFAULT_SETTINGS = {
    "enforce_calling_hours": True,
    "calling_hours": [9, 21],
    "max_attempts_per_day": 3,
    "contact_window_sec": 60,
    "hot_threshold": 70,
    "hot_unvisited_hours": 24,
    "max_reschedules": 2,
    "confirm_window_hours": 2,
    "retry_delay_demo_sec": 10,
    "coverage_radius_km": 12,
    "auto_recover": False,
    "alloc_weights": {"distance": 0.4, "earliest": 0.25, "skill": 0.2, "workload": 0.15},
}

TEMPLATES = {
    "TPL_MISSED_CALL": {"channel": "whatsapp", "to": "merchant",
                        "body": "Namaste {name}, Paytm here. We just tried calling about your {interest} enquiry. Reply YES to continue on WhatsApp, or tell us a good time to call."},
    "TPL_CHAT_LINK": {"channel": "sms", "to": "merchant",
                      "body": "Hi {name}, our call didn't connect. Continue your Paytm {interest} enquiry in chat: paytm.me/lp/{lead_id}"},
    "TPL_VISIT_CONFIRM": {"channel": "whatsapp", "to": "merchant",
                          "body": "Confirmed: {rep} from Paytm will visit {business} on {slot} for a free {device} demo. Reply R to reschedule."},
    "TPL_REP_BRIEFING": {"channel": "rep_app", "to": "rep",
                         "body": "New visit {visit_id}: {name} ({business}), {area}, {slot}. Recommended: {device}. Score {score}. Briefing attached."},
    "TPL_INFO_BROCHURE": {"channel": "whatsapp", "to": "merchant",
                          "body": "Hi {name}, here are the details of {device} ({plan}, {price}). Reply VISIT anytime to book a free demo."},
    "TPL_HANDOFF_ALERT": {"channel": "manager_app", "to": "manager",
                          "body": "Handoff {lead_id}: {reason}. Summary: {summary}"},
    "TPL_RESCHEDULE": {"channel": "whatsapp", "to": "merchant",
                       "body": "Update: your Paytm demo visit is now on {slot} with {rep}. Sorry for the change."},
    "TPL_MANAGER_ALERT": {"channel": "manager_app", "to": "manager",
                          "body": "Leakage alert on {lead_id}: {title}."},
    "TPL_RETRY_FINAL": {"channel": "sms", "to": "merchant",
                        "body": "Hi {name}, we couldn't reach you about Paytm {interest}. Give a missed call on 080-4XXX-XXXX whenever convenient."},
    "TPL_CALLBACK_LATER": {"channel": "whatsapp", "to": "merchant",
                           "body": "No problem {name}! We'll call you back later today about Paytm {interest}."},
}


# --------------------------------------------------------------------------- settings

def get_settings() -> dict:
    s = dict(DEFAULT_SETTINGS)
    for row in db.q("SELECT key, value FROM settings"):
        s[row["key"]] = row["value"]
    return s


def put_settings(patch: dict) -> dict:
    for k, v in patch.items():
        if k in DEFAULT_SETTINGS:
            db.ex("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (k, v))
    return get_settings()


# --------------------------------------------------------------------------- logging

def log_action(lead_id, tool, inp, out, status="ok", actor="agent", started=None, ts=None):
    ts = ts or time.time()
    dur = round((time.perf_counter() - started) * 1000, 2) if started else None
    aid = db.ex(
        "INSERT INTO agent_actions(lead_id, tool, input, output, status, actor, duration_ms, ts) VALUES(?,?,?,?,?,?,?,?)",
        (lead_id, tool, inp, out, status, actor, dur, ts))
    bus.publish("action", {"id": aid, "lead_id": lead_id, "tool": tool, "input": inp, "output": out,
                           "status": status, "actor": actor, "duration_ms": dur, "ts": ts})
    return aid


def set_lead(lead_id, **fields):
    fields["updated_at"] = time.time()
    db.update("leads", "id", lead_id, fields)
    bus.publish("lead", {"id": lead_id, **{k: v for k, v in fields.items() if k not in ("phone_enc",)}})


def lead(lead_id) -> dict | None:
    return db.one("SELECT * FROM leads WHERE id = ?", (lead_id,))


def profile(lead_id) -> dict:
    return db.one("SELECT * FROM merchant_profiles WHERE lead_id = ?", (lead_id,)) or {}


def reps() -> list[dict]:
    return db.q("SELECT * FROM field_agents ORDER BY id")


def consent_event(lead_id, event, detail=""):
    db.ex("INSERT INTO consent_log(lead_id, event, detail, ts) VALUES(?,?,?,?)", (lead_id, event, detail, time.time()))


# --------------------------------------------------------------------------- tools

def check_consent(lead_id: str, actor="agent") -> dict:
    t0 = time.perf_counter()
    L = lead(lead_id)
    s = get_settings()
    hour = datetime.now().hour
    in_hours = s["calling_hours"][0] <= hour < s["calling_hours"][1]
    dnc = db.one("SELECT 1 FROM dnc_list WHERE phone_hash = ?", (L["phone_hash"],)) is not None
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    attempts_today = db.scalar(
        "SELECT COUNT(*) FROM agent_actions WHERE lead_id = ? AND tool = 'place_call' AND ts >= ?", (lead_id, today_start)) or 0
    checks = {
        "consent_on_record": bool(L["consent"]),
        "not_on_dnc": not dnc,
        "not_opted_out": not L["opted_out"],
        "within_calling_hours": in_hours or not s["enforce_calling_hours"],
        "attempts_today": f"{attempts_today}/{s['max_attempts_per_day']}",
    }
    reason = "All checks passed"
    allowed = True
    if not checks["consent_on_record"]:
        allowed, reason = False, "No consent on record"
    elif not checks["not_on_dnc"]:
        allowed, reason = False, "Number is on the do-not-call list"
    elif not checks["not_opted_out"]:
        allowed, reason = False, "Merchant opted out"
    elif not checks["within_calling_hours"]:
        allowed, reason = False, f"Outside permitted calling hours ({s['calling_hours'][0]}:00–{s['calling_hours'][1]}:00)"
    elif attempts_today >= s["max_attempts_per_day"]:
        allowed, reason = False, "Daily attempt cap reached"
    out = {"allowed": allowed, "reason": reason, "checks": checks}
    consent_event(lead_id, "consent_check_passed" if allowed else "contact_blocked", reason)
    log_action(lead_id, "check_consent", {"lead_id": lead_id}, out, "ok" if allowed else "blocked", actor, t0)
    return out


def place_call(lead_id: str, outcome: str, channel="voice") -> dict:
    t0 = time.perf_counter()
    L = lead(lead_id)
    now = time.time()
    attempt = (L["attempts"] or 0) + 1
    fields = {"attempts": attempt, "last_attempt_at": now, "channel": channel}
    if not L["first_contact_at"]:
        fields["first_contact_at"] = now
    set_lead(lead_id, **fields)
    out = {"call_id": "CALL-" + uuid.uuid4().hex[:8].upper(), "provider": "sim-telephony", "attempt": attempt,
           "outcome": outcome, "dialled": L["phone_masked"], "disclosure": "automated assistant + recording notice",
           "ttfc_sec": round(now - L["created_at"], 1) if not L["first_contact_at"] else None}
    log_action(lead_id, "place_call", {"lead_id": lead_id, "channel": channel}, out,
               "ok" if outcome == "answered" else "warn", "agent", t0)
    return out


def send_message(lead_id: str, template_id: str, vars: dict | None = None, actor="agent") -> dict:
    t0 = time.perf_counter()
    tpl = TEMPLATES.get(template_id)
    if not tpl:
        out = {"sent": False, "blocked_by": "guardrail: template not on approved list"}
        log_action(lead_id, "send_message", {"template_id": template_id}, out, "blocked", actor, t0)
        return out
    L = lead(lead_id) or {}
    v = {"name": (L.get("name") or "").split(" ")[0], "interest": rules.INTEREST_LABEL.get(L.get("interest"), "Soundbox"),
         "lead_id": lead_id, "business": L.get("business_name") or "your shop"}
    v.update(vars or {})

    class _D(dict):
        def __missing__(self, k):
            return "—"
    body = tpl["body"].format_map(_D(v))
    if tpl["to"] == "merchant" and L.get("opted_out"):
        out = {"sent": False, "blocked_by": "guardrail: merchant opted out"}
        log_action(lead_id, "send_message", {"template_id": template_id}, out, "blocked", actor, t0)
        return out
    recipient = L.get("phone_masked") if tpl["to"] == "merchant" else v.get("rep", tpl["to"])
    mid = db.ex("INSERT INTO messages(lead_id, channel, template_id, recipient, body, direction, ts) VALUES(?,?,?,?,?,?,?)",
                (lead_id, tpl["channel"], template_id, recipient, body, "out", time.time()))
    out = {"message_id": mid, "status": "delivered", "channel": tpl["channel"], "to": recipient, "preview": body}
    log_action(lead_id, "send_message", {"template_id": template_id, "channel": tpl["channel"]}, out, "ok", actor, t0)
    bus.publish("message", {"lead_id": lead_id, **out, "template_id": template_id})
    return out


def save_profile(lead_id: str, fields: dict) -> dict:
    t0 = time.perf_counter()
    fields = {k: v for k, v in fields.items() if v is not None}
    if "daily_sales_value" in fields:
        fields["daily_sales_band"] = rules.sales_band(fields["daily_sales_value"])
    if "pincode" in fields:
        loc = rules.locate(fields["pincode"])
        if loc:
            fields.update({"area": loc["area"], "lat": loc["lat"], "lng": loc["lng"]})
    existing = db.one("SELECT lead_id FROM merchant_profiles WHERE lead_id = ?", (lead_id,))
    if not existing:
        db.ex("INSERT INTO merchant_profiles(lead_id) VALUES(?)", (lead_id,))
    db.update("merchant_profiles", "lead_id", lead_id, fields)
    log_action(lead_id, "save_profile", {"lead_id": lead_id, "fields": fields}, {"saved": list(fields.keys())}, "ok", "agent", t0)
    bus.publish("profile", {"lead_id": lead_id, **profile(lead_id)})
    return profile(lead_id)


def recommend_device(lead_id: str) -> dict:
    t0 = time.perf_counter()
    p = dict(profile(lead_id))
    p["language"] = (lead(lead_id) or {}).get("language")
    rec = rules.recommend(p)
    db.ex("INSERT INTO recommendations(lead_id, device, plan, price, reason, rule_ids) VALUES(?,?,?,?,?,?) "
          "ON CONFLICT(lead_id) DO UPDATE SET device=excluded.device, plan=excluded.plan, price=excluded.price, "
          "reason=excluded.reason, rule_ids=excluded.rule_ids",
          (lead_id, rec["device"], rec["plan"], rec["price"], rec["reason"], rec["rule_ids"]))
    log_action(lead_id, "recommend_device",
               {k: p.get(k) for k in ("shop_type", "daily_sales_band", "current_setup", "outlets")}, rec, "ok", "agent", t0)
    return rec


def score_lead(lead_id: str, answered=True) -> dict:
    t0 = time.perf_counter()
    res = rules.score(lead(lead_id), profile(lead_id), answered)
    set_lead(lead_id, score=res["score"], temperature=res["temperature"], score_factors=res["factors"])
    log_action(lead_id, "score_lead", {"lead_id": lead_id}, res, "ok", "agent", t0)
    return res


def find_slots(lead_id: str, exclude: set | None = None, actor="agent") -> dict:
    t0 = time.perf_counter()
    p = profile(lead_id)
    s = get_settings()
    loc = rules.locate(p.get("pincode"))
    rec = db.one("SELECT * FROM recommendations WHERE lead_id = ?", (lead_id,))
    skill = "soundbox"
    for k, d in rules.DEVICES.items():
        if rec and d["device"] == rec["device"]:
            skill = d["skill"]
    if not loc or not loc["covered"] or loc["lat"] is None:
        out = {"options": [], "rejected": [], "reason": "Pincode outside field coverage", "weights": s["alloc_weights"]}
    else:
        visits = db.q("SELECT agent_id, slot_start FROM visits WHERE status IN ('BOOKED','CONFIRMED') AND slot_start >= ?",
                      (time.time() - 3600,))
        out = rules.allocate(loc, skill, reps(), visits, s["alloc_weights"], s["coverage_radius_km"], exclude=exclude)
    log_action(lead_id, "find_slots", {"lead_id": lead_id, "skill": skill, "pincode": p.get("pincode"),
                                       "exclude": sorted(exclude) if exclude else []}, out, "ok", actor, t0)
    return out


def build_briefing(lead_id: str, rep_name: str, slot_label: str) -> dict:
    L, p = lead(lead_id), profile(lead_id)
    rec = db.one("SELECT * FROM recommendations WHERE lead_id = ?", (lead_id,)) or {}
    objections, points = [], []
    setup = p.get("current_setup")
    if setup == "cash_only":
        objections.append("Unsure about digital payments; worried about settlement delays")
        points.append("Show instant voice alert + same-day settlement on the demo unit")
    if setup == "competitor_soundbox":
        objections.append("Already has a competitor soundbox")
        points.append("Compare 4G reliability and Hindi alerts; no discounts — stick to rule-table pricing")
    if setup == "upi_qr":
        objections.append("Static QR already works — why pay rent?")
        points.append("Missed-payment risk during rush hour; audio confirmation stops fake screenshots")
    if setup == "card_machine":
        objections.append("Existing bank card machine is 'good enough'")
        points.append("Single device for cards + UPI with one settlement report")
    if p.get("daily_sales_band") == "low":
        objections.append("Monthly rental feels high for small daily sales")
        points.append(f"Lite plan at {rec.get('price', '—')} — cost per day is under ₹2")
    if p.get("asked_price"):
        points.append("Merchant asked about price — carry the printed plan sheet")
    if p.get("hesitation"):
        objections.append("Hesitant on call — may want family/partner present")
    if not objections:
        objections.append("Time to set up during business hours")
    points.append(f"Pitch {rec.get('device', 'Soundbox')}: {rec.get('reason', '')}")
    points.append("Free installation; KYC docs: PAN, Aadhaar, shop photo, bank account")
    shop = rules.SHOP_TYPES.get(p.get("shop_type"), {}).get("label", "Shop")
    return {
        "headline": f"{shop} in {p.get('area', '—')} · {rules.SALES_BANDS.get(p.get('daily_sales_band'), '—')}",
        "merchant": L["name"], "business": L.get("business_name"), "language": {"hi": "Hindi", "en": "English", "mr": "Marathi"}.get(L["language"], L["language"]),
        "score": L.get("score"), "temperature": L.get("temperature"),
        "current_setup": rules.SETUPS.get(setup, "—"),
        "recommendation": {"device": rec.get("device"), "plan": rec.get("plan"), "price": rec.get("price"), "rule_ids": rec.get("rule_ids")},
        "likely_objections": objections, "talking_points": points, "rep": rep_name, "slot": slot_label,
    }


def book_visit(lead_id: str, rep_id: str, slot_start: float, alloc: dict | None = None, actor="agent") -> dict:
    t0 = time.perf_counter()
    rep = db.one("SELECT * FROM field_agents WHERE id = ?", (rep_id,))
    clash = db.one("SELECT id FROM visits WHERE agent_id = ? AND slot_start = ? AND status IN ('BOOKED','CONFIRMED')",
                   (rep_id, slot_start))
    if clash or not rep:
        out = {"booked": False, "blocked_by": "guardrail: slot no longer free" if clash else "unknown rep"}
        log_action(lead_id, "book_visit", {"rep_id": rep_id, "slot_start": slot_start}, out, "blocked", actor, t0)
        return out
    p = profile(lead_id)
    dist = rules.haversine(p["lat"], p["lng"], rep["home_lat"], rep["home_lng"]) if p.get("lat") else None
    vid = "V-" + uuid.uuid4().hex[:6].upper()
    label = rules.slot_label(slot_start)
    briefing = build_briefing(lead_id, rep["name"], label)
    db.ex("INSERT INTO visits(id, lead_id, agent_id, slot_start, status, merchant_confirmed, distance_km, briefing, alloc, created_at) "
          "VALUES(?,?,?,?,?,?,?,?,?,?)",
          (vid, lead_id, rep_id, slot_start, "BOOKED", 1 if actor == "agent" else 0, round(dist, 1) if dist else None,
           briefing, alloc or {}, time.time()))
    out = {"booked": True, "visit_id": vid, "rep": rep["name"], "slot": label, "distance_km": round(dist, 1) if dist else None}
    log_action(lead_id, "book_visit", {"rep_id": rep_id, "slot_start": slot_start}, out, "ok", actor, t0)
    log_action(lead_id, "generate_briefing", {"visit_id": vid}, briefing, "ok", actor, time.perf_counter())
    bus.publish("visit", {"lead_id": lead_id, "visit_id": vid, "kind": "booked", "actor": actor})
    return {**out, "briefing": briefing, "rep_id": rep_id, "slot_start": slot_start}


def update_crm(lead_id: str, summary: str, status: str, sentiment: str | None = None, lost_reason: str | None = None,
               actor="agent") -> dict:
    t0 = time.perf_counter()
    fields = {"summary": summary, "status": status}
    if sentiment:
        fields["sentiment"] = sentiment
    if lost_reason:
        fields["lost_reason"] = lost_reason
    set_lead(lead_id, **fields)
    out = {"crm_record": lead_id, "status": status, "sentiment": sentiment, "updated": True}
    log_action(lead_id, "update_crm", {"lead_id": lead_id, "status": status, "summary": summary[:140]}, out, "ok", actor, t0)
    return out


def schedule_retry(lead_id: str, delay_sec: float, production_delay="30 min") -> dict:
    t0 = time.perf_counter()
    when = time.time() + delay_sec
    set_lead(lead_id, next_retry_at=when)
    out = {"scheduled_for": when, "production_policy": f"retry after {production_delay}", "demo_delay_sec": delay_sec}
    log_action(lead_id, "schedule_retry", {"lead_id": lead_id, "when": when}, out, "ok", "agent", t0)
    return out


def handoff_to_human(lead_id: str, reason: str, summary: str, actor="agent") -> dict:
    t0 = time.perf_counter()
    hid = db.ex("INSERT INTO handoffs(lead_id, reason, summary, status, assigned_to, ts) VALUES(?,?,?,?,?,?)",
                (lead_id, reason, summary, "open", "Sales manager · Meera", time.time()))
    set_lead(lead_id, status="HANDOFF")
    out = {"handoff_id": hid, "queue": "human-sales", "assigned_to": "Sales manager · Meera", "reason": reason}
    log_action(lead_id, "handoff_to_human", {"lead_id": lead_id, "reason": reason}, out, "ok", actor, t0)
    bus.publish("handoff", {"lead_id": lead_id, **out})
    return out


def opt_out(lead_id: str, source="merchant") -> dict:
    t0 = time.perf_counter()
    L = lead(lead_id)
    set_lead(lead_id, opted_out=1, consent=0, status="CLOSED", lost_reason="Opted out")
    db.ex("INSERT OR IGNORE INTO dnc_list(phone_hash, ts) VALUES(?, ?)", (L["phone_hash"], time.time()))
    consent_event(lead_id, "opt_out", f"Opt-out by {source}; added to DNC")
    out = {"opted_out": True, "dnc_added": True, "effective": "immediately"}
    log_action(lead_id, "record_opt_out", {"lead_id": lead_id, "source": source}, out, "ok", "agent", t0)
    return out


def reveal_phone(lead_id: str, role: str) -> dict:
    t0 = time.perf_counter()
    L = lead(lead_id)
    if role != "admin":
        out = {"revealed": False, "reason": "Only admin role can reveal phone numbers"}
        log_action(lead_id, "reveal_phone", {"role": role}, out, "blocked", role, t0)
        return out
    phone = security.decrypt(L["phone_enc"])
    log_action(lead_id, "reveal_phone", {"role": role}, {"revealed": True}, "ok", role, t0)
    return {"revealed": True, "phone": f"+91 {phone[:5]} {phone[5:]}"}
