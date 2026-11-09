"""Lead leakage detector: a scheduled scan that flags leads silently going cold and proposes a recovery action."""
import time

import bus
import db
import tools

RULES = {
    "L1": {"title": "No contact within target window", "severity": "high", "action": "Retry contact now"},
    "L2": {"title": "3+ unanswered attempts", "severity": "medium", "action": "Send WhatsApp + manager alert"},
    "L3": {"title": "Repeated reschedules", "severity": "medium", "action": "Reassign to a different rep"},
    "L4": {"title": "Hot lead without a visit after 24h", "severity": "high", "action": "Manager alert + call back to book"},
    "L5": {"title": "Booked visit not confirmed by merchant", "severity": "low", "action": "Send confirmation reminder"},
}

ACTIVE = ("NEW", "CONSENT_OK", "CONTACTING", "QUALIFYING", "RECOMMENDING", "BOOKING")


def _open(lead_id, rule):
    return db.one("SELECT id FROM leakage_flags WHERE lead_id = ? AND rule = ? AND status = 'open'", (lead_id, rule))


def _flag(lead_id, rule, detail):
    if _open(lead_id, rule):
        return None
    r = RULES[rule]
    fid = db.ex("INSERT INTO leakage_flags(lead_id, rule, title, detail, severity, action, status, ts) VALUES(?,?,?,?,?,?,?,?)",
                (lead_id, rule, r["title"], detail, r["severity"], r["action"], "open", time.time()))
    tools.log_action(lead_id, "flag_leakage", {"rule": rule}, {"flag_id": fid, "title": r["title"], "detail": detail,
                                                              "proposed_action": r["action"]}, "warn", "leakage_detector")
    bus.publish("flag", {"id": fid, "lead_id": lead_id, "rule": rule, "title": r["title"], "severity": r["severity"]})
    return fid


def _resolve_stale():
    """Auto-close flags whose condition no longer holds."""
    for f in db.q("SELECT f.id, f.rule, l.status, l.attempts FROM leakage_flags f JOIN leads l ON l.id = f.lead_id WHERE f.status = 'open'"):
        stale = False
        if f["rule"] in ("L1", "L2", "L4") and f["status"] in ("CONFIRMED", "CONVERTED", "ACTIVATED", "CLOSED", "HANDOFF"):
            stale = True
        if stale:
            db.update("leakage_flags", "id", f["id"], {"status": "resolved", "resolved_at": time.time()})


def scan() -> int:
    from agent import SESSIONS
    s = tools.get_settings()
    now = time.time()
    created = 0
    live = {k for k, v in SESSIONS.items() if not v.ended}

    for L in db.q("SELECT id, created_at FROM leads WHERE first_contact_at IS NULL AND status IN ('NEW','CONSENT_OK') "
                  "AND opted_out = 0 AND consent = 1 AND created_at < ?", (now - s["contact_window_sec"],)):
        if L["id"] in live:
            continue
        mins = (now - L["created_at"]) / 60
        created += bool(_flag(L["id"], "L1", f"Waiting {mins:.0f} min with no contact (target {s['contact_window_sec']}s)"))

    for L in db.q("SELECT id, attempts FROM leads WHERE attempts >= 3 AND status = 'FOLLOW_UP' AND sentiment = 'unknown' AND created_at > ?",
                  (now - 3 * 86400,)):
        if L["id"] in live:
            continue
        created += bool(_flag(L["id"], "L2", f"{L['attempts']} attempts, never answered"))

    for L in db.q("SELECT id, reschedules FROM leads WHERE reschedules >= ? AND status = 'CONFIRMED'", (s["max_reschedules"],)):
        created += bool(_flag(L["id"], "L3", f"Rescheduled {L['reschedules']} times"))

    cutoff = now - s["hot_unvisited_hours"] * 3600
    for L in db.q("SELECT l.id, l.score, l.created_at FROM leads l WHERE l.score >= ? AND l.created_at < ? AND l.status IN ('FOLLOW_UP','QUALIFYING','RECOMMENDING','BOOKING') "
                  "AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.lead_id = l.id AND v.status IN ('BOOKED','CONFIRMED','COMPLETED'))",
                  (s["hot_threshold"], cutoff)):
        if L["id"] in live:
            continue
        hrs = (now - L["created_at"]) / 3600
        created += bool(_flag(L["id"], "L4", f"Score {L['score']}, no visit after {hrs:.0f}h"))

    for V in db.q("SELECT v.id, v.lead_id, v.created_at FROM visits v WHERE v.status = 'BOOKED' AND v.merchant_confirmed = 0 "
                  "AND v.created_at < ? AND v.slot_start > ?", (now - s["confirm_window_hours"] * 3600, now)):
        created += bool(_flag(V["lead_id"], "L5", f"Visit {V['id']} unconfirmed for {(now - V['created_at']) / 3600:.0f}h"))

    _resolve_stale()
    if created:
        bus.publish("flags_changed", {"created": created})
    return created


