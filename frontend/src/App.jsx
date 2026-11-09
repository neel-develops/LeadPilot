import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  House, Radio, List, MapPinned, ChartLine, ShieldAlert, ScrollText, Settings, Plus, Search, Bell, ChevronDown,
  CalendarCheck, Headset, Siren, UserPlus, PhoneMissed, Ban, CheckCircle2, Expand, ShieldCheck, LogOut, Sun, Lock,
} from 'lucide-react'
import { api, can, connectEvents, setSession, useApi, useConnection, useEvent, useSession, timeAgo } from './api.js'
import { Ctx } from './ctx.js'
import { endCall } from './voice.js'
import NewLeadModal from './components/NewLeadModal.jsx'
import IncomingCall from './components/IncomingCall.jsx'
import CommandCenter from './pages/CommandCenter.jsx'
import LiveAgent from './pages/LiveAgent.jsx'
import Leads from './pages/Leads.jsx'
import LeadDetail from './pages/LeadDetail.jsx'
import FieldOps from './pages/FieldOps.jsx'
import Analytics from './pages/Analytics.jsx'
import Leakage from './pages/Leakage.jsx'
import Audit from './pages/Audit.jsx'
import Compliance from './pages/Compliance.jsx'
import MyDay from './pages/MyDay.jsx'
import Login, { Logo } from './pages/Login.jsx'

// page -> permission needed (null = any signed-in user)
const NAV = [
  { key: 'command', label: 'Overview', icon: House, perm: 'metrics:read' },
  { key: 'myday', label: 'My Day', icon: Sun, role: 'rep' },
  { key: 'live', label: 'Live Agent', icon: Radio, badge: 'live', perm: 'agent:control' },
  { key: 'leads', label: 'Merchants & CRM', icon: List, perm: null },
  { key: 'field', label: 'Field Operations', icon: MapPinned, perm: 'visits:read_all' },
  { key: 'analytics', label: 'Analytics', icon: ChartLine, perm: 'metrics:read' },
  { key: 'leakage', label: 'Lead Leakage', icon: ShieldAlert, badge: 'flags', perm: 'leakage:read' },
  { key: 'audit', label: 'Audit Log', icon: ScrollText, perm: 'audit:read' },
  { key: 'compliance', label: 'Compliance & Rules', icon: Settings, perm: 'settings:read' },
]

const TITLES = {
  command: 'Overview', myday: 'My Day', live: 'Live Agent', leads: 'Merchants', field: 'Field Operations',
  leakage: 'Lead Leakage', analytics: 'Analytics', audit: 'Audit Log', compliance: 'Compliance',
}

const ROLE_LABEL = { rep: 'Field rep', manager: 'Sales manager', admin: 'Admin' }

function allowed(n, user) {
  if (!user) return false
  if (n.role) return user.role === n.role
  return !n.perm || user.permissions.includes(n.perm)
}

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path, query] = raw.split('?')
  const [page, id] = path.split('/')
  const q = new URLSearchParams(query || '').get('q') || ''
  return { page: TITLES[page] ? page : '', id: id || null, q }
}

