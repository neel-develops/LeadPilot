"""Funnel, first-contact, before/after comparison and operational KPIs. All figures are from simulated leads."""
import statistics
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta

import db
import rules

VISIT_STATUSES = ("CONFIRMED", "CONVERTED", "ACTIVATED", "REJECTED", "REVISIT")
CONTACTED_EXCLUDE = ("NEW", "CONSENT_OK", "BLOCKED")


def overview() -> dict:
    from agent import SESSIONS
    now = time.time()
    leads = db.q("SELECT id, source, status, score, temperature, created_at, first_contact_at, attempts, lost_reason, "
                 "baseline_ttfc_h, baseline_visit, baseline_wasted, language, sentiment FROM leads")
    visits = db.q("SELECT v.*, a.name AS rep_name FROM visits v JOIN field_agents a ON a.id = v.agent_id")
    n = len(leads) or 1
    lead_with_visit = {v["lead_id"] for v in visits if v["status"] in ("BOOKED", "CONFIRMED", "COMPLETED")}
    completed = [v for v in visits if v["status"] == "COMPLETED"]
    wasted = sum(v["wasted"] for v in completed)
    ttfc = [l["first_contact_at"] - l["created_at"] for l in leads if l["first_contact_at"]]
    upcoming = [v for v in visits if v["status"] in ("BOOKED", "CONFIRMED") and v["slot_start"] >= now - 3600]
    handoffs_open = db.scalar("SELECT COUNT(*) FROM handoffs WHERE status = 'open'")
    handoff_n = db.scalar("SELECT COUNT(DISTINCT lead_id) FROM handoffs")
    flags_open = db.scalar("SELECT COUNT(*) FROM leakage_flags WHERE status = 'open'")

    contacted = [l for l in leads if l["status"] not in CONTACTED_EXCLUDE]
    qualified = db.scalar("SELECT COUNT(*) FROM merchant_profiles WHERE shop_type IS NOT NULL AND daily_sales_band IS NOT NULL")
    visited = len(completed)
    converted = sum(1 for v in completed if v["outcome"] == "converted")

    kpis = {
        "total_leads": len(leads),
        "hot_leads": sum(1 for l in leads if l["temperature"] == "hot" and l["status"] not in ("CLOSED", "CONVERTED", "ACTIVATED", "REJECTED")),
        "callbacks_pending": sum(1 for l in leads if l["status"] == "FOLLOW_UP"),
        "visits_booked": len(upcoming),
        "median_ttfc_sec": round(statistics.median(ttfc), 1) if ttfc else None,
        "active_sessions": sum(1 for s in SESSIONS.values() if not s.ended),
        "open_flags": flags_open,
        "handoffs_open": handoffs_open,
        "leads_today": sum(1 for l in leads if l["created_at"] >= datetime.now().replace(hour=0, minute=0, second=0).timestamp()),
    }

    funnel = [
        {"stage": "Leads", "value": len(leads)},
        {"stage": "Contacted", "value": len(contacted)},
        {"stage": "Qualified", "value": qualified},
        {"stage": "Visit booked", "value": len(lead_with_visit)},
        {"stage": "Visited", "value": visited},
        {"stage": "Converted", "value": converted},
    ]

    sim = [l for l in leads]
    b_visits = sum(l["baseline_visit"] or 0 for l in sim)
    b_wasted = sum(l["baseline_wasted"] or 0 for l in sim)
    b_ttfc = [l["baseline_ttfc_h"] for l in sim if l["baseline_ttfc_h"]]
    comparison = {
        "ttfc": {"baseline": f"{statistics.median(b_ttfc):.0f} h" if b_ttfc else "—",
                 "agent": f"{statistics.median(ttfc):.0f} s" if ttfc else "—", "label": "Median time to first contact"},
        "lead_to_visit": {"baseline": round(100 * b_visits / n, 1), "agent": round(100 * len(lead_with_visit) / n, 1),
                          "label": "Lead-to-visit conversion %"},
        "wasted": {"baseline": round(100 * b_wasted / max(1, b_visits), 1), "agent": round(100 * wasted / max(1, len(completed)), 1),
                   "label": "Wasted visit rate %"},
        "human": {"baseline": 100.0, "agent": round(100 * (handoff_n or 0) / n, 1), "label": "Leads needing a human %"},
    }

    lost = Counter(l["lost_reason"] for l in leads if l["lost_reason"])
    lost_reasons = [{"reason": k, "count": v} for k, v in lost.most_common(10)]

    by_source = defaultdict(lambda: {"leads": 0, "visits": 0})
    for l in leads:
        by_source[l["source"]]["leads"] += 1
        if l["id"] in lead_with_visit:
            by_source[l["source"]]["visits"] += 1
    sources = [{"source": {"web_form": "Web form", "missed_call": "Missed call", "ad_feed": "Ad feed"}.get(k, k),
                "leads": v["leads"], "visits": v["visits"], "rate": round(100 * v["visits"] / max(1, v["leads"]), 1)}
               for k, v in by_source.items()]

    reps = db.q("SELECT * FROM field_agents ORDER BY id")
    rep_perf = []
    for r in reps:
        rv = [v for v in visits if v["agent_id"] == r["id"]]
        done = [v for v in rv if v["status"] == "COMPLETED"]
        conv = sum(1 for v in done if v["outcome"] == "converted")
        up = [v for v in rv if v["status"] in ("BOOKED", "CONFIRMED") and v["slot_start"] >= now - 3600]
        rep_perf.append({"id": r["id"], "name": r["name"], "area": r["area"], "visits": len(done), "converted": conv,
                         "conversion": round(100 * conv / max(1, len(done)), 1), "upcoming": len(up),
                         "wasted": sum(v["wasted"] for v in done), "rating": r["rating"],
                         "avg_distance": round(statistics.mean([v["distance_km"] for v in rv if v["distance_km"] is not None] or [0]), 1)})

    buckets = [(0, 10, "<10s"), (10, 20, "10–20s"), (20, 30, "20–30s"), (30, 45, "30–45s"), (45, 60, "45–60s"), (60, 10 ** 9, ">60s")]
    ttfc_hist = [{"bucket": lab, "count": sum(1 for x in ttfc if lo <= x < hi)} for lo, hi, lab in buckets]

    days = []
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    for d in range(11, -1, -1):
        start = (today - timedelta(days=d)).timestamp()
        end = start + 86400
        day_leads = [l for l in leads if start <= l["created_at"] < end]
        days.append({"day": (today - timedelta(days=d)).strftime("%d %b"), "short": (today - timedelta(days=d)).strftime("%a"),
                     "leads": len(day_leads),
                     "visits": sum(1 for l in day_leads if l["id"] in lead_with_visit),
                     "converted": sum(1 for l in day_leads if l["status"] in ("CONVERTED", "ACTIVATED")),
                     "contacted": sum(1 for l in day_leads if l["first_contact_at"])})
    calendar = Counter(datetime.fromtimestamp(v["slot_start"]).strftime("%Y-%m-%d") for v in visits
                       if v["status"] in ("BOOKED", "CONFIRMED", "COMPLETED"))

    temps = Counter(l["temperature"] or "unscored" for l in leads)
    statuses = Counter(l["status"] for l in leads)
    langs = Counter(l["language"] for l in leads)

    return {"kpis": kpis, "funnel": funnel, "comparison": comparison, "lost_reasons": lost_reasons, "sources": sources,
            "rep_performance": rep_perf, "ttfc_hist": ttfc_hist, "daily": days, "calendar": dict(calendar), "temperatures": dict(temps),
            "statuses": dict(statuses), "languages": dict(langs), "simulated": True,
            "note": "All metrics are computed on simulated leads. Baselines are assumptions modelled as a slow manual callback."}


def first_contact() -> dict:
    rows = db.q("SELECT created_at, first_contact_at FROM leads WHERE first_contact_at IS NOT NULL")
    xs = sorted(r["first_contact_at"] - r["created_at"] for r in rows)
    if not xs:
        return {"count": 0}
    return {"count": len(xs), "median_sec": round(statistics.median(xs), 1), "p90_sec": round(xs[int(0.9 * (len(xs) - 1))], 1),
            "under_60s_pct": round(100 * sum(1 for x in xs if x < 60) / len(xs), 1)}
