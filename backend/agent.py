"""Agent orchestrator: a guarded state machine that drives contact → qualification → recommendation →
allocation → booking → CRM, calling the tool layer. Works in 'auto' mode (simulated merchant persona)
or 'interactive' mode (a human plays the merchant from the dashboard)."""
import asyncio
import random
import time
import traceback

import bus
import db
import nlu
import rules
import sarvam
import tools

STATES = ["NEW", "CONSENT_OK", "CONTACTING", "QUALIFYING", "RECOMMENDING", "BOOKING", "CONFIRMED",
          "FOLLOW_UP", "HANDOFF", "CLOSED"]

# --------------------------------------------------------------------------- agent lines (hi, en)
LINES = {
    "greet": ("नमस्ते {name} जी! मैं Paytm की ऑटोमेटेड सेल्स असिस्टेंट हूँ। आपने Paytm {interest_hi} में रुचि दिखाई थी। यह कॉल क्वालिटी के लिए रिकॉर्ड हो रही है। क्या अभी दो मिनट बात कर सकते हैं?",
              "Namaste {name}! I'm Paytm's automated sales assistant. You showed interest in a Paytm {interest}. This call is recorded for quality. Is this a good time for two minutes?"),
    "greet_callback": ("नमस्ते {name} जी! मैं Paytm की ऑटोमेटेड असिस्टेंट हूँ, आपकी डेमो विज़िट तय करने के लिए दोबारा कॉल कर रही हूँ। यह कॉल रिकॉर्ड हो रही है। क्या दो मिनट हैं?",
                       "Namaste {name}! I'm Paytm's automated assistant, calling back to schedule your demo visit. This call is recorded. Do you have two minutes?"),
    "greet_chat": ("नमस्ते {name} जी! मैं Paytm की ऑटोमेटेड असिस्टेंट हूँ। कॉल कनेक्ट नहीं हुई, तो यहीं चैट पर बात कर लेते हैं। क्या अभी दो मिनट हैं?",
                   "Namaste {name}! I'm Paytm's automated assistant. The call didn't connect, so let's continue here on chat. Do you have two minutes?"),
    "ask_shop": ("बढ़िया! आपकी दुकान किस तरह की है — जैसे किराना, चाय की टपरी, रेस्टोरेंट या मेडिकल स्टोर?",
                 "Great! What kind of shop do you run — for example kirana, tea stall, restaurant or medical store?"),
    "ask_sales": ("धन्यवाद। आपकी दुकान में रोज़ लगभग कितनी बिक्री होती है?",
                  "Thank you. Roughly how much do you sell in a day?"),
    "ask_setup": ("और अभी ग्राहक आपको कैसे पेमेंट करते हैं — कैश, UPI QR, या कार्ड मशीन?",
                  "And how do customers pay you today — cash, UPI QR, or a card machine?"),
    "ask_pincode": ("आपकी दुकान का पिनकोड या इलाका क्या है?", "What is your shop's pincode or area?"),
    "reask_shop": ("माफ़ कीजिए, समझ नहीं पाई। आपकी दुकान किस चीज़ की है — किराना, चाय, खाना, मेडिकल, कपड़े?",
                   "Sorry, I didn't catch that. What do you sell — groceries, tea, food, medicines, clothes?"),
    "reask_sales": ("कोई अंदाज़ा बता दीजिए — जैसे 3 हज़ार, 10 हज़ार या 30 हज़ार रोज़?",
                    "Just a rough idea is fine — say 3 thousand, 10 thousand or 30 thousand a day?"),
    "reask_setup": ("ग्राहक ज़्यादातर कैश देते हैं, QR स्कैन करते हैं, या कार्ड से?",
                    "Do customers mostly pay cash, scan a QR, or use cards?"),
    "reask_pincode": ("कृपया पिनकोड या इलाके का नाम बताइए, जैसे कोथरूड या हडपसर।", "Please tell me the pincode or the area name, for example Kothrud or Hadapsar."),
    "price_early": ("ज़रूर, सही प्लान की कीमत मैं एक-दो सवालों के बाद बताती हूँ।",
                    "Sure — I'll share the exact plan price right after a couple of quick questions."),
    "recommend": ("आपकी जानकारी के हिसाब से {device} — {plan} प्लान, {price} — आपकी दुकान के लिए सबसे सही रहेगा, क्योंकि यह {reason_hi}। क्या मैं हमारे फील्ड एग्जीक्यूटिव की फ्री डेमो विज़िट बुक कर दूँ?",
                  "Based on what you told me, the {device} on the {plan} plan at {price} fits your shop best — it {reason}. Shall I book a free demo visit from our field executive?"),
    "price_answer": ("इंस्टॉलेशन बिल्कुल फ्री है, हमारे एग्जीक्यूटिव विज़िट पर ही लगा देंगे। {plan} प्लान {price} का है — इस कॉल पर मैं कोई और डिस्काउंट नहीं दे सकती। विज़िट बुक कर दूँ?",
                     "Installation is free — our executive sets it up during the visit. The {plan} plan is {price}; I can't offer other discounts on this call. Shall I book the visit?"),
    "reask_book": ("क्या मैं फ्री डेमो विज़िट बुक कर दूँ? बस हाँ या ना बता दीजिए।",
                   "Shall I book the free demo visit? Just yes or no is fine."),
    "offer_slots": ("{rep1} {slot1} आ सकते हैं, या {rep2} {slot2}। आपके लिए कौनसा ठीक रहेगा — पहला या दूसरा?",
                    "{rep1} can visit {slot1}, or {rep2} {slot2}. Which works better — the first or the second?"),
    "offer_one": ("{rep1} {slot1} आपकी दुकान पर आ सकते हैं। क्या यह समय ठीक है?",
                  "{rep1} can visit your shop {slot1}. Does that time work?"),
    "reask_slot": ("कृपया बताइए — पहला समय या दूसरा?", "Please tell me — the first time or the second?"),
    "confirm": ("हो गया! {rep} {slot} आपकी दुकान पर आएंगे। WhatsApp पर कन्फर्मेशन भेज दिया है। धन्यवाद {name} जी, आपका दिन शुभ हो!",
                "Done! {rep} will visit your shop {slot}. I've sent a WhatsApp confirmation. Thank you {name}, have a great day!"),
    "decline_visit": ("कोई बात नहीं। मैं WhatsApp पर पूरी जानकारी भेज देती हूँ, जब मन हो VISIT लिखकर विज़िट बुक कर लीजिए। धन्यवाद!",
                      "No problem. I'll send the details on WhatsApp — reply VISIT whenever you'd like to book. Thank you!"),
    "handoff": ("मैं समझती हूँ। मैं यह हमारे सीनियर साथी को दे रही हूँ — वो बातचीत की पूरी जानकारी के साथ जल्द आपको कॉल करेंगे। धन्यवाद!",
                "I understand. I'm passing this to a senior colleague who will call you back shortly with everything we discussed. Thank you!"),
    "optout": ("ठीक है, हम आपको दोबारा संपर्क नहीं करेंगे। आपका दिन शुभ हो!",
               "Understood — we won't contact you again. Have a good day!"),
    "busy": ("कोई बात नहीं, मैं बाद में कॉल करूँगी। धन्यवाद!", "No problem, I'll call you back later. Thank you!"),
    "no_coverage": ("धन्यवाद! आपका इलाका अभी हमारी फील्ड टीम के दायरे से थोड़ा बाहर है, इसलिए हमारे साथी आपको सेटअप के लिए खुद कॉल करेंगे।",
                    "Thank you! Your area is just outside our current field coverage, so a colleague will call you to arrange setup."),
    "silence": ("हैलो? लगता है आवाज़ नहीं आ रही। मैं WhatsApp पर मैसेज भेज रही हूँ।",
                "Hello? I think we got disconnected. I'll send you a WhatsApp message."),
}
REASON_HI = {
    "smart_pos": "कार्ड, UPI और बिलिंग एक ही मशीन में संभालता है",
    "card_machine": "कार्ड और UPI दोनों लेता है और हर पेमेंट पर आवाज़ से बताता है",
    "soundbox_pro": "4G पर हर UPI पेमेंट तुरंत बोलकर बताता है, Wi-Fi की ज़रूरत नहीं",
    "soundbox_lite": "कम खर्च में हर UPI पेमेंट बोलकर कन्फर्म करता है",
}
INTEREST_HI = {"soundbox": "साउंडबॉक्स", "card_machine": "कार्ड मशीन", "not_sure": "पेमेंट डिवाइस"}

