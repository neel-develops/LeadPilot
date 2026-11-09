// Real-time voice engine (singleton): Sarvam TTS playback queue + hands-free mic capture with
// voice-activity detection. Utterances are encoded as 16 kHz WAV and sent to Sarvam STT via the API.
import { useEffect, useState } from 'react'
import { api, audioUrl } from './api.js'

const st = {
  inCall: false, leadId: null, phase: 'idle', level: 0, muted: false, heard: '', error: null,
  waiting: false, playing: false, soundOn: true,
}
const subs = new Set()
const emit = () => subs.forEach((f) => f({ ...st }))
const set = (p) => { Object.assign(st, p); emit() }

export function useVoice() {
  const [s, setS] = useState({ ...st })
  useEffect(() => { subs.add(setS); return () => subs.delete(setS) }, [])
  return s
}
export const voiceState = () => ({ ...st })

// ------------------------------------------------------------------ playback queue
const queue = []
let current = null

function playNext() {
  if (current || !queue.length) {
    if (!current && !queue.length) { set({ playing: false }); maybeListen() }
    return
  }
  const item = queue.shift()
  set({ playing: true, phase: st.inCall ? 'agent' : st.phase })
  stopListening(true)
  const done = () => { current = null; playNext() }
  if (item.audio) {
    const a = new Audio(audioUrl(item.audio))
    current = a
    a.onended = done
    a.onerror = () => { current = null; item.text ? speakFallback(item, done) : done() }
    a.play().catch(() => { current = null; item.text ? speakFallback(item, done) : done() })
  } else if (item.text) {
    speakFallback(item, done)
  } else done()
}

function speakFallback(item, done) {
  if (!('speechSynthesis' in window)) return done()
  const u = new SpeechSynthesisUtterance(item.text)
  const want = item.lang === 'en' ? 'en' : 'hi'
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(want))
  if (v) u.voice = v
  u.lang = want === 'hi' ? 'hi-IN' : 'en-IN'
  current = { pause() { window.speechSynthesis.cancel() } }
  u.onend = done
  u.onerror = done
  window.speechSynthesis.speak(u)
}

export function enqueue(item) {
  if (!st.soundOn && !st.inCall) return
  queue.push(item)
  playNext()
}
export function setSound(on) {
  set({ soundOn: on })
  if (!on && !st.inCall) clearQueue()
}
function clearQueue() {
  queue.length = 0
  if (current) { try { current.pause() } catch { /* ignore */ } current = null }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  set({ playing: false })
}

// ------------------------------------------------------------------ ringtone
let ring = null
export function startRing() {
  stopRing()
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const g = ctx.createGain()
    g.gain.value = 0
    g.connect(ctx.destination)
    ;[440, 480].forEach((f) => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(g); o.start() })
    let on = false
    const tick = () => { on = !on; g.gain.setTargetAtTime(on ? 0.06 : 0, ctx.currentTime, 0.02) }
    tick()
    const id = setInterval(tick, 1100)
    ring = { ctx, id }
  } catch { ring = null }
}
export function stopRing() {
  if (!ring) return
  clearInterval(ring.id)
  ring.ctx.close().catch(() => {})
  ring = null
}

// ------------------------------------------------------------------ microphone + VAD
let ctx = null
let stream = null
let proc = null
let listening = false
let frames = []
let preroll = []
let speechFrames = 0
let silentFrames = 0
let heardSpeech = false
let floor = 0.01
let startedAt = 0
let busy = false

export async function startCall(leadId) {
  if (st.inCall && st.leadId === leadId) return true
  await endCall()
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  } catch (e) {
    set({ error: 'Microphone blocked — allow mic access or type your replies.' })
    set({ inCall: true, leadId, phase: 'idle' })
    return false
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  await ctx.resume().catch(() => {})
  const src = ctx.createMediaStreamSource(stream)
  proc = ctx.createScriptProcessor(4096, 1, 1)
  const mute = ctx.createGain()
  mute.gain.value = 0
  src.connect(proc)
  proc.connect(mute)
  mute.connect(ctx.destination)
  proc.onaudioprocess = onAudio
  set({ inCall: true, leadId, phase: 'idle', error: null, heard: '', muted: false })
  return true
}

