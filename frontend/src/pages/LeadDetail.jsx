import React, { useState } from 'react'
import {
  ArrowLeft, Radio, Play, UserRound, Ban, Eye, Lock, Sparkles, Gauge, FileText, CalendarCheck, MessageSquare,
  ScrollText, ShieldCheck, Bot, Info, Store, Send, Headset, ShieldAlert, BadgeCheck,
} from 'lucide-react'
import { api, can, useApi, timeAgo, dateTime, clock, SOURCE_LABEL, LANG_LABEL, CHANNEL_LABEL } from '../api.js'
import { useApp } from '../ctx.js'
import { Card, StatusBadge, ScoreRing, Factors, Empty, Badge, TempBadge, Json } from '../components/ui.jsx'
import { toolMeta, describe } from '../components/ToolIcon.jsx'

const SHOP = { kirana: 'Kirana / Grocery', restaurant: 'Restaurant / Dhaba', medical: 'Medical / Pharmacy', sweets: 'Sweet shop / Bakery', tea_stall: 'Tea stall', clothing: 'Clothing / Garments', electronics: 'Electronics / Mobile', salon: 'Salon / Parlour', hardware: 'Hardware', vegetable: 'Fruit & Vegetable' }
const BAND = { low: 'Under ₹5k / day', medium: '₹5k–20k / day', high: '₹20k–50k / day', very_high: 'Over ₹50k / day' }
const SETUP = { cash_only: 'Cash only', upi_qr: 'UPI QR only', card_machine: 'Has a card machine', competitor_soundbox: 'Competitor soundbox' }

export function Briefing({ b }) {
  if (!b) return null
  return (
    <div className="col" style={{ gap: 10 }}>
      <div style={{ fontWeight: 650 }}>{b.headline}</div>
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="chip">{b.language}</span><span className="chip">{b.current_setup}</span>
        {b.score != null && <span className="chip">Score {b.score}</span>}
        {b.recommendation?.device && <span className="chip accent">{b.recommendation.device} · {b.recommendation.price}</span>}
      </div>
      <div className="grid g-2" style={{ gap: 12 }}>
        <div>
          <div className="section-title">Likely objections</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.6 }}>{(b.likely_objections || []).map((o) => <li key={o}>{o}</li>)}</ul>
        </div>
        <div>
          <div className="section-title">Talking points</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.6 }}>{(b.talking_points || []).map((o) => <li key={o}>{o}</li>)}</ul>
        </div>
      </div>
    </div>
  )
}

