import React, { useEffect, useState } from 'react'
import { Phone, PhoneOff, Bot } from 'lucide-react'
import { api, useEvent, getSession } from '../api.js'
import { useApp } from '../ctx.js'
import { startCall, startRing, stopRing } from '../voice.js'
import { Logo } from '../pages/Login.jsx'

/** Full-screen incoming call: the agent rings the person who created the lead. */
export default function IncomingCall() {
  const { navigate, toast } = useApp()
  const [call, setCall] = useState(null)
  const [secs, setSecs] = useState(0)

  useEvent((t, d) => {
    if (t === 'ring') {
      const me = getSession()?.user?.id
      if (d.created_by && d.created_by !== me) return
      setCall(d)
      setSecs(0)
      startRing()
    }
    if (t === 'session' && call && d.lead_id === call.lead_id && d.activity !== 'ringing') close()
  })

  useEffect(() => {
    if (!call) return
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [call])

  const close = () => { stopRing(); setCall(null) }

  const answer = async () => {
    const c = call
    close()
    await startCall(c.lead_id)
    try {
      await api(`/voice/${c.lead_id}/answer`, { method: 'POST', body: { answer: true } })
      navigate('live', c.lead_id)
    } catch (e) {
      toast({ icon: PhoneOff, tone: 'red', title: 'Call could not connect', sub: e.message })
    }
  }
  const decline = async () => {
    const c = call
    close()
    await api(`/voice/${c.lead_id}/answer`, { method: 'POST', body: { answer: false } }).catch(() => {})
  }

  if (!call) return null
  return (
    <div className="overlay" style={{ zIndex: 80 }}>
      <div className="incoming">
        <div className="row" style={{ gap: 8, justifyContent: 'center', opacity: 0.85 }}><Logo size={18} /> <span style={{ fontSize: 13 }}>Paytm · LeadPilot sales agent</span></div>
        <div className="ring-ava"><span /><span /><Bot size={38} /></div>
        <div style={{ fontSize: 13, color: 'var(--paytm-cyan)', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>Incoming AI call</div>
        <div style={{ fontSize: 26, fontWeight: 500, marginTop: 6 }}>Calling {call.name}</div>
        <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>{call.business || 'Merchant'} · {call.phone} · {call.lang === 'en' ? 'English' : 'Hindi'}</div>
        <div className="muted mono" style={{ fontSize: 12.5, marginTop: 10 }}>ringing 0:{String(secs).padStart(2, '0')} · you play the merchant</div>
        <div className="row" style={{ gap: 46, justifyContent: 'center', marginTop: 28 }}>
          <div className="col" style={{ alignItems: 'center', gap: 8 }}>
            <button className="call-btn decline" onClick={decline} aria-label="Decline"><PhoneOff size={26} /></button>
            <span className="muted" style={{ fontSize: 12.5 }}>Decline</span>
          </div>
          <div className="col" style={{ alignItems: 'center', gap: 8 }}>
            <button className="call-btn accept" onClick={answer} aria-label="Answer"><Phone size={26} /></button>
            <span className="muted" style={{ fontSize: 12.5 }}>Answer</span>
          </div>
        </div>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 22 }}>Speak naturally in Hindi or English after the agent finishes. Powered by Sarvam AI speech.</div>
      </div>
    </div>
  )
}
