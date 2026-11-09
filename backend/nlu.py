"""Lightweight bilingual (English / Hindi / Hinglish) understanding for merchant replies.
Deterministic keyword + pattern extraction so the demo works fully offline."""
import re
import unicodedata

DEVANAGARI = re.compile(r"[ऀ-ॿ]")

HINGLISH_MARKERS = {"hai", "haan", "han", "nahi", "nahin", "mera", "meri", "dukan", "dukaan", "kya", "ji", "kitna",
                    "kitne", "roz", "bas", "theek", "thik", "chalega", "accha", "acha", "abhi", "hazaar", "hazar",
                    "kal", "wala", "wali", "karte", "hota", "hoti", "lagbhag", "paisa", "rupaye"}


def _has(text: str, words) -> bool:
    for w in words:
        if DEVANAGARI.search(w):
            if w in text:
                return True
        elif re.search(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])", text):
            return True
    return False


OPTOUT = ["not interested", "dont call", "don't call", "do not call", "stop calling", "remove my number",
          "nahi chahiye", "interest nahi", "call mat", "mat karo", "band karo", "unsubscribe", "stop",
          "इंटरेस्ट नहीं", "नहीं चाहिए", "कॉल मत", "दोबारा कॉल"]
H_DISCOUNT = ["discount", "kam karo", "kam kar", "sasta", "cheaper", "bulk price", "best price", "special price",
              "offer do", "डिस्काउंट", "कम कीजिए", "सस्ता"]
H_HUMAN = ["human", "real person", "manager", "insaan", "agent se baat", "talk to someone", "senior", "supervisor",
           "मैनेजर", "इंसान"]
H_LEGAL = ["complaint", "legal", "fraud", "police", "court", "consumer forum", "lawyer", "शिकायत", "धोखा"]
H_ANGRY = ["bakwas", "pagal", "stupid", "irritat", "fed up", "waste of time", "nonsense", "बकवास", "परेशान"]
H_CONFUSED = ["samajh nahi", "confused", "not understand", "dont understand", "don't understand", "समझ नहीं"]
MULTI = ["outlets", "branches", "chain", "stores", "shops", "dukane", "dukanein", "आउटलेट", "ब्रांच", "दुकानें"]

BUSY = ["busy", "later", "baad mein", "baad me", "abhi nahi", "call later", "call back", "driving", "meeting",
        "बाद में", "अभी नहीं", "व्यस्त"]
YES = ["yes", "yeah", "yep", "haan", "han", "ha", "haa", "ok", "okay", "sure", "theek", "thik", "chalega", "bilkul",
       "ji", "haanji", "go ahead", "book", "please", "fine", "done", "kar do", "kar dijiye", "perfect", "sounds good",
       "हाँ", "हां", "ठीक", "जी", "बिल्कुल", "चलेगा", "बुक", "कर दीजिए"]
NO = ["no", "nope", "nahi", "nahin", "mat", "नहीं"]
PRICE = ["price", "cost", "kitna", "kitne ka", "kitne paise", "charge", "charges", "rent", "rental", "installation", "fees", "fee",
         "monthly", "rate", "paisa", "कितना", "कितने", "चार्ज", "किराया", "कीमत", "लगाने"]
HESITATE = ["sochna", "soch ke", "think about", "maybe", "shayad", "not sure", "pata nahi", "dekhte", "सोच", "शायद",
            "पता नहीं"]

SHOPS = {
    "tea_stall": ["tea", "chai", "tapri", "tea stall", "चाय", "टपरी"],
    "kirana": ["kirana", "grocery", "general store", "provision", "supermarket", "किराना", "जनरल स्टोर"],
    "restaurant": ["restaurant", "dhaba", "hotel", "cafe", "food", "canteen", "eatery", "रेस्टोरेंट", "ढाबा", "होटल"],
    "medical": ["medical", "pharmacy", "chemist", "medicine", "मेडिकल", "दवा"],
    "sweets": ["sweet", "sweets", "mithai", "bakery", "मिठाई", "बेकरी"],
    "clothing": ["cloth", "clothes", "clothing", "garment", "garments", "boutique", "saree", "कपड़", "कपडे"],
    "electronics": ["electronic", "electronics", "mobile", "phone shop", "मोबाइल", "इलेक्ट्रॉनिक"],
    "salon": ["salon", "parlour", "parlor", "barber", "सैलून", "पार्लर"],
    "hardware": ["hardware", "paint", "plumbing", "हार्डवेयर"],
    "vegetable": ["vegetable", "sabzi", "sabji", "fruit", "fruits", "thela", "सब्ज़ी", "सब्जी", "फल"],
}

CARD = ["card", "swipe", "pos", "edc", "card machine", "कार्ड"]
UPI = ["upi", "qr", "gpay", "google pay", "phonepe", "phone pe", "bharatpe", "bhim", "scanner", "scan", "यूपीआई",
       "क्यूआर", "स्कैनर"]
COMPETITOR_SB = ["soundbox", "sound box", "speaker", "साउंडबॉक्स", "स्पीकर"]
CASH = ["cash", "nakad", "nagad", "cash only", "कैश", "नकद"]