# --------------------------------------------------------------------------- simulated merchant personas
PERSONAS = {
    "sunita_tea": {
        "gender": "female",
        "label": "Sunita · Tea stall · Hindi", "lang": "hi", "call": "answer", "interest": "soundbox",
        "desc": "Low sales, cash only, asks about price, books Soundbox Lite",
        "answers": {
            "greet": [("हाँ बोलिए, पर जल्दी बताइए, ग्राहक खड़े हैं।", "Yes, go ahead, but quickly — customers are waiting.")],
            "shop": [("मेरी चाय की टपरी है, कोथरूड में।", "I have a tea stall, in Kothrud.")],
            "sales": [("रोज़ का लगभग 3 हज़ार हो जाता है।", "About 3 thousand a day.")],
            "setup": [("ज़्यादातर कैश ही लेती हूँ।", "I mostly take cash.")],
            "pincode": [("411038", "411038")],
            "recommend": [("महीने का कितना लगेगा? और लगाने का अलग से चार्ज है क्या?", "How much per month? And is there a separate installation charge?"),
                          ("ठीक है, बुक कर दीजिए।", "Okay, please book it.")],
            "slot": [("पहला वाला ठीक है।", "The first one is fine.")],
        },
    },
    "rakesh_kirana": {
        "gender": "male",
        "label": "Rakesh · Kirana · Hindi", "lang": "hi", "call": "answer", "interest": "soundbox",
        "desc": "Medium sales, UPI QR, books Soundbox Pro 4G",
        "answers": {
            "greet": [("हाँ जी, बताइए।", "Yes, please tell me.")],
            "shop": [("किराना जनरल स्टोर है हमारा।", "We run a kirana general store.")],
            "sales": [("दिन का 15 हज़ार के आसपास।", "Around 15 thousand a day.")],
            "setup": [("PhonePe का QR लगा है, बाकी कैश।", "We have a PhonePe QR, otherwise cash.")],
            "pincode": [("411028, हडपसर।", "411028, Hadapsar.")],
            "recommend": [("हाँ, बुक कर दीजिए।", "Yes, book it.")],
            "slot": [("दूसरा वाला सही रहेगा।", "The second one works.")],
        },
    },
    "priya_restaurant": {
        "gender": "female",
        "label": "Priya · Restaurant · English", "lang": "en", "call": "answer", "interest": "card_machine",
        "desc": "High sales, has a slow bank card machine, books Card Machine",
        "answers": {
            "greet": [("Yes, I have a few minutes.", "Yes, I have a few minutes.")],
            "shop": [("We run a family restaurant in Viman Nagar.", "We run a family restaurant in Viman Nagar.")],
            "sales": [("Roughly 35k on a normal day, more on weekends.", "Roughly 35k on a normal day, more on weekends.")],
            "setup": [("We have a card machine from our bank but it's really slow.", "We have a card machine from our bank but it's really slow.")],
            "pincode": [("411014", "411014")],
            "recommend": [("Sounds good, please book it.", "Sounds good, please book it.")],
            "slot": [("The first one works.", "The first one works.")],
        },
    },
    "anil_chain": {
        "gender": "male",
        "label": "Anil · 6-outlet chain · handoff", "lang": "en", "call": "answer", "interest": "card_machine",
        "desc": "Multi-outlet business asking for bulk discount → human handoff",
        "answers": {
            "greet": [("Yes, go ahead.", "Yes, go ahead.")],
            "shop": [("I run a sweets business — we have 6 outlets across Pune. Can you give a bulk discount?",
                      "I run a sweets business — we have 6 outlets across Pune. Can you give a bulk discount?")],
        },
    },
    "meena_whatsapp": {
        "gender": "female",
        "label": "Meena · Vegetables · WhatsApp rescue", "lang": "hi", "call": "no_answer_then_whatsapp", "interest": "soundbox",
        "desc": "Misses the call, replies to the WhatsApp template within seconds (60-second rescue)",
        "answers": {
            "whatsapp": [("हाँ, कॉल नहीं उठा पाई। यहीं बात कर लेते हैं।", "Yes, I couldn't pick up the call. Let's talk here.")],
            "greet": [("हाँ जी, बताइए।", "Yes, tell me.")],
            "shop": [("सब्ज़ी और फल का ठेला है, कात्रज में।", "I have a vegetable and fruit cart in Katraj.")],
            "sales": [("4 हज़ार रोज़ के आसपास।", "Around 4 thousand a day.")],
            "setup": [("Google Pay का QR है।", "I have a Google Pay QR.")],
            "pincode": [("411046", "411046")],
            "recommend": [("ठीक है, बुक कर दीजिए।", "Okay, book it.")],
            "slot": [("पहला।", "The first.")],
        },
    },
    "vikas_competitor": {
        "gender": "male",
        "label": "Vikas · Medical · competitor device", "lang": "hi", "call": "answer", "interest": "soundbox",
        "desc": "Pharmacy with a competitor soundbox, hesitant, still books",
        "answers": {
            "greet": [("हाँ बोलिए।", "Yes, go on.")],
            "shop": [("मेडिकल स्टोर है, बानेर में।", "It's a medical store in Baner.")],
            "sales": [("25 हज़ार रोज़।", "25 thousand a day.")],
            "setup": [("दूसरी कंपनी का साउंडबॉक्स लगा हुआ है।", "We already have another company's soundbox.")],
            "pincode": [("411045", "411045")],
            "recommend": [("सोचना पड़ेगा... पर ठीक है, डेमो के लिए बुला लीजिए।", "I'll have to think... but okay, call them for a demo.")],
            "slot": [("पहला ठीक है।", "The first is fine.")],
        },
    },
    "optout_raj": {
        "gender": "male",
        "label": "Raj · opts out", "lang": "hi", "call": "answer", "interest": "soundbox",
        "desc": "Asks not to be called again → instant opt-out + DNC",
        "answers": {"greet": [("मुझे इंटरेस्ट नहीं है, दोबारा कॉल मत करना।", "I'm not interested, don't call again.")]},
    },
    "never_answers": {
        "gender": "male",
        "label": "Ghost lead · never answers", "lang": "hi", "call": "never", "interest": "soundbox",
        "desc": "3 unanswered attempts → attempt cap → leakage detector flags it",
        "answers": {},
    },
    "voice_fail": {
        "gender": "male",
        "label": "Deepak · voice fails → chat", "lang": "en", "call": "voice_fail", "interest": "soundbox",
        "desc": "Telephony fails, agent falls back to chat and completes booking",
        "answers": {
            "greet": [("Yes sure, chat is fine.", "Yes sure, chat is fine.")],
            "shop": [("Mobile and electronics shop.", "Mobile and electronics shop.")],
            "sales": [("Around 12000 per day.", "Around 12000 per day.")],
            "setup": [("Cash and UPI QR.", "Cash and UPI QR.")],
            "pincode": [("411018", "411018")],
            "recommend": [("Ok go ahead.", "Ok go ahead.")],
            "slot": [("second", "second")],
        },
    },
}

