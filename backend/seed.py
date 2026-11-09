"""Deterministic simulated dataset: 10 Pune field reps and ~200 historical leads with an agent arm and
a slow-manual-callback baseline arm. All data is synthetic and labelled as simulated."""
import math
import random
import time
from datetime import datetime, timedelta

import db
import rules
import security

REPS = [
    ("R-01", "Rahul Patil", "Kothrud", 18.5074, 73.8077, {"soundbox": 3, "card_machine": 2, "smart_pos": 1}, [10, 19], ["hi", "mr", "en"], 4.7),
    ("R-02", "Sneha Kulkarni", "Baner", 18.5590, 73.7868, {"soundbox": 3, "card_machine": 3, "smart_pos": 2}, [10, 19], ["en", "mr", "hi"], 4.8),
    ("R-03", "Amit Deshmukh", "Hadapsar", 18.5089, 73.9260, {"soundbox": 3, "card_machine": 1}, [9, 18], ["hi", "mr"], 4.5),
    ("R-04", "Pooja Jadhav", "Viman Nagar", 18.5679, 73.9143, {"soundbox": 2, "card_machine": 3, "smart_pos": 3}, [10, 19], ["en", "hi"], 4.9),
    ("R-05", "Vikram Shinde", "Pimpri", 18.6279, 73.8009, {"soundbox": 3, "card_machine": 2, "smart_pos": 1}, [9, 18], ["hi", "mr"], 4.4),
    ("R-06", "Neha Joshi", "Shivajinagar", 18.5308, 73.8475, {"soundbox": 2, "card_machine": 3, "smart_pos": 2}, [10, 19], ["en", "mr", "hi"], 4.6),
    ("R-07", "Sanket Pawar", "Katraj", 18.4529, 73.8652, {"soundbox": 3, "card_machine": 1}, [10, 19], ["mr", "hi"], 4.3),
    ("R-08", "Aarti More", "Wakad", 18.5989, 73.7650, {"soundbox": 3, "card_machine": 2}, [10, 19], ["hi", "en"], 4.6),
    ("R-09", "Imran Shaikh", "Camp", 18.5165, 73.8780, {"soundbox": 2, "card_machine": 3, "smart_pos": 3}, [10, 19], ["hi", "en"], 4.7),
    ("R-10", "Kiran Gaikwad", "Kondhwa", 18.4700, 73.8900, {"soundbox": 3, "card_machine": 2}, [9, 18], ["mr", "hi"], 4.5),
]

FIRST = ["Sunita", "Rakesh", "Priya", "Anil", "Meena", "Vikas", "Ganesh", "Lata", "Suresh", "Kavita", "Mahesh", "Asha",
         "Prakash", "Rekha", "Santosh", "Jyoti", "Sachin", "Pallavi", "Nitin", "Swati", "Ramesh", "Anita", "Dinesh", "Usha",
         "Mohan", "Seema", "Ajay", "Manisha", "Vijay", "Shobha", "Raju", "Kalpana", "Sunil", "Vaishali", "Arun", "Deepa",
         "Farhan", "Ayesha", "Harpreet", "Joseph"]
LAST = ["Patil", "Jadhav", "Shinde", "Pawar", "Kulkarni", "Deshpande", "More", "Gaikwad", "Chavan", "Joshi", "Sharma",
        "Gupta", "Agarwal", "Shaikh", "Khan", "Yadav", "Bhosale", "Kale", "Mane", "Salunkhe", "Singh", "D'Souza"]
