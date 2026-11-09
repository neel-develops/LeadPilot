# LeadPilot — Lead-to-Visit Sales Agent

Paytm Builder's Hackathon, Pune · Track 3 (Autonomous AI Teammates).
All Paytm systems, merchants, reps and metrics are **simulated**. Prices are illustrative.

## Run it

1. Put your Sarvam key in `backend/.env`:

   ```
   SARVAM_API_KEY=your-key
   ```

2. Double-click `start.bat`, then open http://localhost:8000 in **Chrome or Edge**. Allow the microphone when asked.
3. Or, while the server window is running, double-click `LeadPilot.html`. It's the whole dashboard in one file.

**Dev mode (two terminals):**

```bash
backend/.venv/Scripts/python -m uvicorn main:app --app-dir backend --port 8000
```

```bash
npm --prefix frontend run dev
```

## Demo accounts (role-based access, enforced on the server)

| Role | Email | Password | Can do |
| --- | --- | --- | --- |
| Sales manager | manager@leadpilot.in | manager123 | Overview, live agent, CRM, field ops, analytics, leakage, audit; compliance read-only; PII masked |
| Admin | admin@leadpilot.in | admin123 | Everything, plus editing compliance settings, revealing phone numbers (audited) and resetting data |
| Field rep | rahul.patil@leadpilot.in (any `firstname.lastname@leadpilot.in`) | rep123 | My Day route on OpenStreetMap, own merchants only, visit outcomes, reassign, capture leads, talk to the agent |

## Demo script (about 4 minutes)

1. **Sign in as the manager.** The Overview shows lead flow, visit calendar, lead mix and upcoming visits. In "Ask me anything", questions are answered by **Sarvam-105b** from live metrics.
2. Click **+** and keep **"AI calls me (voice)"**. Submit, and your screen **rings**. Click **Answer** and talk as the merchant in Hindi or English. For example:
   - "हाँ बोलिए"
   - "मेरी किराना की दुकान है"
   - "रोज़ का बारह हज़ार"
   - "PhonePe QR है"
   - "हडपसर"
   - "बुक कर दीजिए"
   - "पहला वाला"

   You can also ask an off-script question such as "KYC में क्या लगेगा?".
3. Watch the Live Agent screen as the call runs:
   - **Speech:** Sarvam speech-to-text (saarika) for your voice and Sarvam text-to-speech (bulbul) for the agent's voice.
   - **Understanding:** keyword rules first, with **Sarvam LLM** as a fallback.
   - **Decisions:** an explained score, a rule-based recommendation (prices only from the rule table), rep allocation and booking.
4. **Guardrails:** say "discount milega?" (handoff to a human) or "mujhe call mat karo" (instant opt-out and do-not-call list).
5. **Simulated merchants** (manager or admin): nine personas with Sarvam voices on both sides, plus missed-call and ad-burst triggers.
6. **Field Operations** on OpenStreetMap, then **Lead Leakage** (one-click recovery), **Analytics** (before/after), **Audit Log** (every tool and Sarvam call).
7. **Sign out**, then sign in as **Rahul Patil (field rep)**. My Day shows his route on OpenStreetMap and briefings; he can record outcomes or reassign a visit. Manager pages are locked.
8. **Sign in as admin.** Edit the compliance rules, reveal a phone number (audited), and reset the demo data.

Outside 9:00–21:00 the consent gate blocks calls, which is correct behaviour. For an evening demo, sign in as admin and turn off *Enforce calling hours* in Compliance.

## Architecture

| Part | Files |
| --- | --- |
| API | `backend/` — FastAPI with SQLite. `auth.py` (signed tokens, permission matrix, rep ownership), `agent.py` (guarded state-machine orchestrator, voice mode), `sarvam.py` (STT, TTS, LLM, translate), `tools.py` (logged tool layer), `rules.py` (recommendation, scoring and allocation rules), `nlu.py` (Hindi, Hinglish and English understanding, spoken numbers, Pune area names), `leakage.py`, `seed.py` |
| Dashboard | `frontend/` — React and Vite. `voice.js` (mic capture, voice-activity detection, WAV encoding, playback queue, ringtone), Leaflet with OpenStreetMap tiles, live updates over server-sent events |
| Standalone file | `LeadPilot.html` — the full dashboard in one file, connecting to `http://localhost:8000` |

The Sarvam key stays on the server and is never sent to the browser. Real phone (PSTN) calls would need a telephony provider such as Exotel; in this prototype the agent "calls" the dashboard user in the browser.
