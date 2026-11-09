import React, { useState } from 'react'
import { CalendarCheck, CheckCircle2, XCircle, RotateCcw, CalendarClock, Route, Trophy, Target, TriangleAlert, Plus, Navigation, Phone } from 'lucide-react'
import { api, useApi, can } from '../api.js'
import { useApp } from '../ctx.js'
import { Card, Badge, Empty, Kpi, ScorePill } from '../components/ui.jsx'
import OsmMap from '../components/OsmMap.jsx'
import { Briefing } from './LeadDetail.jsx'

const REJECT = ['Merchant not present', 'Device mismatch', 'Not the decision maker', 'Chose competitor', 'Price concern at visit']

export default function MyDay() {
  const { toast, openNewLead, navigate } = useApp()
  const { data, reload } = useApi('/me/day', ['visit', 'reset', 'session_end'], null, 500)
  const [sel, setSel] = useState(null)
  const [reason, setReason] = useState(REJECT[0])
  const [busy, setBusy] = useState(false)
  if (!data) return <Empty>Loading your day…</Empty>
  const now = Date.now() / 1000
  const rep = data.rep
  const upcoming = data.visits.filter((v) => ['BOOKED', 'CONFIRMED'].includes(v.status)).sort((a, b) => a.slot_start - b.slot_start)
  const done = data.visits.filter((v) => v.status === 'COMPLETED').sort((a, b) => b.slot_start - a.slot_start)
  const v = data.visits.find((x) => x.id === sel) || upcoming[0]

  const act = async (fn, msg) => {
    setBusy(true)
    try { const r = await fn(); toast({ icon: CheckCircle2, tone: 'green', title: msg, sub: r?.slot ? `${r.rep} · ${r.slot}` : undefined }); reload() }
    catch (e) { toast({ icon: XCircle, tone: 'red', title: 'Not allowed', sub: e.message }) }
    finally { setBusy(false) }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-sub">Good day, {rep.name.split(' ')[0]} — {rep.area} territory · {rep.working_hours[0]}:00–{rep.working_hours[1]}:00 · capacity {rep.capacity} visits/day</div>
        {can('leads:create') && <button className="btn primary" onClick={openNewLead}><Plus size={15} /> Capture a merchant lead</button>}
      </div>
      <div className="grid g-4">
        <Kpi label="Upcoming visits" icon={CalendarCheck} tone="cyan" value={data.stats.upcoming} foot="Next 3 days" />
        <Kpi label="Completed" icon={Target} tone="violet" value={data.stats.completed} foot="All time" />
        <Kpi label="Conversion" icon={Trophy} tone="green" value={data.stats.conversion} suffix="%" foot={`${data.stats.converted} merchants converted`} />
        <Kpi label="Wasted visits" icon={TriangleAlert} tone="amber" value={data.stats.wasted} foot="Merchant absent / wrong device" />
      </div>

      <div className="grid g-main mt-16">
        <Card title="Today's route" icon={Navigation} sub="OpenStreetMap · numbered in visit order">
          <OsmMap reps={[rep]} visits={upcoming} selectedRep={rep.id} numbered onVisit={setSel} selectedVisit={v?.id} height={420} />
        </Card>
        <Card title="My visits" icon={Route} sub={`${upcoming.length} upcoming · ${done.length} done`} bodyClass="card-body scroll" style={{ maxHeight: 520, display: 'flex', flexDirection: 'column' }}>
          {upcoming.length ? upcoming.map((x, i) => (
            <div key={x.id} className={`sess-list-item ${v?.id === x.id ? 'active' : ''}`} onClick={() => setSel(x.id)}>
              <div className="row between">
                <span className="row" style={{ fontWeight: 600 }}><span className="step-dot" style={{ width: 22, height: 22, fontSize: 11 }}>{i + 1}</span>{x.lead_name}</span>
                <ScorePill score={x.score} temperature={x.temperature} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{x.slot_label} · {x.area} · {x.distance_km ?? '—'} km {x.slot_start < now ? '· awaiting outcome' : ''}</div>
            </div>
          )) : <Empty icon={CalendarCheck}>No visits booked yet. The agent books them straight into this list.</Empty>}
        </Card>
      </div>

      {v && (
        <Card className="mt-16" title={`${v.lead_name} · ${v.business_name || ''}`} icon={Phone} sub={`${v.id} · ${v.slot_label} · ${v.area}`}
          actions={<button className="btn sm ghost" onClick={() => navigate('leads', v.lead_id)}>Merchant record</button>}>
          <div className="grid g-main">
            <Briefing b={v.briefing} />
            <div className="col" style={{ gap: 10 }}>
              <div className="row wrap" style={{ gap: 6 }}>
                <Badge tone={v.status === 'COMPLETED' ? 'green' : 'violet'}>{v.status}</Badge>
                <span className="chip">{v.merchant_confirmed ? 'Merchant confirmed' : 'Awaiting confirmation'}</span>
              </div>
              {['BOOKED', 'CONFIRMED'].includes(v.status) && (
                <>
                  <div className="section-title">Visit outcome</div>
                  <div className="row wrap">
                    <button className="btn sm success" disabled={busy} onClick={() => act(() => api(`/visits/${v.id}`, { method: 'PATCH', body: { outcome: 'converted' } }), 'Marked converted')}><CheckCircle2 size={13} /> Converted</button>
                    <button className="btn sm" disabled={busy} onClick={() => act(() => api(`/visits/${v.id}`, { method: 'PATCH', body: { outcome: 'revisit', reason: 'Asked to come back' } }), 'Revisit captured')}><RotateCcw size={13} /> Revisit</button>
                  </div>
                  <div className="row">
                    <select className="select" style={{ height: 32 }} value={reason} onChange={(e) => setReason(e.target.value)}>{REJECT.map((r) => <option key={r}>{r}</option>)}</select>
                    <button className="btn sm danger" disabled={busy} onClick={() => act(() => api(`/visits/${v.id}`, { method: 'PATCH', body: { outcome: 'rejected', reason } }), 'Rejection captured')}><XCircle size={13} /> Rejected</button>
                  </div>
                  <div className="section-title" style={{ marginTop: 4 }}>Can't make it?</div>
                  <button className="btn sm" disabled={busy} onClick={() => act(() => api(`/visits/${v.id}/reschedule`, { method: 'POST', body: { reason: 'rep_unavailable' } }), 'Reassigned to another rep')}><CalendarClock size={13} /> I'm unavailable — reassign</button>
                </>
              )}
            </div>
          </div>
        </Card>
      )}
    </>
  )
}