FIRST = ["first", "1st", "pehla", "pehle", "pahla", "option 1", "one", "पहला", "पहले", "पहली", "पहना", "pahle"]
SECOND = ["second", "2nd", "doosra", "dusra", "doosre", "option 2", "two", "दूसरा", "दूसरे", "दूसरी"]


def detect_language(text: str) -> str:
    if DEVANAGARI.search(text):
        return "hi"
    words = set(re.findall(r"[a-z]+", text.lower()))
    return "hi" if len(words & HINGLISH_MARKERS) >= 1 else "en"


AREA_WORDS = {
    "411001": ["camp", "कैंप"], "411002": ["swargate", "स्वारगेट"], "411004": ["deccan", "डेक्कन"],
    "411005": ["shivajinagar", "shivaji nagar", "शिवाजीनगर", "शिवाजी नगर"], "411006": ["yerawada", "yerwada", "येरवडा"],
    "411007": ["aundh", "औंध"], "411014": ["viman nagar", "vimannagar", "kharadi", "विमान नगर", "खराडी"],
    "411015": ["vishrantwadi", "विश्रांतवाडी"], "411018": ["pimpri", "पिंपरी"], "411019": ["chinchwad", "चिंचवड"],
    "411021": ["bavdhan", "बावधन"], "411028": ["hadapsar", "हडपसर"], "411030": ["sadashiv peth", "सदाशिव पेठ"],
    "411036": ["mundhwa", "मुंढवा"], "411038": ["kothrud", "कोथरूड", "कोथरुड"], "411040": ["wanowrie", "वानवडी"],
    "411041": ["dhayari", "धायरी"], "411045": ["baner", "बाणेर", "बानेर"], "411046": ["katraj", "कात्रज"],
    "411048": ["kondhwa", "कोंढवा"], "411057": ["wakad", "वाकड"], "411062": ["hinjewadi", "hinjawadi", "हिंजवडी"],
    "412105": ["chakan", "चाकण"], "410506": ["talegaon", "तलेगांव"], "412207": ["wagholi", "वाघोली"],
}
DIGIT_WORDS = {"zero": "0", "shunya": "0", "शून्य": "0", "जीरो": "0", "one": "1", "ek": "1", "एक": "1", "two": "2", "do": "2", "दो": "2",
               "three": "3", "teen": "3", "तीन": "3", "four": "4", "char": "4", "chaar": "4", "चार": "4", "चाय": "4",
               "five": "5", "paanch": "5", "पांच": "5", "पाँच": "5", "six": "6", "chhe": "6", "छह": "6", "छः": "6",
               "seven": "7", "saat": "7", "सात": "7", "eight": "8", "aath": "8", "आठ": "8", "nine": "9", "nau": "9", "नौ": "9"}


def _area_pincode(t: str):
    t = normalize(t)
    for pin, words in AREA_WORDS.items():
        for w in words:
            if (w in t) if DEVANAGARI.search(w) else re.search(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])", t):
                return pin
    return None


def _spoken_digits(t: str):
    toks = re.findall(r"[a-z]+|[ऀ-ॿ]+|\d", re.sub(r"[।॥,.]", " ", t))
    digits = "".join(DIGIT_WORDS.get(x, x if x.isdigit() else "") for x in toks)
    m = re.search(r"[1-9]\d{5}", digits)
    return m.group(0) if m else None


def _pincode(text: str):
    m = re.search(r"(?<!\d)([1-9]\d{5})(?!\d)", text.replace(" ", "") if len(text) < 12 else text)
    return m.group(1) if m else None


NUM_WORDS = {
    "ek": 1, "do": 2, "teen": 3, "tin": 3, "char": 4, "chaar": 4, "paanch": 5, "panch": 5, "chhe": 6, "che": 6, "saat": 7, "sat": 7,
    "aath": 8, "ath": 8, "nau": 9, "das": 10, "dus": 10, "barah": 12, "baara": 12, "pandrah": 15, "pandra": 15, "bees": 20, "bis": 20,
    "pachees": 25, "pachis": 25, "tees": 30, "tis": 30, "chalees": 40, "chalis": 40, "pachaas": 50, "pachas": 50, "dedh": 1.5, "dhai": 2.5,
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "twelve": 12,
    "fifteen": 15, "twenty": 20, "twenty five": 25, "thirty": 30, "forty": 40, "fifty": 50,
    "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10, "बारह": 12,
    "पंद्रह": 15, "बीस": 20, "पच्चीस": 25, "तीस": 30, "चालीस": 40, "पचास": 50, "डेढ़": 1.5, "ढाई": 2.5,
}
_UNIT = r"(k|thousand|hazaar|hazar|hajar|हज़ार|हजार|lakh|lac|लाख)"


