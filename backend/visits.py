"""Visit lifecycle: reschedule (FR-15) and outcome capture (FR-16)."""
import time

import bus
import db
import rules
import tools

WASTED_REASONS = {"Merchant not present", "Device mismatch", "Not the decision maker", "Wrong address"}


def reschedule(visit_id: str, reason: str, actor: str = "agent") -> dict:
    v = db.one("SELECT * FROM visits WHERE id = ?", (visit_id,))
    if not v:
        return {"ok": False, "error": "Visit not found"}
    exclude = {v["agent_id"]} if reason == "rep_unavailable" else set()
    db.update("visits", "id", visit_id, {"status": "RESCHEDULED"})
    res = tools.find_slots(v["lead_id"], exclude=exclude, actor=actor)
    opts = [o for o in res["options"] if not (o["rep_id"] == v["agent_id"] and o["slot_start"] == v["slot_start"])]
    if not opts:
        db.update("visits", "id", visit_id, {"status": v["status"]})
        return {"ok": False, "error": "No alternative slot available"}
    o = opts[0]
    booked = tools.book_visit(v["lead_id"], o["rep_id"], o["slot_start"], alloc=o, actor=actor)
    L = tools.lead(v["lead_id"])
    tools.set_lead(v["lead_id"], reschedules=(L["reschedules"] or 0) + 1, status="CONFIRMED")
    tools.send_message(v["lead_id"], "TPL_RESCHEDULE", {"slot": booked["slot"], "rep": booked["rep"]}, actor=actor)
    tools.send_message(v["lead_id"], "TPL_REP_BRIEFING", {"rep": booked["rep"], "visit_id": booked["visit_id"], "slot": booked["slot"],
                                                          "device": (booked.get("briefing") or {}).get("recommendation", {}).get("device"),
                                                          "score": L.get("score"), "area": tools.profile(v["lead_id"]).get("area")}, actor=actor)
    tools.log_action(v["lead_id"], "reschedule_visit", {"visit_id": visit_id, "reason": reason},
                     {"new_visit": booked["visit_id"], "rep": booked["rep"], "slot": booked["slot"]}, "ok", actor)
    bus.publish("visit", {"lead_id": v["lead_id"], "visit_id": booked["visit_id"], "kind": "rescheduled"})
    return {"ok": True, "visit_id": booked["visit_id"], "rep": booked["rep"], "slot": booked["slot"]}


def set_outcome(visit_id: str, outcome: str, reason: str | None, actor: str = "rep") -> dict:
    v = db.one("SELECT * FROM visits WHERE id = ?", (visit_id,))
    if not v:
        return {"ok": False, "error": "Visit not found"}
    wasted = 1 if outcome == "rejected" and reason in WASTED_REASONS else 0
    db.update("visits", "id", visit_id, {"status": "COMPLETED", "outcome": outcome, "outcome_reason": reason,
                                          "wasted": wasted, "verified": 1})
    status = {"converted": "CONVERTED", "rejected": "REJECTED", "revisit": "REVISIT"}[outcome]
    fields = {"status": status}
    if outcome == "rejected":
        fields["lost_reason"] = reason or "Rejected at visit"
    tools.set_lead(v["lead_id"], **fields)
    tools.log_action(v["lead_id"], "capture_visit_outcome", {"visit_id": visit_id},
                     {"outcome": outcome, "reason": reason, "wasted_visit": bool(wasted)}, "ok", actor)
    bus.publish("visit", {"lead_id": v["lead_id"], "visit_id": visit_id, "kind": "outcome"})
    return {"ok": True, "status": status, "wasted": bool(wasted)}


def activate(lead_id: str) -> dict:
    tools.set_lead(lead_id, status="ACTIVATED")
    tools.log_action(lead_id, "track_activation", {"lead_id": lead_id}, {"activated": True, "first_txn": "simulated"}, "ok", "system")
    return {"ok": True}


def listing(days_back=1, days_fwd=3) -> list[dict]:
    now = time.time()
    rows = db.q("SELECT v.*, a.name AS rep_name, a.area AS rep_area, l.name AS lead_name, l.business_name, l.score, l.temperature, "
                "p.area, p.shop_type, p.lat, p.lng FROM visits v JOIN field_agents a ON a.id = v.agent_id JOIN leads l ON l.id = v.lead_id "
                "LEFT JOIN merchant_profiles p ON p.lead_id = v.lead_id WHERE v.slot_start BETWEEN ? AND ? ORDER BY v.slot_start",
                (now - days_back * 86400, now + days_fwd * 86400))
    for r in rows:
        r["slot_label"] = rules.slot_label(r["slot_start"])
        r["shop_label"] = rules.SHOP_TYPES.get(r.get("shop_type"), {}).get("label")
    return rows
