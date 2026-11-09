import React from 'react'
import { ArrowRight, Timer, TrendingUp, TriangleAlert, Headset, Filter, ChartColumn, PieChart as PieIcon, Users, Info, Trophy } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { useApi } from '../api.js'
import { Card, ChartTip, Empty } from '../components/ui.jsx'

const AX = { stroke: '#5a6a88', fontSize: 11, tickLine: false, axisLine: false }
const CMP = [
  ['ttfc', Timer, 'cyan', ''],
  ['lead_to_visit', TrendingUp, 'green', '%'],
  ['wasted', TriangleAlert, 'amber', '%'],
  ['human', Headset, 'violet', '%'],
]
const TEMP_COLORS = { hot: '#f2617a', warm: '#f5b544', cold: '#00BAF2', unscored: '#A9B8CE' }

export default function Analytics() {
  const { data } = useApi('/metrics/overview', ['session_end', 'visit', 'reset'], null, 1000)
  if (!data) return <Empty>Loading analytics…</Empty>
  const c = data.comparison
  const maxF = data.funnel[0]?.value || 1
  const temps = Object.entries(data.temperatures).map(([k, v]) => ({ name: k, value: v }))

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Analytics</h1>
          <div className="page-sub">Before vs after on {data.kpis.total_leads} simulated leads — agent arm vs a modelled slow manual callback.</div>
        </div>
        <span className="chip"><Info size={12} />{data.note}</span>
      </div>

      <div className="grid g-4">
        {CMP.map(([k, I, tone, unit]) => (
          <div className={`card cmp tone-${tone}`} key={k}>
            <div className="kpi-label"><span className="kpi-icon" style={{ background: 'var(--cs)', color: 'var(--c)' }}><I size={14} /></span>{c[k].label}</div>
            <div className="cmp-row">
              <div className="cmp-col base"><div className="lbl">Baseline</div><div className="val">{c[k].baseline}{typeof c[k].baseline === 'number' ? unit : ''}</div></div>
              <ArrowRight className="cmp-arrow" size={18} />
              <div className="cmp-col agent" style={{ textAlign: 'right' }}><div className="lbl">With agent</div><div className="val">{c[k].agent}{typeof c[k].agent === 'number' ? unit : ''}</div></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid g-2 mt-16">
        <Card title="Conversion funnel" icon={Filter} sub="Lead → converted merchant">
          {data.funnel.map((f, i) => (
            <div className="funnel-row" key={f.stage}>
              <span className="muted">{f.stage}</span>
              <div><div className="funnel-bar" style={{ width: `${(f.value / maxF) * 100}%`, opacity: 1 - i * 0.1 }} /></div>
              <span className="tnum" style={{ fontWeight: 700 }}>{f.value} <span className="dim" style={{ fontWeight: 500 }}>{i ? `${Math.round((f.value / maxF) * 100)}%` : ''}</span></span>
            </div>
          ))}
        </Card>
        <Card title="Time to first contact" icon={Timer} sub="Distribution across agent-contacted leads">
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={data.ttfc_hist} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,170,210,.07)" vertical={false} />
                <XAxis dataKey="bucket" {...AX} /><YAxis {...AX} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(0, 186, 242,.06)' }} />
                <Bar dataKey="count" name="Leads" fill="#00BAF2" radius={[6, 6, 0, 0]} maxBarSize={46} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid g-main mt-16">
        <Card title="Leads & booked visits · last 10 days" icon={ChartColumn}>
          <div style={{ height: 250 }}>
            <ResponsiveContainer>
              <AreaChart data={data.daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#00BAF2" stopOpacity=".35" /><stop offset="1" stopColor="#00BAF2" stopOpacity="0" /></linearGradient>
                  <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2dd4a0" stopOpacity=".35" /><stop offset="1" stopColor="#2dd4a0" stopOpacity="0" /></linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,170,210,.07)" vertical={false} />
                <XAxis dataKey="day" {...AX} /><YAxis {...AX} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#00BAF2" strokeWidth={2} fill="url(#gl)" />
                <Area type="monotone" dataKey="visits" name="Visits booked" stroke="#2dd4a0" strokeWidth={2} fill="url(#gv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="legend"><span><i style={{ background: '#00BAF2' }} />Leads</span><span><i style={{ background: '#2dd4a0' }} />Visits booked</span></div>
        </Card>
        <Card title="Lead temperature" icon={PieIcon} sub="Score bands: hot ≥70 · warm 45–69 · cold <45">
          <div style={{ height: 210 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={temps} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} stroke="none">
                  {temps.map((t) => <Cell key={t.name} fill={TEMP_COLORS[t.name] || '#A9B8CE'} />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend" style={{ justifyContent: 'center' }}>{temps.map((t) => <span key={t.name}><i style={{ background: TEMP_COLORS[t.name] }} />{t.name} · {t.value}</span>)}</div>
        </Card>
      </div>

      <div className="grid g-2 mt-16">
        <Card title="Lost-deal reasons" icon={TriangleAlert} sub="Grouped automatically from calls and visit outcomes">
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data.lost_reasons} layout="vertical" margin={{ top: 0, right: 16, left: 40, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,170,210,.07)" horizontal={false} />
                <XAxis type="number" {...AX} allowDecimals={false} />
                <YAxis type="category" dataKey="reason" {...AX} width={150} tick={{ fill: '#b4c1d8', fontSize: 11.5 }} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(245,181,68,.06)' }} />
                <Bar dataKey="count" name="Leads" fill="#f5b544" radius={[0, 6, 6, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Source performance" icon={Users} sub="Lead-to-visit rate by intake channel" bodyClass="table-wrap">
          <table className="t">
            <thead><tr><th>Source</th><th>Leads</th><th>Visits</th><th>Lead → visit</th></tr></thead>
            <tbody>
              {data.sources.map((s) => (
                <tr key={s.source}>
                  <td style={{ fontWeight: 600 }}>{s.source}</td><td className="tnum">{s.leads}</td><td className="tnum">{s.visits}</td>
                  <td><div className="row"><div className="progress grow" style={{ maxWidth: 140 }}><i style={{ width: `${s.rate}%` }} /></div><span className="tnum" style={{ fontWeight: 650 }}>{s.rate}%</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="divider" />
          <div className="section-title" style={{ padding: '0 14px' }}>Language mix</div>
          <div className="row wrap" style={{ padding: '0 14px 14px', gap: 8 }}>
            {Object.entries(data.languages).map(([k, v]) => <span className="chip" key={k}>{{ hi: 'Hindi', en: 'English', mr: 'Marathi' }[k] || k} · {v}</span>)}
          </div>
        </Card>
      </div>

      <Card title="Rep performance" icon={Trophy} sub="Completed visits, conversion, wasted visits and travel" className="mt-16" bodyClass="table-wrap">
        <table className="t">
          <thead><tr><th>Rep</th><th>Base</th><th>Visits done</th><th>Converted</th><th>Conversion</th><th>Wasted</th><th>Avg distance</th><th>Upcoming</th><th>Rating</th></tr></thead>
          <tbody>
            {[...data.rep_performance].sort((a, b) => b.conversion - a.conversion).map((r) => (
              <tr key={r.id}>
                <td><div className="who"><div className="avatar sm">{r.name.split(' ').map((p) => p[0]).join('')}</div><span className="who-name">{r.name}</span></div></td>
                <td className="muted">{r.area}</td><td className="tnum">{r.visits}</td><td className="tnum">{r.converted}</td>
                <td><div className="row"><div className="progress" style={{ width: 90 }}><i style={{ width: `${r.conversion}%` }} /></div><span className="tnum">{r.conversion}%</span></div></td>
                <td className="tnum" style={{ color: r.wasted ? 'var(--red)' : 'var(--dim)' }}>{r.wasted}</td>
                <td className="tnum muted">{r.avg_distance} km</td><td className="tnum">{r.upcoming}</td><td className="tnum">★ {r.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}
