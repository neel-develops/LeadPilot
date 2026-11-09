import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot, UserRound, Phone, MessageCircle, MessageSquare, Send, Mic, MicOff, Volume2, VolumeX, Store, IndianRupee,
  Wallet, MapPin, Languages, Sparkles, Route, CalendarCheck, Square, Plus, Info, Radio, Headset, Ban, Timer,
  FileText, Gauge, ExternalLink, Play, PhoneMissed, Megaphone, PhoneOff, PhoneCall, Loader2, Ear, AudioLines,
} from 'lucide-react'
import { api, can, useApi, useEvent, timeAgo, clock, LANG_LABEL, CHANNEL_LABEL, SOURCE_LABEL } from '../api.js'
import { useVoice, voiceState, enqueue, setSound, startCall, endCall, setMuted, setWaiting, finishUtterance } from '../voice.js'
import { useApp } from '../ctx.js'
import { Card, StatusBadge, Empty, ScoreRing, Factors, Badge } from '../components/ui.jsx'
import { toolMeta, describe } from '../components/ToolIcon.jsx'

const FLOW = [
  ['NEW', 'Lead'], ['CONSENT_OK', 'Consent'], ['CONTACTING', 'Contact'], ['QUALIFYING', 'Qualify'],
  ['RECOMMENDING', 'Recommend'], ['BOOKING', 'Allocate'], ['CONFIRMED', 'Booked'],
]
const CH_ICON = { voice: Phone, whatsapp: MessageCircle, chat: MessageSquare }
const SHOP = { kirana: 'Kirana / Grocery', restaurant: 'Restaurant / Dhaba', medical: 'Medical / Pharmacy', sweets: 'Sweet shop / Bakery', tea_stall: 'Tea stall', clothing: 'Clothing', electronics: 'Electronics / Mobile', salon: 'Salon', hardware: 'Hardware', vegetable: 'Fruit & Vegetable' }
const BAND = { low: 'Under ₹5k/day', medium: '₹5k–20k/day', high: '₹20k–50k/day', very_high: 'Over ₹50k/day' }
const SETUP = { cash_only: 'Cash only', upi_qr: 'UPI QR only', card_machine: 'Card machine', competitor_soundbox: 'Competitor soundbox' }

const QUICK = {
  greet: ['Haan, boliye', 'Yes, go ahead', 'Abhi busy hoon, baad mein call karo'],
  shop: ['Meri kirana ki dukan hai', 'I run a restaurant', 'Chai ki tapri hai'],
  sales: ['Roz ka 10 hazaar', 'Around 40k a day', '3000 rupees'],
  setup: ['Sirf cash', 'PhonePe QR hai', 'Bank ki card machine hai'],
  pincode: ['411038', '411014', '412105'],
  recommend: ['Kitna lagega?', 'Haan, book kar do', 'Discount milega kya?', 'Nahi, abhi nahi'],
  slot: ['Pehla wala', 'Second one'],
}
const ALWAYS = ['Manager se baat karao', 'Mujhe call mat karo']

const ACTIVITY = {
  checking_consent: 'Checking consent, DND & calling hours…', dialling: 'Dialling merchant…', agent_thinking: 'Agent is thinking…',
  agent_speaking: 'Agent speaking…', merchant_speaking: 'Merchant speaking…', waiting_merchant: 'Waiting for merchant…',
  retry_scheduled: 'Retry scheduled…', 'tool:recommend_device': 'Running recommend_device…', 'tool:score_lead': 'Running score_lead…',
  'tool:find_slots': 'Allocating best rep & slot…', 'tool:book_visit': 'Booking visit…',
  ringing: 'Ringing the merchant…', ai_understanding: 'Sarvam AI is understanding the reply…',
}

const PHASE = {
  agent: ['Agent speaking', AudioLines, 'cyan'], listening: ['Listening — speak now', Mic, 'green'],
  hearing: ['Hearing you…', Ear, 'green'], processing: ['Understanding (Sarvam STT)…', Loader2, 'amber'], idle: ['On call', Phone, 'slate'],
}