export default function LeadDetail({ id }) {
  const { navigate, toast } = useApp()
  const { data, reload } = useApi(`/leads/${id}`, ['action'], (t, d) => d.lead_id === id, 600)
  const [tab, setTab] = useState('overview')
  const [phone, setPhone] = useState(null)
  const [openAct, setOpenAct] = useState(null)

  if (!data) return <Empty>Loading merchant…</Empty>
  const { lead: L, profile: p, recommendation: rec, interactions, visits, actions, consent_log, flags, handoffs, messages, live } = data
  const transcript = interactions?.[0]?.transcript || []

  const rerun = async (mode) => {
    try {
      await api(`/leads/${id}/start`, { method: 'POST', body: { mode, audio: mode !== 'interactive' } })
      navigate('live', id)
    } catch (e) { toast({ icon: Lock, tone: 'red', title: 'Could not start', sub: e.message }) }
  }
  const optout = async () => {
    if (!window.confirm('Record opt-out for this merchant? They will be added to the do-not-call list.')) return
    await api(`/leads/${id}/optout`, { method: 'POST' })
    toast({ icon: Ban, tone: 'slate', title: 'Opt-out recorded', sub: 'Added to DNC; all contact blocked.' })
    reload()
  }
  const reveal = async () => {
    const r = await api(`/leads/${id}/reveal-phone`, { method: 'POST' })
    if (r.revealed) setPhone(r.phone)
    else toast({ icon: Lock, tone: 'red', title: 'Access denied', sub: r.reason })
  }
  const activate = async () => { await api(`/leads/${id}/activate`, { method: 'POST' }); reload() }

  return (
    <>
      <button className="btn ghost sm" style={{ marginBottom: 12 }} onClick={() => navigate('leads')}><ArrowLeft size={14} /> All merchants</button>
      <div className="card lead-hero">
        <div className="avatar lg">{L.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 750, letterSpacing: '-0.02em' }}>{L.name}</span>
            <StatusBadge status={L.status} /><TempBadge t={L.temperature} />
            {live && <Badge tone="green" dot>Agent live</Badge>}
            {L.simulated ? <Badge tone="slate">Simulated history</Badge> : <Badge tone="cyan">Created in demo</Badge>}
          </div>
          <div className="muted row wrap" style={{ marginTop: 5, gap: 8, fontSize: 13 }}>
            <span className="mono">{L.id}</span>·<span>{L.business_name || '—'}</span>·
            <span className="mono">{phone || L.phone_masked}</span>
            {!phone && <button className="btn xs ghost" onClick={reveal} title={can('pii:reveal') ? 'Reveal (audited)' : 'Admin only'}>{can('pii:reveal') ? <Eye size={12} /> : <Lock size={12} />} Reveal</button>}
            ·<span>{SOURCE_LABEL[L.source]}</span>·<span>{LANG_LABEL[L.language]}</span>·<span>Received {timeAgo(L.created_at)}</span>
          </div>
        </div>
        <div className="row wrap">
          <button className="btn sm" onClick={() => navigate('live', id)}><Radio size={14} /> Conversation</button>
          {!L.opted_out && <button className="btn sm success" onClick={() => rerun('voice')}><Radio size={13} /> AI calls me</button>}
          {!L.opted_out && can('sim:run') && <button className="btn sm" onClick={() => rerun('auto')}><Play size={13} /> Simulated run</button>}
          {!L.opted_out && <button className="btn sm" onClick={() => rerun('interactive')}><UserRound size={13} /> Text chat</button>}
          {L.status === 'CONVERTED' && can('visits:outcome') && <button className="btn sm success" onClick={activate}><BadgeCheck size={13} /> Mark activated</button>}
          {!L.opted_out && can('leads:optout') && <button className="btn sm danger" onClick={optout}><Ban size={13} /> Opt-out</button>}
        </div>
      </div>

      <div className="tabs mt-16">
        {[['overview', 'Overview', Sparkles], ['conversation', 'Conversation', MessageSquare], ...(can('audit:read') ? [['timeline', `Timeline · ${actions.length}`, ScrollText]] : []), ['compliance', 'Consent & messages', ShieldCheck]].map(([k, l, I]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}><I size={14} />{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid g-main">
          <div className="col" style={{ gap: 16 }}>
            <Card title="CRM summary" icon={FileText} sub={`Sentiment: ${L.sentiment || '—'}`}>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-2)' }}>{L.summary || 'No summary yet — the agent writes one at the end of each conversation.'}</div>
              {L.lost_reason && <div className="banner tone-amber mt-12"><Info size={15} /> Reason: {L.lost_reason}</div>}
              {flags.filter((f) => f.status === 'open').map((f) => <div key={f.id} className="banner tone-red mt-8"><ShieldAlert size={15} />Leakage flag {f.rule}: {f.title} — {f.detail}</div>)}
              {handoffs.map((h) => <div key={h.id} className="banner tone-orange mt-8"><Headset size={15} />Handoff ({h.status}): {h.reason}</div>)}
            </Card>
            <Card title="Merchant profile" icon={Store}>
              <dl className="kv">
                <dt>Shop type</dt><dd>{SHOP[p.shop_type] || '—'}</dd>
                <dt>Daily sales</dt><dd>{BAND[p.daily_sales_band] || '—'}{p.daily_sales_value ? <span className="muted"> · ₹{Number(p.daily_sales_value).toLocaleString('en-IN')}</span> : ''}</dd>
                <dt>Payment setup</dt><dd>{SETUP[p.current_setup] || '—'}</dd>
                <dt>Location</dt><dd>{p.area ? `${p.area} · ${p.pincode}` : '—'}</dd>
                <dt>Outlets</dt><dd>{p.outlets || 1}</dd>
                <dt>Signals</dt><dd className="row wrap" style={{ gap: 6 }}>{p.asked_price ? <span className="chip">Asked price</span> : null}{p.hesitation ? <span className="chip">Hesitant</span> : null}{!p.asked_price && !p.hesitation && <span className="dim">—</span>}</dd>
                <dt>Attempts</dt><dd>{L.attempts} · first contact {L.first_contact_at ? `${(L.first_contact_at - L.created_at).toFixed(1)}s after lead` : '—'}</dd>
              </dl>
            </Card>
            <Card title="Visits & rep briefing" icon={CalendarCheck}>
              {visits.length ? visits.map((v) => (
                <div key={v.id} className="col" style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  <div className="row between">
                    <div className="row"><span className="mono">{v.id}</span><span style={{ fontWeight: 650 }}>{v.rep_name}</span><span className="muted">· {v.slot_label} · {v.distance_km ?? '—'} km</span></div>
                    <div className="row">{v.outcome ? <Badge tone={v.outcome === 'converted' ? 'green' : v.outcome === 'rejected' ? 'red' : 'amber'}>{v.outcome}{v.outcome_reason ? ` · ${v.outcome_reason}` : ''}</Badge> : <Badge tone={v.status === 'RESCHEDULED' ? 'slate' : 'violet'}>{v.status}</Badge>}{v.wasted ? <Badge tone="red">Wasted visit</Badge> : null}</div>
                  </div>
                  {v.status !== 'RESCHEDULED' && <Briefing b={v.briefing} />}
                </div>
              )) : <Empty icon={CalendarCheck}>No visit booked.</Empty>}
            </Card>
          </div>
          <div className="col" style={{ gap: 16 }}>
            <Card title="Lead score" icon={Gauge} sub="Each factor stored for explainability">
              {L.score != null ? (
                <div className="col" style={{ alignItems: 'center' }}>
                  <ScoreRing score={L.score} temperature={L.temperature} size={110} />
                  <div style={{ width: '100%' }}><Factors factors={L.score_factors || []} /></div>
                </div>
              ) : <Empty>Not scored yet.</Empty>}
            </Card>
            <Card title="Recommendation" icon={Sparkles} sub="Lookup on shop type × sales band × setup">
              {rec ? (
                <div className="rec-card" style={{ animation: 'none' }}>
                  <div className="row between"><span className="rec-device">{rec.device}</span><span className="rec-price">{rec.price}</span></div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{rec.plan} plan · {rec.reason}</div>
                  <div className="row wrap mt-12" style={{ gap: 5 }}>{(rec.rule_ids || []).map((r) => <span className="rule-chip" key={r}>{r}</span>)}</div>
                </div>
              ) : <Empty>No recommendation yet.</Empty>}
            </Card>
          </div>
        </div>
      )}

      {tab === 'conversation' && (
        <Card title={`Transcript · ${CHANNEL_LABEL[interactions?.[0]?.channel] || 'Voice call'}`} icon={MessageSquare} sub={interactions?.[0] ? `Started ${dateTime(interactions[0].started_at)} · outcome ${interactions[0].outcome || '—'}` : ''}>
          {transcript.length ? (
            <div className="transcript" style={{ padding: 0 }}>
              {transcript.map((t) => t.speaker === 'system' ? <div className="sys-row" key={t.i}><Info size={12} />{t.text}</div> : (
                <div className={`bubble-row ${t.speaker}`} key={t.i}>
                  <div className={`speaker ${t.speaker}`}>{t.speaker === 'agent' ? <Bot size={16} /> : <UserRound size={16} />}</div>
                  <div className="bubble">{t.text}{t.en && t.en !== t.text && <div className="tr"><b>EN</b>{t.en}</div>}</div>
                </div>
              ))}
            </div>
          ) : <Empty icon={MessageSquare}>No conversation recorded.</Empty>}
        </Card>
      )}

      {tab === 'timeline' && (
        <Card title="Agent timeline" icon={ScrollText} sub="Every tool call with inputs, outputs and timing — click to expand">
          <div className="timeline">
            {actions.map((a) => {
              const m = toolMeta(a.tool)
              return (
                <div key={a.id} className={`tl-item tone-${a.status === 'blocked' ? 'red' : m.tone}`}>
                  <div className="row between json-toggle" onClick={() => setOpenAct(openAct === a.id ? null : a.id)}>
                    <div className="row"><m.icon size={13} color="var(--c)" /><span className="tool-name">{a.tool}</span><span className="muted" style={{ fontSize: 12.5 }}>{describe(a)}</span></div>
                    <span className="dim" style={{ fontSize: 11.5 }}>{a.actor} · {dateTime(a.ts)}</span>
                  </div>
                  {openAct === a.id && <div className="grid g-2 mt-8" style={{ gap: 10 }}><div><div className="section-title">Input</div><Json value={a.input} /></div><div><div className="section-title">Output</div><Json value={a.output} /></div></div>}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {tab === 'compliance' && (
        <div className="grid g-2">
          <Card title="Consent log" icon={ShieldCheck} sub="Immutable consent & opt-out events">
            <div className="feed">
              {consent_log.map((c) => (
                <div className="feed-item" key={c.id}>
                  <div className={`feed-icon tone-${c.event.includes('block') || c.event.includes('opt') || c.event.includes('missing') ? 'red' : 'green'}`}><ShieldCheck size={13} /></div>
                  <div className="feed-main"><div className="feed-title mono">{c.event}</div><div className="feed-meta">{c.detail} · {dateTime(c.ts)}</div></div>
                </div>
              ))}
              {!consent_log.length && <Empty>No consent events.</Empty>}
            </div>
          </Card>
          <Card title="Messages" icon={Send} sub="Approved templates only">
            <div className="feed">
              {messages.map((m) => (
                <div className="feed-item" key={m.id}>
                  <div className={`feed-icon tone-${m.direction === 'in' ? 'green' : 'blue'}`}><Send size={13} /></div>
                  <div className="feed-main">
                    <div className="row between"><span className="feed-title">{m.template_id || 'Inbound reply'} <span className="dim">· {m.channel} → {m.recipient}</span></span><span className="feed-meta">{clock(m.ts)}</span></div>
                    <div className="muted" style={{ marginTop: 3 }}>{m.body}</div>
                  </div>
                </div>
              ))}
              {!messages.length && <Empty>No messages sent.</Empty>}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
