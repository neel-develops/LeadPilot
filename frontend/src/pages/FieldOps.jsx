import React, { useMemo, useState } from 'react'
import { MapPinned, Users, CalendarDays, CheckCircle2, XCircle, RotateCcw, CalendarClock, Route, Star, ClipboardList } from 'lucide-react'
import { api, useApi, dateTime } from '../api.js'
import { useApp } from '../ctx.js'
import { Card, Badge, Empty, Seg, StatusBadge, ScorePill } from '../components/ui.jsx'
import { Briefing } from './LeadDetail.jsx'
import OsmMap from '../components/OsmMap.jsx'

const REJECT = ['Merchant not present', 'Device mismatch', 'Not the decision maker', 'Chose competitor', 'Price concern at visit']

export default function FieldOps() {
  const { meta, toast, navigate } = useApp()
  const { data: reps } = useApi('/reps', ['visit', 'reset'])
  const { data: visits, reload } = useApi('/visits?days_back=2&days_fwd=3', ['visit', 'reset'])
  const [day, setDay] = useState(0)
  const [selectedRep, setSelectedRep] = useState(null)
  const [selectedVisit, setSelectedVisit] = useState(null)
  const [reason, setReason] = useState(REJECT[0])
  const [busy, setBusy] = useState(false)

  const now = Date.now() / 1000
  const upcoming = (visits || []).filter((v) => ['BOOKED', 'CONFIRMED'].includes(v.status) && v.slot_start >= now - 3600)
  const needsOutcome = (visits || []).filter((v) => ['BOOKED', 'CONFIRMED'].includes(v.status) && v.slot_start < now - 3600)
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0); dayStart.setDate(dayStart.getDate() + day)
  const ds = dayStart.getTime() / 1000
  const dayVisits = (visits || []).filter((v) => v.slot_start >= ds && v.slot_start < ds + 86400 && v.status !== 'RESCHEDULED')
  const hours = Array.from({ length: 10 }, (_, i) => 9 + i)
  const sel = (visits || []).find((v) => v.id === selectedVisit)

  const outcome = async (o) => {
    setBusy(true)
    try {
      const r = await api(`/visits/${sel.id}`, { method: 'PATCH', body: { outcome: o, reason: o === 'rejected' ? reason : o === 'revisit' ? 'Asked to come back' : null } })
      toast({ icon: CheckCircle2, tone: o === 'converted' ? 'green' : 'amber', title: `Visit marked ${o}`, sub: r.wasted ? 'Counted as a wasted visit' : 'Outcome captured to CRM' })
      reload()
    } finally { setBusy(false) }
  }
  const reschedule = async (why) => {
    setBusy(true)
    try {
      const r = await api(`/visits/${sel.id}/reschedule`, { method: 'POST', body: { reason: why } })
      toast({ icon: CalendarClock, tone: 'amber', title: 'Visit rescheduled', sub: `${r.rep} · ${r.slot} — merchant & rep notified` })
      setSelectedVisit(r.visit_id)
      reload()
    } catch (e) {
      toast({ icon: XCircle, tone: 'red', title: 'Could not reschedule', sub: e.message })
    } finally { setBusy(false) }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Field Operations</h1>
          <div className="page-sub">Field-aware allocation: the right rep and slot by distance, availability, skill and workload — not just any free slot.</div>
        </div>
        <div className="row"><Badge tone="violet">{upcoming.length} upcoming visits</Badge>{needsOutcome.length > 0 && <Badge tone="amber">{needsOutcome.length} awaiting outcome</Badge>}</div>
      </div>

      <div className="grid g-main">
        <Card title="Pune field map" icon={MapPinned} sub="OpenStreetMap · click a rep to see their 12 km coverage and route" bodyClass="card-body">
          <OsmMap reps={reps || []} visits={upcoming} selectedRep={selectedRep} onRep={setSelectedRep} selectedVisit={selectedVisit} onVisit={setSelectedVisit} />
        </Card>
        <Card title="Field reps" icon={Users} sub="Capacity 6 visits / day" bodyClass="card-body scroll" style={{ maxHeight: 540, display: 'flex', flexDirection: 'column' }}>
          <div className="col" style={{ gap: 4 }}>
            {(reps || []).map((r) => (
              <div key={r.id} className={`sess-list-item ${selectedRep === r.id ? 'active' : ''}`} onClick={() => setSelectedRep(selectedRep === r.id ? null : r.id)}>
                <div className="row">
                  <div className="avatar sm">{r.name.split(' ').map((p) => p[0]).join('')}</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row between"><span style={{ fontWeight: 650, fontSize: 13 }}>{r.name}</span><span className="row muted" style={{ fontSize: 12, gap: 3 }}><Star size={11} fill="var(--amber)" color="var(--amber)" />{r.rating}</span></div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{r.area} · {Object.keys(r.skills).map((s) => s.replace('_', ' ')).join(', ')} · {r.working_hours[0]}–{r.working_hours[1]}h</div>
                  </div>
                </div>
                <div className="row mt-8" style={{ gap: 8 }}>
                  <div className="progress grow"><i style={{ width: `${Math.min(100, (r.next_24h / r.capacity) * 100)}%` }} /></div>
                  <span className="dim tnum" style={{ fontSize: 11 }}>{r.next_24h}/{r.capacity} next 24h</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g-main mt-16">
        <Card title="Rep calendar" icon={CalendarDays} sub="Bookings land here the moment the agent confirms"
          actions={<Seg value={day} onChange={setDay} options={[{ value: -1, label: 'Yesterday' }, { value: 0, label: 'Today' }, { value: 1, label: 'Tomorrow' }, { value: 2, label: dayStart && new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }) }]} />}>
          <div className="table-wrap">
            <div className="cal" style={{ gridTemplateColumns: `120px repeat(${hours.length}, minmax(52px, 1fr))`, minWidth: 640 }}>
              <div className="cal-cell cal-head">Rep</div>
              {hours.map((h) => <div key={h} className="cal-cell cal-head">{h % 12 || 12}{h < 12 ? 'am' : 'pm'}</div>)}
              {(reps || []).map((r) => (
                <React.Fragment key={r.id}>
                  <div className="cal-cell cal-rep"><div className="avatar sm">{r.name.split(' ').map((p) => p[0]).join('')}</div><span className="ellipsis">{r.name.split(' ')[0]}</span></div>
                  {hours.map((h) => {
                    const off = h < r.working_hours[0] || h >= r.working_hours[1]
                    const evs = dayVisits.filter((v) => v.agent_id === r.id && new Date(v.slot_start * 1000).getHours() === h)
                    const isNow = day === 0 && new Date().getHours() === h
                    return (
                      <div key={h} className={`cal-cell ${isNow ? 'cal-now' : ''}`} style={off ? { background: 'repeating-linear-gradient(45deg, transparent 0 6px, rgba(148,170,210,.03) 6px 12px)' } : undefined}>
                        {evs.map((v) => {
                          const tone = v.status === 'COMPLETED' ? (v.outcome === 'converted' ? 'green' : v.outcome === 'rejected' ? 'red' : 'amber') : 'cyan'
                          return <div key={v.id} className={`cal-ev tone-${tone} ${v.created_at > now - 120 ? 'new' : ''}`} onClick={() => setSelectedVisit(v.id)} title={`${v.lead_name} · ${v.slot_label}`}>{v.lead_name.split(' ')[0]}</div>
                        })}
                      </div>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </Card>

        <Card title={sel ? `Visit ${sel.id}` : 'Visit details'} icon={ClipboardList} sub={sel ? `${sel.slot_label} · ${sel.rep_name}` : 'Select a visit on the map or calendar'}>
          {sel ? (
            <div className="col" style={{ gap: 12 }}>
              <div className="row between">
                <div className="who" style={{ cursor: 'pointer' }} onClick={() => navigate('leads', sel.lead_id)}>
                  <div className="avatar">{sel.lead_name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</div>
                  <div><div className="who-name">{sel.lead_name}</div><div className="who-sub">{sel.business_name} · {sel.area}</div></div>
                </div>
                <ScorePill score={sel.score} temperature={sel.temperature} />
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                <Badge tone={sel.status === 'COMPLETED' ? 'green' : 'violet'}>{sel.status}</Badge>
                {sel.outcome && <Badge tone={sel.outcome === 'converted' ? 'green' : 'red'}>{sel.outcome}{sel.outcome_reason ? ` · ${sel.outcome_reason}` : ''}</Badge>}
                {sel.distance_km != null && <span className="chip"><Route size={11} />{sel.distance_km} km</span>}
                <span className="chip">{sel.merchant_confirmed ? 'Merchant confirmed' : 'Awaiting confirmation'}</span>
              </div>
              <Briefing b={sel.briefing} />
              {['BOOKED', 'CONFIRMED'].includes(sel.status) && (
                <>
                  <div className="divider" style={{ margin: '4px 0' }} />
                  <div className="section-title">Capture outcome (rep app)</div>
                  <div className="row wrap">
                    <button className="btn sm success" disabled={busy} onClick={() => outcome('converted')}><CheckCircle2 size={13} /> Converted</button>
                    <button className="btn sm" disabled={busy} onClick={() => outcome('revisit')}><RotateCcw size={13} /> Revisit</button>
                  </div>
                  <div className="row">
                    <select className="select" value={reason} onChange={(e) => setReason(e.target.value)} style={{ height: 32 }}>{REJECT.map((r) => <option key={r}>{r}</option>)}</select>
                    <button className="btn sm danger" disabled={busy} onClick={() => outcome('rejected')}><XCircle size={13} /> Rejected</button>
                  </div>
                  <div className="section-title" style={{ marginTop: 6 }}>Reschedule</div>
                  <div className="row wrap">
                    <button className="btn sm" disabled={busy} onClick={() => reschedule('rep_unavailable')}><CalendarClock size={13} /> Rep unavailable → reassign</button>
                    <button className="btn sm ghost" disabled={busy} onClick={() => reschedule('merchant_request')}>Merchant asked</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Empty icon={ClipboardList}>Nothing selected.</Empty>
              {needsOutcome.length > 0 && (
                <>
                  <div className="section-title">Awaiting outcome</div>
                  {needsOutcome.slice(0, 5).map((v) => (
                    <div key={v.id} className="sess-list-item" onClick={() => setSelectedVisit(v.id)}>
                      <div className="row between"><span style={{ fontWeight: 600 }}>{v.lead_name}</span><span className="muted" style={{ fontSize: 12 }}>{dateTime(v.slot_start)}</span></div>
                      <div className="muted" style={{ fontSize: 12 }}>{v.rep_name} · {v.area}</div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  )
}
