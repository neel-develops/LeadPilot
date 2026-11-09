import React, { useEffect, useState } from 'react'
import { ScrollText, Search, Pause, Play, ChevronRight } from 'lucide-react'
import { useApi, useEvent, dateTime } from '../api.js'
import { useApp } from '../ctx.js'
import { Card, Badge, Empty, Json } from '../components/ui.jsx'
import { toolMeta, describe } from '../components/ToolIcon.jsx'

export default function Audit() {
  const { navigate } = useApp()
  const [lead, setLead] = useState('')
  const [tool, setTool] = useState('')
  const [actor, setActor] = useState('')
  const [paused, setPaused] = useState(false)
  const [open, setOpen] = useState(null)
  const qs = new URLSearchParams({ limit: '300', ...(lead && { lead_id: lead.trim().toUpperCase() }), ...(tool && { tool }), ...(actor && { actor }) }).toString()
  const { data } = useApi(`/audit?${qs}`)
  const { data: tools } = useApi('/audit/tools')
  const [rows, setRows] = useState([])

  useEffect(() => { if (data) setRows(data) }, [data])
  useEvent((t, d) => {
    if (t !== 'action' || paused) return
    if (lead && d.lead_id !== lead.trim().toUpperCase()) return
    if (tool && d.tool !== tool) return
    if (actor && d.actor !== actor) return
    setRows((r) => [{ ...d, _new: true }, ...r].slice(0, 500))
  })

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <div className="page-sub">Every agent action and tool call with inputs, outputs, actor and timing. Reproducible, filterable, streamed live.</div>
        </div>
        <button className="btn" onClick={() => setPaused(!paused)}>{paused ? <><Play size={14} /> Resume stream</> : <><Pause size={14} /> Pause stream</>}</button>
      </div>
      <Card bodyClass="">
        <div className="row wrap" style={{ padding: 14, gap: 10, borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--dim)' }} />
            <input className="input mono" style={{ paddingLeft: 34 }} placeholder="Lead ID e.g. LD-1201" value={lead} onChange={(e) => setLead(e.target.value)} />
          </div>
          <select className="select" style={{ width: 220 }} value={tool} onChange={(e) => setTool(e.target.value)}>
            <option value="">All tools</option>
            {(tools || []).map((t) => <option key={t.tool} value={t.tool}>{t.tool} ({t.n})</option>)}
          </select>
          <select className="select" style={{ width: 200 }} value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">All actors</option>
            {['agent', 'orchestrator', 'ingestion', 'leakage_detector', 'operator', 'rep', 'manager', 'admin'].map((a) => <option key={a}>{a}</option>)}
          </select>
          <div className="grow" />
          <span className="row muted" style={{ fontSize: 12.5 }}><span className={`dot ${paused ? 'warn' : 'live'}`} />{rows.length} entries</span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 270px)', overflowY: 'auto' }}>
          <table className="t">
            <thead><tr><th style={{ width: 30 }} /><th>Time</th><th>Lead</th><th>Tool</th><th>Summary</th><th>Actor</th><th>Status</th><th>Duration</th></tr></thead>
            <tbody>
              {rows.map((a, i) => {
                const m = toolMeta(a.tool)
                const k = (a.id || 'n' + i) + a.tool + a.ts
                return (
                  <React.Fragment key={k}>
                    <tr className={`click ${a._new ? 'flash' : ''}`} onClick={() => setOpen(open === k ? null : k)}>
                      <td><ChevronRight size={14} color="var(--dim)" style={{ transform: open === k ? 'rotate(90deg)' : 'none', transition: '.15s' }} /></td>
                      <td className="mono muted" style={{ whiteSpace: 'nowrap' }}>{dateTime(a.ts)}</td>
                      <td>{a.lead_id ? <a className="mono" onClick={(e) => { e.stopPropagation(); navigate('leads', a.lead_id) }} style={{ cursor: 'pointer' }}>{a.lead_id}</a> : <span className="dim">system</span>}</td>
                      <td><div className="row"><span className={`feed-icon tone-${m.tone}`} style={{ width: 24, height: 24 }}><m.icon size={12} /></span><span className="tool-name">{a.tool}</span></div></td>
                      <td className="muted ellipsis" style={{ maxWidth: 380 }}>{describe(a)}</td>
                      <td className="muted">{a.actor}</td>
                      <td><Badge tone={a.status === 'ok' ? 'green' : a.status === 'blocked' ? 'red' : 'amber'}>{a.status}</Badge></td>
                      <td className="mono dim">{a.duration_ms != null ? `${a.duration_ms} ms` : '—'}</td>
                    </tr>
                    {open === k && (
                      <tr><td colSpan={8} style={{ background: 'var(--bg-2)' }}>
                        <div className="grid g-2" style={{ gap: 12 }}>
                          <div><div className="section-title">Input</div><Json value={a.input} /></div>
                          <div><div className="section-title">Output</div><Json value={a.output} /></div>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
          {!rows.length && <Empty icon={ScrollText}>No actions match these filters.</Empty>}
        </div>
      </Card>
    </>
  )
}
