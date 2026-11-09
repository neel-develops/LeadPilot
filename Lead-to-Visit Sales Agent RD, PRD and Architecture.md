# Lead-to-Visit Sales Agent: RD, PRD and Architecture

Paytm hackathon, Track 3 (Autonomous AI Teammates). Draft v1, 9 November 2026. All Paytm systems are simulated for the demo. Every number below is a target or an assumption, not a measured result.

## Part 1: Requirements Document (RD)

### 1.1 Purpose and scope

This document defines what the Lead-to-Visit Sales Agent must do. The agent takes a new merchant lead (Soundbox or card machine interest), contacts them within a minute, qualifies them, recommends a device and plan, books a field visit with the best available rep, and writes a full summary to the CRM. It also watches for leads that are silently getting lost.

In scope: lead intake, consent checks, outbound voice and chat contact, qualification, scoring, recommendation, field agent allocation, booking, rep briefing, CRM, human handoff, dashboard, metrics.

Out of scope for the MVP: real payments, real KYC, real device provisioning, real Paytm API integration, and production-grade learned models.

### 1.2 Stakeholders

| Stakeholder | Need |
| --- | --- |
| Merchant (lead) | A fast, respectful call in their language, and a clear next step |
| Field sales rep | Qualified leads, a good schedule, and a briefing before each visit |
| Sales manager | Visibility into funnel, lost leads, and rep performance |
| Paytm sales operations | Higher conversion with fewer wasted visits and lower cost per acquired merchant |
| Compliance and legal | Consent, opt-out, calling-hour and data-handling rules respected |

### 1.3 Business requirements

- BR-1: Reduce time to first contact from days to under one minute.
- BR-2: Increase lead-to-visit conversion.
- BR-3: Reduce wasted field visits through better qualification and device fit.
- BR-4: Give every rep a short, useful briefing before a visit.
- BR-5: Operate within consent and telemarketing rules, with a full audit trail.

### 1.4 Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Accept leads from a web form, a simulated missed-call webhook and a simulated ad-lead feed | P0 |
| FR-2 | Validate and deduplicate phone numbers; store the phone number hashed plus an encrypted copy for dialling | P0 |
| FR-3 | Check consent and do-not-call status before any contact; block contact if absent | P0 |
| FR-4 | Place an outbound voice call immediately; fall back to chat if voice fails | P0 |
| FR-5 | If unanswered, retry on a schedule and send an approved WhatsApp or SMS template | P1 |
| FR-6 | Qualify: shop type, daily sales band, current payment setup, location (pincode), preferred language | P0 |
| FR-7 | Converse in Hindi and English; add Marathi as a stretch goal | P0 / P1 |
| FR-8 | Recommend a device and plan from a rule table, with a short reason and the rule IDs used | P0 |
| FR-9 | Compute a lead score from 0 to 100 with a visible explanation | P0 |
| FR-10 | Allocate a field rep using distance, availability, skill and workload | P0 |
| FR-11 | Book the visit in the rep's calendar; confirm to merchant and rep | P0 |
| FR-12 | Generate a rep briefing: profile, recommendation, likely objections, talking points | P0 |
| FR-13 | Create and update the CRM record: transcript, summary, sentiment, score, status, timeline | P0 |
| FR-14 | Hand off to a human on defined triggers, passing a full summary | P0 |
| FR-15 | Reschedule automatically when a rep becomes unavailable or the merchant asks | P1 |
| FR-16 | Capture visit outcome (converted, rejected, revisit) and track activation after the visit | P1 |
| FR-17 | Detect lead leakage: no contact within the target window, repeated reschedules, unvisited high-score leads | P1 |
| FR-18 | Dashboard with command center, live conversation view, CRM, field operations and analytics | P0 |
| FR-19 | Log every agent action and tool call with inputs, outputs and timestamps | P0 |
| FR-20 | Report time to first contact, lead-to-visit conversion and wasted-visit rate | P0 |

### 1.5 Non-functional requirements

- Speed: first contact within 60 seconds of lead creation (demo target 30 seconds). Voice response gap under about 1.5 seconds per turn.
- Reliability: if voice fails, switch to chat or WhatsApp; if the live demo network fails, a recorded run is available.
- Explainability: every score and recommendation shows the rules that produced it.
- Auditability: all actions are reproducible from the log.
- Privacy: collect only what qualification needs; mask personal data in logs and screens.
- Scalability story: stateless workers behind a queue, so lead volume scales horizontally.

### 1.6 Compliance requirements

