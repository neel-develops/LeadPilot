"""Reference data plus the deterministic, explainable rule engines:
recommendation, lead scoring and field-agent allocation. All prices are illustrative placeholders."""
import math
import time
from datetime import datetime, timedelta

# --------------------------------------------------------------------------- reference data

AREAS = {
    "411001": ("Camp", 18.5165, 73.8780),
    "411002": ("Swargate", 18.5018, 73.8636),
    "411004": ("Deccan", 18.5158, 73.8418),
    "411005": ("Shivajinagar", 18.5308, 73.8475),
    "411006": ("Yerawada", 18.5530, 73.8860),
    "411007": ("Aundh", 18.5590, 73.8078),
    "411014": ("Viman Nagar", 18.5679, 73.9143),
    "411015": ("Vishrantwadi", 18.5730, 73.8780),
    "411018": ("Pimpri", 18.6279, 73.8009),
    "411019": ("Chinchwad", 18.6440, 73.7600),
    "411021": ("Bavdhan", 18.5106, 73.7802),
    "411028": ("Hadapsar", 18.5089, 73.9260),
    "411030": ("Sadashiv Peth", 18.5100, 73.8530),
    "411036": ("Mundhwa", 18.5326, 73.9300),
    "411038": ("Kothrud", 18.5074, 73.8077),
    "411040": ("Wanowrie", 18.4880, 73.9000),
    "411041": ("Dhayari", 18.4500, 73.8100),
    "411045": ("Baner", 18.5590, 73.7868),
    "411046": ("Katraj", 18.4529, 73.8652),
    "411048": ("Kondhwa", 18.4700, 73.8900),
    "411057": ("Wakad", 18.5989, 73.7650),
    "411062": ("Hinjewadi", 18.5913, 73.7389),
}
# Outside the field coverage radius (still valid pincodes)
OUTSKIRTS = {
    "412105": ("Chakan", 18.7606, 73.8636),
    "410506": ("Talegaon", 18.7350, 73.6750),
    "412207": ("Wagholi", 18.5800, 73.9800),
}

SHOP_TYPES = {
    "kirana": {"label": "Kirana / Grocery", "fit": "high"},
    "restaurant": {"label": "Restaurant / Dhaba", "fit": "high"},
    "medical": {"label": "Medical / Pharmacy", "fit": "high"},
    "sweets": {"label": "Sweet shop / Bakery", "fit": "high"},
    "tea_stall": {"label": "Tea stall", "fit": "medium"},
    "clothing": {"label": "Clothing / Garments", "fit": "medium"},
    "electronics": {"label": "Electronics / Mobile", "fit": "medium"},
    "salon": {"label": "Salon / Parlour", "fit": "medium"},
    "hardware": {"label": "Hardware", "fit": "medium"},
    "vegetable": {"label": "Fruit & Vegetable", "fit": "low"},
}

SALES_BANDS = {
    "low": "Under ₹5k / day",
    "medium": "₹5k–20k / day",
    "high": "₹20k–50k / day",
    "very_high": "Over ₹50k / day",
}

SETUPS = {
    "cash_only": "Cash only",
    "upi_qr": "UPI QR only",
    "card_machine": "Has a card machine",
    "competitor_soundbox": "Competitor soundbox",
}

DEVICES = {
    "soundbox_lite": {"device": "Soundbox Lite", "plan": "Lite Monthly", "price": "₹49/month", "skill": "soundbox"},
    "soundbox_pro": {"device": "Soundbox Pro 4G", "plan": "Pro Monthly", "price": "₹99/month", "skill": "soundbox"},
    "card_machine": {"device": "Card Machine (EDC) + Soundbox", "plan": "Card + UPI", "price": "₹299/month", "skill": "card_machine"},
    "smart_pos": {"device": "Smart POS Combo", "plan": "Business Suite", "price": "₹499/month", "skill": "smart_pos"},
}

INTEREST_LABEL = {"soundbox": "Soundbox", "card_machine": "card machine", "not_sure": "payment devices"}


def sales_band(value: int) -> str:
    if value < 5000:
        return "low"
    if value < 20000:
        return "medium"
    if value <= 50000:
        return "high"
    return "very_high"


def locate(pincode: str | None):
    if not pincode:
        return None
    if pincode in AREAS:
        name, lat, lng = AREAS[pincode]
        return {"area": name, "lat": lat, "lng": lng, "covered": True}
    if pincode in OUTSKIRTS:
        name, lat, lng = OUTSKIRTS[pincode]
        return {"area": name, "lat": lat, "lng": lng, "covered": False}
    return {"area": f"Pincode {pincode}", "lat": None, "lng": None, "covered": False}


# --------------------------------------------------------------------------- recommendation

