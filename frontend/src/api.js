import { useCallback, useEffect, useRef, useState } from 'react'

// When opened as a standalone file (LeadPilot.html) talk to the local API server directly.
export const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'http://localhost:8000' : ''

// ------------------------------------------------------------------ session (bearer token)
const SESSION_KEY = 'leadpilot.session'
let session = null
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { session = null }
const sessionListeners = new Set()

export function getSession() { return session }
export function setSession(s) {
  session = s
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  else localStorage.removeItem(SESSION_KEY)
  disconnectEvents()
  sessionListeners.forEach((l) => l(s))
}
export function useSession() {
  const [s, set] = useState(session)
  useEffect(() => { sessionListeners.add(set); return () => sessionListeners.delete(set) }, [])
  return s
}
export function can(perm) { return !!session?.user?.permissions?.includes(perm) }
export function audioUrl(id) { return `${API_BASE}/api/voice/audio/${id}` }

export async function api(path, opts = {}) {
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData
  const headers = { ...(isForm ? {} : { 'content-type': 'application/json' }), ...(opts.headers || {}) }
  if (session?.token) headers.authorization = `Bearer ${session.token}`
  const init = { ...opts, headers }
  if (init.body && !isForm && typeof init.body !== 'string') init.body = JSON.stringify(init.body)
  let res
  try {
    res = await fetch(API_BASE + '/api' + path, init)
  } catch {
    throw new Error('Cannot reach the LeadPilot server on port 8000')
  }
  if (res.status === 401 && path !== '/auth/login') {
    setSession(null)
    throw new Error('Session expired — please sign in again')
  }
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      msg = Array.isArray(j.detail) ? j.detail.map((d) => d.msg).join(', ') : j.detail || msg
    } catch {
      /* ignore */
    }
    const e = new Error(msg || 'Request failed')
    e.status = res.status
    throw e
  }
  return res.json()
}

// ------------------------------------------------------------------ server-sent events (singleton)
const EVENT_TYPES = ['action', 'lead', 'lead_created', 'turn', 'session', 'session_start', 'session_end', 'profile',
  'visit', 'handoff', 'flag', 'flags_changed', 'message', 'reset', 'ring']
const listeners = new Set()
const statusListeners = new Set()
let es = null
let status = 'connecting'
let retryTimer = null

function setStatus(s) {
  status = s
  statusListeners.forEach((l) => l(s))
}

function disconnectEvents() {
  if (es) { es.close(); es = null }
  clearTimeout(retryTimer)
}

export function connectEvents() {
  if (es || !session?.token) return
  es = new EventSource(`${API_BASE}/api/events?token=${encodeURIComponent(session.token)}`)
  EVENT_TYPES.forEach((t) =>
    es.addEventListener(t, (e) => {
      let d
      try { d = JSON.parse(e.data) } catch { return }
      listeners.forEach((l) => { try { l(t, d) } catch (err) { console.error(err) } })
    }),
  )
  let opened = false
  es.onopen = () => {
    if (opened) listeners.forEach((l) => { try { l('resync', {}) } catch (err) { console.error(err) } })
    opened = true
    setStatus('live')
  }
  es.onerror = () => {
    setStatus('reconnecting')
    if (es && es.readyState === EventSource.CLOSED) {
      es.close()
      es = null
      retryTimer = setTimeout(() => {
        api('/auth/me').then(() => { connectEvents(); listeners.forEach((l) => l('resync', {})) }).catch(() => {})
      }, 2500)
    }
  }
}

export function onEvent(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useConnection() {
  const [s, set] = useState(status)
  useEffect(() => {
    statusListeners.add(set)
    return () => statusListeners.delete(set)
  }, [])
  return s
}

export function useEvent(fn) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => onEvent((t, d) => ref.current(t, d)), [])
}

/** Fetch `path`; refetch (debounced) when any of `refreshOn` event types arrive and `filter` passes. */
export function useApi(path, refreshOn = [], filter = null, debounce = 400) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const filterRef = useRef(filter)
  filterRef.current = filter
  const pathRef = useRef(path)
  pathRef.current = path

  const load = useCallback(() => {
    if (!pathRef.current) return Promise.resolve()
    const p = pathRef.current
    return api(p)
      .then((d) => { if (pathRef.current === p) { setData(d); setError(null) } })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
  }, [path, load])

  const key = refreshOn.join(',')
  useEffect(() => {
    let t
    const off = onEvent((type, d) => {
      if (type === 'resync') { clearTimeout(t); t = setTimeout(load, 200); return }
      if (!key || !key.split(',').includes(type)) return
      if (filterRef.current && !filterRef.current(type, d)) return
      clearTimeout(t)
      t = setTimeout(load, debounce)
    })
    return () => { off(); clearTimeout(t) }
  }, [key, load, debounce])

  return { data, error, loading, reload: load, setData }
}

// ------------------------------------------------------------------ formatting
export function timeAgo(ts) {
  if (!ts) return '—'
  const s = Date.now() / 1000 - ts
  if (s < 0) return 'in ' + dur(-s)
  if (s < 10) return 'just now'
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function dur(s) {
  if (s == null) return '—'
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
}

export function clock(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function dateTime(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

export const STATUS = {
  NEW: { label: 'New', tone: 'slate' },
  CONSENT_OK: { label: 'Consent OK', tone: 'slate' },
  CONTACTING: { label: 'Contacting', tone: 'cyan' },
  QUALIFYING: { label: 'Qualifying', tone: 'cyan' },
  RECOMMENDING: { label: 'Recommending', tone: 'violet' },
  BOOKING: { label: 'Booking', tone: 'violet' },
  CONFIRMED: { label: 'Visit booked', tone: 'green' },
  FOLLOW_UP: { label: 'Follow-up', tone: 'amber' },
  HANDOFF: { label: 'Human handoff', tone: 'orange' },
  CLOSED: { label: 'Closed', tone: 'slate' },
  BLOCKED: { label: 'Blocked', tone: 'red' },
  CONVERTED: { label: 'Converted', tone: 'green' },
  ACTIVATED: { label: 'Activated', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  REVISIT: { label: 'Revisit', tone: 'amber' },
}

export const TEMP_TONE = { hot: 'red', warm: 'amber', cold: 'blue' }
export const SOURCE_LABEL = { web_form: 'Web form', missed_call: 'Missed call', ad_feed: 'Ad feed' }
export const LANG_LABEL = { hi: 'Hindi', en: 'English', mr: 'Marathi' }
export const CHANNEL_LABEL = { voice: 'Voice call', whatsapp: 'WhatsApp', chat: 'Web chat', sms: 'SMS' }