SESSIONS: dict[str, "Session"] = {}


def _fmt(key: str, lang: str, **kw) -> tuple[str, str]:
    hi, en = LINES[key]

    class _D(dict):
        def __missing__(self, k):
            return ""
    d = _D(kw)
    en_txt = en.format_map(d)
    if lang != "hi":
        return en_txt, en_txt
    hi_txt = hi.format_map(d).replace("today, ", "आज ").replace("tomorrow, ", "कल ")
    return hi_txt, en_txt


class Session:
    def __init__(self, lead: dict, mode: str, persona_key: str | None, callback=False, audio=False):
        self.lead_id = lead["id"]
        self.name = (lead["name"] or "").split(" ")[0]
        self.lead_name = lead["name"]
        self.lang = lead["language"] if lead["language"] in ("hi", "en") else "hi"
        self.interest = lead.get("interest") or "soundbox"
        self.mode = mode
        self.persona_key = persona_key if mode == "auto" else None
        self.persona = PERSONAS.get(persona_key) if mode == "auto" else None
        self.persona_idx: dict[str, int] = {}
        self.state = "NEW"
        self.channel = "voice"
        self.expecting: str | None = None
        self.turns: list[dict] = []
        self.reasks: dict[str, int] = {}
        self.slot_options: list[dict] = []
        self.recommendation: dict | None = None
        self.score: dict | None = None
        self.visit: dict | None = None
        self.handoff: dict | None = None
        self.interaction_id: int | None = None
        self.started_at = time.time()
        self.call_started_at: float | None = None
        self.ended = False
        self.outcome: str | None = None
        self.callback = callback
        self.inbox: asyncio.Queue = asyncio.Queue()
        self.activity: str | None = None
        self.task: asyncio.Task | None = None
        self.answered = False
        self.audio = bool(audio or mode == "voice") and sarvam.enabled()
        self.answer_fut: asyncio.Future = asyncio.get_event_loop().create_future()
        self.ai_calls = 0

    # ------------------------------------------------------------------ snapshot / events
    def snapshot(self) -> dict:
        L = tools.lead(self.lead_id) or {}
        return {
            "lead_id": self.lead_id, "name": self.lead_name, "business_name": L.get("business_name"),
            "mode": self.mode, "persona": self.persona_key,
            "persona_label": self.persona["label"] if self.persona else ("Live voice call (you are the merchant)" if self.mode == "voice" else "Live chat (you are the merchant)"),
            "audio": self.audio, "ai_calls": self.ai_calls,
            "lang": self.lang, "state": self.state, "channel": self.channel, "expecting": self.expecting,
            "turns": self.turns, "profile": tools.profile(self.lead_id), "recommendation": self.recommendation,
            "score": self.score, "slot_options": self.slot_options, "visit": self.visit, "handoff": self.handoff,
            "ended": self.ended, "outcome": self.outcome, "started_at": self.started_at,
            "call_started_at": self.call_started_at, "activity": self.activity, "live": not self.ended,
            "created_at": L.get("created_at"), "first_contact_at": L.get("first_contact_at"),
            "source": L.get("source"), "phone_masked": L.get("phone_masked"), "attempts": L.get("attempts"),
        }

    def publish(self):
        bus.publish("session", {"lead_id": self.lead_id, "state": self.state, "channel": self.channel,
                                "activity": self.activity, "ended": self.ended, "outcome": self.outcome,
                                "expecting": self.expecting})

    async def set_state(self, state: str):
        prev = self.state
        self.state = state
        if state in STATES:
            tools.set_lead(self.lead_id, status=state)
        tools.log_action(self.lead_id, "state_transition", {"from": prev}, {"to": state}, "ok", "orchestrator")
        self.publish()

    def set_activity(self, a: str | None):
        self.activity = a
        self.publish()

    def _persist(self):
        if self.interaction_id is None:
            self.interaction_id = db.ex(
                "INSERT INTO interactions(lead_id, channel, started_at, transcript) VALUES(?,?,?,?)",
                (self.lead_id, self.channel, time.time(), self.turns))
        else:
            db.update("interactions", "id", self.interaction_id, {"transcript": self.turns, "channel": self.channel})

    def add_turn(self, speaker: str, text: str, en: str | None = None, meta: dict | None = None):
        turn = {"i": len(self.turns), "speaker": speaker, "text": text, "en": en or text, "lang": self.lang,
                "channel": self.channel, "ts": time.time(), "meta": meta or {}}
        self.turns.append(turn)
        self._persist()
        bus.publish("turn", {"lead_id": self.lead_id, "turn": turn})
        return turn

    async def _pause(self, lo: float, hi: float):
        await asyncio.sleep(random.uniform(lo, hi))

    async def say(self, key: str, **kw):
        text, en = _fmt(key, self.lang, name=self.name, **kw)
        await self.speak(text, en, {"line": key})

    async def speak(self, text: str, en: str, meta: dict | None = None):
        meta = dict(meta or {})
        self.set_activity("agent_thinking")
        if self.audio:
            res = await sarvam.tts(text, self.lang, sarvam.AGENT_VOICE)
            if res:
                meta.update(audio=res[0], duration=round(res[1], 2))
        else:
            await self._pause(0.6, 1.1)
        self.set_activity("agent_speaking")
        self.add_turn("agent", text, en, meta)
        if meta.get("duration"):
            await asyncio.sleep(meta["duration"] + 0.25)
        else:
            await self._pause(0.3, 0.6)
        self.set_activity(None)

    def system(self, text: str, meta: dict | None = None):
        self.add_turn("system", text, text, meta)

    # ------------------------------------------------------------------ merchant replies
    async def get_reply(self, stage: str):
        if self.mode in ("interactive", "voice"):
            self.set_activity("waiting_merchant")
            try:
                item = await asyncio.wait_for(self.inbox.get(), timeout=75 if self.mode == "voice" else 300)
            except asyncio.TimeoutError:
                return None
            self.set_activity(None)
            if isinstance(item, tuple):
                return item
            return item, None, {}
        answers = (self.persona or {}).get("answers", {}).get(stage)
        if not answers:
            return None
        idx = self.persona_idx.get(stage, 0)
        self.persona_idx[stage] = idx + 1
        text, en = answers[min(idx, len(answers) - 1)]
        self.set_activity("merchant_speaking")
        meta = {}
        if self.audio:
            g = (self.persona or {}).get("gender", "male")
            res = await sarvam.tts(text, "hi" if nlu.DEVANAGARI.search(text) else "en", sarvam.VOICES[g])
            if res:
                meta = {"audio": res[0], "duration": round(res[1], 2)}
            await self._pause(0.3, 0.6)
        else:
            await self._pause(1.4, 2.3)
        self.set_activity(None)
        return text, en, meta

    # ------------------------------------------------------------------ main flow
    async def run(self):
        try:
            await self._run()
        except asyncio.CancelledError:
            self.system("Session stopped by operator")
            self.outcome = self.outcome or "stopped"
        except Exception as e:  # never crash the server on a session bug
            traceback.print_exc()
            self.system(f"Agent error: {e}. Lead routed to human queue.")
            tools.handoff_to_human(self.lead_id, "Agent error", f"Session failed: {e}", actor="orchestrator")
            self.outcome = "error"
        finally:
            self.ended = True
            self.activity = None
            if self.interaction_id:
                db.update("interactions", "id", self.interaction_id,
                          {"ended_at": time.time(), "outcome": self.outcome,
                           "summary": (tools.lead(self.lead_id) or {}).get("summary")})
            self.publish()
            bus.publish("session_end", {"lead_id": self.lead_id, "outcome": self.outcome})

    async def _run(self):
        await self.set_state("NEW")
        self.set_activity("checking_consent")
        await self._pause(0.4, 0.7)
        gate = tools.check_consent(self.lead_id)
        if not gate["allowed"]:
            self.system(f"Contact blocked by consent gate: {gate['reason']}")
            status = "FOLLOW_UP" if "hours" in gate["reason"] or "cap" in gate["reason"] else "BLOCKED"
            tools.update_crm(self.lead_id, f"Contact blocked: {gate['reason']}.", status, lost_reason=gate["reason"] if status == "BLOCKED" else None)
            self.outcome = "blocked"
            self.state = status
            return
        await self.set_state("CONSENT_OK")
        if not await self.contact():
            return
        await self.set_state("QUALIFYING")
        self.call_started_at = time.time()
        greet = "greet_chat" if self.channel != "voice" else ("greet_callback" if self.callback else "greet")
        await self.say(greet, interest=rules.INTEREST_LABEL.get(self.interest, "Soundbox"),
                       interest_hi=INTEREST_HI.get(self.interest, "साउंडबॉक्स"))
        self.expecting = "greet"
        self.publish()
        await self.loop()

    async def contact(self) -> bool:
        s = tools.get_settings()
        await self.set_state("CONTACTING")
        if self.mode == "voice":
            return await self.ring()
        mode = "answer" if self.mode == "interactive" else (self.persona or {}).get("call", "answer")
        attempt = 0
        while True:
            attempt += 1
            self.set_activity("dialling")
            await self._pause(1.0, 1.6)
            if mode == "voice_fail":
                tools.place_call(self.lead_id, "failed")
                self.system("Voice call failed (carrier error). Falling back to chat.")
                tools.send_message(self.lead_id, "TPL_CHAT_LINK")
                self.channel = "chat"
                self.answered = True
                return True
            if mode in ("answer",):
                tools.place_call(self.lead_id, "answered")
                self.system("Call connected · agent disclosed as automated · recording notice given")
                self.answered = True
                return True
            # no answer
            tools.place_call(self.lead_id, "no_answer")
            self.system(f"Attempt {attempt}: no answer")
            if mode == "no_answer_then_whatsapp":
                tools.send_message(self.lead_id, "TPL_MISSED_CALL")
                self.system("WhatsApp follow-up sent (approved template TPL_MISSED_CALL)")
                self.set_activity("waiting_merchant")
                await self._pause(2.5, 3.5)
                self.channel = "whatsapp"
                reply = await self.get_reply("whatsapp")
                if reply:
                    self.add_turn("merchant", reply[0], reply[1], reply[2] if len(reply) > 2 else {})
                    db.ex("INSERT INTO messages(lead_id, channel, template_id, recipient, body, direction, ts) VALUES(?,?,?,?,?,?,?)",
                          (self.lead_id, "whatsapp", None, "agent", reply[0], "in", time.time()))
                self.system("Merchant replied on WhatsApp — continuing the conversation there (60-second rescue)")
                self.answered = True
                return True
            if attempt == 1:
                tools.send_message(self.lead_id, "TPL_MISSED_CALL")
            if attempt >= s["max_attempts_per_day"]:
                tools.send_message(self.lead_id, "TPL_RETRY_FINAL")
                sc = tools.score_lead(self.lead_id, answered=False)
                self.score = sc
                tools.update_crm(self.lead_id, f"No answer after {attempt} attempts. Daily attempt cap reached; "
                                 "approved SMS sent. Marked at-risk for the leakage detector.", "FOLLOW_UP", "unknown")
                self.state = "FOLLOW_UP"
                self.outcome = "no_answer_cap"
                self.system("Attempt cap reached — lead marked at-risk")
                import leakage
                leakage.scan()
                return False
            delay = s["retry_delay_demo_sec"]
            tools.schedule_retry(self.lead_id, delay)
            await self.set_state("FOLLOW_UP")
            self.set_activity("retry_scheduled")
            self.system(f"Retry scheduled in {delay}s (30 min in production)")
            await asyncio.sleep(delay)
            gate = tools.check_consent(self.lead_id)
            if not gate["allowed"]:
                self.system(f"Retry blocked: {gate['reason']}")
                self.outcome = "blocked"
                return False
            await self.set_state("CONTACTING")

    async def ring(self) -> bool:
        L = tools.lead(self.lead_id)
        self.set_activity("ringing")
        tools.place_call(self.lead_id, "ringing")
        self.system("Calling the merchant… answer the incoming call in the dashboard")
        bus.publish("ring", {"lead_id": self.lead_id, "name": self.lead_name, "business": L.get("business_name"),
                             "lang": self.lang, "phone": L.get("phone_masked"), "created_by": L.get("created_by")})
        try:
            answered = await asyncio.wait_for(asyncio.shield(self.answer_fut), timeout=45)
        except asyncio.TimeoutError:
            answered = False
        if answered:
            self.answered = True
            tools.log_action(self.lead_id, "call_answered", {"lead_id": self.lead_id},
                             {"answered": True, "engine": "Sarvam saarika STT + bulbul TTS"}, "ok", "telephony")
            self.system("Call connected · agent disclosed as automated · recording notice given")
            return True
        tools.log_action(self.lead_id, "call_answered", {"lead_id": self.lead_id}, {"answered": False}, "warn", "telephony")
        self.system("No answer / call declined")
        tools.send_message(self.lead_id, "TPL_MISSED_CALL")
        tools.schedule_retry(self.lead_id, tools.get_settings()["retry_delay_demo_sec"])
        tools.update_crm(self.lead_id, "Merchant did not answer the voice call; WhatsApp template sent and retry scheduled.",
                         "FOLLOW_UP", "unknown")
        self.state = "FOLLOW_UP"
        self.outcome = "no_answer"
        return False

    def answer(self, yes: bool):
        if not self.answer_fut.done():
            self.answer_fut.set_result(bool(yes))

    async def loop(self):
        silent = 0
        while not self.ended:
            reply = await self.get_reply(self.expecting)
            if reply is None:
                silent += 1
                if self.mode == "auto" or silent >= 1:
                    await self.say("silence")
                    tools.send_message(self.lead_id, "TPL_CALLBACK_LATER")
                    tools.schedule_retry(self.lead_id, 1800)
                    await self.finish("FOLLOW_UP", "Merchant went silent; WhatsApp sent and callback scheduled.",
                                      "neutral", "silent")
                    return
                continue
            text, en, meta = reply if len(reply) == 3 else (reply[0], reply[1], {})
            done = await self.handle(text, en, meta)
            if done:
                return

    async def handle(self, text: str, en: str | None, meta: dict | None = None) -> bool:
        meta = dict(meta or {})
        nl = nlu.parse(text, self.expecting)
        ai = None
        if self._needs_ai(nl):
            self.set_activity("ai_understanding")
            ai = await self.ai_understand(text, nl)
        understood = self._understood(nl)
        if ai:
            understood.append("✦ Sarvam AI")
        if (not en or en == text) and nl["lang"] == "hi" and self.mode in ("interactive", "voice") and sarvam.enabled():
            en = await sarvam.translate(text) or en
        self.add_turn("merchant", text, en or text, {**meta, "understood": understood})
        if meta.get("duration") and self.mode == "auto":
            await asyncio.sleep(meta["duration"] + 0.2)
        if ai and ai.get("answer"):
            ans = str(ai["answer"])[:400]
            ans_en = ans if self.lang == "en" else (await sarvam.translate(ans) or ans)
            await self.speak(ans, ans_en, {"line": "ai_answer", "ai": True})
            if self.expecting in ("shop", "sales", "setup", "pincode", "slot"):
                await self.say("reask_" + self.expecting)
            elif self.expecting == "recommend":
                await self.say("reask_book")
            elif self.expecting == "greet":
                self.expecting = "shop"
                await self.say("ask_shop")
            return False
        if self.expecting == "greet" and nl["lang"] != self.lang and self.mode in ("interactive", "voice"):
            self.lang = nl["lang"]
            tools.set_lead(self.lead_id, language=self.lang)
            tools.log_action(self.lead_id, "switch_language", {"detected": nl["lang"]}, {"language": self.lang}, "ok", "orchestrator")

        if nl["optout"]:
            tools.opt_out(self.lead_id)
            await self.say("optout")
            await self.finish("CLOSED", f"{self.lead_name} asked not to be contacted. Opt-out recorded instantly and number added to DNC.",
                              "negative", "opted_out", lost_reason="Opted out", skip_status=False)
            return True
        if nl["handoff"] or (nl["confused"] and self.reasks.get(self.expecting, 0) >= 1):
            reason = nl["handoff"] or "Merchant confused"
            if nl.get("outlets"):
                tools.save_profile(self.lead_id, {"outlets": nl["outlets"], **({"shop_type": nl["shop_type"]} if nl.get("shop_type") else {})})
            await self.say("handoff")
            summary = self.summary(extra=f"Handoff reason: {reason}.")
            self.handoff = tools.handoff_to_human(self.lead_id, reason, summary)
            tools.send_message(self.lead_id, "TPL_HANDOFF_ALERT", {"reason": reason, "summary": summary[:120]})
            await self.set_state("HANDOFF")
            await self.finish("HANDOFF", summary, "neutral", "handoff")
            return True
        if nl["busy"] and self.expecting in ("greet", "shop", "sales", "setup", "pincode"):
            await self.say("busy")
            tools.schedule_retry(self.lead_id, 3600, "1 hour")
            tools.send_message(self.lead_id, "TPL_CALLBACK_LATER")
            await self.finish("FOLLOW_UP", f"{self.lead_name} was busy; callback scheduled.", "neutral", "callback")
            return True

        # Capture any profile fields mentioned
        fields = {}
        for k in ("shop_type", "daily_sales_value", "current_setup", "pincode", "outlets"):
            if nl.get(k) is not None:
                fields[k] = nl[k]
        if nl["price_q"]:
            fields["asked_price"] = 1
        if nl["hesitation"]:
            fields["hesitation"] = 1
        if fields:
            tools.save_profile(self.lead_id, fields)

        ex = self.expecting
        if ex in ("greet", "shop", "sales", "setup", "pincode"):
            if ex == "greet" and nl["no"]:
                await self.say("busy")
                tools.schedule_retry(self.lead_id, 3600, "1 hour")
                await self.finish("FOLLOW_UP", f"{self.lead_name} not available now; callback scheduled.", "neutral", "callback")
                return True
            key_for = {"shop": "shop_type", "sales": "daily_sales_value", "setup": "current_setup", "pincode": "pincode"}
            if ex != "greet" and key_for[ex] not in fields:
                if nl["price_q"]:
                    await self.say("price_early")
                n = self.reasks.get(ex, 0)
                self.reasks[ex] = n + 1
                if n >= 2:
                    reason = "Merchant confused"
                    await self.say("handoff")
                    summary = self.summary(extra=f"Could not capture {ex} after 3 tries.")
                    self.handoff = tools.handoff_to_human(self.lead_id, reason, summary)
                    await self.set_state("HANDOFF")
                    await self.finish("HANDOFF", summary, "neutral", "handoff")
                    return True
                await self.say("reask_" + ex)
                return False
            if nl["price_q"] and ex != "greet":
                await self.say("price_early")
            return await self.ask_next()

        if ex == "recommend":
            rec = self.recommendation
            if nl["price_q"]:
                await self.say("price_answer", plan=rec["plan"], price=rec["price"])
                self.score = tools.score_lead(self.lead_id)
                return False
            if nl["yes"]:
                return await self.booking()
            if nl["no"]:
                await self.say("decline_visit")
                tools.send_message(self.lead_id, "TPL_INFO_BROCHURE", {"device": rec["device"], "plan": rec["plan"], "price": rec["price"]})
                tools.save_profile(self.lead_id, {"hesitation": 1})
                self.score = tools.score_lead(self.lead_id)
                await self.finish("FOLLOW_UP", self.summary(extra="Declined the visit for now; brochure sent on WhatsApp."),
                                  "neutral", "declined", lost_reason="Not interested now")
                return True
            await self.say("reask_book")
            return False

        if ex == "slot":
            idx = nl.get("slot_choice")
            if idx is None and nl["yes"]:
                idx = 0
            if idx is None and nl["no"]:
                await self.say("decline_visit")
                tools.send_message(self.lead_id, "TPL_INFO_BROCHURE", {"device": self.recommendation["device"]})
                await self.finish("FOLLOW_UP", self.summary(extra="No suitable slot; merchant will reply VISIT."), "neutral", "no_slot")
                return True
            if idx is None or idx >= len(self.slot_options):
                n = self.reasks.get("slot", 0)
                self.reasks["slot"] = n + 1
                if n >= 2:
                    idx = 0
                else:
                    await self.say("reask_slot")
                    return False
            return await self.book(self.slot_options[idx])
        return False

    def _needs_ai(self, nl: dict) -> bool:
        if not sarvam.enabled() or self.mode == "auto":
            return False
        if nl["optout"] or nl["handoff"] or nl["busy"]:
            return False
        ex = self.expecting
        key = {"shop": "shop_type", "sales": "daily_sales_value", "setup": "current_setup", "pincode": "pincode"}.get(ex)
        if key:
            return nl.get(key) is None
        if ex == "recommend":
            return not (nl["price_q"] or nl["yes"] or nl["no"])
        if ex == "slot":
            return nl.get("slot_choice") is None and not (nl["yes"] or nl["no"])
        if ex == "greet":
            return not (nl["yes"] or nl["no"]) and "?" in (nl["raw"] or "")
        return False

    async def ai_understand(self, text: str, nl: dict) -> dict | None:
        """Sarvam LLM fallback: classify intent, extract the expected field, and answer off-script questions
        strictly from the rule table. The output is validated before it can change anything."""
        ex = self.expecting
        asked = {"greet": "whether this is a good time to talk", "shop": "what kind of shop they run",
                 "sales": "their approximate daily sales in rupees",
                 "setup": "how customers pay today (cash, UPI QR, card machine, other soundbox)",
                 "pincode": "the shop's 6-digit pincode",
                 "recommend": "whether to book a free demo visit for " + (self.recommendation or {}).get("device", "the device"),
                 "slot": "which of two visit time options they prefer (1 or 2)"}.get(ex, "a question")
        facts = "; ".join(f"{d['device']} on {d['plan']} plan costs {d['price']}" for d in rules.DEVICES.values())
        lang = "Hindi (Devanagari script)" if self.lang == "hi" else "English"
        sys_p = ("You are the language-understanding module of Paytm's automated merchant sales agent. Merchants speak Hindi, "
                 "Hinglish or English. Output ONLY one JSON object and nothing else.")
        user_p = (f"The agent asked the merchant {asked}. The merchant said: \"{text}\".\n"
                  "Return JSON with keys:\n"
                  "intent: one of answer, question, yes, no, price, optout, human, discount, busy, other;\n"
                  "value: for shop type one of [kirana, restaurant, medical, sweets, tea_stall, clothing, electronics, salon, hardware, vegetable]; "
                  "for daily sales an integer number of rupees per day; for payment setup one of [cash_only, upi_qr, card_machine, competitor_soundbox]; "
                  "for pincode a 6-digit string, or the Pune area name if they name a locality; for visit slot 1 or 2; otherwise null;\n"
                  f"answer: only when intent is question, a friendly answer of at most 2 short sentences in {lang}, using ONLY these facts: "
                  f"{facts}; installation is free during the demo visit; KYC needs PAN, Aadhaar, a shop photo and a bank account; "
                  "the soundbox announces every UPI payment aloud. Battery life, warranty, specs, settlement times and anything else not listed "
                  "are NOT known: for those, never guess any number, just say our field executive will explain it during the free demo visit. "
                  "If the facts do not cover the question, say our field executive "
                  "will explain it during the free demo visit. Never invent prices and never offer discounts. Otherwise null.\n"
                  "Rules: if the merchant asks anything instead of answering, intent is question. Convert spoken numbers "
                  "(e.g. pandrah hazaar = 15000, dedh lakh = 150000) to digits.\n"
                  "Examples: \"hum dawai bechte hain\" -> {\"intent\":\"answer\",\"value\":\"medical\",\"answer\":null}; "
                  "\"roz ka bees hazaar\" -> {\"intent\":\"answer\",\"value\":20000,\"answer\":null}; "
                  "\"battery kitne din chalti hai?\" -> {\"intent\":\"question\",\"value\":null,\"answer\":\"...\"}")
        t0 = time.perf_counter()
        raw = await sarvam.chat([{"role": "system", "content": sys_p}, {"role": "user", "content": user_p}], max_tokens=260)
        d = sarvam.parse_json(raw)
        self.ai_calls += 1
        if not d:
            tools.log_action(self.lead_id, "sarvam_llm_understand", {"expecting": ex, "text": text},
                             {"error": "no JSON", "raw": (raw or "")[:200]}, "warn", "agent", t0)
            return None
        intent = str(d.get("intent") or "other").lower()
        v = d.get("value")
        applied = {}
        try:
            if ex == "shop" and v in rules.SHOP_TYPES:
                nl["shop_type"] = applied["shop_type"] = v
            elif ex == "sales" and v is not None:
                num = nlu.money(str(v))
                if num and 50 <= num <= 10_000_000:
                    nl["daily_sales_value"] = applied["daily_sales_value"] = num
            elif ex == "setup" and v in rules.SETUPS:
                nl["current_setup"] = applied["current_setup"] = v
            elif ex == "pincode" and v:
                pc = str(v).strip() if len(str(v).strip()) == 6 and str(v).strip().isdigit() else nlu._area_pincode(str(v))
                if pc:
                    nl["pincode"] = applied["pincode"] = pc
            elif ex == "slot" and str(v).strip() in ("1", "2"):
                nl["slot_choice"] = applied["slot_choice"] = int(str(v).strip()) - 1
        except (TypeError, ValueError):
            pass
        if intent == "yes":
            nl["yes"], nl["no"] = True, False
        elif intent == "no":
            nl["no"], nl["yes"] = True, False
        elif intent == "price":
            nl["price_q"] = True
        elif intent == "optout":
            nl["optout"] = True
        elif intent == "human":
            nl["handoff"] = "Merchant asked for a human"
        elif intent == "discount":
            nl["handoff"] = "Custom pricing or discount request"
        elif intent == "busy":
            nl["busy"] = True
        answer = d.get("answer") if intent == "question" and not applied else None
        out = {"intent": intent, "value": v, "applied": applied, "answer": answer}
        tools.log_action(self.lead_id, "sarvam_llm_understand", {"expecting": ex, "text": text, "model": sarvam.CHAT_MODEL},
                         out, "ok", "agent", t0)
        return out

    def _understood(self, nl: dict) -> list[str]:
        u = []
        if nl.get("shop_type"):
            u.append(f"Shop: {rules.SHOP_TYPES[nl['shop_type']]['label']}")
        if nl.get("daily_sales_value") is not None:
            u.append(f"Sales: ₹{nl['daily_sales_value']:,}/day")
        if nl.get("current_setup"):
            u.append(f"Setup: {rules.SETUPS[nl['current_setup']]}")
        if nl.get("pincode"):
            u.append(f"Pincode: {nl['pincode']}")
        if nl.get("outlets"):
            u.append(f"Outlets: {nl['outlets']}")
        if nl.get("price_q"):
            u.append("Asked about price")
        if nl.get("hesitation"):
            u.append("Hesitation")
        if nl.get("slot_choice") is not None:
            u.append(f"Picked option {nl['slot_choice'] + 1}")
        if nl.get("optout"):
            u.append("Opt-out")
        if nl.get("handoff"):
            u.append(f"Handoff: {nl['handoff']}")
        if nl.get("busy"):
            u.append("Busy / later")
        if not u and nl.get("yes"):
            u.append("Yes")
        if not u and nl.get("no"):
            u.append("No")
        return u

    async def ask_next(self) -> bool:
        p = tools.profile(self.lead_id)
        for field, key, exp in (("shop_type", "ask_shop", "shop"), ("daily_sales_band", "ask_sales", "sales"),
                                ("current_setup", "ask_setup", "setup"), ("pincode", "ask_pincode", "pincode")):
            if not p.get(field):
                self.expecting = exp
                self.publish()
                await self.say(key)
                return False
        return await self.recommend()

    async def recommend(self) -> bool:
        await self.set_state("RECOMMENDING")
        self.set_activity("tool:recommend_device")
        await self._pause(0.5, 0.8)
        self.recommendation = tools.recommend_device(self.lead_id)
        self.set_activity("tool:score_lead")
        await self._pause(0.4, 0.6)
        self.score = tools.score_lead(self.lead_id, answered=True)
        self.publish()
        rec = self.recommendation
        self.expecting = "recommend"
        await self.say("recommend", device=rec["device"], plan=rec["plan"], price=rec["price"], reason=rec["reason"],
                       reason_hi=REASON_HI.get(rec["key"], ""))
        return False

    async def booking(self) -> bool:
        await self.set_state("BOOKING")
        self.set_activity("tool:find_slots")
        await self._pause(0.6, 1.0)
        res = tools.find_slots(self.lead_id)
        self.slot_options = res["options"][:2]
        self.publish()
        if not self.slot_options:
            await self.say("no_coverage")
            summary = self.summary(extra="No eligible field rep: " + (res.get("reason") or "no capacity") + ".")
            self.handoff = tools.handoff_to_human(self.lead_id, "Outside field coverage / no capacity", summary)
            await self.set_state("HANDOFF")
            await self.finish("HANDOFF", summary, "positive", "no_coverage")
            return True
        o = self.slot_options
        self.expecting = "slot"
        if len(o) == 1:
            await self.say("offer_one", rep1=o[0]["rep_name"], slot1=o[0]["slot_label"])
        else:
            await self.say("offer_slots", rep1=o[0]["rep_name"], slot1=o[0]["slot_label"],
                           rep2=o[1]["rep_name"], slot2=o[1]["slot_label"])
        return False

    async def book(self, opt: dict) -> bool:
        self.set_activity("tool:book_visit")
        await self._pause(0.5, 0.9)
        res = tools.book_visit(self.lead_id, opt["rep_id"], opt["slot_start"], alloc=opt)
        if not res.get("booked"):
            self.system("Slot was taken a moment ago — re-running allocation")
            return await self.booking()
        self.visit = res
        await self.set_state("CONFIRMED")
        await self.say("confirm", rep=res["rep"], slot=res["slot"])
        rec = self.recommendation
        tools.send_message(self.lead_id, "TPL_VISIT_CONFIRM", {"rep": res["rep"], "slot": res["slot"], "device": rec["device"]})
        L = tools.lead(self.lead_id)
        tools.send_message(self.lead_id, "TPL_REP_BRIEFING", {"rep": res["rep"], "visit_id": res["visit_id"], "slot": res["slot"],
                                                              "device": rec["device"], "score": L.get("score"),
                                                              "area": tools.profile(self.lead_id).get("area")})
        await self.finish("CONFIRMED", self.summary(extra=f"Visit booked with {res['rep']} {res['slot']}."), "positive", "visit_booked")
        return True

    def summary(self, extra: str = "") -> str:
        p = tools.profile(self.lead_id)
        L = tools.lead(self.lead_id)
        parts = [f"{self.lead_name}" + (f" ({L.get('business_name')})" if L.get("business_name") else "")]
        if p.get("shop_type"):
            parts.append(f"runs a {rules.SHOP_TYPES[p['shop_type']]['label'].lower()}")
        if p.get("area"):
            parts.append(f"in {p['area']} ({p.get('pincode')})")
        s = " ".join(parts) + "."
        if p.get("daily_sales_band"):
            s += f" Daily sales {rules.SALES_BANDS[p['daily_sales_band']]}."
        if p.get("current_setup"):
            s += f" Currently: {rules.SETUPS[p['current_setup']].lower()}."
        if self.recommendation:
            s += f" Recommended {self.recommendation['device']} ({self.recommendation['plan']}, {self.recommendation['price']})."
        if L.get("score") is not None:
            s += f" Score {L['score']} ({L.get('temperature')})."
        if p.get("asked_price"):
            s += " Asked about pricing/installation."
        if extra:
            s += " " + extra
        return s

    async def finish(self, status: str, summary: str, sentiment: str, outcome: str, lost_reason=None, skip_status=False):
        self.expecting = None
        self.outcome = outcome
        if not skip_status:
            self.state = status
        tools.update_crm(self.lead_id, summary, status, sentiment, lost_reason)
        self.publish()


