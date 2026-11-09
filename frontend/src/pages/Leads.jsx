import React, { useMemo, useState } from 'react'
import { Search, Users, Download } from 'lucide-react'
import { useApi, timeAgo, SOURCE_LABEL, LANG_LABEL, STATUS } from '../api.js'
import { useApp } from '../ctx.js'
import { Card, StatusBadge, ScorePill, Empty, Seg } from '../components/ui.jsx'

const SHOP = { kirana: 'Kirana', restaurant: 'Restaurant', medical: 'Medical', sweets: 'Sweets', tea_stall: 'Tea stall', clothing: 'Clothing', electronics: 'Electronics', salon: 'Salon', hardware: 'Hardware', vegetable: 'Fruit & Veg' }
const GROUPS = {
  all: null,
  active: ['NEW', 'CONSENT_OK', 'CONTACTING', 'QUALIFYING', 'RECOMMENDING', 'BOOKING'],
  booked: ['CONFIRMED'],
  followup: ['FOLLOW_UP', 'REVISIT'],
  handoff: ['HANDOFF'],
  won: ['CONVERTED', 'ACTIVATED'],
  lost: ['CLOSED', 'REJECTED', 'BLOCKED'],
}

export default function Leads({ initialQuery = '' }) {
  const { navigate } = useApp()
  const [q, setQ] = useState(initialQuery)
  const [group, setGroup] = useState('all')
  const [temp, setTemp] = useState('')
  const { data, loading } = useApi('/leads?limit=1000', ['lead_created', 'session_end', 'reset'], null, 800)

  const rows = useMemo(() => {
    let r = data || []
    if (GROUPS[group]) r = r.filter((l) => GROUPS[group].includes(l.status))
    if (temp) r = r.filter((l) => l.temperature === temp)
    if (q) {
      const s = q.toLowerCase()
      r = r.filter((l) => [l.name, l.business_name, l.id, l.area, l.pincode].some((x) => x && String(x).toLowerCase().includes(s)))
    }
    return r
  }, [data, group, temp, q])

  const counts = useMemo(() => {
    const c = {}
    Object.entries(GROUPS).forEach(([k, v]) => { c[k] = v ? (data || []).filter((l) => v.includes(l.status)).length : (data || []).length })
    return c
  }, [data])

  const exportCsv = () => {
    const cols = ['id', 'name', 'business_name', 'source', 'status', 'score', 'temperature', 'shop_type', 'area', 'pincode', 'device', 'lost_reason']
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'leadpilot-crm.csv'
    a.click()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Merchants & CRM</h1>
          <div className="page-sub">Every lead with its profile, score, recommendation and status. Phone numbers are masked; PII minimised.</div>
        </div>
        <button className="btn" onClick={exportCsv}><Download size={15} /> Export CSV</button>
      </div>

      <Card bodyClass="" style={{ overflow: 'hidden' }}>
        <div className="row wrap" style={{ padding: 14, gap: 10, borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--dim)' }} />
            <input className="input" style={{ paddingLeft: 34 }} placeholder="Search name, business, ID, area…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Seg value={group} onChange={setGroup} options={[
            { value: 'all', label: `All ${counts.all ?? ''}` }, { value: 'active', label: `In progress ${counts.active ?? ''}` },
            { value: 'booked', label: `Booked ${counts.booked ?? ''}` }, { value: 'followup', label: `Follow-up ${counts.followup ?? ''}` },
            { value: 'handoff', label: `Handoff ${counts.handoff ?? ''}` }, { value: 'won', label: `Won ${counts.won ?? ''}` }, { value: 'lost', label: `Lost ${counts.lost ?? ''}` },
          ]} />
          <Seg value={temp} onChange={setTemp} options={[{ value: '', label: 'Any' }, { value: 'hot', label: 'Hot' }, { value: 'warm', label: 'Warm' }, { value: 'cold', label: 'Cold' }]} />
          <div className="grow" />
          <span className="muted" style={{ fontSize: 12.5 }}>{rows.length} merchants</span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 290px)', overflowY: 'auto' }}>
          <table className="t">
            <thead><tr><th>Merchant</th><th>Shop</th><th>Area</th><th>Source</th><th>Lang</th><th>Status</th><th>Score</th><th>Recommended</th><th>Reason / note</th><th>Received</th></tr></thead>
            <tbody>
              {rows.slice(0, 400).map((l) => (
                <tr key={l.id} className="click" onClick={() => navigate('leads', l.id)}>
                  <td>
                    <div className="who">
                      <div className="avatar sm">{l.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="who-name row">{l.name}{l.live && <span className="dot live" />}</div>
                        <div className="who-sub ellipsis" style={{ maxWidth: 220 }}><span className="mono">{l.id}</span> · {l.business_name || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{SHOP[l.shop_type] || '—'}</td>
                  <td className="muted">{l.area || '—'}</td>
                  <td className="muted">{SOURCE_LABEL[l.source]}</td>
                  <td className="muted">{LANG_LABEL[l.language]?.slice(0, 2) || '—'}</td>
                  <td><StatusBadge status={l.status} /></td>
                  <td><ScorePill score={l.score} temperature={l.temperature} /></td>
                  <td className="muted ellipsis" style={{ maxWidth: 170 }}>{l.device || '—'}</td>
                  <td className="dim ellipsis" style={{ maxWidth: 180 }}>{l.lost_reason || ''}</td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{timeAgo(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !rows.length && <Empty icon={Users}>No merchants match these filters.</Empty>}
        </div>
      </Card>
    </>
  )
}