- Contact only leads who requested it or consented; honour opt-out instantly.
- Call only in permitted hours; cap attempts per lead per day (proposed: 3).
- The agent identifies itself as an automated assistant at the start of each call.
- Tell the merchant if the call is recorded.
- Check the current telemarketing and do-not-disturb rules with a qualified person before describing the system as compliant. The team has not verified them.

### 1.7 Assumptions and constraints

- Merchant, rep, calendar and CRM data are simulated; tool functions are placeholders for Paytm internal APIs.
- Telephony runs on a trial account; Hindi speech quality must be tested early.
- Metrics come from a simulated set of about 200 generated leads and must be labelled as simulated.
- Prices and plans in the rule table are illustrative, not Paytm's real pricing.

### 1.8 Out of scope (roadmap only)

Predictive acquisition, merchant digital twin, self-learning sales intelligence, live rep GPS tracking and territory heatmaps are shown as roadmap slides, not built.

## Part 2: Product Requirements Document (PRD)

### 2.1 Problem

Merchants who show interest in a Soundbox or card machine often wait days for a callback. By then a competitor has often reached them. After a lead is finally qualified, field reps still lose time on poor schedules, unprepared visits and mismatched devices.

### 2.2 Positioning

One autonomous teammate that runs the path from first lead to booked visit and then watches the lead until activation. Competitors already announced outbound voice assistants for merchant onboarding, so a calling bot alone is not the differentiator. The three signature ideas are:

1. Lead leakage detection, which finds and recovers leads that are silently going cold.
2. Merchant intelligence, which turns the call into a profile, score and rep briefing.
3. Field-aware allocation, which picks the right rep and slot, not just any free slot.

### 2.3 Goals and non-goals

Goals: speed to contact, higher lead-to-visit conversion, fewer wasted visits, better-prepared reps, full auditability. Non-goals: replacing reps, negotiating custom pricing, completing KYC or payments, building a general CRM.

### 2.4 Personas

- Sunita, tea stall owner: low daily sales, mostly cash, prefers Hindi or Marathi, impatient with long calls.
- Rahul, field sales rep: covers an area, wants nearby, qualified leads and a short briefing.
- Meera, sales manager: wants the funnel, lost-lead reasons and rep performance at a glance.

### 2.5 User stories

| As a | I want | So that |
| --- | --- | --- |
| Merchant | a call within minutes in my language | I do not wait days or switch provider |
| Merchant | a simple recommendation with a reason | I know what fits my shop |
| Merchant | to pick a visit time | the visit suits me |
| Rep | only qualified leads near me | I waste less travel time |
| Rep | a briefing with talking points | I can pitch the right device |
| Manager | an alert when a hot lead is not visited | no high-intent lead is lost |
| Manager | lost-deal reasons grouped | I can improve the pitch |
| Compliance | an audit log and opt-out handling | contact stays within the rules |

### 2.6 Scope by priority

| Priority | Feature | Notes |
| --- | --- | --- |
| P0 | Lead intake, consent check, voice and chat qualification | Core demo |
| P0 | Recommendation rules, lead score with explanation | Rule-based, transparent |
| P0 | Rep allocation, calendar booking, rep briefing | Field-aware angle |
| P0 | CRM with summaries, human handoff, audit log, dashboard | Needed for credibility |
| P1 | Retry plus WhatsApp or SMS follow-up | Called the 60-second rescue |
| P1 | Lead leakage detector and manager alerts | Signature idea 1 |
| P1 | Rescheduling, visit outcome capture, post-visit tracking | Closes the loop |
| P1 | Marathi support, lost-deal grouping | Stretch |
| P2 | Route optimisation, predictive acquisition, digital twin, self-learning | Roadmap slides |

Build P0 completely before touching P1. A smaller system that works on stage beats a long feature list.

### 2.7 Key flows

Happy path: lead arrives, consent confirmed, call placed, merchant qualified, device recommended, score computed, rep allocated, visit booked, confirmation sent, CRM updated, rep briefed. No answer: schedule retry, send approved WhatsApp or SMS, retry up to the cap, then mark as at risk for the leakage detector. Handoff: trigger fires, agent says a human will call, CRM gets the summary and reason, a rep or manager is notified. Reschedule: rep unavailable or merchant asks, agent finds a new slot, notifies both sides.

Handoff triggers: merchant asks for custom pricing or discounts, is angry or confused, runs a large multi-outlet business, raises a legal or complaint topic, or asks for a human.

### 2.8 Screens

