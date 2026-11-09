import React, { useMemo, useState } from 'react'
import {
  SlidersHorizontal, ChevronLeft, ChevronRight, ChartNoAxesColumn, Sparkles, Minimize2, SendHorizontal, Plus,
  ArrowUpRight, Lightbulb, Loader2,
} from 'lucide-react'
import { api, useApi, dur } from '../api.js'
import { useApp } from '../ctx.js'

const FLOW = ['CONSENT_OK', 'CONTACTING', 'QUALIFYING', 'RECOMMENDING', 'BOOKING', 'CONFIRMED']
export function MiniSteps({ state }) {
  const idx = FLOW.indexOf(state)
  const terminal = ['FOLLOW_UP', 'HANDOFF', 'CLOSED', 'BLOCKED'].includes(state)
  return (
    <div className="mini-steps">
      {FLOW.map((s, i) => {
        let cls = ''
        if (state === 'CONFIRMED') cls = 'ok'
        else if (terminal) cls = i < 2 ? 'bad' : ''
        else if (i <= idx) cls = 'on'
        return <span key={s} className={cls} />
      })}
    </div>
  )
}

const METRICS = [
  { key: 'leads', label: 'Leads', title: 'Lead flow' },
  { key: 'contacted', label: 'Contacted', title: 'Contacted in <60s' },
  { key: 'visits', label: 'Visits', title: 'Visits booked' },
  { key: 'converted', label: 'Converted', title: 'Merchants converted' },
]
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const fmt = (n) => Number(n || 0).toLocaleString('en-IN')
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0)