function CallPanel({ snap, id, onSend, sending }) {
  const v = useVoice()
  const [text, setText] = useState('')
  const mine = v.inCall && v.leadId === id
  const ringing = snap.activity === 'ringing'
  const [label, Icon, tone] = PHASE[mine ? (v.muted ? 'idle' : v.phase) : 'idle']
  const answer = async () => {
    await startCall(id)
    await api(`/voice/${id}/answer`, { method: 'POST', body: { answer: true } }).catch(() => {})
  }
  const hang = async () => {
    await api(`/leads/${id}/stop`, { method: 'POST' }).catch(() => {})
    endCall()
  }
  if (!mine) {
    return (
      <div className="composer">
        <div className="row between wrap">
          <span className="muted" style={{ fontSize: 13 }}>{ringing ? 'The agent is calling — answer to talk.' : 'Live voice call in progress.'}</span>
          <div className="row">
            <button className="btn sm success" onClick={answer}><PhoneCall size={14} /> {ringing ? 'Answer call' : 'Join call audio'}</button>
            <button className="btn sm danger" onClick={hang}><PhoneOff size={13} /> End</button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="composer">
      <div className="call-bar">
        <div className={`call-phase tone-${tone}`}><Icon size={16} className={v.phase === 'processing' ? 'spin' : ''} />{v.muted ? 'Muted' : label}</div>
        <div className="meter">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ height: `${Math.max(12, Math.min(100, v.level * 100 * (0.6 + ((i * 37) % 10) / 10)))}%`, opacity: v.phase === 'hearing' || v.phase === 'listening' ? 1 : 0.25 }} />)}</div>
        <div className="grow" />
        {v.phase === 'hearing' && <button className="btn sm" onClick={finishUtterance}><Send size={13} /> Done speaking</button>}
        <button className={`btn sm ${v.muted ? 'danger' : ''}`} onClick={() => setMuted(!v.muted)}>{v.muted ? <MicOff size={14} /> : <Mic size={14} />} {v.muted ? 'Unmute' : 'Mute'}</button>
        <button className="btn sm danger" onClick={hang}><PhoneOff size={14} /> Hang up</button>
      </div>
      {v.heard && <div className="muted" style={{ fontSize: 12 }}>Sarvam heard: <span style={{ color: 'var(--text)' }}>“{v.heard}”</span></div>}
      {v.error && <div className="banner tone-amber" style={{ padding: '8px 12px' }}><Info size={14} />{v.error}</div>}
      <div className="row">
        <input className="input" placeholder="Or type a reply…" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { onSend(text); setText('') } }} />
        <button className="btn" disabled={sending || !text.trim()} onClick={() => { onSend(text); setText('') }}><Send size={14} /></button>
      </div>
    </div>
  )
}

function useTick(on) {
  const [, set] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => set((x) => x + 1), 100)
    return () => clearInterval(id)
  }, [on])
}

function Stepper({ state }) {
  const idx = FLOW.findIndex(([s]) => s === state)
  const terminal = { FOLLOW_UP: ['Follow-up', 'amber'], HANDOFF: ['Human handoff', 'orange'], CLOSED: ['Closed', 'slate'], BLOCKED: ['Blocked', 'red'] }[state]
  return (
    <div className="stepper">
      {FLOW.map(([s, label], i) => {
        const done = state === 'CONFIRMED' ? true : idx > i
        const cur = idx === i && state !== 'CONFIRMED'
        return (
          <React.Fragment key={s}>
            {i > 0 && <div className={`step-line ${done || cur ? 'done' : ''}`} />}
            <div className={`step ${done ? 'done' : ''} ${cur ? 'cur' : ''}`}>
              <div className="step-dot">{done ? '✓' : ''}</div>{label}
            </div>
          </React.Fragment>
        )
      })}
      {terminal && <><div className="step-line" /><Badge tone={terminal[1]} dot>{terminal[0]}</Badge></>}
    </div>
  )
}