1. Command center: leads, hot leads, callbacks pending, visits booked, time to first contact.
2. Live agent: transcript with English translation, extracted fields, recommendation card.
3. Merchant profile and CRM: summary, score with reasons, timeline, status.
4. Field operations: rep list, map of leads and reps, calendar, bookings.
5. Analytics: funnel, lost-deal reasons, wasted-visit rate, before and after comparison.
6. Audit log: every tool call, filterable by lead.

### 2.9 Success metrics

| Metric | Baseline (assumed) | Target (simulated) |
| --- | --- | --- |
| Time to first contact | 24 to 72 hours | Under 60 seconds |
| Lead-to-visit conversion | About 15% | About 35% |
| Wasted visit rate | About 20% | About 10% |
| Leads reaching a human | 100% | Only complex cases |
| Hot leads unvisited after 24 hours | Unknown | Alerted and tracked |

Baselines are assumptions to be replaced by data. Report results as measured on simulated leads and say so on stage.

### 2.10 Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Hindi or Marathi speech quality is poor | Test in week one; make Hindi the live language, Marathi a recorded clip |
| Live call fails on stage | Recorded backup and one-click switch; chat fallback |
| Overclaiming novelty | Say that public examples exist for voice calling; stress leakage detection, intelligence and allocation |
| Scope creep | Freeze P0; P1 only after P0 passes end-to-end |
| Agent says something wrong about price | Prices only from the rule table; no discounts; handoff instead |
| Compliance gaps | Consent gate, opt-out, hours, attempt cap, and a note to verify rules |

### 2.11 Milestones

Use these phases, scaled to the days available:

1. Foundations: data model, mock data generator, lead form, dashboard shell.
2. Agent core: voice or chat qualification, tools, CRM write.
3. Intelligence: scoring, recommendation, allocation, booking, briefing.
4. Differentiators: retry and follow-up, leakage detector, handoff polish.
5. Demo hardening: simulation run for metrics, recorded backup, pitch rehearsal.

### 2.12 Open questions

- Which Paytm products and plans should the rule table cover?
- Which telephony and speech provider gives the best Hindi quality on trial accounts?
- How many days and how many people are on the team?
- Will judges expect a live call or accept a recorded one?

## Part 3: Architecture

### 3.1 Overview

```
Lead sources (form, missed call, ad feed)
        |
   Ingestion API ---> Consent and DND gate ---> Lead queue
                                                   |
                                          Agent orchestrator (LLM + tools)
                                           |        |         |
                                     Voice/chat   Tool layer   Event log
                                     channel     (scoring, recommend,   |
                                           |      allocate, calendar,   |
                                       Merchant   CRM, notify)          |
                                                   |                    |
                                               Database  <------  Dashboard (live via SSE)
```

### 3.2 Components

| Component | Responsibility |
| --- | --- |
| Ingestion API | Receives leads, validates, deduplicates, enqueues |
| Consent gate | Blocks contact without consent or on opt-out; enforces hours and attempt cap |
| Queue and workers | Stateless workers pull leads, so volume scales horizontally |
| Agent orchestrator | LLM with tool calling; holds conversation state; decides next action |
| Voice channel | Telephony, speech-to-text, text-to-speech, interruption handling |
| Chat channel | WhatsApp or web chat fallback with approved templates |
| Tool layer | Deterministic functions the agent calls (below) |
| Leakage detector | Scheduled job that flags stalled leads |
| Database | Leads, profiles, interactions, visits, reps, audit |
| Dashboard | React front end fed by REST and server-sent events |

### 3.3 Agent design

States: NEW, CONSENT\_OK, CONTACTING, QUALIFYING, RECOMMENDING, BOOKING, CONFIRMED, FOLLOW\_UP, HANDOFF, CLOSED.

Tools (all logged):

- `check_consent(lead_id)`: returns allowed, reason.
- `place_call(lead_id)` and `send_message(lead_id, template_id)`.
- `save_profile(lead_id, fields)`.
- `recommend_device(profile)`: returns device, plan, reason, rule IDs.
- `score_lead(lead_id)`: returns score and contributing factors.
- `find_slots(lead_id)`: returns ranked rep and slot options.
- `book_visit(lead_id, rep_id, slot)`.
- `update_crm(lead_id, summary, status)`.
- `schedule_retry(lead_id, when)`.
- `handoff_to_human(lead_id, reason, summary)`.

Guardrails: no prices outside the rule table; no discount promises; identify as automated at the start; stop on opt-out; maximum three attempts a day; calls only in permitted hours; hand off on the triggers in section 2.7. The orchestrator validates every tool call against these rules before it runs.

Prompt outline: role and tone (short, warm sentences), the three qualifying questions, how to use each tool, the recommendation rule summary, handoff triggers, and what to do when the merchant interrupts or goes silent.

