import React, { useEffect, useState } from 'react'
import { ShieldCheck, Clock, Sparkles, Send, Database, Route, RotateCcw, Save, Info, Lock, Ban, Bot, Scale, TriangleAlert } from 'lucide-react'
import { api, can, useApi, dateTime } from '../api.js'
import { useApp } from '../ctx.js'
import { Card, Switch, Empty, Badge } from '../components/ui.jsx'

const GUARDRAILS = [
  [Bot, 'Identifies itself as an automated assistant at the start of every call'],
  [Info, 'Tells the merchant the call is recorded'],
  [ShieldCheck, 'Consent + DNC + opt-out checked before any contact; blocked if absent'],
  [Clock, 'Calls only inside permitted hours; max attempts per lead per day'],
  [Ban, 'Opt-out honoured instantly and added to the do-not-call list'],
  [Scale, 'Prices only from the rule table — no discounts, custom pricing goes to a human'],
  [Send, 'Messages only via approved templates (WhatsApp / SMS)'],
  [Lock, 'Phone numbers hashed for lookup, encrypted at rest, masked in UI & logs; reveal is admin-only and audited'],
]

export default function Compliance() {
  const { meta, toast } = useApp()
  const { data: s, reload } = useApi('/settings')
  const { data: consent } = useApi('/consent?limit=60', ['action'], (t, d) => d.tool === 'check_consent' || d.tool === 'record_opt_out')
  const [form, setForm] = useState(null)
  useEffect(() => { if (s) setForm(s) }, [s])

  const save = async () => {
    await api('/settings', { method: 'PUT', body: form })
    toast({ icon: Save, tone: 'green', title: 'Settings saved', sub: 'Logged to the audit trail' })
    reload()
  }
  const reset = async () => {
    if (!window.confirm('Reset all demo data? This reseeds 200 simulated leads and clears live sessions.')) return
    await api('/admin/reset', { method: 'POST' })
    reload()
  }
  if (!form) return <Empty>Loading…</Empty>
  const w = form.alloc_weights || {}
  const setW = (k, v) => setForm({ ...form, alloc_weights: { ...w, [k]: v } })
  const setN = (k) => (e) => setForm({ ...form, [k]: Number(e.target.value) })

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Compliance & Rules</h1>
          <div className="page-sub">Guardrails the orchestrator validates before every tool call, plus the transparent rule tables behind every decision.</div>
        </div>
        <div className="row">
          {can('admin:reset') && <button className="btn danger" onClick={reset}><RotateCcw size={14} /> Reset demo data</button>}
          {can('settings:write') ? <button className="btn primary" onClick={save}><Save size={15} /> Save settings</button> : <span className="chip"><Lock size={12} /> Read-only · admins can edit</span>}
        </div>
      </div>

      <div className="banner tone-amber" style={{ marginBottom: 16 }}>
        <TriangleAlert size={16} />
        Telemarketing / DND rules have not been verified with a qualified person. Do not describe this system as compliant until they are.
      </div>

      <fieldset disabled={!can('settings:write')} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="grid g-3">
        <Card title="Contact policy" icon={Clock}>
          <div className="col gap-12">
            <div className="row between"><div><div style={{ fontWeight: 600 }}>Enforce calling hours</div><div className="dim" style={{ fontSize: 12 }}>Turn off only for after-hours demos</div></div><Switch checked={form.enforce_calling_hours} onChange={(v) => setForm({ ...form, enforce_calling_hours: v })} /></div>
            <div className="grid g-2" style={{ gap: 10 }}>
              <div className="field"><label>From (hour)</label><input className="input" type="number" min="0" max="23" value={form.calling_hours[0]} onChange={(e) => setForm({ ...form, calling_hours: [Number(e.target.value), form.calling_hours[1]] })} /></div>
              <div className="field"><label>To (hour)</label><input className="input" type="number" min="1" max="24" value={form.calling_hours[1]} onChange={(e) => setForm({ ...form, calling_hours: [form.calling_hours[0], Number(e.target.value)] })} /></div>
            </div>
            <div className="grid g-2" style={{ gap: 10 }}>
              <div className="field"><label>Max attempts / day</label><input className="input" type="number" min="1" max="5" value={form.max_attempts_per_day} onChange={setN('max_attempts_per_day')} /></div>
              <div className="field"><label>Retry delay (demo, s)</label><input className="input" type="number" min="3" max="120" value={form.retry_delay_demo_sec} onChange={setN('retry_delay_demo_sec')} /></div>
            </div>
          </div>
        </Card>
        <Card title="Leakage thresholds" icon={TriangleAlert}>
          <div className="col gap-12">
            <div className="grid g-2" style={{ gap: 10 }}>
              <div className="field"><label>Contact window (s)</label><input className="input" type="number" value={form.contact_window_sec} onChange={setN('contact_window_sec')} /></div>
              <div className="field"><label>Hot score ≥</label><input className="input" type="number" value={form.hot_threshold} onChange={setN('hot_threshold')} /></div>
              <div className="field"><label>Hot unvisited after (h)</label><input className="input" type="number" value={form.hot_unvisited_hours} onChange={setN('hot_unvisited_hours')} /></div>
              <div className="field"><label>Max reschedules</label><input className="input" type="number" value={form.max_reschedules} onChange={setN('max_reschedules')} /></div>
            </div>
            <div className="row between"><div style={{ fontWeight: 600 }}>Auto-recover L1 / L5</div><Switch checked={form.auto_recover} onChange={(v) => setForm({ ...form, auto_recover: v })} /></div>
          </div>
        </Card>
        <Card title="Allocation weights" icon={Route} sub={`Coverage radius ${form.coverage_radius_km} km · weights shown in every find_slots log`}>
          <div className="col gap-12">
            {['distance', 'earliest', 'skill', 'workload'].map((k) => (
              <div key={k}>
                <div className="row between" style={{ fontSize: 12.5 }}><span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{k}</span><span className="mono">{Number(w[k] || 0).toFixed(2)}</span></div>
                <input type="range" min="0" max="1" step="0.05" value={w[k] || 0} onChange={(e) => setW(k, Number(e.target.value))} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      </fieldset>

      <div className="grid g-2 mt-16">
        <Card title="Guardrails" icon={ShieldCheck} sub="Validated by the orchestrator before each tool runs">
          <div className="feed">
            {GUARDRAILS.map(([I, t]) => (
              <div className="feed-item" key={t}><div className="feed-icon tone-green"><I size={13} /></div><div className="feed-main" style={{ fontSize: 13, color: 'var(--text-2)', paddingTop: 5 }}>{t}</div></div>
            ))}
          </div>
        </Card>
        <Card title="Recommendation rule table" icon={Sparkles} sub="Illustrative plans & prices — not Paytm's real pricing">
          <div className="col" style={{ gap: 6 }}>
            {(meta?.rules || []).map((r) => <div key={r.id} className="row" style={{ alignItems: 'flex-start' }}><span className="rule-chip">{r.id}</span><span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{r.desc}</span></div>)}
            <div className="divider" style={{ margin: '8px 0' }} />
            {(meta?.modifiers || []).map((r) => <div key={r.id} className="row" style={{ alignItems: 'flex-start' }}><span className="rule-chip">{r.id}</span><span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{r.desc}</span></div>)}
            <div className="divider" style={{ margin: '8px 0' }} />
            <div className="row wrap" style={{ gap: 6 }}>{Object.values(meta?.devices || {}).map((d) => <span key={d.device} className="chip accent">{d.device} · {d.price}</span>)}</div>
          </div>
        </Card>
      </div>

      <div className="grid g-2 mt-16">
        <Card title="Approved message templates" icon={Send}>
          <div className="feed">
            {Object.entries(meta?.templates || {}).map(([k, t]) => (
              <div className="feed-item" key={k}>
                <div className="feed-icon tone-blue"><Send size={13} /></div>
                <div className="feed-main"><div className="row between"><span className="tool-name">{k}</span><Badge tone="slate">{t.channel} → {t.to}</Badge></div><div className="muted" style={{ marginTop: 3 }}>{t.body}</div></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Consent log" icon={Database} sub="Latest consent checks, blocks and opt-outs" bodyClass="card-body scroll" style={{ maxHeight: 520, display: 'flex', flexDirection: 'column' }}>
          <div className="feed">
            {(consent || []).map((c) => (
              <div className="feed-item" key={c.id}>
                <div className={`feed-icon tone-${/block|opt|missing/.test(c.event) ? 'red' : 'green'}`}><ShieldCheck size={13} /></div>
                <div className="feed-main"><div className="row between"><span className="mono" style={{ fontSize: 12 }}>{c.event}</span><span className="feed-meta">{dateTime(c.ts)}</span></div><div className="feed-meta">{c.lead_id} · {c.name} · {c.detail}</div></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