export async function endCall() {
  stopListening(true)
  if (proc) { proc.onaudioprocess = null; try { proc.disconnect() } catch { /* ignore */ } proc = null }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null }
  if (ctx) { await ctx.close().catch(() => {}); ctx = null }
  set({ inCall: false, leadId: null, phase: 'idle', level: 0, waiting: false })
}

export function setMuted(m) {
  set({ muted: m })
  if (m) stopListening(true)
  else maybeListen()
}

/** Called with the session's activity so we know when the agent is waiting for the merchant. */
export function setWaiting(waiting) {
  set({ waiting })
  if (waiting) maybeListen()
  else if (!heardSpeech) stopListening(true)
}

function maybeListen() {
  if (!st.inCall || !st.waiting || st.muted || st.playing || busy || !proc) return
  if (!listening) startListening()
}

function startListening() {
  listening = true
  frames = []
  speechFrames = 0
  silentFrames = 0
  heardSpeech = false
  startedAt = performance.now()
  set({ phase: 'listening' })
}

function stopListening(discard) {
  if (!listening) return
  listening = false
  if (discard) { frames = []; heardSpeech = false }
  if (st.inCall && st.phase === 'listening') set({ phase: 'idle' })
}

/** Manually finish the current utterance (push-to-send). */
export function finishUtterance() {
  if (listening && heardSpeech) finalize()
}

function onAudio(e) {
  const data = e.inputBuffer.getChannelData(0)
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
  const rms = Math.sqrt(sum / data.length)
  if (!heardSpeech) floor = floor * 0.95 + Math.min(rms, 0.05) * 0.05
  const threshold = Math.max(0.012, floor * 2.6)
  if (Math.random() < 0.5) set({ level: Math.min(1, rms * 12) })
  if (!listening) {
    preroll.push(new Float32Array(data))
    if (preroll.length > 4) preroll.shift()
    return
  }
  const chunk = new Float32Array(data)
  if (!heardSpeech) {
    preroll.push(chunk)
    if (preroll.length > 4) preroll.shift()
    if (rms > threshold) {
      speechFrames++
      if (speechFrames >= 2) {
        heardSpeech = true
        frames = [...preroll]
        set({ phase: 'hearing' })
      }
    } else speechFrames = 0
    if (performance.now() - startedAt > 70000) stopListening(true)
    return
  }
  frames.push(chunk)
  silentFrames = rms < threshold ? silentFrames + 1 : 0
  const secs = (frames.length * data.length) / (ctx?.sampleRate || 48000)
  if (silentFrames >= 10 || secs > 14) finalize()
}

async function finalize() {
  listening = false
  const rate = ctx?.sampleRate || 48000
  const chunks = frames
  frames = []
  heardSpeech = false
  busy = true
  set({ phase: 'processing' })
  try {
    const wav = encodeWav(chunks, rate, 16000)
    const fd = new FormData()
    fd.append('file', new Blob([wav], { type: 'audio/wav' }), 'speech.wav')
    const res = await api(`/voice/${st.leadId}/utterance`, { method: 'POST', body: fd })
    if (res.ok) set({ heard: res.transcript, waiting: false, error: null })
  } catch (e) {
    set({ error: e.message })
  } finally {
    busy = false
    if (st.phase === 'processing') set({ phase: 'idle' })
    maybeListen()
  }
}

function encodeWav(chunks, inRate, outRate) {
  const len = chunks.reduce((a, c) => a + c.length, 0)
  const merged = new Float32Array(len)
  let off = 0
  for (const c of chunks) { merged.set(c, off); off += c.length }
  const ratio = inRate / outRate
  const outLen = Math.floor(len / ratio)
  const pcm = new Int16Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(len, Math.floor((i + 1) * ratio))
    let s = 0
    for (let j = start; j < end; j++) s += merged[j]
    const v = s / Math.max(1, end - start)
    pcm[i] = Math.max(-1, Math.min(1, v)) * 0x7fff
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2)
  const dv = new DataView(buf)
  const w = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)) }
  w(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, outRate, true); dv.setUint32(28, outRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  w(36, 'data'); dv.setUint32(40, pcm.length * 2, true)
  new Int16Array(buf, 44).set(pcm)
  return buf
}