BIZ = {
    "kirana": ["{l} Kirana Stores", "Shree Ganesh General Store", "{f} Provision", "Om Sai Kirana", "Laxmi Supermart"],
    "restaurant": ["{l} Family Restaurant", "Hotel Sai Prasad", "Spice Route Cafe", "Annapurna Dhaba", "{f}'s Kitchen"],
    "medical": ["{l} Medical", "Shree Chemists", "Lifeline Pharmacy", "Apna Medical", "Care Plus Pharma"],
    "sweets": ["{l} Sweets", "Shree Krishna Mithai", "Gokul Bakery", "Royal Sweets", "Pune Bakers"],
    "tea_stall": ["{f} Amruttulya", "Chai Point Tapri", "{f} Tea Stall", "Kesari Chaha", "Cutting Corner"],
    "clothing": ["{l} Garments", "Paithani House", "Style Hub", "Fashion Point", "{f} Collections"],
    "electronics": ["{l} Mobiles", "Digital World", "Sai Electronics", "Mobile Planet", "{f} Telecom"],
    "salon": ["Glamour Salon", "{f}'s Parlour", "Style Cut", "Looks Unisex", "Shine Salon"],
    "hardware": ["{l} Hardware", "Om Paints", "Builders Mart", "Shree Hardware", "{f} Traders"],
    "vegetable": ["{f} Fruits & Veg", "Fresh Mandi", "Hari Bhari Sabzi", "Green Basket", "{f} Vegetables"],
}
LOST_REASONS = ["Price concern", "Already uses competitor", "Not interested now", "Low sales volume", "Wants to discuss with family"]
GENUINE_REJECT = ["Chose competitor", "Price concern at visit", "Postponed decision"]
WASTED_REJECT = ["Merchant not present", "Device mismatch", "Not the decision maker"]
HANDOFF_REASONS = ["Custom pricing or discount request", "Large multi-outlet business", "Merchant asked for a human",
                   "Legal or complaint topic raised", "Merchant confused"]


def _phone(rng):
    return str(rng.choice([6, 7, 8, 9])) + "".join(str(rng.randint(0, 9)) for _ in range(9))


def _transcript(rng, name, lang, profile, rec, outcome, t0, slot_text=None, rep=None):
    """Compact English-rendered transcript for historical (simulated) leads."""
    from agent import LINES, _fmt
    lg = lang if lang in ("hi", "en") else "hi"
    turns, ts = [], t0

    def add(speaker, key=None, text=None, en=None, **kw):
        nonlocal ts
        ts += rng.uniform(4, 9)
        if key:
            text, en = _fmt(key, lg, name=name, **kw)
        turns.append({"i": len(turns), "speaker": speaker, "text": text, "en": en or text, "lang": lg, "channel": "voice", "ts": ts, "meta": {}})

    add("system", text="Call connected · agent disclosed as automated · recording notice given")
    add("agent", "greet", interest="Soundbox", interest_hi="साउंडबॉक्स")
    if outcome == "optout":
        add("merchant", text="Not interested, please don't call again.")
        add("agent", "optout")
        return turns
    add("merchant", text="Yes, tell me." if lg == "en" else "हाँ जी, बताइए।", en="Yes, tell me.")
    add("agent", "ask_shop")
    add("merchant", text=rules.SHOP_TYPES[profile["shop_type"]]["label"])
    if outcome == "handoff":
        add("merchant", text="Can you do a special price? We have multiple outlets.")
        add("agent", "handoff")
        return turns
    add("agent", "ask_sales")
    add("merchant", text=f"About ₹{profile['daily_sales_value']:,} a day")
    add("agent", "ask_setup")
    add("merchant", text=rules.SETUPS[profile["current_setup"]])
    add("agent", "ask_pincode")
    add("merchant", text=profile["pincode"])
    from agent import REASON_HI
    add("agent", "recommend", device=rec["device"], plan=rec["plan"], price=rec["price"], reason=rec["reason"], reason_hi=REASON_HI.get(rec["key"], ""))
    if outcome == "booked":
        add("merchant", text="Okay, book it." if lg == "en" else "ठीक है, बुक कर दीजिए।", en="Okay, book it.")
        add("agent", "confirm", rep=rep, slot=slot_text)
    else:
        add("merchant", text="I'll think about it." if lg == "en" else "सोचकर बताता हूँ।", en="I'll think about it.")
        add("agent", "decline_visit")
    return turns