### 3.4 Voice pipeline

Telephony provider places the call and streams audio. Speech-to-text transcribes each turn in Hindi or English. The LLM decides the reply and any tool call. Text-to-speech speaks it. The pipeline supports barge-in so the agent stops when interrupted. Keep a managed voice-agent platform as an option to save time, after confirming its Hindi quality.

### 3.5 Data model

| Table | Key fields |
| --- | --- |
| leads | id, name, phone\_hash, phone\_enc, source, created\_at, consent, language, status, score |
| merchant\_profiles | lead\_id, shop\_type, daily\_sales\_band, current\_setup, pincode, lat, lng |
| interactions | id, lead\_id, channel, started\_at, transcript, summary, sentiment, outcome |
| recommendations | lead\_id, device, plan, reason, rule\_ids |
| field\_agents | id, name, home\_lat, home\_lng, skills, working\_hours, capacity |
| visits | id, lead\_id, agent\_id, slot\_start, status, verified, outcome |
| agent\_actions | id, lead\_id, tool, input, output, ts |
| consent\_log | lead\_id, event, ts |

### 3.6 API sketch

- `POST /leads`, `GET /leads/{id}`
- `POST /webhooks/telephony`, `POST /webhooks/missed-call`
- `GET /agents/availability`, `POST /visits`, `PATCH /visits/{id}`
- `GET /metrics/funnel`, `GET /metrics/first-contact`
- `GET /events` (server-sent events for the live log)

### 3.7 Scoring and recommendation (rule-based MVP)

Lead score adds points for: strong intent source (form above missed call above ad click), answered the call, asked about price or installation, no current digital setup, shop type with high device fit, daily sales band, and a location inside a covered area. It subtracts points for hesitation, repeated no-answers and an existing competitor device. Each factor and its points are stored so the dashboard can explain the score.

Recommendation is a lookup on shop type, daily sales band and current setup. Example: small stall, low sales, mostly cash gives a basic Soundbox plan; restaurant or high sales with card usage gives a card machine or a combined option. Plans and prices are illustrative placeholders.

### 3.8 Field agent allocation

Hard constraints: rep works that slot, has capacity, and covers the area. Among eligible options, rank by a weighted score of travel distance, earliest suitable slot, skill match for the device, and current workload. Weights are configurable and shown in the log. Route grouping of nearby visits is a P2 extension.

### 3.9 Lead leakage detector

A scheduled job flags: leads with no contact after the target window, three or more unanswered attempts, repeated reschedules, high-score leads without a visit after 24 hours, and bookings with no confirmation. Each flag triggers an action (retry, message, reassign, or manager alert) and appears in the dashboard.

### 3.10 Security and privacy

Encrypt phone numbers at rest, hash for lookup, mask in the UI and logs. Role-based access for rep, manager and admin. Minimum data collection. Retention limits on transcripts and recordings. Consent and opt-out events are immutable log entries.

### 3.11 Observability and evaluation

Generate about 200 simulated leads with varied shop types, languages, answer behaviour and objections. Run the agent against them, with a baseline that mimics a slow manual callback. Measure time to first contact, lead-to-visit conversion, wasted-visit rate and handoff rate. Review a sample of transcripts for correctness and tone.

### 3.12 Suggested stack

| Layer | Option |
| --- | --- |
| Front end | React dashboard |
| Back end | Python (FastAPI) |
| Queue | Redis or a hosted queue |
| Database | Postgres or SQLite for the demo |
| Agent | LLM with tool calling |
| Voice | Telephony provider plus Hindi-capable speech services |
| Messaging | WhatsApp or SMS sandbox with approved templates |
| Maps | Open-source map library with simulated coordinates |

### 3.13 Deployment

Single cloud deployment for the demo: API, workers and dashboard in containers, managed database, secrets in environment config. Describe the production path as horizontally scaled workers behind a queue, regional telephony, and integration with Paytm's CRM and calendar systems.

### 3.14 Demo plan and fallbacks

Submit a lead on stage, show a stopwatch for first contact, take the call on a teammate's phone, watch the transcript and extracted fields fill in, then show the recommendation, the allocated rep, the calendar slot and the CRM entry. Finish on the leakage alert and the metrics comparison. Keep a recorded run and a chat-mode fallback ready.

### 3.15 Scale path to Paytm

Replace simulated data with Paytm lead, CRM and rep systems; replace rule tables with learned models once real outcome data is available and privacy review is done; add routing, territory analytics and self-learning as later phases.
