import React, { useState } from 'react'
import { Bot, Keyboard, Loader2, PhoneCall, Shuffle, Mic, Volume2 } from 'lucide-react'
import { api, can } from '../api.js'
import { useApp } from '../ctx.js'
import { Modal, Seg, Switch } from './ui.jsx'

const randPhone = () => '9' + String(Math.floor(100000000 + Math.random() * 899999999))
const NAMES = {
  sunita_tea: ['Sunita Pawar', 'Sunita Amruttulya'], rakesh_kirana: ['Rakesh Jadhav', 'Jadhav Kirana Stores'],
  priya_restaurant: ['Priya Deshpande', 'Spice Route Family Restaurant'], anil_chain: ['Anil Agarwal', 'Agarwal Sweets (6 outlets)'],
  meena_whatsapp: ['Meena Gaikwad', 'Meena Fruits & Veg'], vikas_competitor: ['Vikas Kulkarni', 'Lifeline Medical'],
  optout_raj: ['Raj Malhotra', 'Raj Hardware'], never_answers: ['Ganesh Kale', 'Kale Provision'], voice_fail: ['Deepak Shinde', 'Digital World Mobiles'],
}

export default function NewLeadModal({ onClose, onCreated }) {
  const { meta, toast } = useApp()
  const [mode, setMode] = useState('voice')
  const [audio, setAudio] = useState(true)
  const sims = can('sim:run')
  const [persona, setPersona] = useState('sunita_tea')
  const [f, setF] = useState({ name: 'Sunita Pawar', business_name: 'Sunita Amruttulya', phone: randPhone(), source: 'web_form', interest: 'soundbox', language: 'hi', pincode: '', consent: true })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e })

  const pick = (key) => {
    setPersona(key)
    const p = meta?.personas.find((x) => x.key === key)
    const [name, biz] = NAMES[key] || ['', '']
    setF({ ...f, name, business_name: biz, language: p?.lang || f.language, phone: randPhone() })
  }

  const submit = async () => {
    setBusy(true)
    setErr(null)
    try {
      const res = await api('/leads', { method: 'POST', body: { ...f, mode, audio: mode === 'auto' ? audio : mode === 'voice', persona: mode === 'auto' ? persona : null } })
      if (res.duplicate) toast({ icon: Shuffle, tone: 'amber', title: 'Duplicate lead merged', sub: `Phone matches ${res.lead_id} (deduplicated by hash)` })
      onCreated(res.lead_id)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Capture a new merchant lead" sub="The agent contacts the lead the moment it lands — watch the stopwatch." onClose={onClose} width={700}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit} disabled={busy || !f.name || !f.phone}>
          {busy ? <Loader2 size={16} className="spin" /> : <PhoneCall size={16} />} {mode === 'voice' ? 'Submit — AI calls me now' : 'Submit lead & start agent'}
        </button>
      </>}>
      <div className="grid g-2" style={{ gap: 12 }}>
        <div className="field"><label>Merchant name</label><input className="input" value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>Business name</label><input className="input" value={f.business_name} onChange={set('business_name')} /></div>
        <div className="field">
          <label>Mobile number</label>
          <input className="input mono" value={f.phone} onChange={set('phone')} />
          <span className="hint">Stored hashed + encrypted, masked everywhere.</span>
        </div>
        <div className="field">
          <label>Shop pincode (optional)</label>
          <input className="input mono" placeholder="e.g. 411038" value={f.pincode} onChange={set('pincode')} />
          <span className="hint">If blank, the agent asks for it on the call.</span>
        </div>
        <div className="field">
          <label>Lead source</label>
          <Seg value={f.source} onChange={set('source')} options={[{ value: 'web_form', label: 'Web form' }, { value: 'missed_call', label: 'Missed call' }, { value: 'ad_feed', label: 'Ad feed' }]} />
        </div>
        <div className="grid g-2" style={{ gap: 10 }}>
          <div className="field">
            <label>Interest</label>
            <select className="select" value={f.interest} onChange={set('interest')}>
              <option value="soundbox">Soundbox</option><option value="card_machine">Card machine</option><option value="not_sure">Not sure</option>
            </select>
          </div>
          <div className="field">
            <label>Language</label>
            <select className="select" value={f.language} onChange={set('language')}>
              <option value="hi">Hindi</option><option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      <label className="check">
        <input type="checkbox" checked={f.consent} onChange={set('consent')} />
        <span>Merchant consented to be contacted by Paytm (call, WhatsApp, SMS). <span className="dim">Untick to see the consent gate block contact.</span></span>
      </label>

      <div className="divider" style={{ margin: '2px 0' }} />
      <div className="row between">
        <div style={{ fontWeight: 650, fontSize: 13 }}>Who answers the call?</div>
        <Seg value={mode} onChange={setMode} options={[{ value: 'voice', label: 'AI calls me (voice)' }, { value: 'interactive', label: 'Text chat' }, ...(sims ? [{ value: 'auto', label: 'Simulated merchant' }] : [])]} />
      </div>
      {mode === 'voice' && (
        <div className="banner tone-cyan">
          <Mic size={18} />
          <div>The agent places the call within seconds and your screen rings. Answer it and talk as the merchant in Hindi, Hinglish or English — Sarvam AI hears you and replies with its own voice. Allow microphone access when asked.</div>
        </div>
      )}
      {mode === 'auto' && (
        <div className="row between">
          <span className="row muted" style={{ fontSize: 13 }}><Volume2 size={15} /> Play both voices with Sarvam AI (agent + merchant)</span>
          <Switch checked={audio} onChange={setAudio} />
        </div>
      )}
      {mode === 'auto' ? (
        <div className="persona-grid">
          {(meta?.personas || []).map((p) => (
            <div key={p.key} className={`persona ${persona === p.key ? 'on' : ''}`} onClick={() => pick(p.key)}>
              <div className="persona-t row"><Bot size={13} color="var(--accent)" />{p.label}</div>
              <div className="persona-d">{p.desc}</div>
            </div>
          ))}
        </div>
      ) : mode === 'interactive' && (
        <div className="banner tone-cyan">
          <Keyboard size={18} />
          <div>You type the merchant's replies in Hindi, Hinglish or English. Try asking for a discount, a human, or saying "don't call me" to trigger guardrails.</div>
        </div>
      )}
      {err && <div className="banner tone-red">{err}</div>}
    </Modal>
  )
}