def recover(flag_id: int) -> dict:
    import agent
    f = db.one("SELECT * FROM leakage_flags WHERE id = ?", (flag_id,))
    if not f:
        return {"ok": False, "error": "Flag not found"}
    if f["status"] != "open":
        return {"ok": False, "error": "Flag already resolved"}
    L = tools.lead(f["lead_id"])
    result = {"ok": True, "rule": f["rule"], "lead_id": L["id"]}
    rule = f["rule"]
    if rule == "L2":
        # Attempt cap respected: no more calls today. Nudge on WhatsApp, alert manager, retry tomorrow.
        tools.send_message(L["id"], "TPL_MISSED_CALL", actor="leakage_detector")
        tools.send_message(L["id"], "TPL_MANAGER_ALERT", {"title": f["title"]}, actor="leakage_detector")
        tools.set_lead(L["id"], next_retry_at=time.time() + 86400, sentiment="nudged")
        tools.log_action(L["id"], "schedule_retry", {"lead_id": L["id"], "when": "next calling window"},
                         {"scheduled_for": time.time() + 86400, "reason": "attempt cap respected"}, "ok", "leakage_detector")
        result["action"] = "WhatsApp nudge sent, manager alerted, retry scheduled for tomorrow (attempt cap respected)"
    elif rule in ("L1", "L4"):
        if rule == "L4":
            tools.send_message(L["id"], "TPL_MANAGER_ALERT", {"title": f["title"]}, actor="leakage_detector")
        persona = "rakesh_kirana" if L["language"] != "en" else "priya_restaurant"
        p = tools.profile(L["id"])
        complete = all(p.get(k) for k in ("shop_type", "daily_sales_band", "current_setup", "pincode"))
        agent.start_session(L, "auto", persona, callback=complete)
        result["action"] = "Agent session restarted" + (" (callback to book visit)" if complete else "")
    elif rule == "L3":
        v = db.one("SELECT * FROM visits WHERE lead_id = ? AND status IN ('BOOKED','CONFIRMED') ORDER BY created_at DESC LIMIT 1", (L["id"],))
        if v:
            import visits as vmod
            r = vmod.reschedule(v["id"], "rep_unavailable", actor="leakage_detector")
            result["action"] = f"Reassigned to {r.get('rep', '—')}"
        else:
            result["action"] = "No active visit; flag closed"
    elif rule == "L5":
        v = db.one("SELECT v.*, a.name AS rep FROM visits v JOIN field_agents a ON a.id = v.agent_id WHERE lead_id = ? AND v.status = 'BOOKED' ORDER BY v.created_at DESC LIMIT 1", (L["id"],))
        if v:
            from rules import slot_label
            tools.send_message(L["id"], "TPL_VISIT_CONFIRM", {"rep": v["rep"], "slot": slot_label(v["slot_start"]), "device": "Paytm device"},
                               actor="leakage_detector")
            db.update("visits", "id", v["id"], {"merchant_confirmed": 1})
        result["action"] = "Confirmation reminder sent; merchant confirmed"
    db.update("leakage_flags", "id", flag_id, {"status": "resolved", "resolved_at": time.time()})
    tools.log_action(L["id"], "recover_lead", {"flag_id": flag_id, "rule": rule}, result, "ok", "leakage_detector")
    bus.publish("flags_changed", {"resolved": flag_id})
    return result