function useOutside(ref, on, close) {
  useEffect(() => {
    if (!on) return
    const h = (e) => ref.current && !ref.current.contains(e.target) && close()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [on, close, ref])
}

export default function App() {
  const session = useSession()
  if (!session) return <Login />
  return <Shell key={session.token} user={session.user} />
}

function Shell({ user }) {
  const [route, setRoute] = useState(parseHash)
  const [newLead, setNewLead] = useState(false)
  const [toasts, setToasts] = useState([])
  const [search, setSearch] = useState('')
  const [bellOpen, setBellOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const bellRef = useRef(null)
  const userRef = useRef(null)
  const conn = useConnection()
  const staff = user.role !== 'rep'
  const { data: meta } = useApi('/meta')
  const { data: ov } = useApi(staff ? '/metrics/overview' : null, ['session_start', 'session_end', 'flags_changed', 'flag', 'reset'], null, 800)
  const { data: flags } = useApi(staff ? '/leakage' : null, ['flag', 'flags_changed', 'reset'])
  const { data: handoffs } = useApi(staff ? '/handoffs?status=open' : null, ['handoff', 'reset'])
  const closeBell = useCallback(() => setBellOpen(false), [])
  const closeUser = useCallback(() => setUserOpen(false), [])
  useOutside(bellRef, bellOpen, closeBell)
  useOutside(userRef, userOpen, closeUser)

  useEffect(() => {
    connectEvents()
    const h = () => setRoute(parseHash())
    window.addEventListener('hashchange', h)
    // heartbeat: re-validates the session and revives the live stream after a server restart
    const beat = setInterval(() => { api('/auth/me').then(() => connectEvents()).catch(() => {}) }, 20000)
    return () => { window.removeEventListener('hashchange', h); clearInterval(beat) }
  }, [])

  const navigate = useCallback((page, id, q) => {
    window.location.hash = `/${page}${id ? '/' + id : ''}${q ? '?q=' + encodeURIComponent(q) : ''}`
  }, [])

  const toast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((x) => [...x.slice(-3), { id, ...t }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.ttl || 4800)
  }, [])

  useEvent((type, d) => {
    if (type === 'lead_created') toast({ icon: UserPlus, tone: 'blue', title: `New lead · ${d.name}`, sub: `${d.id} via ${d.source.replace('_', ' ')} — agent calling now` })
    if (type === 'visit' && d.kind === 'booked' && d.actor === 'agent') toast({ icon: CalendarCheck, tone: 'green', title: 'Visit booked', sub: `${d.lead_id} · ${d.visit_id} added to rep calendar` })
    if (type === 'handoff' && d.reason) toast({ icon: Headset, tone: 'orange', title: 'Handed off to a human', sub: `${d.lead_id} · ${d.reason}` })
    if (type === 'flag') toast({ icon: Siren, tone: d.severity === 'high' ? 'red' : 'amber', title: `Leakage: ${d.title}`, sub: d.lead_id })
    if (type === 'session_end' && d.outcome === 'opted_out') toast({ icon: Ban, tone: 'slate', title: 'Opt-out recorded', sub: `${d.lead_id} added to DNC instantly` })
    if (type === 'session_end' && d.outcome === 'no_answer_cap') toast({ icon: PhoneMissed, tone: 'amber', title: 'Attempt cap reached', sub: `${d.lead_id} marked at-risk` })
    if (type === 'reset') toast({ icon: CheckCircle2, tone: 'green', title: 'Demo data reset' })
  })

  const ctx = useMemo(() => ({ navigate, user, role: user.role, openNewLead: () => setNewLead(true), toast, meta, route }), [navigate, user, toast, meta, route])

  const nav = NAV.filter((n) => allowed(n, user))
  const home = user.role === 'rep' ? 'myday' : 'command'
  const page = route.page || home
  const pageNav = NAV.find((n) => n.key === page)
  const permitted = pageNav ? allowed(pageNav, user) : false

  const k = ov?.kpis || {}
  const alerts = [
    ...(flags || []).slice(0, 5).map((f) => ({ key: 'f' + f.id, icon: ShieldAlert, tone: f.severity === 'high' ? 'red' : 'amber', title: f.title, sub: `${f.lead_id} · ${f.name}`, ts: f.ts, go: () => navigate('leakage') })),
    ...(handoffs || []).slice(0, 3).map((h) => ({ key: 'h' + h.id, icon: Headset, tone: 'orange', title: `Handoff · ${h.reason}`, sub: `${h.lead_id} · ${h.name}`, ts: h.ts, go: () => navigate('leads', h.lead_id) })),
  ].sort((a, b) => b.ts - a.ts)

  let content
  if (!permitted) {
    content = (
      <div className="empty" style={{ paddingTop: 120 }}>
        <Lock size={34} />
        <div style={{ fontSize: 16, color: 'var(--text)', marginTop: 6 }}>{ROLE_LABEL[user.role]}s can't open {TITLES[page] || 'this page'}</div>
        <div className="mt-8">Access is enforced on the server too.</div>
        <button className="btn primary mt-16" onClick={() => navigate(home)}>Go to {TITLES[home]}</button>
      </div>
    )
  } else if (page === 'command') content = <CommandCenter />
  else if (page === 'myday') content = <MyDay />
  else if (page === 'live') content = <LiveAgent leadId={route.id} />
  else if (page === 'leads') content = route.id ? <LeadDetail id={route.id} key={route.id} /> : <Leads initialQuery={route.q} key={route.q} />
  else if (page === 'field') content = <FieldOps />
  else if (page === 'analytics') content = <Analytics />
  else if (page === 'leakage') content = <Leakage />
  else if (page === 'audit') content = <Audit />
  else if (page === 'compliance') content = <Compliance />

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }
  const signOut = async () => {
    await endCall()
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.hash = ''
    setSession(null)
  }
  const initials = user.name.split(' ').map((p) => p[0]).join('').slice(0, 2)

  return (
    <Ctx.Provider value={ctx}>
      <div className="frame-outer">
        <div className="app">
          <div className="rail-wrap">
            <nav className="rail">
              <div className="rail-logo" title="LeadPilot"><Logo size={30} /></div>
              {nav.map((n) => (
                <button key={n.key} className={`rail-btn ${page === n.key ? 'active' : ''}`} onClick={() => navigate(n.key)} aria-label={n.label}>
                  <n.icon size={19} strokeWidth={1.8} />
                  {n.badge === 'live' && k.active_sessions > 0 && <span className="pip live" />}
                  {n.badge === 'flags' && k.open_flags > 0 && <span className="pip" />}
                  <span className="rail-tip">{n.label}{n.badge === 'live' && k.active_sessions ? ` · ${k.active_sessions} live` : ''}{n.badge === 'flags' && k.open_flags ? ` · ${k.open_flags}` : ''}</span>
                </button>
              ))}
              <div className="rail-spacer" />
              {can('leads:create') && <button className="rail-btn" onClick={() => setNewLead(true)} aria-label="New lead"><Plus size={20} strokeWidth={1.8} /><span className="rail-tip">New lead · AI calls you</span></button>}
              <button className="rail-btn" onClick={fullscreen} aria-label="Present"><Expand size={18} strokeWidth={1.8} /><span className="rail-tip">Present (full screen)</span></button>
              <button className="rail-btn" onClick={signOut} aria-label="Sign out"><LogOut size={18} strokeWidth={1.8} /><span className="rail-tip">Sign out</span></button>
            </nav>
          </div>

          <main className="main">
            <div className="topbar">
              <div className="topbar-title">{TITLES[page]}</div>
              {route.id && <div className="topbar-crumb mono dim">/ {route.id}</div>}
              <div className="grow" />
              <form className="search-pill" onSubmit={(e) => { e.preventDefault(); if (search.trim()) navigate('leads', null, search.trim()) }}>
                <Search size={17} />
                <input placeholder="Search merchants" value={search} onChange={(e) => setSearch(e.target.value)} />
                <span className={`dot ${conn === 'live' ? 'live' : 'warn'}`} title={conn === 'live' ? 'Live stream connected' : 'Reconnecting…'} />
              </form>
              <div className="user-chip" ref={userRef} onClick={() => setUserOpen((v) => !v)}>
                <div className="user-ava">{initials}</div>
                <div>
                  <div className="user-name">{user.name}</div>
                  <div className="user-mail">{user.title}</div>
                </div>
                <ChevronDown size={16} color="var(--muted)" />
                {userOpen && (
                  <div className="dropdown" style={{ width: 300 }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ padding: '6px 10px 4px' }}>
                      <div style={{ fontWeight: 600 }}>{user.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{user.email}</div>
                    </div>
                    <div className="row" style={{ padding: '4px 10px 8px', gap: 6 }}>
                      <span className="badge tone-cyan"><ShieldCheck size={11} /> {ROLE_LABEL[user.role]}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{user.permissions.length} permissions</span>
                    </div>
                    <div className="perm-list">{user.permissions.map((p) => <span key={p}>{p}</span>)}</div>
                    <div className="divider" style={{ margin: '8px 8px' }} />
                    <div className="dd-item" onClick={signOut}><LogOut size={16} color="var(--red)" /><div>Sign out · switch role</div></div>
                  </div>
                )}
              </div>
              {staff && (
                <div className="bell" ref={bellRef} onClick={() => setBellOpen((v) => !v)}>
                  <Bell size={18} />
                  {alerts.length > 0 && <span className="pip" />}
                  {bellOpen && (
                    <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                      <div className="row between" style={{ padding: '6px 8px 8px' }}>
                        <span style={{ fontWeight: 500 }}>Alerts</span>
                        <span className="muted" style={{ fontSize: 12 }}>{k.open_flags ?? 0} leakage · {k.handoffs_open ?? 0} handoffs</span>
                      </div>
                      {alerts.slice(0, 7).map((a) => (
                        <div key={a.key} className="dd-item" onClick={() => { a.go(); setBellOpen(false) }}>
                          <div className={`feed-icon tone-${a.tone}`}><a.icon size={14} /></div>
                          <div className="grow" style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }} className="ellipsis">{a.title}</div>
                            <div className="muted ellipsis" style={{ fontSize: 12 }}>{a.sub} · {timeAgo(a.ts)}</div>
                          </div>
                        </div>
                      ))}
                      {!alerts.length && <div className="empty">All clear.</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="content" key={page}>{content}</div>
          </main>
        </div>
      </div>

      {newLead && <NewLeadModal onClose={() => setNewLead(false)} onCreated={(id, mode) => { setNewLead(false); navigate('live', id) }} />}
      <IncomingCall />

      <div className="toasts">
        {toasts.map((t) => (
          <div className={`toast tone-${t.tone || 'blue'}`} key={t.id}>
            <div className="feed-icon"><t.icon size={15} /></div>
            <div className="grow">
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
              {t.sub && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