def start_session(lead: dict, mode: str = "auto", persona: str | None = None, callback=False, audio=False) -> Session:
    old = SESSIONS.get(lead["id"])
    if old and not old.ended and old.task:
        old.task.cancel()
    if mode == "auto" and persona not in PERSONAS:
        persona = "rakesh_kirana" if lead.get("language") != "en" else "priya_restaurant"
    s = Session(lead, mode, persona, callback=callback, audio=audio)
    SESSIONS[lead["id"]] = s
    s.task = asyncio.create_task(s.run())
    bus.publish("session_start", {"lead_id": lead["id"], "mode": mode, "persona": persona})
    return s


def stored_snapshot(lead_id: str) -> dict | None:
    """Rebuild a view for leads without a live session (seeded or after restart)."""
    L = tools.lead(lead_id)
    if not L:
        return None
    inter = db.one("SELECT * FROM interactions WHERE lead_id = ? ORDER BY id DESC LIMIT 1", (lead_id,))
    rec = db.one("SELECT * FROM recommendations WHERE lead_id = ?", (lead_id,))
    visit = db.one("SELECT v.*, a.name AS rep FROM visits v JOIN field_agents a ON a.id = v.agent_id WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1", (lead_id,))
    return {
        "lead_id": lead_id, "name": L["name"], "business_name": L.get("business_name"), "mode": "record",
        "persona": None, "persona_label": "Recorded interaction", "lang": L["language"], "state": L["status"],
        "channel": (inter or {}).get("channel") or L.get("channel") or "voice", "expecting": None,
        "turns": (inter or {}).get("transcript") or [], "profile": tools.profile(lead_id),
        "recommendation": rec, "score": {"score": L["score"], "temperature": L["temperature"], "factors": L["score_factors"] or []} if L["score"] is not None else None,
        "slot_options": [],
        "visit": {"visit_id": visit["id"], "rep": visit["rep"], "slot": rules.slot_label(visit["slot_start"]),
                  "briefing": visit["briefing"]} if visit else None,
        "handoff": None, "ended": True, "outcome": (inter or {}).get("outcome"), "started_at": (inter or {}).get("started_at"),
        "call_started_at": (inter or {}).get("started_at"), "activity": None, "live": False,
        "created_at": L["created_at"], "first_contact_at": L["first_contact_at"], "source": L["source"],
        "phone_masked": L["phone_masked"], "attempts": L["attempts"],
    }
