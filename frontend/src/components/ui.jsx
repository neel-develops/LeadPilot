import React, { useEffect, useState } from 'react'
import { Inbox, X } from 'lucide-react'
import { STATUS, TEMP_TONE } from '../api.js'

export function Card({ title, icon: Icon, sub, actions, children, className = '', bodyClass = 'card-body', style }) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            <div className="card-title">{Icon && <Icon size={16} />}{title}</div>
            {sub && <div className="card-sub" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </div>
  )
}

export function Badge({ tone = 'slate', children, dot }) {
  return <span className={`badge tone-${tone}`}>{dot && <span className="dot" />}{children}</span>
}

export function StatusBadge({ status }) {
  const m = STATUS[status] || { label: status || '—', tone: 'slate' }
  return <Badge tone={m.tone} dot>{m.label}</Badge>
}

export function ScorePill({ score, temperature }) {
  if (score == null) return <span className="dim">—</span>
  const tone = TEMP_TONE[temperature] || 'slate'
  return <span className={`score-pill tone-${tone}`}>{score}</span>
}

export function TempBadge({ t }) {
  if (!t) return null
  return <Badge tone={TEMP_TONE[t] || 'slate'}>{t[0].toUpperCase() + t.slice(1)}</Badge>
}

export function Kpi({ label, value, suffix, foot, icon: Icon, tone = 'cyan', glow }) {
  return (
    <div className={`card kpi tone-${tone}`} style={{ '--glow': glow }}>
      <div className="kpi-label">
        {Icon && <span className="kpi-icon" style={{ background: 'var(--cs)', color: 'var(--c)' }}><Icon size={14} /></span>}
        {label}
      </div>
      <div className="kpi-value">{value ?? '—'}{suffix && <small>{suffix}</small>}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  )
}

export function Empty({ icon: Icon = Inbox, children }) {
  return (
    <div className="empty">
      <Icon size={28} />
      <div>{children}</div>
    </div>
  )
}

export function Modal({ title, sub, onClose, children, footer, width }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <div className="modal-head">
          <div>
            <div style={{ fontSize: 17, fontWeight: 750, letterSpacing: '-0.02em' }}>{title}</div>
            {sub && <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{sub}</div>}
          </div>
          <button className="btn ghost icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ScoreRing({ score = 0, temperature, size = 96 }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(score || 0))
    return () => cancelAnimationFrame(id)
  }, [score])
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  const color = temperature === 'hot' ? 'var(--red)' : temperature === 'warm' ? 'var(--amber)' : '#00BAF2'
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth="8" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div className="ring-val">
        <div className="ring-num">{score ?? '—'}</div>
        <div className="ring-lbl" style={{ color }}>{temperature || 'score'}</div>
      </div>
    </div>
  )
}

export function Factors({ factors = [] }) {
  const max = Math.max(20, ...factors.map((f) => Math.abs(f.points)))
  return (
    <div>
      {factors.map((f, i) => (
        <div className="factor" key={i}>
          <div>
            <div style={{ color: 'var(--text-2)' }}>{f.label}</div>
            <div className="factor-bar">
              <i style={{ width: `${(Math.abs(f.points) / max) * 100}%`, background: f.points >= 0 ? 'var(--green)' : 'var(--red)' }} />
            </div>
          </div>
          <div className={`pts ${f.points >= 0 ? 'pos' : 'neg'}`}>{f.points > 0 ? '+' : ''}{f.points}</div>
        </div>
      ))}
    </div>
  )
}

export function Json({ value }) {
  return <pre className="pre">{JSON.stringify(value, null, 2)}</pre>
}

export function Switch({ checked, onChange }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  )
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export function ChartTip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rt">
      {label != null && <div style={{ fontWeight: 650, marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="row" style={{ gap: 6 }}>
          <i style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill, display: 'inline-block' }} />
          <span className="muted">{p.name}</span>
          <b className="tnum">{p.value}{unit}</b>
        </div>
      ))}
    </div>
  )
}
