import React, { useEffect, useState } from 'react'
import { ShieldCheck, Briefcase, Bike, Loader2, LogIn, Lock, Mail, Info } from 'lucide-react'
import { api, setSession } from '../api.js'

const DEMO = [
  { email: 'manager@leadpilot.in', password: 'manager123', role: 'Sales manager', name: 'Meera Iyer', icon: Briefcase, desc: 'Full funnel, agents, leakage, analytics. PII masked.' },
  { email: 'admin@leadpilot.in', password: 'admin123', role: 'Admin', name: 'Arjun Mehta', icon: ShieldCheck, desc: 'Everything + compliance settings, PII reveal, data reset.' },
]

export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M3 6 L15 16 L3 26 Z" fill="#00BAF2" />
      <path d="M29 6 L17 16 L29 26 Z" fill="#ffffff" />
    </svg>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)
  const [reps, setReps] = useState([])
  const [rep, setRep] = useState('rahul.patil@leadpilot.in')

  useEffect(() => {
    api('/auth/directory').then((d) => setReps(d.filter((u) => u.role === 'rep'))).catch((e) => setErr(e.message))
  }, [])

  const signIn = async (em, pw, key) => {
    setBusy(key)
    setErr(null)
    try {
      const res = await api('/auth/login', { method: 'POST', body: { email: em, password: pw } })
      window.location.hash = res.user.role === 'rep' ? '/myday' : '/command'
      setSession(res)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="frame-outer">
      <div className="login-shell">
        <div className="login-hero">
          <div className="row" style={{ gap: 12 }}>
            <Logo size={38} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Lead<span style={{ color: 'var(--paytm-cyan)' }}>Pilot</span></div>
              <div className="muted" style={{ fontSize: 13 }}>Autonomous lead-to-visit sales agent</div>
            </div>
          </div>
          <h1 className="login-title">Every merchant lead,<br /><span>called in seconds.</span></h1>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 460 }}>
            The AI agent calls new merchants in Hindi or English, qualifies them, recommends the right Paytm device,
            books the best field rep and watches for leads going cold.
          </p>
          <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
            <span className="chip accent">Sarvam AI voice</span><span className="chip">OpenStreetMap</span>
            <span className="chip">Role-based access</span><span className="chip">Full audit trail</span>
          </div>
          <div className="login-foot">Paytm Builder's Hackathon · Pune · Track 3 · All Paytm systems and data are simulated.</div>
        </div>

        <div className="login-card">
          <div style={{ fontSize: 20, fontWeight: 500 }}>Sign in</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Pick a demo account or use your credentials.</div>

          <div className="col mt-16" style={{ gap: 10 }}>
            {DEMO.map((d) => (
              <button key={d.email} className="login-role" onClick={() => signIn(d.email, d.password, d.email)} disabled={!!busy}>
                <span className="login-ico"><d.icon size={18} /></span>
                <span className="grow" style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{d.role} · {d.name}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>{d.desc}</span>
                </span>
                {busy === d.email ? <Loader2 size={16} className="spin" /> : <LogIn size={16} color="var(--muted)" />}
              </button>
            ))}
            <div className="login-role" style={{ cursor: 'default' }}>
              <span className="login-ico"><Bike size={18} /></span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>Field rep</span>
                <select className="select" style={{ height: 32, marginTop: 6 }} value={rep} onChange={(e) => setRep(e.target.value)}>
                  {reps.map((r) => <option key={r.email} value={r.email}>{r.name} · {r.rep_id}</option>)}
                </select>
              </span>
              <button className="btn sm primary" onClick={() => signIn(rep, 'rep123', 'rep')} disabled={!!busy}>
                {busy === 'rep' ? <Loader2 size={14} className="spin" /> : <LogIn size={14} />} Enter
              </button>
            </div>
          </div>

          <div className="divider" />
          <form className="col" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); signIn(email, password, 'form') }}>
            <div className="field"><label>Email</label>
              <div style={{ position: 'relative' }}><Mail size={15} className="in-ico" /><input className="input" style={{ paddingLeft: 36 }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@leadpilot.in" /></div>
            </div>
            <div className="field"><label>Password</label>
              <div style={{ position: 'relative' }}><Lock size={15} className="in-ico" /><input className="input" style={{ paddingLeft: 36 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
            </div>
            <button className="btn primary" disabled={!email || !password || !!busy}>{busy === 'form' ? <Loader2 size={15} className="spin" /> : <LogIn size={15} />} Sign in</button>
          </form>
          {err && <div className="banner tone-red mt-12"><Info size={15} />{err}</div>}
          <div className="dim mt-12" style={{ fontSize: 11.5 }}>Demo passwords: manager123 · admin123 · rep123 (reps sign in as firstname.lastname@leadpilot.in)</div>
        </div>
      </div>
    </div>
  )
}
