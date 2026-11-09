import React from 'react'
import {
  ShieldCheck, PhoneCall, Send, Database, Sparkles, Gauge, Route, CalendarCheck, FileText, RotateCcw, Headset,
  Ban, Siren, Workflow, UserPlus, Eye, Settings2, LifeBuoy, Languages, CircleDot, Copy, BadgeCheck, CalendarClock,
  BrainCircuit, Mic, PhoneIncoming, LogIn, MessageSquareText,
} from 'lucide-react'

export const TOOL_META = {
  check_consent: { icon: ShieldCheck, tone: 'green', label: 'Consent gate' },
  place_call: { icon: PhoneCall, tone: 'cyan', label: 'Place call' },
  send_message: { icon: Send, tone: 'blue', label: 'Send message' },
  save_profile: { icon: Database, tone: 'violet', label: 'Save profile' },
  recommend_device: { icon: Sparkles, tone: 'cyan', label: 'Recommend device' },
  score_lead: { icon: Gauge, tone: 'amber', label: 'Score lead' },
  find_slots: { icon: Route, tone: 'violet', label: 'Find rep & slot' },
  book_visit: { icon: CalendarCheck, tone: 'green', label: 'Book visit' },
  generate_briefing: { icon: FileText, tone: 'blue', label: 'Rep briefing' },
  update_crm: { icon: Database, tone: 'slate', label: 'Update CRM' },
  schedule_retry: { icon: RotateCcw, tone: 'amber', label: 'Schedule retry' },
  handoff_to_human: { icon: Headset, tone: 'orange', label: 'Human handoff' },
  record_opt_out: { icon: Ban, tone: 'red', label: 'Opt-out' },
  flag_leakage: { icon: Siren, tone: 'red', label: 'Leakage flag' },
  recover_lead: { icon: LifeBuoy, tone: 'green', label: 'Recover lead' },
  state_transition: { icon: Workflow, tone: 'slate', label: 'State' },
  ingest_lead: { icon: UserPlus, tone: 'cyan', label: 'Lead ingested' },
  reveal_phone: { icon: Eye, tone: 'orange', label: 'Reveal phone' },
  update_settings: { icon: Settings2, tone: 'slate', label: 'Settings' },
  switch_language: { icon: Languages, tone: 'violet', label: 'Language' },
  dedupe: { icon: Copy, tone: 'amber', label: 'Deduplicated' },
  capture_visit_outcome: { icon: BadgeCheck, tone: 'green', label: 'Visit outcome' },
  reschedule_visit: { icon: CalendarClock, tone: 'amber', label: 'Reschedule' },
  resolve_handoff: { icon: Headset, tone: 'green', label: 'Handoff resolved' },
  track_activation: { icon: BadgeCheck, tone: 'green', label: 'Activation' },
  sarvam_llm_understand: { icon: BrainCircuit, tone: 'violet', label: 'Sarvam LLM' },
  sarvam_stt: { icon: Mic, tone: 'cyan', label: 'Sarvam speech-to-text' },
  sarvam_assistant: { icon: MessageSquareText, tone: 'violet', label: 'Sarvam assistant' },
  call_answered: { icon: PhoneIncoming, tone: 'green', label: 'Call answered' },
  sign_in: { icon: LogIn, tone: 'slate', label: 'Sign in' },
}

export function toolMeta(tool) {
  return TOOL_META[tool] || { icon: CircleDot, tone: 'slate', label: tool }
}

export function describe(a) {
  const o = a.output || {}
  const i = a.input || {}
  switch (a.tool) {
    case 'check_consent': return o.allowed ? 'All consent checks passed' : `Blocked — ${o.reason}`
    case 'place_call': return `Attempt ${o.attempt ?? ''} · ${String(o.outcome || '').replace('_', ' ')}`
    case 'send_message': return o.preview ? `${i.template_id} → ${o.channel}` : `${i.template_id} ${o.blocked_by ? '· ' + o.blocked_by : ''}`
    case 'save_profile': return `Saved ${(o.saved || []).join(', ')}`
    case 'recommend_device': return `${o.device} · ${(o.rule_ids || []).join(' ')}`
    case 'score_lead': return `Score ${o.score} (${o.temperature})`
    case 'find_slots': return o.options ? `${o.options.length} option(s) · ${o.rejected?.length ?? 0} reps excluded` : `${o.eligible ?? ''} eligible reps`
    case 'book_visit': return o.booked ? `${o.visit_id || ''} ${o.rep ? '· ' + o.rep : ''} ${o.slot ? '· ' + o.slot : ''}` : `Blocked — ${o.blocked_by}`
    case 'generate_briefing': return o.headline || 'Briefing generated'
    case 'update_crm': return `Status → ${o.status || i.status}`
    case 'schedule_retry': return o.production_policy || 'Retry scheduled'
    case 'handoff_to_human': return o.reason || i.reason
    case 'state_transition': return `${i.from} → ${o.to}`
    case 'flag_leakage': return `${i.rule} · ${o.title}`
    case 'recover_lead': return o.action || 'Recovery started'
    case 'ingest_lead': return `${i.source?.replace('_', ' ')} · ${i.phone}`
    case 'record_opt_out': return 'Opt-out recorded · added to DNC'
    case 'reschedule_visit': return `→ ${o.rep} · ${o.slot}`
    case 'capture_visit_outcome': return `${o.outcome}${o.reason ? ' · ' + o.reason : ''}`
    case 'sarvam_llm_understand': return o.error ? `No JSON · ${o.error}` : `intent ${o.intent}${o.applied && Object.keys(o.applied).length ? ' · ' + Object.entries(o.applied).map(([k, v]) => `${k}=${v}`).join(', ') : ''}${o.answer ? ' · answered question' : ''}`
    case 'sarvam_stt': return `“${o.transcript || ''}” · ${o.language || ''}`
    case 'call_answered': return o.answered ? 'Merchant answered · voice live' : 'Not answered'
    case 'sign_in': return `${i.email} · ${o.role}`
    case 'sarvam_assistant': return i.question
    default: return ''
  }
}