def money(text: str):
    """Parse an amount like '15000', '15k', '₹15,000', 'pandrah hazaar', 'dedh lakh', 'पंद्रह हज़ार'."""
    t = (text or "").lower().replace(",", "").replace("₹", " ")
    m = re.search(r"(\d+(?:\.\d+)?)\s*" + _UNIT, t)
    if m:
        mult = 100000 if m.group(2) in ("lakh", "lac", "लाख") else 1000
        return int(float(m.group(1)) * mult)
    for w in sorted(NUM_WORDS, key=len, reverse=True):
        pat = (re.escape(w) if DEVANAGARI.search(w) else r"(?<![a-z])" + re.escape(w) + r"(?![a-z])") + r"\s*" + _UNIT
        m = re.search(pat, t)
        if m:
            mult = 100000 if m.group(1) in ("lakh", "lac", "लाख") else 1000
            return int(NUM_WORDS[w] * mult)
    m = re.search(r"(?<!\d)(\d{2,7})(?!\d)", t)
    return int(m.group(1)) if m else None


def _sales_value(t: str):
    t = t.replace(",", "")
    worded = money(t) if any(w in t for w in NUM_WORDS if len(w) > 2) else None
    if worded and re.search(_UNIT, t):
        return worded
    if re.search(r"(?<![a-z])(lakh|lac)(?![a-z])|लाख", t):
        m = re.search(r"(\d+(?:\.\d+)?)\s*(lakh|lac|लाख)", t)
        return int(float(m.group(1)) * 100000) if m else 100000
    m = re.search(r"(\d+(?:\.\d+)?)\s*(k|thousand|hazaar|hazar|hajar|हज़ार|हजार)(?![a-z])", t)
    if m:
        return int(float(m.group(1)) * 1000)
    nums = [int(n) for n in re.findall(r"(?<!\d)(\d{2,6})(?!\d)", t)]
    nums = [n for n in nums if not (len(str(n)) == 6 and str(n).startswith(("41", "40", "42")))]
    if nums:
        return max(nums)
    if _has(t, ["bahut kam", "thoda", "very little", "not much", "बहुत कम", "थोड़ा"]):
        return 2500
    if _has(t, ["bahut zyada", "a lot", "lot of", "बहुत ज़्यादा"]):
        return 40000
    return None


def normalize(text: str) -> str:
    """Lower-case and strip Devanagari nukta so STT spellings (हड़पसर) match our keywords (हडपसर)."""
    t = unicodedata.normalize("NFD", (text or "").strip().lower()).replace("\u093c", "")
    return unicodedata.normalize("NFC", t)


def parse(text: str, expecting: str | None) -> dict:
    t = normalize(text)
    out: dict = {"raw": text, "lang": detect_language(text or "")}
    out["optout"] = _has(t, OPTOUT)

    handoff = None
    m_out = re.search(r"(\d+)\s*(outlets|branches|stores|shops|dukane|dukanein|आउटलेट|ब्रांच|दुकानें)", t)
    if _has(t, H_LEGAL):
        handoff = "Legal or complaint topic raised"
    elif _has(t, H_HUMAN):
        handoff = "Merchant asked for a human"
    elif _has(t, H_DISCOUNT):
        handoff = "Custom pricing or discount request"
    elif m_out and int(m_out.group(1)) >= 3 or _has(t, ["multiple shops", "many outlets", "kai dukane"]):
        handoff = "Large multi-outlet business"
    elif _has(t, H_ANGRY):
        handoff = "Merchant upset"
    out["handoff"] = handoff
    if m_out:
        out["outlets"] = int(m_out.group(1))
    out["confused"] = _has(t, H_CONFUSED)
    out["busy"] = _has(t, BUSY)
    out["price_q"] = _has(t, PRICE)
    out["hesitation"] = _has(t, HESITATE)
    strong_yes = _has(t, [w for w in YES if w not in ("ji", "जी", "please", "ok", "okay")])
    has_no = _has(t, NO)
    out["no"] = has_no and not strong_yes
    out["yes"] = _has(t, YES) and not out["no"]

    if expecting in ("greet", "shop", "sales", None):
        for key, words in SHOPS.items():
            if _has(t, words):
                out["shop_type"] = key
                break
    if expecting in ("sales", "shop"):
        v = _sales_value(t)
        if v is not None and (expecting == "sales" or _has(t, ["day", "daily", "roz", "rupees", "rs", "₹", "रोज़", "रोज"])):
            out["daily_sales_value"] = v
    if expecting == "setup":
        has_card, has_upi, has_cash = _has(t, CARD), _has(t, UPI), _has(t, CASH)
        if _has(t, COMPETITOR_SB):
            out["current_setup"] = "competitor_soundbox"
        elif has_card:
            out["current_setup"] = "card_machine"
        elif has_upi:
            out["current_setup"] = "upi_qr"
        elif has_cash:
            out["current_setup"] = "cash_only"
    pc = _pincode(t) if expecting == "pincode" else None
    if pc is None:
        m = re.search(r"(?<!\d)(4[0-2]\d{4})(?!\d)", t)
        pc = m.group(1) if m else None
    if pc is None and expecting == "pincode":
        pc = _area_pincode(t) or _spoken_digits(t)
    if pc:
        out["pincode"] = pc
    if expecting in ("slot",):
        if _has(t, SECOND) or re.fullmatch(r"\s*2\s*", t):
            out["slot_choice"] = 1
        elif _has(t, FIRST) or re.fullmatch(r"\s*1\s*", t):
            out["slot_choice"] = 0
    return out