// ------------------------------------------------------------------ lead flow (Revenue)
function LeadFlow({ ov }) {
  const { navigate } = useApp()
  const [metric, setMetric] = useState('leads')
  const [hover, setHover] = useState(null)
  const days = ov?.daily || []
  const vals = days.map((d) => d[metric] || 0)
  const total = vals.reduce((a, b) => a + b, 0)
  const recent = vals.slice(6).reduce((a, b) => a + b, 0)
  const prior = vals.slice(0, 6).reduce((a, b) => a + b, 0)
  const delta = pct(recent, prior)
  const max = Math.max(4, ...vals)
  const step = Math.ceil(max / 4)
  const top = step * 4
  const maxIdx = vals.indexOf(Math.max(...vals))
  const hi = hover ?? maxIdx
  const m = METRICS.find((x) => x.key === metric)

  return (
    <div className="card ov-revenue" style={{ padding: '20px 22px 18px' }}>
      <div className="row between">
        <div className="card-title" style={{ fontSize: 19 }}>{m.title}</div>
        <div className="row" style={{ gap: 10 }}>
          <div className="seg">
            {METRICS.map((x) => <button key={x.key} className={metric === x.key ? 'on' : ''} onClick={() => { setMetric(x.key); setHover(null) }}>{x.label}</button>)}
          </div>
          <button className="round-btn" title="Open analytics" onClick={() => navigate('analytics')}><SlidersHorizontal size={16} /></button>
        </div>
      </div>
      <div className="row" style={{ gap: 12, marginTop: 14 }}>
        <span className="big-num">{fmt(total)}</span>
        <span className={`delta ${delta < 0 ? 'down' : ''}`}>{delta < 0 ? '▼' : '▲'} {Math.abs(delta)}%</span>
        <span className="muted" style={{ fontSize: 13 }}>vs {fmt(prior)} previous 6 days · last 12 days</span>
      </div>
      <div className="bars">
        <div className="bars-y">{[4, 3, 2, 1, 0].map((i) => <span key={i}>{fmt(step * i)}</span>)}</div>
        <div className="bars-x" style={{ gridTemplateColumns: `repeat(${days.length || 12}, minmax(0, 1fr))` }} onMouseLeave={() => setHover(null)}>
          {days.map((d, i) => {
            const v = vals[i]
            const h = Math.max(8, (v / top) * 100)
            const change = i > 0 ? pct(v, vals[i - 1]) : 0
            const isHi = i === hi
            return (
              <div className="bar-col" key={d.day} onMouseEnter={() => setHover(i)}>
                <div className="bar-track">
                  <div className={`bar ${isHi ? 'hi' : ''}`} style={{ height: `${h}%` }}>
                    {isHi && <div className="bar-tag">{change >= 0 ? '▲' : '▼'} {change >= 0 ? '+' : ''}{change}%</div>}
                    {isHi && h > 28 && <div className="bar-val">{fmt(v)}</div>}
                  </div>
                </div>
                <div className="bar-lbl">{d.day.split(' ').reverse().join(' ')}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ visit calendar
function VisitCalendar({ ov }) {
  const { navigate } = useApp()
  const now = new Date()
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const todayKey = now.toISOString().slice(0, 10)
  const [sel, setSel] = useState(todayKey)
  const cal = ov?.calendar || {}
  const y = cursor.getFullYear()
  const mo = cursor.getMonth()
  const first = (new Date(y, mo, 1).getDay() + 6) % 7
  const n = new Date(y, mo + 1, 0).getDate()
  const key = (d) => `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const cells = []
  for (let i = 0; i < first; i++) cells.push(null)
  for (let d = 1; d <= n; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  const monthVals = Array.from({ length: n }, (_, i) => cal[key(i + 1)] || 0)
  const active = monthVals.filter(Boolean)
  const avg = active.length ? active.reduce((a, b) => a + b, 0) / active.length : 0
  const selKey = sel === todayKey ? localToday : sel
  const selVal = cal[selKey] || 0
  const d = pct(selVal, Math.round(avg))
  const selLabel = new Date(selKey + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="round-btn" style={{ width: 34, height: 34 }} onClick={() => setCursor(new Date(y, mo - 1, 1))}><ChevronLeft size={16} /></button>
        <div style={{ fontSize: 16, fontWeight: 500 }}>{MONTHS[mo]}, {y}</div>
        <button className="round-btn" style={{ width: 34, height: 34 }} onClick={() => setCursor(new Date(y, mo + 1, 1))}><ChevronRight size={16} /></button>
      </div>
      <div className="calbox">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => <div className="cal-dow" key={i}>{x}</div>)}
        {cells.map((dd, i) => {
          if (!dd) return <div className="cal-day pad" key={'p' + i} />
          const k = key(dd)
          const c = cal[k] || 0
          const isToday = k === localToday
          return (
            <div key={k} className={`cal-day ${c ? 'has' : ''} ${isToday ? 'today' : ''} ${selKey === k && !isToday ? 'sel' : ''}`}
              title={c ? `${c} visit(s)` : 'No visits'} onClick={() => setSel(k)}>
              {dd}{c > 0 && <span className="cnt" />}
            </div>
          )
        })}
      </div>
      <div className="stat-pill" style={{ cursor: 'pointer' }} onClick={() => navigate('field')}>
        <div className="stat-ico" style={{ width: 40, height: 40 }}><ChartNoAxesColumn size={17} /></div>
        <div className="grow">
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <span className="big-num" style={{ fontSize: 30 }}>{selVal}</span>
            <span className={d < 0 ? '' : 'up'} style={{ color: d < 0 ? 'var(--red)' : undefined, fontSize: 13 }}>{d < 0 ? '▼' : '▲'} {Math.abs(d)}%</span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>field visits on {selLabel} · vs month avg {avg.toFixed(1)}</div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ AI assistant
function answer(q, ov, fc) {
  const k = ov.kpis
  const c = ov.comparison
  const t = q.toLowerCase()
  const topRep = [...ov.rep_performance].sort((a, b) => b.conversion - a.conversion)[0]
  const lost = ov.lost_reasons.slice(0, 3).map((r) => `${r.reason} (${r.count})`).join(', ')
  const bestSrc = [...ov.sources].sort((a, b) => b.rate - a.rate)[0]
  if (/contact|fast|speed|first|minute|ttfc/.test(t)) return `Median time to first contact is ${dur(k.median_ttfc_sec)} (${fc?.under_60s_pct ?? '—'}% of leads reached in under 60s) versus a ${c.ttfc.baseline} manual callback baseline.`
  if (/wasted|waste/.test(t)) return `Wasted visits are at ${c.wasted.agent}% versus ${c.wasted.baseline}% in the baseline — better qualification and device fit before booking.`
  if (/convers|visit rate|lead.to.visit|book/.test(t)) return `Lead-to-visit conversion is ${c.lead_to_visit.agent}% versus ${c.lead_to_visit.baseline}% baseline. ${k.visits_booked} visits are booked and upcoming.`
  if (/leak|cold|stuck|risk/.test(t)) return `${k.open_flags} leads are flagged as leaking. Open the Lead Leakage screen to recover them with one click.`
  if (/hot/.test(t)) return `${k.hot_leads} hot leads (score ≥ 70) are still open. The leakage detector alerts if any go 24h without a visit.`
  if (/rep|best|top|field/.test(t)) return `${topRep.name} (${topRep.area}) leads conversion at ${topRep.conversion}% across ${topRep.visits} completed visits.`
  if (/lost|reason|why|reject/.test(t)) return `Top lost-deal reasons: ${lost}.`
  if (/source|channel|form|missed|ad/.test(t)) return `${bestSrc.source} converts best: ${bestSrc.rate}% lead-to-visit from ${bestSrc.leads} leads.`
  if (/handoff|human|manager/.test(t)) return `${k.handoffs_open} handoffs are open; only ${c.human.agent}% of leads needed a human versus 100% before.`
  if (/today|new/.test(t)) return `${k.leads_today} leads arrived today; ${k.active_sessions} agent conversation(s) are live right now.`
  return `I can answer questions about first-contact speed, conversion, wasted visits, leaking or hot leads, top reps, lost reasons, sources and handoffs. Try "Which rep converts best?"`
}

function Assistant({ ov, fc }) {
  const { navigate } = useApp()
  const [q, setQ] = useState('')
  const [reply, setReply] = useState(null)
  const [more, setMore] = useState(false)
  const [thinking, setThinking] = useState(false)
  const k = ov?.kpis || {}
  const c = ov?.comparison
  const summary = c
    ? `Lead engine is healthy. ${k.leads_today} leads arrived today and the agent reached them in a median of ${dur(k.median_ttfc_sec)}, against a ${c.ttfc.baseline} manual baseline. Lead-to-visit is ${c.lead_to_visit.agent}% (baseline ${c.lead_to_visit.baseline}%) and wasted visits fell to ${c.wasted.agent}%.`
    : 'Loading summary…'
  const extra = ov ? ` ${k.open_flags} leads are flagged as leaking and ${k.handoffs_open} handoffs await a human. Top lost reason: ${ov.lost_reasons[0]?.reason || '—'}.` : ''
  const ask = (e) => {
    e.preventDefault()
    if (!q.trim() || !ov) return
    setThinking(true)
    const text = q
    setQ('')
    api('/assistant', { method: 'POST', body: { question: text } })
      .then((r) => setReply({ q: text, a: r.answer, ai: true }))
      .catch(() => setReply({ q: text, a: answer(text, ov, fc) }))
      .finally(() => setThinking(false))
  }
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row between">
        <div className="ai-title"><Sparkles size={20} color="#5ED3F8" /> How can I help you?</div>
        <button className="round-btn" title="Open live agent" onClick={() => navigate('live')}><Minimize2 size={15} /></button>
      </div>
      <div>
        <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 6 }}>{reply ? reply.q : 'AI Summary'}</div>
        <div className="ai-text" style={{ minHeight: 60 }}>
          {thinking ? <span className="row"><Loader2 size={14} className="spin" /> Thinking…</span>
            : reply ? <>{reply.a} {reply.ai && <span className="chip accent" style={{ padding: '1px 7px', fontSize: 10.5 }}>Sarvam AI</span>} <a onClick={() => setReply(null)}>Back to summary</a></>
              : <>{summary}{more ? extra : '…'}<a onClick={() => setMore(!more)}>{more ? ' Show less' : 'Read more'}</a></>}
        </div>
      </div>
      <div className="grid g-2" style={{ gap: 10 }}>
        <div className="mini" onClick={() => navigate('leads')}>
          <div className="muted" style={{ fontSize: 13 }}>Hot leads open</div>
          <div className="row mt-8" style={{ gap: 10 }}><span className="mini-num">{k.hot_leads ?? '—'}</span><span className="pill-tag" style={{ background: 'var(--orange)', color: '#2a1103' }}>Act now</span></div>
        </div>
        <div className="mini" onClick={() => navigate('field')}>
          <div className="muted" style={{ fontSize: 13 }}>Visits booked</div>
          <div className="row mt-8" style={{ gap: 10 }}><span className="mini-num">{k.visits_booked ?? '—'}</span><span className="pill-tag" style={{ background: 'var(--green)', color: '#062a19' }}>Scheduled</span></div>
        </div>
      </div>
      <form className="ask" onSubmit={ask}>
        <input placeholder="Ask me anything…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" aria-label="Ask"><SendHorizontal size={17} /></button>
      </form>
    </div>
  )
}

// ------------------------------------------------------------------ lead mix donut (Spending)
const GROUPS = {
  status: {
    label: 'By status',
    items: [
      ['Visit booked', '#ff7a2c', ['CONFIRMED']],
      ['Converted', '#3ecf8e', ['CONVERTED', 'ACTIVATED']],
      ['Follow-up', '#f5c518', ['FOLLOW_UP', 'REVISIT']],
      ['In progress', '#00BAF2', ['NEW', 'CONSENT_OK', 'CONTACTING', 'QUALIFYING', 'RECOMMENDING', 'BOOKING']],
      ['Human handoff', '#a78bfa', ['HANDOFF']],
      ['Lost / blocked', '#A9B8CE', ['CLOSED', 'REJECTED', 'BLOCKED']],
    ],
  },
  temp: {
    label: 'By temperature',
    items: [['Hot', '#ff7a2c', ['hot']], ['Warm', '#f5c518', ['warm']], ['Cold', '#00BAF2', ['cold']], ['Unscored', '#A9B8CE', ['unscored']]],
  },
  lang: {
    label: 'By language',
    items: [['Hindi', '#ff7a2c', ['hi']], ['English', '#00BAF2', ['en']], ['Marathi', '#3ecf8e', ['mr']]],
  },
}

function LeadMix({ ov }) {
  const { navigate } = useApp()
  const [group, setGroup] = useState('status')
  const [hover, setHover] = useState(null)
  const src = group === 'status' ? ov?.statuses : group === 'temp' ? ov?.temperatures : ov?.languages
  const segs = GROUPS[group].items.map(([label, color, keys]) => ({ label, color, value: keys.reduce((a, k) => a + ((src || {})[k] || 0), 0) })).filter((s) => s.value > 0)
  const total = segs.reduce((a, s) => a + s.value, 0) || 1
  const R = 78
  const C = 2 * Math.PI * R
  const gap = 14
  let acc = 0
  const arcs = segs.map((s) => {
    const len = (s.value / total) * C
    const a = { ...s, start: acc, len, mid: (acc + len / 2) / C }
    acc += len
    return a
  })
  const sorted = [...segs].sort((a, b) => b.value - a.value)
  const h = hover != null ? arcs[hover] : null
  const tipPos = h ? { left: 100 + (R + 4) * Math.cos(h.mid * 2 * Math.PI - Math.PI / 2), top: 100 + (R + 4) * Math.sin(h.mid * 2 * Math.PI - Math.PI / 2) } : null

  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row between">
        <div className="card-title" style={{ fontSize: 19 }}>Lead mix</div>
        <select className="drop" value={group} onChange={(e) => { setGroup(e.target.value); setHover(null) }}>
          {Object.entries(GROUPS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}
        </select>
      </div>
      <div className="row" style={{ gap: 18, alignItems: 'center' }}>
        <div className="donut-wrap" onMouseLeave={() => setHover(null)}>
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
            {arcs.map((a, i) => (
              <circle key={a.label} cx="100" cy="100" r={R} fill="none" stroke={a.color} strokeWidth={hover === i ? 30 : 26} strokeLinecap="round"
                strokeDasharray={`${Math.max(0.1, a.len - gap)} ${C}`} strokeDashoffset={-(a.start + gap / 2)}
                style={{ transition: 'stroke-width .2s', cursor: 'pointer' }} onMouseEnter={() => setHover(i)} />
            ))}
          </svg>
          <div className="donut-center">
            <div><div style={{ fontSize: 28, fontWeight: 500 }}>{fmt(total)}</div><div className="muted" style={{ fontSize: 13 }}>Total leads</div></div>
          </div>
          {h && <div className="donut-tip" style={tipPos}><span style={{ color: h.color }}>●</span> {h.value}<br /><span className="muted">({Math.round((h.value / total) * 100)}%)</span></div>}
        </div>
        <div className="lg">
          {arcs.map((a, i) => (
            <span key={a.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ opacity: hover == null || hover === i ? 1 : 0.5 }}>
              <i style={{ background: a.color === '#A9B8CE' ? '#A9B8CE' : a.color }} />{a.label}
            </span>
          ))}
        </div>
      </div>
      <div className="insight" style={{ cursor: 'pointer' }} onClick={() => navigate('analytics')}>
        <Lightbulb size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Most leads sit in {sorted[0]?.label.toLowerCase()} and {sorted[1]?.label.toLowerCase() || '—'}, while {sorted[sorted.length - 1]?.label.toLowerCase()} is the smallest share ({Math.round(((sorted[sorted.length - 1]?.value || 0) / total) * 100)}%).</span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ upcoming visits (Invoices)
function relDay(ts) {
  const a = new Date(); a.setHours(0, 0, 0, 0)
  const b = new Date(ts * 1000); b.setHours(0, 0, 0, 0)
  const d = Math.round((b - a) / 864e5)
  return d === 0 ? 'today' : d === 1 ? 'in 1 day' : `in ${d} days`
}

function UpcomingVisits({ fc }) {
  const { navigate, openNewLead } = useApp()
  const { data: visits } = useApi('/visits?days_back=0&days_fwd=3', ['visit', 'reset'], null, 500)
  const now = Date.now() / 1000
  const up = (visits || []).filter((v) => ['BOOKED', 'CONFIRMED'].includes(v.status) && v.slot_start >= now - 1800)
    .sort((a, b) => (a.merchant_confirmed - b.merchant_confirmed) || (a.slot_start - b.slot_start)).slice(0, 3)
  const sla = Math.round(fc?.under_60s_pct ?? 0)
  const bars = 56
  const filled = Math.round((sla / 100) * bars)
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row between">
        <div className="card-title" style={{ fontSize: 19 }}>Upcoming visits</div>
        <button className="round-btn" title="New lead" onClick={openNewLead}><Plus size={17} /></button>
      </div>
      <div className="score-row" title="Share of leads contacted within 60 seconds">
        <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Contact SLA</span>
        <div className="barcode">
          {Array.from({ length: bars }, (_, i) => (
            <i key={i} style={{ background: i < filled ? '#f5c518' : 'rgba(255,255,255,.12)', opacity: i < filled ? 0.55 + 0.45 * ((i * 7) % 5) / 4 : 1 }} />
          ))}
        </div>
        <span style={{ fontWeight: 600 }}>{sla}</span>
      </div>
      <div>
        {up.map((v) => {
          const d = new Date(v.slot_start * 1000)
          const st = v.slot_start < now + 3 * 3600 ? ['Due soon', '#f5c518'] : v.merchant_confirmed ? ['Confirmed', '#3ecf8e'] : ['Unconfirmed', '#f25f5c']
          return (
            <div className="inv-row" key={v.id} onClick={() => navigate('leads', v.lead_id)}>
              <div>
                <div style={{ fontSize: 13 }}>{d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</div>
                <div className="muted" style={{ fontSize: 12 }}>{relDay(v.slot_start)}</div>
              </div>
              <div><span className="st-pill"><i style={{ background: st[1] }} />{st[0]}</span></div>
              <div className="inv-name ellipsis">{v.lead_name}<div className="dim" style={{ fontSize: 11.5 }}>{v.rep_name} · {d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</div></div>
              <div className="inv-amt">{v.briefing?.recommendation?.price?.replace('/month', '/mo') || '—'}</div>
            </div>
          )
        })}
        {visits && !up.length && <div className="empty">No upcoming visits.</div>}
      </div>
      <a style={{ color: 'var(--text)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 'auto' }} onClick={() => navigate('field')}>
        View all visits <ArrowUpRight size={15} />
      </a>
    </div>
  )
}

export default function CommandCenter() {
  const { data: ov } = useApi('/metrics/overview', ['session_end', 'session_start', 'visit', 'flags_changed', 'handoff', 'reset', 'lead_created'], null, 700)
  const { data: fc } = useApi('/metrics/first-contact', ['session_start', 'reset'], null, 1500)
  const ovm = useMemo(() => ov, [ov])
  return (
    <div className="ov-grid">
      <LeadFlow ov={ovm} />
      <VisitCalendar ov={ovm} />
      <Assistant ov={ovm} fc={fc} />
      <LeadMix ov={ovm} />
      <UpcomingVisits fc={fc} />
    </div>
  )
}