export default function LiveAgent({ leadId }) {
  const { navigate, openNewLead, toast } = useApp()
  const { data: sessions } = useApi('/sessions', ['session_start', 'session_end', 'session'], null, 300)
  const id = leadId || sessions?.[0]?.lead_id || null
  const [snap, setSnap] = useState(null)
  const [tools, setTools] = useState([])
  const [text, setText] = useState('')
  const vs = useVoice()
  const [listening, setListening] = useState(false)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const recRef = useRef(null)
  const idRef = useRef(id)
  idRef.current = id

  const load = () => {
    if (!idRef.current) return
    const want = idRef.current
    api(`/sessions/${want}`).then((s) => idRef.current === want && setSnap(s)).catch(() => setSnap(null))
    api(`/audit?lead_id=${want}&limit=200`).then((a) => idRef.current === want && setTools(a.filter((x) => x.tool !== 'state_transition'))).catch(() => {})
  }
  useEffect(() => { setSnap(null); setTools([]); load() }, [id])

  const refetchT = useRef()
  useEvent((t, d) => {
    if (!idRef.current || d.lead_id !== idRef.current) return
    if (t === 'turn') {
      setSnap((s) => (s && !s.turns.some((x) => x.i === d.turn.i) ? { ...s, turns: [...s.turns, d.turn] } : s))
      const turn = d.turn
      const call = voiceState()
      const onCall = call.inCall && call.leadId === d.lead_id
      if (onCall && turn.speaker === 'agent') enqueue({ audio: turn.meta?.audio, text: turn.text, lang: turn.lang })
      else if (!onCall && turn.meta?.audio && turn.speaker !== 'system') enqueue({ audio: turn.meta.audio })
    } else if (t === 'session') {
      setSnap((s) => (s ? { ...s, ...d, live: !d.ended } : s))
      const call = voiceState()
      if (call.inCall && call.leadId === d.lead_id) {
        setWaiting(d.activity === 'waiting_merchant')
        if (d.ended) setTimeout(() => { if (!voiceState().playing) endCall(); else setTimeout(endCall, 8000) }, 1500)
      }
    } else if (t === 'profile') {
      setSnap((s) => (s ? { ...s, profile: d } : s))
    } else if (t === 'action') {
      if (d.tool !== 'state_transition') setTools((x) => [{ ...d, _new: true }, ...x])
      if (['recommend_device', 'score_lead', 'find_slots', 'book_visit', 'place_call', 'handoff_to_human', 'update_crm'].includes(d.tool)) {
        clearTimeout(refetchT.current)
        refetchT.current = setTimeout(load, 150)
      }
    } else if (t === 'session_end' || t === 'session_start') {
      clearTimeout(refetchT.current)
      refetchT.current = setTimeout(load, 150)
    }
  })

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [snap?.turns?.length, snap?.activity])

  const live = snap && !snap.ended
  useTick(!!live)

  const now = Date.now() / 1000
  const ttfc = snap?.first_contact_at && snap?.created_at ? snap.first_contact_at - snap.created_at : live && snap?.created_at ? now - snap.created_at : null
  const lastTs = snap?.turns?.length ? snap.turns[snap.turns.length - 1].ts : null
  const callDur = snap?.call_started_at ? (live ? now : lastTs || now) - snap.call_started_at : null

  const send = async (t) => {
    const msg = (t ?? text).trim()
    if (!msg || !id) return
    setSending(true)
    try {
      await api(`/leads/${id}/reply`, { method: 'POST', body: { text: msg } })
      setText('')
    } catch (e) {
      toast({ icon: Info, tone: 'red', title: 'Could not send', sub: e.message })
    } finally { setSending(false) }
  }

  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const toggleMic = () => {
    if (!SR) return
    if (listening) { recRef.current?.stop(); return }
    const r = new SR()
    r.lang = snap?.lang === 'en' ? 'en-IN' : 'hi-IN'
    r.interimResults = true
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(' '))
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recRef.current = r
    r.start()
    setListening(true)
  }

  const stop = () => api(`/leads/${id}/stop`, { method: 'POST' })
  const restart = (mode) => api(`/leads/${id}/start`, { method: 'POST', body: { mode, persona: null, audio: mode !== 'interactive' } })
    .then(load).catch((e) => toast({ icon: Info, tone: 'red', title: 'Could not start', sub: e.message }))

  const p = snap?.profile || {}
  const rec = snap?.recommendation
  const score = snap?.score
  const Ch = CH_ICON[snap?.channel] || Phone
  const activity = snap?.activity
  const typingWho = activity === 'agent_thinking' ? 'agent' : activity === 'merchant_speaking' ? 'merchant' : null
  const quick = useMemo(() => [...(QUICK[snap?.expecting] || []), ...ALWAYS], [snap?.expecting])

  const fields = [
    ['Shop type', Store, SHOP[p.shop_type]],
    ['Daily sales', IndianRupee, p.daily_sales_band && `${BAND[p.daily_sales_band]}${p.daily_sales_value ? ` (₹${Number(p.daily_sales_value).toLocaleString('en-IN')})` : ''}`],
    ['Payment setup', Wallet, SETUP[p.current_setup]],
    ['Location', MapPin, p.pincode && `${p.area || ''} · ${p.pincode}`],
    ['Language', Languages, snap && LANG_LABEL[snap.lang]],
    ['Channel', Ch, snap && CHANNEL_LABEL[snap.channel]],
  ]

  return (
    <div className="live-layout">
      {/* sessions */}
      <div className="live-col">
        <button className="btn primary" onClick={openNewLead}><Plus size={16} /> New lead</button>
        {can('sim:run') && <div className="grid g-2" style={{ gap: 8, marginTop: -6 }}>
          <button className="btn sm" title="Simulated missed-call webhook" onClick={async () => { const p = '8' + String(Math.floor(100000000 + Math.random() * 899999999)); const r = await api('/webhooks/missed-call', { method: 'POST', body: { phone: p } }); navigate('live', r.lead_id) }}><PhoneMissed size={13} /> Missed call</button>
          <button className="btn sm" title="4 ad leads at once" onClick={() => api('/simulate/burst', { method: 'POST', body: { count: 4 } })}><Megaphone size={13} /> Ad burst</button>
        </div>}
        <div className="card grow" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="card-head" style={{ paddingBottom: 10 }}><div className="card-title"><Radio size={15} /> Sessions</div><span className="card-sub">{(sessions || []).filter((s) => !s.ended).length} live</span></div>
          <div className="scroll" style={{ padding: '0 8px 8px' }}>
            {(sessions || []).length ? sessions.map((s) => {
              const I = CH_ICON[s.channel] || Phone
              return (
                <div key={s.lead_id} className={`sess-list-item ${s.lead_id === id ? 'active' : ''}`} onClick={() => navigate('live', s.lead_id)}>
                  <div className="row between">
                    <span className="row" style={{ fontWeight: 600, fontSize: 13, minWidth: 0 }}>
                      {!s.ended && <span className="dot live" />}<span className="ellipsis">{s.name}</span>
                    </span>
                    <I size={13} color="var(--muted)" />
                  </div>
                  <div className="row between" style={{ marginTop: 5 }}>
                    <span className="mono dim" style={{ fontSize: 11 }}>{s.lead_id}</span>
                    <StatusBadge status={s.state} />
                  </div>
                </div>
              )
            }) : <Empty icon={Radio}>No sessions yet. Create a lead to start one.</Empty>}
          </div>
        </div>
      </div>

      {/* conversation */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {!snap ? (
          <div style={{ margin: 'auto' }}>
            <Empty icon={Bot}>
              {id ? 'Loading session…' : 'Pick a session, or submit a new lead to watch the agent call, qualify and book in under a minute.'}
              {!id && <div className="mt-12"><button className="btn primary sm" onClick={openNewLead}><Plus size={14} /> New lead</button></div>}
            </Empty>
          </div>
        ) : (
          <>
            <div className="call-head">
              <div className="avatar lg">{snap.name?.split(' ').map((x) => x[0]).slice(0, 2).join('')}</div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span style={{ fontWeight: 750, fontSize: 16, whiteSpace: 'nowrap' }}>{snap.name}</span>
                  <StatusBadge status={snap.state} />
                  {live && <Badge tone="green" dot>LIVE</Badge>}
                </div>
                <div className="muted row wrap" style={{ fontSize: 12.5, marginTop: 3, gap: 6 }}>
                  <span className="mono">{snap.lead_id}</span>·<span>{snap.business_name || '—'}</span>·<span className="mono">{snap.phone_masked}</span>·
                  <span>{SOURCE_LABEL[snap.source]}</span>·<span className="row" style={{ gap: 4 }}><Ch size={12} />{CHANNEL_LABEL[snap.channel]}</span>
                </div>
                <div className="dim ellipsis" style={{ fontSize: 12, marginTop: 2 }}>{snap.persona_label}</div>
              </div>
              {callDur != null && (
                <div style={{ textAlign: 'right' }}>
                  <div className="dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>Conversation</div>
                  <div className="timer">{Math.floor(callDur / 60)}:{String(Math.floor(callDur % 60)).padStart(2, '0')}</div>
                </div>
              )}
              {ttfc != null && (
                <div className="stopwatch" title="Time from lead creation to first contact attempt">
                  <span className="lbl"><Timer size={10} style={{ verticalAlign: -1 }} /> First contact</span>
                  <span className="timer">{ttfc.toFixed(1)}s</span>
                </div>
              )}
            </div>
            <Stepper state={snap.state} />

            <div className="transcript" ref={scrollRef}>
              {snap.turns.length === 0 && <div className="sys-row">{ACTIVITY[activity] || 'Waiting for the agent to start…'}</div>}
              {snap.turns.map((t) => t.speaker === 'system' ? (
                <div className="sys-row" key={t.i}><Info size={12} />{t.text}<span className="dim">{clock(t.ts)}</span></div>
              ) : (
                <div className={`bubble-row ${t.speaker}`} key={t.i}>
                  <div className={`speaker ${t.speaker}`}>{t.speaker === 'agent' ? <Bot size={16} /> : <UserRound size={16} />}</div>
                  <div>
                    <div className="bubble">
                      {t.text}
                      {t.en && t.en !== t.text && <div className="tr"><b>EN</b>{t.en}</div>}
                    </div>
                    {t.meta?.understood?.length > 0 && (
                      <div className="understood">{t.meta.understood.map((u) => <span key={u}>✓ {u}</span>)}</div>
                    )}
                    <div className="dim" style={{ fontSize: 10.5, marginTop: 4, textAlign: t.speaker === 'merchant' ? 'right' : 'left' }}>
                      {t.speaker === 'agent' ? 'LeadPilot agent' : snap.name?.split(' ')[0]} · {t.channel !== 'voice' ? CHANNEL_LABEL[t.channel] + ' · ' : ''}{clock(t.ts)}
                    </div>
                  </div>
                </div>
              ))}
              {typingWho && (
                <div className={`bubble-row ${typingWho}`}>
                  <div className={`speaker ${typingWho}`}>{typingWho === 'agent' ? <Bot size={16} /> : <UserRound size={16} />}</div>
                  <div className="bubble"><span className="typing"><i /><i /><i /></span></div>
                </div>
              )}
              {activity && !typingWho && activity !== 'agent_speaking' && snap.turns.length > 0 && (
                <div className="sys-row" style={{ color: 'var(--accent)' }}>
                  {activity === 'dialling' ? <span className="wave"><i /><i /><i /><i /><i /></span> : <span className="dot cyan" />}
                  {ACTIVITY[activity] || activity}
                </div>
              )}
            </div>

            {live && snap.mode === 'voice' ? (
              <CallPanel snap={snap} id={id} onSend={send} sending={sending} />
            ) : live && snap.mode === 'interactive' ? (
              <div className="composer">
                <div className="quick">{quick.map((q) => <button key={q} onClick={() => send(q)} disabled={sending}>{q}</button>)}</div>
                <div className="row">
                  <input className="input" placeholder={snap.expecting ? `Reply as the merchant (Hindi, Hinglish or English)…` : 'Waiting for the agent…'}
                    value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} autoFocus />
                  {SR && <button className={`btn icon-btn ${listening ? 'danger' : ''}`} onClick={toggleMic} title="Speak (browser speech recognition)">{listening ? <MicOff size={16} /> : <Mic size={16} />}</button>}
                  <button className="btn primary" onClick={() => send()} disabled={sending || !text.trim()}><Send size={15} /> Send</button>
                </div>
              </div>
            ) : (
              <div className="composer">
                <div className="row between wrap">
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {live ? 'Simulated merchant is replying automatically.' : `Session ended · ${snap.outcome ? snap.outcome.replace(/_/g, ' ') : 'recorded'}`}
                  </span>
                  <div className="row">
                    {snap.audio && <button className="btn sm ghost" onClick={() => setSound(!vs.soundOn)} title="Play Sarvam voices">{vs.soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />} Sound</button>}
                    {live ? <button className="btn sm danger" onClick={stop}><Square size={12} /> Stop</button> : (
                      <>
                        <button className="btn sm success" onClick={() => restart('voice')}><PhoneCall size={13} /> AI calls me</button>
                        <button className="btn sm" onClick={() => restart('interactive')}><UserRound size={13} /> Text chat</button>
                        {can('sim:run') && <button className="btn sm" onClick={() => restart('auto')}><Play size={13} /> Simulated</button>}
                      </>
                    )}
                    <button className="btn sm ghost" onClick={() => navigate('leads', id)}><ExternalLink size={13} /> CRM record</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* intelligence */}
      <div className="live-col scroll" style={{ paddingRight: 2 }}>
        <Card title="Extracted profile" icon={FileText} sub="Filled live from the conversation">
          <div className="fields">
            {fields.map(([k, I, v]) => (
              <div className={`field-tile ${v ? 'filled' : ''}`} key={k}>
                <div className="k"><I size={11} />{k}</div>
                <div className="v">{v || 'Listening…'}</div>
              </div>
            ))}
          </div>
        </Card>

        {score && (
          <Card title="Lead score" icon={Gauge} sub="Rule-based · every point explained">
            <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
              <ScoreRing score={score.score} temperature={score.temperature} size={92} />
              <div className="grow"><Factors factors={score.factors || []} /></div>
            </div>
          </Card>
        )}

        {rec && (
          <div className="rec-card">
            <div className="row between">
              <span className="section-title" style={{ margin: 0, color: 'var(--accent)' }}><Sparkles size={13} /> Recommendation</span>
              <span className="rec-price">{rec.price}</span>
            </div>
            <div className="rec-device mt-8">{rec.device}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{rec.plan} plan · {rec.reason}</div>
            <div className="row wrap mt-12" style={{ gap: 5 }}>{(rec.rule_ids || []).map((r) => <span className="rule-chip" key={r}>{r}</span>)}</div>
            {rec.rules && <div className="dim mt-8" style={{ fontSize: 11.5 }}>{rec.rules[0]}</div>}
          </div>
        )}

        {(snap?.slot_options?.length > 0 || snap?.visit) && (
          <Card title="Field allocation" icon={Route} sub="Distance · earliest slot · skill · workload">
            <div className="col">
              {(snap.slot_options || []).map((o, i) => {
                const picked = snap.visit && snap.visit.rep_id === o.rep_id && snap.visit.slot_start === o.slot_start
                return (
                  <div key={o.rep_id + o.slot_start} className={`opt ${picked ? 'picked' : i === 0 ? 'best' : ''}`}>
                    <div className="row between">
                      <span style={{ fontWeight: 650 }}>{o.rep_name}</span>
                      <span className="row" style={{ gap: 6 }}>{picked && <Badge tone="green">Booked</Badge>}<span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{o.score}</span></span>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>{o.slot_label} · {o.distance_km} km · base {o.rep_area}</div>
                    <div className="mini-bars">
                      {Object.entries(o.breakdown || {}).map(([k, v]) => (
                        <div key={k}>{k}<div className="b"><i style={{ width: `${v}%` }} /></div></div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {snap.visit && (
                <div className="banner tone-green"><CalendarCheck size={16} /><div><b>{snap.visit.visit_id}</b> · {snap.visit.rep} · {snap.visit.slot}. Rep briefed, merchant confirmed on WhatsApp.</div></div>
              )}
            </div>
          </Card>
        )}

        {snap?.state === 'HANDOFF' && <div className="banner tone-orange"><Headset size={16} />Routed to a human with full summary.</div>}
        {snap?.state === 'CLOSED' && snap?.outcome === 'opted_out' && <div className="banner tone-red"><Ban size={16} />Opt-out honoured instantly · number on DNC.</div>}

        {can('audit:read') && <Card title="Tool calls" icon={Bot} sub={`${tools.length} logged for this lead`}>
          <div className="feed">
            {tools.slice(0, 18).map((a, i) => {
              const m = toolMeta(a.tool)
              return (
                <div className={`feed-item ${a._new ? 'enter' : ''}`} key={(a.id || i) + a.tool + a.ts}>
                  <div className={`feed-icon tone-${a.status === 'blocked' ? 'red' : m.tone}`}><m.icon size={13} /></div>
                  <div className="feed-main">
                    <div className="row between"><span className="tool-name">{a.tool}</span><span className="feed-meta">{a.duration_ms != null ? `${a.duration_ms}ms` : ''}</span></div>
                    <div className="feed-meta">{describe(a)}</div>
                  </div>
                </div>
              )
            })}
            {!tools.length && <Empty>No tool calls yet.</Empty>}
          </div>
        </Card>}
      </div>
    </div>
  )
}