def seed(n_leads: int = 200, rng_seed: int = 42):
    rng = random.Random(rng_seed)
    now = time.time()
    db.many("INSERT INTO field_agents(id, name, area, home_lat, home_lng, skills, working_hours, capacity, rating, languages, active) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,1)",
            [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], 6, r[8], r[7]) for r in REPS])
    reps = db.q("SELECT * FROM field_agents")
    pincodes = list(rules.AREAS.keys())
    outskirts = list(rules.OUTSKIRTS.keys())
    shop_keys = list(rules.SHOP_TYPES.keys())
    shop_w = [16, 12, 10, 8, 14, 9, 8, 6, 5, 12]

    leads, profiles, recs, visits, actions, inters, consents, handoffs, msgs = [], [], [], [], [], [], [], [], []
    busy = set()
    per_day = {}

    wrng = random.Random(11)
    day_w = [1.3, 1.0, 1.2, 0.75, 1.1, 1.25, 0.85, 1.0, 1.15, 0.7, 1.05, 0.95]

    def act(lid, tool, inp, out, ts, status="ok", actor="agent"):
        actions.append((lid, tool, inp, out, status, actor, round(rng.uniform(2, 40), 1), ts))

    for i in range(n_leads):
        lid = f"LD-{1001 + i}"
        day_off = wrng.choices(range(12), day_w)[0]
        midnight = datetime.fromtimestamp(now).replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
        created = midnight - day_off * 86400 + rng.uniform(8 * 3600, 21 * 3600)
        if created > now - 1.5 * 3600:
            created = now - rng.uniform(1.5 * 3600, 6 * 3600)
        f, l = rng.choice(FIRST), rng.choice(LAST)
        name = f"{f} {l}"
        source = rng.choices(["web_form", "missed_call", "ad_feed"], [45, 30, 25])[0]
        lang = rng.choices(["hi", "en", "mr"], [55, 33, 12])[0]
        interest = rng.choices(["soundbox", "card_machine", "not_sure"], [65, 25, 10])[0]
        phone = _phone(rng)
        shop = rng.choices(shop_keys, shop_w)[0]
        biz = rng.choice(BIZ[shop]).format(f=f, l=l)
        consent = 0 if rng.random() < 0.03 else 1

        # baseline arm: slow manual callback
        b_h = rng.uniform(18, 72) if rng.random() < 0.8 else rng.uniform(6, 18)
        b_visit = 1 if rng.random() < 0.29 * math.exp(-b_h / 60) else 0
        b_wasted = 1 if b_visit and rng.random() < 0.24 else 0

        L = {"id": lid, "name": name, "business_name": biz, "phone_hash": security.phone_hash(phone),
             "phone_enc": security.encrypt(phone), "phone_masked": security.mask(phone), "source": source,
             "interest": interest, "created_at": created, "consent": consent, "opted_out": 0, "language": lang,
             "status": "NEW", "score": None, "temperature": None, "score_factors": None, "first_contact_at": None,
             "last_attempt_at": None, "attempts": 0, "reschedules": 0, "channel": "voice", "lost_reason": None,
             "summary": None, "sentiment": None, "next_retry_at": None, "simulated": 1,
             "baseline_ttfc_h": round(b_h, 2), "baseline_visit": b_visit, "baseline_wasted": b_wasted, "updated_at": created}
        consents.append((lid, "consent_captured" if consent else "consent_missing", f"Source: {source}", created))

        if not consent:
            L["status"] = "BLOCKED"
            L["lost_reason"] = "No consent on record"
            act(lid, "check_consent", {"lead_id": lid}, {"allowed": False, "reason": "No consent on record"}, created + 1, "blocked")
            leads.append(L)
            continue

        # leaky: stuck in queue (no contact) — only very recent ones are realistic
        if i in (7, 63, 141):
            L["created_at"] = now - rng.uniform(6 * 60, 25 * 60)
            leads.append(L)
            continue

        ttfc = rng.uniform(6, 48)
        t = created + ttfc
        L["first_contact_at"] = t
        act(lid, "check_consent", {"lead_id": lid}, {"allowed": True, "reason": "All checks passed"}, created + 2)
        answered = rng.random() < 0.8
        if not answered:
            L["attempts"] = 3
            L["last_attempt_at"] = t + 7200
            for a in range(3):
                act(lid, "place_call", {"lead_id": lid}, {"attempt": a + 1, "outcome": "no_answer"}, t + a * 3600, "warn")
            act(lid, "send_message", {"template_id": "TPL_MISSED_CALL"}, {"status": "delivered"}, t + 30)
            msgs.append((lid, "whatsapp", "TPL_MISSED_CALL", L["phone_masked"], "We just tried calling about your Paytm enquiry.", "out", t + 30))
            sc = rules.score(L, None, False)
            L["score"], L["temperature"], L["score_factors"] = sc["score"], sc["temperature"], sc["factors"]
            if rng.random() < 0.55:
                L["status"], L["lost_reason"], L["sentiment"] = "CLOSED", "No answer after 3 attempts", "unknown"
            else:
                L["status"], L["sentiment"] = "FOLLOW_UP", "unknown"
            L["summary"] = "No answer after 3 attempts; approved WhatsApp/SMS templates sent."
            leads.append(L)
            continue

        L["attempts"] = 1
        L["last_attempt_at"] = t
        act(lid, "place_call", {"lead_id": lid}, {"attempt": 1, "outcome": "answered"}, t)

        # profile
        covered = rng.random() > 0.06
        pin = rng.choice(pincodes) if covered else rng.choice(outskirts)
        loc = rules.locate(pin)
        sales_mu = {"kirana": 12000, "restaurant": 30000, "medical": 18000, "sweets": 20000, "tea_stall": 3500,
                    "clothing": 16000, "electronics": 25000, "salon": 6000, "hardware": 14000, "vegetable": 3000}[shop]
        sales = int(max(800, rng.lognormvariate(math.log(sales_mu), 0.5)) // 100 * 100)
        setup = rng.choices(["cash_only", "upi_qr", "card_machine", "competitor_soundbox"], [30, 40, 12, 18])[0]
        P = {"lead_id": lid, "shop_type": shop, "daily_sales_band": rules.sales_band(sales), "daily_sales_value": sales,
             "current_setup": setup, "pincode": pin, "area": loc["area"], "lat": loc["lat"], "lng": loc["lng"],
             "outlets": 1, "asked_price": 1 if rng.random() < 0.45 else 0, "hesitation": 1 if rng.random() < 0.2 else 0}

        path = rng.random()
        if path < 0.04:  # opt-out
            L.update(status="CLOSED", opted_out=1, consent=0, lost_reason="Opted out", sentiment="negative",
                     summary=f"{name} opted out during the call; added to DNC.")
            consents.append((lid, "opt_out", "Opt-out during call; added to DNC", t + 20))
            inters.append((lid, "voice", t, t + 40, _transcript(rng, f, lang, P, None, "optout", t), L["summary"], "negative", "opted_out"))
            leads.append(L)
            continue
        if path < 0.12:  # handoff
            reason = rng.choice(HANDOFF_REASONS)
            P["outlets"] = rng.randint(3, 9) if reason == "Large multi-outlet business" else 1
            L.update(status="HANDOFF", sentiment="neutral",
                     summary=f"{name} ({biz}) — {rules.SHOP_TYPES[shop]['label']} in {loc['area']}. Handoff: {reason}.")
            profiles.append(P)
            handoffs.append((lid, reason, L["summary"], rng.choice(["open", "resolved", "resolved"]), "Sales manager · Meera", t + 90))
            act(lid, "handoff_to_human", {"lead_id": lid, "reason": reason}, {"queue": "human-sales"}, t + 90)
            inters.append((lid, "voice", t, t + 95, _transcript(rng, f, lang, P, None, "handoff", t), L["summary"], "neutral", "handoff"))
            leads.append(L)
            continue

        profiles.append(P)
        act(lid, "save_profile", {"lead_id": lid}, {"saved": ["shop_type", "daily_sales_value", "current_setup", "pincode"]}, t + 60)
        p2 = dict(P, language=lang)
        rec = rules.recommend(p2)
        recs.append((lid, rec["device"], rec["plan"], rec["price"], rec["reason"], rec["rule_ids"]))
        act(lid, "recommend_device", {"shop_type": shop, "daily_sales_band": P["daily_sales_band"], "current_setup": setup}, rec, t + 70)
        sc = rules.score(L, P, True)
        L["score"], L["temperature"], L["score_factors"] = sc["score"], sc["temperature"], sc["factors"]
        act(lid, "score_lead", {"lead_id": lid}, sc, t + 72)

        p_book = {"hot": 0.85, "warm": 0.6, "cold": 0.22}[sc["temperature"]]
        if not loc["covered"]:
            p_book = 0
        book = rng.random() < p_book
        if not book:
            reason = "Out of coverage" if not loc["covered"] else rng.choices(LOST_REASONS, [30, 25, 25, 10, 10])[0]
            if setup == "competitor_soundbox" and loc["covered"] and rng.random() < 0.6:
                reason = "Already uses competitor"
            status = "CLOSED" if rng.random() < 0.6 else "FOLLOW_UP"
            L.update(status=status, lost_reason=reason, sentiment=rng.choice(["neutral", "negative"]),
                     summary=f"{name} ({biz}) — {rules.SHOP_TYPES[shop]['label']} in {loc['area']}, {rules.SALES_BANDS[P['daily_sales_band']]}. "
                             f"Recommended {rec['device']}. Not booked: {reason}.")
            inters.append((lid, "voice", t, t + 150, _transcript(rng, f, lang, P, rec, "declined", t), L["summary"], L["sentiment"], "declined"))
            act(lid, "update_crm", {"lead_id": lid, "status": status}, {"updated": True}, t + 160)
            leads.append(L)
            continue

        # allocate a rep and slot
        skill = rules.DEVICES[rec["key"]]["skill"]
        cands = sorted(((rules.haversine(loc["lat"], loc["lng"], r["home_lat"], r["home_lng"]), r) for r in reps
                        if (r["skills"] or {}).get(skill, 0) > 0), key=lambda x: x[0])
        dist, rep = cands[0] if rng.random() < 0.8 or len(cands) < 2 else cands[1]
        base = datetime.fromtimestamp(t) + timedelta(hours=rng.uniform(3, 30))
        slot = None
        for k in range(40):
            d = base + timedelta(hours=k)
            if d.hour < rep["working_hours"][0] or d.hour >= rep["working_hours"][1]:
                continue
            ts_ = d.replace(minute=0, second=0, microsecond=0).timestamp()
            dk = (rep["id"], d.date())
            if (rep["id"], int(ts_)) in busy or per_day.get(dk, 0) >= rep["capacity"]:
                continue
            slot = ts_
            busy.add((rep["id"], int(ts_)))
            per_day[dk] = per_day.get(dk, 0) + 1
            break
        if slot is None:
            L.update(status="FOLLOW_UP", lost_reason="No rep capacity", summary="No rep capacity in window.")
            leads.append(L)
            continue
        vid = f"V-S{1001 + i}"
        label = rules.slot_label(slot, now)
        briefing = {"headline": f"{rules.SHOP_TYPES[shop]['label']} in {loc['area']} · {rules.SALES_BANDS[P['daily_sales_band']]}",
                    "merchant": name, "business": biz, "language": {"hi": "Hindi", "en": "English", "mr": "Marathi"}[lang],
                    "score": sc["score"], "temperature": sc["temperature"], "current_setup": rules.SETUPS[setup],
                    "recommendation": {"device": rec["device"], "plan": rec["plan"], "price": rec["price"], "rule_ids": rec["rule_ids"]},
                    "likely_objections": ["Monthly rental vs. benefit"] + (["Already has competitor device"] if setup == "competitor_soundbox" else []),
                    "talking_points": [f"Pitch {rec['device']}: {rec['reason']}", "Free installation; KYC: PAN, Aadhaar, shop photo, bank account"],
                    "rep": rep["name"], "slot": label}
        resched = 1 if rng.random() < 0.08 else 0
        L["reschedules"] = resched
        if slot < now - 3600:
            r = rng.random()
            if r < 0.6:
                outcome, reason, wasted, status = "converted", None, 0, ("ACTIVATED" if rng.random() < 0.7 else "CONVERTED")
            elif r < 0.9:
                if rng.random() < 0.36:
                    reason, wasted = rng.choice(WASTED_REJECT), 1
                else:
                    reason, wasted = rng.choice(GENUINE_REJECT), 0
                outcome, status = "rejected", "REJECTED"
                L["lost_reason"] = reason
            else:
                outcome, reason, wasted, status = "revisit", "Asked to come back", 0, "REVISIT"
            visits.append((vid, lid, rep["id"], slot, "COMPLETED", 1, 1, outcome, reason, wasted, round(dist, 1), briefing, {}, t + 180))
            L["status"] = status
        else:
            confirmed, vcreated = 1, t + 180
            visits.append((vid, lid, rep["id"], slot, "BOOKED", confirmed, 0, None, None, 0, round(dist, 1), briefing, {}, vcreated))
            L["status"] = "CONFIRMED"
        L["sentiment"] = "positive"
        L["summary"] = (f"{name} ({biz}) — {rules.SHOP_TYPES[shop]['label']} in {loc['area']}, {rules.SALES_BANDS[P['daily_sales_band']]}; "
                        f"{rules.SETUPS[setup].lower()}. Recommended {rec['device']}. Score {sc['score']} ({sc['temperature']}). "
                        f"Visit with {rep['name']} {label}.")
        act(lid, "find_slots", {"lead_id": lid, "skill": skill}, {"eligible": len(cands)}, t + 175)
        act(lid, "book_visit", {"rep_id": rep["id"], "slot_start": slot}, {"booked": True, "visit_id": vid}, t + 180)
        act(lid, "update_crm", {"lead_id": lid, "status": L["status"]}, {"updated": True}, t + 185)
        inters.append((lid, "voice", t, t + 200, _transcript(rng, f, lang, P, rec, "booked", t, label, rep["name"]), L["summary"], "positive", "visit_booked"))
        leads.append(L)

    # wasted-visit quota (~9% of completed visits) so the headline metric is stable
    qrng = random.Random(3)
    done_idx = [k for k, v in enumerate(visits) if v[4] == "COMPLETED"]
    rej_idx = [k for k in done_idx if visits[k][7] == "rejected"]
    n_w = min(len(rej_idx), round(0.09 * len(done_idx)))
    wasted_set = set(qrng.sample(rej_idx, n_w))
    for k in rej_idx:
        v = list(visits[k])
        if k in wasted_set:
            v[8], v[9] = qrng.choice(WASTED_REJECT), 1
        elif v[9]:
            v[8], v[9] = qrng.choice(GENUINE_REJECT), 0
        visits[k] = tuple(v)
        for L in leads:
            if L["id"] == v[1]:
                L["lost_reason"] = v[8]

    # leakage scenarios on upcoming visits: repeated reschedules (L3) and unconfirmed bookings (L5)
    future = [k for k, v in enumerate(visits) if v[4] == "BOOKED"]
    by_id = {L["id"]: L for L in leads}
    for k in future[:2]:
        by_id[visits[k][1]]["reschedules"] = 2
    for k in future[2:4]:
        v = list(visits[k])
        v[5], v[13] = 0, now - 4 * 3600
        visits[k] = tuple(v)

    # baseline arm (slow manual callback), fixed quotas so the comparison is stable: ~15% visits, ~20% wasted
    brng = random.Random(7)
    ranked = sorted(leads, key=lambda L: -math.exp(-L["baseline_ttfc_h"] / 60) * brng.random())
    n_b = round(0.15 * len(leads))
    for k, L in enumerate(ranked):
        L["baseline_visit"] = 1 if k < n_b else 0
        L["baseline_wasted"] = 0
    for L in brng.sample(ranked[:n_b], round(0.2 * n_b)):
        L["baseline_wasted"] = 1

    cols = list(leads[0].keys())
    db.many(f"INSERT INTO leads({', '.join(cols)}) VALUES({', '.join('?' * len(cols))})", [tuple(L[c] for c in cols) for L in leads])
    pcols = ["lead_id", "shop_type", "daily_sales_band", "daily_sales_value", "current_setup", "pincode", "area", "lat", "lng",
             "outlets", "asked_price", "hesitation"]
    db.many(f"INSERT INTO merchant_profiles({', '.join(pcols)}) VALUES({', '.join('?' * len(pcols))})",
            [tuple(P[c] for c in pcols) for P in profiles])
    db.many("INSERT INTO recommendations(lead_id, device, plan, price, reason, rule_ids) VALUES(?,?,?,?,?,?)", recs)
    db.many("INSERT INTO visits(id, lead_id, agent_id, slot_start, status, merchant_confirmed, verified, outcome, outcome_reason, "
            "wasted, distance_km, briefing, alloc, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", visits)
    db.many("INSERT INTO agent_actions(lead_id, tool, input, output, status, actor, duration_ms, ts) VALUES(?,?,?,?,?,?,?,?)", actions)
    db.many("INSERT INTO interactions(lead_id, channel, started_at, ended_at, transcript, summary, sentiment, outcome) VALUES(?,?,?,?,?,?,?,?)", inters)
    db.many("INSERT INTO consent_log(lead_id, event, detail, ts) VALUES(?,?,?,?)", consents)
    db.many("INSERT INTO handoffs(lead_id, reason, summary, status, assigned_to, ts) VALUES(?,?,?,?,?,?)", handoffs)
    db.many("INSERT INTO messages(lead_id, channel, template_id, recipient, body, direction, ts) VALUES(?,?,?,?,?,?,?)", msgs)
    dnc = [(L["phone_hash"], now) for L in leads if L["opted_out"]]
    db.many("INSERT OR IGNORE INTO dnc_list(phone_hash, ts) VALUES(?,?)", dnc)
    return len(leads)


def ensure_seeded():
    db.conn()
    if not db.scalar("SELECT COUNT(*) FROM field_agents"):
        seed()