RULES = [
    {"id": "R-01", "desc": "Very high daily sales or multiple outlets → Smart POS Combo",
     "when": lambda p: p.get("daily_sales_band") == "very_high" or (p.get("outlets") or 1) > 1, "pick": "smart_pos"},
    {"id": "R-02", "desc": "Restaurant / electronics / clothing with high sales → Card Machine",
     "when": lambda p: p.get("shop_type") in ("restaurant", "electronics", "clothing") and p.get("daily_sales_band") == "high",
     "pick": "card_machine"},
    {"id": "R-03", "desc": "Already accepts cards with medium/high sales → Card Machine with sound alerts",
     "when": lambda p: p.get("current_setup") == "card_machine" and p.get("daily_sales_band") in ("medium", "high"),
     "pick": "card_machine"},
    {"id": "R-04", "desc": "Competitor soundbox in use → Soundbox Pro 4G (switch pitch)",
     "when": lambda p: p.get("current_setup") == "competitor_soundbox", "pick": "soundbox_pro"},
    {"id": "R-05", "desc": "Medium daily sales → Soundbox Pro 4G",
     "when": lambda p: p.get("daily_sales_band") == "medium", "pick": "soundbox_pro"},
    {"id": "R-06", "desc": "Low sales, cash or UPI QR → Soundbox Lite",
     "when": lambda p: p.get("daily_sales_band") == "low", "pick": "soundbox_lite"},
    {"id": "R-07", "desc": "High sales, counter business → Soundbox Pro 4G",
     "when": lambda p: p.get("daily_sales_band") == "high", "pick": "soundbox_pro"},
]

MODIFIERS = [
    {"id": "M-01", "desc": "Cash-only merchant: include first-time digital payments walkthrough",
     "when": lambda p: p.get("current_setup") == "cash_only"},
    {"id": "M-02", "desc": "Competitor device present: carry switch talking points, no discounts",
     "when": lambda p: p.get("current_setup") == "competitor_soundbox"},
    {"id": "M-03", "desc": "Prefers Hindi: enable Hindi voice payment alerts",
     "when": lambda p: p.get("language") == "hi"},
    {"id": "M-04", "desc": "Price asked: rep to show plan sheet, prices only from rule table",
     "when": lambda p: bool(p.get("asked_price"))},
]

REASONS = {
    "smart_pos": "handles high volume with cards, UPI and billing in one device",
    "card_machine": "lets you accept cards and UPI with instant sound alerts",
    "soundbox_pro": "announces every UPI payment instantly over 4G, no Wi-Fi needed",
    "soundbox_lite": "is the simplest low-cost way to confirm UPI payments aloud",
}


def recommend(profile: dict) -> dict:
    pick, rule_ids, matched_desc = "soundbox_pro", [], []
    for r in RULES:
        if r["when"](profile):
            pick = r["pick"]
            rule_ids.append(r["id"])
            matched_desc.append(r["desc"])
            break
    else:
        rule_ids.append("R-00")
        matched_desc.append("Default → Soundbox Pro 4G")
    for m in MODIFIERS:
        if m["when"](profile):
            rule_ids.append(m["id"])
            matched_desc.append(m["desc"])
    d = DEVICES[pick]
    return {
        "key": pick, "device": d["device"], "plan": d["plan"], "price": d["price"], "skill": d["skill"],
        "reason": REASONS[pick], "rule_ids": rule_ids, "rules": matched_desc,
    }


# --------------------------------------------------------------------------- scoring

SOURCE_POINTS = {"web_form": ("Strong intent source: web form", 20),
                 "missed_call": ("Intent source: missed call", 14),
                 "ad_feed": ("Intent source: ad click", 8)}
FIT_POINTS = {"high": 12, "medium": 7, "low": 3}
BAND_POINTS = {"low": 4, "medium": 10, "high": 15, "very_high": 18}


