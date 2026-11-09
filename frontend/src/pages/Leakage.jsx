import React, { useState } from 'react'
import { ShieldAlert, LifeBuoy, RefreshCw, CheckCircle2, Siren, PhoneOff, CalendarClock, Flame, MailWarning } from 'lucide-react'
import { api, can, useApi, timeAgo } from '../api.js'
import { useApp } from '../ctx.js'
import { Card, Badge, Empty, Seg, StatusBadge, ScorePill, Switch } from '../components/ui.jsx'

const RULE_ICON = { L1: Siren, L2: PhoneOff, L3: CalendarClock, L4: Flame, L5: MailWarning }
const SEV_TONE = { high: 'red', medium: 'amber', low: 'blue' }

export default function Leakage() {
  const { navigate, toast, meta } = useApp()
  const [status, setStatus] = useState('open')
  const { data: flags, reload } = useApi(`/leakage?status=${status}`, ['flag', 'flags_changed', 'reset'])
  const { data: settings, reload: reloadSettings } = useApi('/settings')
  const { data: allOpen } = useApi('/leakage?status=open', ['flag', 'flags_changed', 'reset'])
  const [busy, setBusy] = useState(null)

  const counts = {}
  ;(allOpen || []).forEach((f) => { counts[f.rule] = (counts[f.rule] || 0) + 1 })

  const recover = async (f) => {
    setBusy(f.id)
    try {
      const r = await api(`/leakage/${f.id}/recover`, { method: 'POST' })
      toast({ icon: LifeBuoy, tone: 'green', title: `Recovered ${f.lead_id}`, sub: r.action })
      reload()
      if (r.action?.startsWith('Agent session')) navigate('live', f.lead_id)
    } catch (e) {
      toast({ icon: ShieldAlert, tone: 'red', title: 'Recovery failed', sub: e.message })
    } finally { setBusy(null) }
  }
  const scan = async () => {
    const r = await api('/leakage/scan', { method: 'POST' })
    toast({ icon: RefreshCw, tone: 'cyan', title: 'Leakage scan complete', sub: `${r.created} new flag(s)` })
    reload()
  }
  const toggleAuto = async (v) => {
    await api('/settings', { method: 'PUT', body: { auto_recover: v } })
    reloadSettings()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Lead Leakage Detector</h1>
          <div className="page-sub">A scheduled job (every 10s) finds leads that are silently going cold and proposes — or takes — a recovery action.</div>
        </div>
        <div className="row">
          <span className="row muted" style={{ fontSize: 13 }}>{can('settings:write') ? <Switch checked={settings?.auto_recover} onChange={toggleAuto} /> : <span className="chip">{settings?.auto_recover ? 'On' : 'Off'}</span>} Auto-recover L1/L5</span>
          <button className="btn" onClick={scan}><RefreshCw size={15} /> Scan now</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
        {Object.entries(meta?.leakage_rules || {}).map(([k, r]) => {
          const I = RULE_ICON[k]
          return (
            <div key={k} className={`card kpi tone-${SEV_TONE[r.severity]}`}>
              <div className="kpi-label"><span className="kpi-icon" style={{ background: 'var(--cs)', color: 'var(--c)' }}><I size={14} /></span><span className="mono">{k}</span></div>
              <div className="kpi-value">{counts[k] || 0}</div>
              <div style={{ fontWeight: 600, fontSize: 12.5, marginTop: 6 }}>{r.title}</div>
              <div className="kpi-foot">→ {r.action}</div>
            </div>
          )
        })}
      </div>

      <Card className="mt-16" title="Flags" icon={ShieldAlert} bodyClass="table-wrap"
        actions={<Seg value={status} onChange={setStatus} options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }]} />}>
        <table className="t">
          <thead><tr><th>Severity</th><th>Rule</th><th>Lead</th><th>Lead status</th><th>Score</th><th>Detail</th><th>Raised</th><th /></tr></thead>
          <tbody>
            {(flags || []).map((f) => {
              const I = RULE_ICON[f.rule] || ShieldAlert
              return (
                <tr key={f.id}>
                  <td><Badge tone={SEV_TONE[f.severity]} dot>{f.severity}</Badge></td>
                  <td><div className="row"><I size={14} color="var(--muted)" /><span className="mono">{f.rule}</span><span style={{ fontWeight: 600 }}>{f.title}</span></div></td>
                  <td className="click" style={{ cursor: 'pointer' }} onClick={() => navigate('leads', f.lead_id)}>
                    <div className="who-name">{f.name}</div><div className="who-sub mono">{f.lead_id}</div>
                  </td>
                  <td><StatusBadge status={f.lead_status} /></td>
                  <td><ScorePill score={f.score} temperature={f.temperature} /></td>
                  <td className="muted">{f.detail}</td>
                  <td className="muted">{timeAgo(f.ts)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {f.status === 'open'
                      ? <button className="btn sm success" disabled={busy === f.id} onClick={() => recover(f)}><LifeBuoy size={13} /> {f.action}</button>
                      : <Badge tone="green"><CheckCircle2 size={11} /> Resolved {timeAgo(f.resolved_at)}</Badge>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {flags && !flags.length && <Empty icon={CheckCircle2}>{status === 'open' ? 'No open leakage flags — every lead is moving.' : 'No resolved flags yet.'}</Empty>}
      </Card>
    </>
  )
}