def score(lead: dict, profile: dict | None, answered: bool) -> dict:
    profile = profile or {}
    f = []
    label, pts = SOURCE_POINTS.get(lead.get("source"), ("Unknown source", 5))
    f.append({"label": label, "points": pts})
    if answered:
        f.append({"label": "Answered and engaged", "points": 10})
    if profile.get("asked_price"):
        f.append({"label": "Asked about price or installation", "points": 8})
    setup = profile.get("current_setup")
    if setup == "cash_only":
        f.append({"label": "No digital setup yet (cash only)", "points": 12})
    elif setup == "upi_qr":
        f.append({"label": "Static UPI QR only, no alerts", "points": 6})
    elif setup == "card_machine":
        f.append({"label": "Already digital, upgrade opportunity", "points": 3})
    elif setup == "competitor_soundbox":
        f.append({"label": "Competitor device in use", "points": -8})
    st = profile.get("shop_type")
    if st in SHOP_TYPES:
        fit = SHOP_TYPES[st]["fit"]
        f.append({"label": f"Shop type fit: {SHOP_TYPES[st]['label']} ({fit})", "points": FIT_POINTS[fit]})
    band = profile.get("daily_sales_band")
    if band in BAND_POINTS:
        f.append({"label": f"Daily sales {SALES_BANDS[band]}", "points": BAND_POINTS[band]})
    if profile.get("pincode"):
        loc = locate(profile["pincode"])
        if loc and loc["covered"]:
            f.append({"label": f"Inside covered area ({loc['area']})", "points": 10})
        else:
            f.append({"label": "Outside field coverage", "points": -10})
    if profile.get("hesitation"):
        f.append({"label": "Hesitation during call", "points": -6})
    missed = max(0, (lead.get("attempts") or 0) - (1 if answered else 0))
    if missed:
        f.append({"label": f"{missed} unanswered attempt(s)", "points": -5 * missed})
    total = max(0, min(100, sum(x["points"] for x in f)))
    temp = "hot" if total >= 70 else "warm" if total >= 45 else "cold"
    return {"score": total, "temperature": temp, "factors": f}


# --------------------------------------------------------------------------- allocation

def haversine(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def slot_label(ts: float, now: float | None = None) -> str:
    now = now or time.time()
    d = datetime.fromtimestamp(ts)
    today = datetime.fromtimestamp(now).date()
    if d.date() == today:
        day = "today"
    elif d.date() == today + timedelta(days=1):
        day = "tomorrow"
    else:
        day = d.strftime("%a %d %b")
    return f"{day}, {d.strftime('%I:%M %p').lstrip('0')}"


def candidate_slots(now: float, hours: list[int], days: int = 3) -> list[float]:
    base = datetime.fromtimestamp(now)
    out = []
    for day in range(days):
        d = (base + timedelta(days=day)).replace(minute=0, second=0, microsecond=0)
        for h in range(hours[0], hours[1]):
            ts = d.replace(hour=h).timestamp()
            if ts >= now + 2 * 3600:
                out.append(ts)
    return out


def allocate(lead_loc: dict, skill: str, reps: list[dict], visits: list[dict], weights: dict,
             radius_km: float, now: float | None = None, exclude: set | None = None) -> dict:
    """Hard constraints: covers area, has skill, works slot, capacity left. Rank by weighted score."""
    now = now or time.time()
    exclude = exclude or set()
    busy = {(v["agent_id"], int(v["slot_start"])) for v in visits}
    per_day: dict = {}
    for v in visits:
        key = (v["agent_id"], datetime.fromtimestamp(v["slot_start"]).date())
        per_day[key] = per_day.get(key, 0) + 1

    options, rejected = [], []
    horizon = 3 * 86400
    for rep in reps:
        if rep["id"] in exclude:
            rejected.append({"rep": rep["name"], "reason": "Marked unavailable"})
            continue
        if not rep.get("active", 1):
            rejected.append({"rep": rep["name"], "reason": "Inactive"})
            continue
        dist = haversine(lead_loc["lat"], lead_loc["lng"], rep["home_lat"], rep["home_lng"])
        if dist > radius_km:
            rejected.append({"rep": rep["name"], "reason": f"Outside area ({dist:.1f} km)"})
            continue
        level = (rep["skills"] or {}).get(skill, 0)
        if level <= 0:
            rejected.append({"rep": rep["name"], "reason": f"No {skill.replace('_', ' ')} skill"})
            continue
        chosen = None
        for ts in candidate_slots(now, rep["working_hours"]):
            day = datetime.fromtimestamp(ts).date()
            if (rep["id"], int(ts)) in busy:
                continue
            if per_day.get((rep["id"], day), 0) >= rep["capacity"]:
                continue
            chosen = ts
            break
        if chosen is None:
            rejected.append({"rep": rep["name"], "reason": "No free slot / at capacity"})
            continue
        day_load = per_day.get((rep["id"], datetime.fromtimestamp(chosen).date()), 0)
        comp = {
            "distance": max(0.0, 1 - dist / radius_km),
            "earliest": max(0.0, 1 - (chosen - now) / horizon),
            "skill": level / 3,
            "workload": max(0.0, 1 - day_load / rep["capacity"]),
        }
        total = sum(weights.get(k, 0) * v for k, v in comp.items())
        options.append({
            "rep_id": rep["id"], "rep_name": rep["name"], "rep_area": rep["area"],
            "slot_start": chosen, "slot_label": slot_label(chosen, now),
            "distance_km": round(dist, 1), "score": round(total * 100, 1),
            "breakdown": {k: round(v * 100) for k, v in comp.items()}, "day_load": day_load,
        })
    options.sort(key=lambda o: -o["score"])
    return {"options": options[:3], "rejected": rejected, "weights": weights, "eligible": len(options)}
