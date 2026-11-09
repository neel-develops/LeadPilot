// Paytm AI Hackathon · Pune — LeadPilot pitch deck (editable, light glassmorphism, Paytm navy + cyan)
const pptxgen = require('pptxgenjs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const sharp = require('sharp')
const lu = require('react-icons/lu')
const path = require('path')
const { applyTheme } = require(path.join(process.env.PPTX_SKILL, 'scripts', 'apply_theme.js'))

const THEME = {
  name: 'Paytm AI Hackathon Glass',
  headFontFace: 'Arial',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '0B1F3F', lt1: 'FFFFFF', dk2: '002E6E', lt2: 'EAF6FD',
    accent1: '00BAF2', accent2: '002E6E', accent3: 'E8394B', accent4: 'FF9933', accent5: '138808', accent6: '2842C4',
    hlink: '00BAF2', folHlink: '5B4FD1',
  },
}
const HEX = { navy: '002E6E', cyan: '00BAF2', ink: '0B1F3F', muted: '5B6F8E' }

const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE' // 13.333 x 7.5
pres.title = 'LeadPilot — Paytm AI Hackathon Pune'
pres.author = 'Team LeadPilot'
pres.subject = 'Paytm AI Hackathon · Build for India · Pune'
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace }
const C = pres.SchemeColor
const S = pres.shapes
const A = (f) => path.join(__dirname, 'assets', f)

const FOOT = 'Paytm AI Hackathon  ·  Build for India  ·  Pune  ·  15 Nov 2026'

// ------------------------------------------------------------------ layouts
pres.defineSlideMaster({
  title: 'TITLE',
  background: { path: A('bg_title.png') },
  objects: [
    { image: { x: 0.7, y: 0.6, w: 4.4, h: 4.4 * 343 / 1286, path: A('logo_hackathon.png') } },
    { image: { x: 11.15, y: 0.5, w: 1.5, h: 1.5 * 369 / 484, path: A('logo_build_for_india.png') } },
    { image: { x: 3.75, y: 5.55, w: 6.6, h: 6.6 * 410 / 1465, path: A('skyline.png') } },
    { placeholder: { options: { name: 'kicker', type: 'body', x: 0.72, y: 2.35, w: 8, h: 0.4, fontSize: 14, bold: true, color: C.accent1, charSpacing: 2, margin: 0 }, text: 'TRACK 3 · AUTONOMOUS AI TEAMMATES' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 2.75, w: 9, h: 1.05, fontSize: 54, bold: true, color: C.text2, margin: 0, valign: 'middle', align: 'left' }, text: 'Project name' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.72, y: 3.85, w: 7.6, h: 0.95, fontSize: 20, color: C.text1, margin: 0, valign: 'top' }, text: 'One-line tagline' } },
  ],
})

pres.defineSlideMaster({
  title: 'SECTION',
  background: { path: A('bg_section.png') },
  objects: [
    { image: { x: 11.0, y: 0.45, w: 1.75, h: 1.75 * 142 / 436, path: A('logo_paytm_white.png') } },
    { placeholder: { options: { name: 'number', type: 'body', x: 4.2, y: 2.0, w: 6, h: 1.2, fontSize: 72, bold: true, color: C.accent1, margin: 0, fontFace: 'Arial' }, text: '01' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 4.2, y: 3.15, w: 8.4, h: 1.0, fontSize: 44, bold: true, color: C.background1, margin: 0, align: 'left' }, text: 'Section title' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 4.22, y: 4.2, w: 7.6, h: 0.9, fontSize: 18, color: C.background2, margin: 0, valign: 'top' }, text: 'What this section proves' } },
    { text: { text: FOOT, options: { x: 4.22, y: 6.85, w: 8, h: 0.3, fontSize: 10, color: C.background2, margin: 0, isTextBox: true } } },
  ],
})

pres.defineSlideMaster({
  title: 'CONTENT',
  background: { path: A('bg_content.png') },
  margin: [0.5, 0.6, 0.7, 0.6],
  objects: [
    { image: { x: 10.75, y: 0.38, w: 2.0, h: 2.0 * 343 / 1286, path: A('logo_hackathon.png') } },
    { placeholder: { options: { name: 'kicker', type: 'body', x: 0.6, y: 0.38, w: 9, h: 0.32, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2, margin: 0 }, text: 'KICKER' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.7, w: 9.9, h: 0.75, fontSize: 32, bold: true, color: C.text2, margin: 0, valign: 'middle', align: 'left' }, text: 'Slide title' } },
    { text: { text: FOOT, options: { x: 0.6, y: 6.98, w: 8, h: 0.3, fontSize: 10, color: C.text1, transparency: 35, margin: 0, isTextBox: true } } },
  ],
  slideNumber: { x: 12.25, y: 6.98, w: 0.5, h: 0.3, fontSize: 10, color: HEX.navy, align: 'right' },
})

pres.defineSlideMaster({
  title: 'CLOSING',
  background: { path: A('bg_title.png') },
  objects: [
    { image: { x: 4.47, y: 0.75, w: 4.4, h: 4.4 * 343 / 1286, path: A('logo_hackathon.png') } },
    { image: { x: 3.75, y: 5.55, w: 6.6, h: 6.6 * 410 / 1465, path: A('skyline.png') } },
    { placeholder: { options: { name: 'title', type: 'title', x: 1.5, y: 2.35, w: 10.33, h: 1.1, fontSize: 54, bold: true, color: C.text2, align: 'center', margin: 0 }, text: 'Thank you' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 2.5, y: 3.45, w: 8.33, h: 0.6, fontSize: 20, color: C.text1, align: 'center', margin: 0 }, text: 'Questions?' } },
  ],
})

// ------------------------------------------------------------------ helpers
const iconCache = {}
async function icon(name, hex = 'FFFFFF') {
  const key = name + hex
  if (iconCache[key]) return iconCache[key]
  let svg = renderToStaticMarkup(React.createElement(lu[name], { size: 256, color: '#' + hex }))
  svg = svg.replace(/currentColor/g, '#' + hex)
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer()
  iconCache[key] = 'image/png;base64,' + buf.toString('base64')
  return iconCache[key]
}

function glass(slide, x, y, w, h, name, opts = {}) {
  slide.addShape(S.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: opts.radius ?? 0.2, objectName: name,
    fill: { color: opts.tint || C.background1, transparency: opts.transparency ?? 30 },
    line: { color: C.background1, width: 1.25, transparency: 5 },
    shadow: { type: 'outer', color: HEX.navy, opacity: 0.13, blur: 16, offset: 4, angle: 90 },
  })
}

async function iconDot(slide, x, y, d, name, fill = C.accent2, hex = 'FFFFFF') {
  slide.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { type: 'none' }, objectName: `icon bg ${name}` })
  const p = d * 0.26
  slide.addImage({ data: await icon(name, hex), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: name.replace('Lu', '') + ' icon', objectName: `icon ${name}` })
}

function text(slide, t, o) {
  slide.addText(t, { isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: 'top', ...o })
}

function arrow(slide, x, y, w, h = 0, name, flip = {}) {
  slide.addShape(S.LINE, { x, y, w, h, ...flip, line: { color: C.accent1, width: 2.25, endArrowType: 'triangle' }, objectName: name })
}

function content(kicker, title, section) {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: section })
  s.addText(kicker, { placeholder: 'kicker' })
  s.addText(title, { placeholder: 'title' })
  return s
}

// ------------------------------------------------------------------ slides
async function build() {
  // white Paytm wordmark for dark section slides
  await sharp(A('logo_paytm.png')).ensureAlpha().linear([0, 0, 0, 1], [255, 255, 255, 0]).toFile(A('logo_paytm_white.png'))

  // 1. Title ---------------------------------------------------------
  pres.addSection({ title: 'Opening' })
  let s = pres.addSlide({ masterName: 'TITLE', sectionTitle: 'Opening' })
  s.addText('TRACK 3 · AUTONOMOUS AI TEAMMATES', { placeholder: 'kicker' })
  s.addText('LeadPilot', { placeholder: 'title' })
  s.addText('An AI sales teammate that calls every merchant lead in seconds, in Hindi or English, and books the right field visit', { placeholder: 'body' })
  glass(s, 0.7, 4.95, 5.6, 0.62, 'event pill', { radius: 0.31, transparency: 20 })
  s.addImage({ data: await icon('LuMapPin', HEX.cyan), x: 0.92, y: 5.1, w: 0.32, h: 0.32, altText: 'Location', objectName: 'pin icon' })
  text(s, 'Pune', { x: 1.32, y: 5.08, w: 0.9, h: 0.36, fontSize: 16, bold: true, color: C.text2, valign: 'middle', objectName: 'city' })
  s.addImage({ data: await icon('LuCalendarCheck', HEX.cyan), x: 2.3, y: 5.1, w: 0.32, h: 0.32, altText: 'Date', objectName: 'date icon' })
  text(s, 'Sunday, 15 November 2026', { x: 2.7, y: 5.08, w: 3.4, h: 0.36, fontSize: 16, bold: true, color: C.text2, valign: 'middle', objectName: 'date' })
  text(s, 'Team LeadPilot  ·  Your team names here', { x: 0.75, y: 5.8, w: 6, h: 0.3, fontSize: 12, color: C.text1, objectName: 'team line' })
  s.addNotes('Open with the hook: a merchant who asks for a Soundbox today waits one to three days for a callback. LeadPilot calls in under 30 seconds.')

  // 2. Agenda --------------------------------------------------------
  s = content('AGENDA', 'What we will show in 5 minutes', 'Opening')
  const agenda = [
    ['01', 'The problem', 'Why merchant leads go cold before anyone calls'],
    ['02', 'LeadPilot', 'One autonomous teammate from lead to booked visit'],
    ['03', 'Live voice demo', 'The AI calls, talks in Hindi and books a rep'],
    ['04', 'The intelligence', 'Explainable score, device fit and field allocation'],
    ['05', 'Impact & trust', 'Before/after metrics, RBAC and compliance'],
    ['06', 'What is next', 'Roadmap to a Paytm-scale rollout'],
  ]
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = Math.floor(i / 3)
    const x = 0.6 + col * 4.16, y = 1.75 + row * 2.5
    glass(s, x, y, 3.85, 2.2, `agenda card ${i + 1}`)
    text(s, agenda[i][0], { x: x + 0.35, y: y + 0.3, w: 1.2, h: 0.6, fontSize: 34, bold: true, color: C.accent1, fontFace: 'Arial', objectName: `agenda num ${i + 1}` })
    text(s, agenda[i][1], { x: x + 0.35, y: y + 0.98, w: 3.2, h: 0.42, fontSize: 20, bold: true, color: C.text2, objectName: `agenda title ${i + 1}` })
    text(s, agenda[i][2], { x: x + 0.35, y: y + 1.42, w: 3.2, h: 0.62, fontSize: 14, color: C.text1, objectName: `agenda desc ${i + 1}` })
  }
  s.addNotes('Walk the structure quickly. Spend most of the time on the live voice demo.')

  // 3. Problem -------------------------------------------------------
  s = content('THE PROBLEM', 'Interested merchants wait days for a call', 'Opening')
  text(s, 'A kirana owner asks for a Paytm Soundbox. By the time a rep calls back, a competitor has already installed one.', { x: 0.6, y: 1.8, w: 5.6, h: 1.5, fontSize: 22, color: C.text2, bold: true, objectName: 'problem statement' })
  const pains = [
    ['LuClock', 'Slow first contact', 'Manual callbacks take 24 to 72 hours'],
    ['LuRoute', 'Wasted field visits', 'Wrong device, wrong time, merchant absent'],
    ['LuEyeOff', 'Silent lead leakage', 'Nobody notices when a hot lead goes cold'],
  ]
  for (let i = 0; i < 3; i++) {
    const y = 3.55 + i * 1.0
    await iconDot(s, 0.6, y, 0.62, pains[i][0], C.accent1)
    text(s, pains[i][1], { x: 1.4, y: y - 0.02, w: 4.8, h: 0.34, fontSize: 17, bold: true, color: C.text2, objectName: `pain title ${i + 1}` })
    text(s, pains[i][2], { x: 1.4, y: y + 0.32, w: 4.8, h: 0.32, fontSize: 14, color: C.text1, objectName: `pain desc ${i + 1}` })
  }
  const stats = [['24–72 h', 'to first contact today'], ['~15%', 'of leads become a field visit'], ['~20%', 'of visits are wasted']]
  for (let i = 0; i < 3; i++) {
    const y = 1.75 + i * 1.68
    glass(s, 6.75, y, 6.0, 1.45, `stat card ${i + 1}`)
    text(s, stats[i][0], { x: 7.1, y: y + 0.2, w: 2.9, h: 1.05, fontSize: 44, bold: true, color: i === 0 ? C.accent3 : C.text2, fontFace: 'Arial', valign: 'middle', objectName: `stat value ${i + 1}` })
    text(s, stats[i][1], { x: 10.0, y: y + 0.2, w: 2.5, h: 1.05, fontSize: 16, color: C.text1, valign: 'middle', objectName: `stat label ${i + 1}` })
  }
  text(s, 'Baselines are assumptions for the hackathon and should be replaced with Paytm data.', { x: 6.75, y: 6.62, w: 6, h: 0.28, fontSize: 10, color: C.text1, italic: true, objectName: 'stat source' })
  s.addNotes('Speed wins merchant acquisition. Every hour of delay increases the chance a competitor gets there first.')

  // 4. Section: solution --------------------------------------------
  pres.addSection({ title: 'Solution' })
  s = pres.addSlide({ masterName: 'SECTION', sectionTitle: 'Solution' })
  s.addText('01', { placeholder: 'number' })
  s.addText('Meet LeadPilot', { placeholder: 'title' })
  s.addText('One autonomous teammate that runs the path from first lead to booked visit, then watches the lead until activation', { placeholder: 'body' })
  s.addNotes('Transition: here is the teammate we built.')

  // 5. Three signature ideas ----------------------------------------
  s = content('THE SOLUTION', 'Three ideas that go beyond a calling bot', 'Solution')
  const ideas = [
    ['LuSiren', 'Lead leakage detection', 'A detector scans every 10 seconds for leads going cold and recovers them in one click', ['No contact within 60 s', '3 unanswered attempts', 'Hot lead, no visit in 24 h']],
    ['LuBrainCircuit', 'Merchant intelligence', 'The call becomes a profile, an explainable score and a rep briefing', ['Shop, sales, payment setup', 'Score 0–100 with reasons', 'Objections + talking points']],
    ['LuMap', 'Field-aware allocation', 'Picks the right rep and slot, not just any free slot', ['Distance + coverage', 'Skill for the device', 'Workload + earliest slot']],
  ]
  for (let i = 0; i < 3; i++) {
    const x = 0.6 + i * 4.16, y = 1.75
    glass(s, x, y, 3.85, 4.95, `idea card ${i + 1}`)
    await iconDot(s, x + 0.35, y + 0.35, 0.85, ideas[i][0], i === 1 ? C.accent1 : C.accent2)
    text(s, ideas[i][1], { x: x + 0.35, y: y + 1.4, w: 3.2, h: 0.45, fontSize: 20, bold: true, color: C.text2, objectName: `idea title ${i + 1}` })
    text(s, ideas[i][2], { x: x + 0.35, y: y + 1.9, w: 3.2, h: 1.2, fontSize: 15, color: C.text1, objectName: `idea desc ${i + 1}` })
    text(s, ideas[i][3].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < 2 } })), { x: x + 0.35, y: y + 3.0, w: 3.2, h: 1.4, fontSize: 14, color: C.text2, paraSpaceAfter: 6, objectName: `idea points ${i + 1}` })
  }
  s.addNotes('Competitors already have outbound voice bots. Our differentiators are these three.')

  // 6. Flow -----------------------------------------------------------
  s = content('HOW IT WORKS', 'From lead to booked visit in under a minute', 'Solution')
  const steps = [
    ['LuStore', 'Lead in', 'Form, missed call or ad'],
    ['LuShieldCheck', 'Consent gate', 'DND, hours, attempt cap'],
    ['LuPhoneCall', 'AI calls', 'First contact < 30 s'],
    ['LuLanguages', 'Qualifies', 'Hindi · Hinglish · English'],
    ['LuSparkles', 'Recommends', 'Device, plan, score'],
    ['LuRoute', 'Allocates', 'Best rep and slot'],
    ['LuCalendarCheck', 'Books', 'Confirms + briefs rep'],
  ]
  const sw = 1.5, gap = 0.27
  for (let i = 0; i < 7; i++) {
    const x = 0.6 + i * (sw + gap), y = 2.0
    glass(s, x, y, sw, 2.55, `step card ${i + 1}`)
    await iconDot(s, x + (sw - 0.72) / 2, y + 0.3, 0.72, steps[i][0], i === 2 ? C.accent1 : C.accent2)
    text(s, String(i + 1).padStart(2, '0'), { x, y: y + 1.12, w: sw, h: 0.3, fontSize: 12, bold: true, color: C.accent1, align: 'center', objectName: `step num ${i + 1}` })
    text(s, steps[i][1], { x: x + 0.1, y: y + 1.42, w: sw - 0.2, h: 0.36, fontSize: 16, bold: true, color: C.text2, align: 'center', objectName: `step title ${i + 1}` })
    text(s, steps[i][2], { x: x + 0.1, y: y + 1.8, w: sw - 0.2, h: 0.6, fontSize: 12, color: C.text1, align: 'center', objectName: `step desc ${i + 1}` })
    if (i < 6) arrow(s, x + sw + 0.03, y + 0.66, gap - 0.06, 0, `step arrow ${i + 1}`)
  }
  glass(s, 0.6, 4.95, 12.13, 1.65, 'flow facts', { transparency: 15 })
  const facts = [['< 30 s', 'first contact (demo target)'], ['3', 'languages understood'], ['100%', 'of steps logged to the audit trail'], ['0', 'prices outside the rule table']]
  for (let i = 0; i < 4; i++) {
    const x = 0.95 + i * 3.0
    text(s, facts[i][0], { x, y: 5.2, w: 2.7, h: 0.65, fontSize: 30, bold: true, color: C.text2, fontFace: 'Arial', objectName: `fact value ${i + 1}` })
    text(s, facts[i][1], { x, y: 5.85, w: 2.7, h: 0.5, fontSize: 14, color: C.text1, objectName: `fact label ${i + 1}` })
  }
  s.addNotes('Every arrow is a logged tool call the orchestrator validates against guardrails before it runs.')

  // 7. Voice architecture --------------------------------------------
  s = content('LIVE AI VOICE', 'Real-time Hindi voice, powered by Sarvam AI', 'Solution')
  const boxes = [
    [0.6, 'LuMic', 'Merchant speaks', 'Mic in the browser, voice activity detection', C.accent2],
    [3.7, 'LuAudioLines', 'Sarvam STT', 'saarika v2.5 · Hindi + English', C.accent1],
    [6.8, 'LuBot', 'Agent orchestrator', 'Rules first, Sarvam-105b fallback, guardrails', C.accent2],
    [9.9, 'LuWorkflow', 'Tool layer', 'Score · recommend · allocate · book · CRM', C.accent1],
  ]
  for (let i = 0; i < 4; i++) {
    const [x, ic, t, d, fill] = boxes[i]
    glass(s, x, 1.85, 2.83, 2.25, `voice box ${i + 1}`)
    await iconDot(s, x + 0.3, 2.1, 0.7, ic, fill)
    text(s, t, { x: x + 0.3, y: 2.92, w: 2.3, h: 0.4, fontSize: 17, bold: true, color: C.text2, objectName: `voice title ${i + 1}` })
    text(s, d, { x: x + 0.3, y: 3.32, w: 2.35, h: 0.68, fontSize: 13, color: C.text1, objectName: `voice desc ${i + 1}` })
    if (i < 3) arrow(s, x + 2.86, 2.97, 0.24, 0, `voice arrow ${i + 1}`)
  }
  glass(s, 3.7, 4.45, 5.93, 1.15, 'tts box')
  await iconDot(s, 3.95, 4.67, 0.7, 'LuRadio', C.accent1)
  text(s, 'Sarvam TTS (bulbul v3) speaks the reply', { x: 4.85, y: 4.67, w: 4.6, h: 0.36, fontSize: 17, bold: true, color: C.text2, objectName: 'tts title' })
  text(s, 'Natural Indian voice, then the mic listens again', { x: 4.85, y: 5.05, w: 4.6, h: 0.36, fontSize: 13, color: C.text1, objectName: 'tts desc' })
  arrow(s, 8.22, 4.13, 0, 0.3, 'return arrow 1')
  arrow(s, 2.03, 5.02, 1.65, 0, 'return arrow 2', { flipH: true })
  arrow(s, 2.02, 4.12, 0, 0.9, 'return arrow 3', { flipV: true })
  const lat = [['≈ 1.1 s', 'speech-to-text'], ['≈ 0.6 s', 'LLM understanding'], ['≈ 1.8 s', 'text-to-speech']]
  for (let i = 0; i < 3; i++) {
    const x = 0.6 + i * 4.16
    glass(s, x, 5.85, 3.85, 0.85, `latency ${i + 1}`, { radius: 0.42, transparency: 15 })
    text(s, [{ text: lat[i][0] + '  ', options: { bold: true, color: C.accent2, fontSize: 18 } }, { text: lat[i][1], options: { color: C.text1, fontSize: 14 } }], { x: x + 0.35, y: 5.95, w: 3.3, h: 0.65, valign: 'middle', objectName: `latency text ${i + 1}` })
  }
  s.addNotes('Measured during our tests against the Sarvam API. The API key never leaves the server.')

  // 8. Intelligence --------------------------------------------------
  s = content('THE INTELLIGENCE', 'Every decision is explainable', 'Solution')
  const cols = [0.6, 4.76, 8.92]
  // score
  glass(s, cols[0], 1.75, 3.85, 4.95, 'score card')
  text(s, 'Lead score', { x: cols[0] + 0.35, y: 2.0, w: 3.2, h: 0.4, fontSize: 20, bold: true, color: C.text2, objectName: 'score title' })
  text(s, [{ text: '71', options: { fontSize: 54, bold: true, color: C.text2 } }, { text: '  HOT', options: { fontSize: 18, bold: true, color: C.accent3 } }], { x: cols[0] + 0.35, y: 2.45, w: 3.2, h: 0.95, valign: 'middle', fontFace: 'Arial', objectName: 'score value' })
  const factors = [['Web form intent', 20], ['No digital setup', 12], ['Shop fit: kirana', 12], ['Inside coverage', 10], ['Asked about price', 8]]
  factors.forEach(([l, v], k) => {
    const y = 3.55 + k * 0.6
    text(s, l, { x: cols[0] + 0.35, y, w: 2.4, h: 0.28, fontSize: 13, color: C.text1, objectName: `factor ${k + 1}` })
    text(s, `+${v}`, { x: cols[0] + 2.9, y, w: 0.6, h: 0.28, fontSize: 13, bold: true, color: C.accent5, align: 'right', objectName: `factor pts ${k + 1}` })
    s.addShape(S.ROUNDED_RECTANGLE, { x: cols[0] + 0.35, y: y + 0.33, w: 3.15, h: 0.1, rectRadius: 0.05, fill: { color: C.background2 }, line: { type: 'none' }, objectName: `factor track ${k + 1}` })
    s.addShape(S.ROUNDED_RECTANGLE, { x: cols[0] + 0.35, y: y + 0.33, w: 3.15 * v / 20, h: 0.1, rectRadius: 0.05, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: `factor bar ${k + 1}` })
  })
  // recommendation
  glass(s, cols[1], 1.75, 3.85, 4.95, 'recommendation card')
  text(s, 'Device fit', { x: cols[1] + 0.35, y: 2.0, w: 3.2, h: 0.4, fontSize: 20, bold: true, color: C.text2, objectName: 'rec title' })
  text(s, 'Rule table on shop type × daily sales × payment setup. Prices only from the table.', { x: cols[1] + 0.35, y: 2.45, w: 3.2, h: 0.9, fontSize: 14, color: C.text1, objectName: 'rec desc' })
  const devices = [['Soundbox Lite', '₹49/mo'], ['Soundbox Pro 4G', '₹99/mo'], ['Card Machine', '₹299/mo'], ['Smart POS Combo', '₹499/mo']]
  devices.forEach(([d, p], k) => {
    const y = 3.5 + k * 0.75
    glass(s, cols[1] + 0.3, y, 3.25, 0.6, `device row ${k + 1}`, { radius: 0.3, transparency: 5 })
    text(s, d, { x: cols[1] + 0.55, y: y + 0.13, w: 2.0, h: 0.34, fontSize: 14, bold: true, color: C.text2, objectName: `device ${k + 1}` })
    text(s, p, { x: cols[1] + 2.45, y: y + 0.13, w: 0.95, h: 0.34, fontSize: 14, color: C.accent2, align: 'right', objectName: `price ${k + 1}` })
  })
  text(s, 'Illustrative prices', { x: cols[1] + 0.35, y: 6.38, w: 3, h: 0.25, fontSize: 10, italic: true, color: C.text1, objectName: 'price note' })
  // allocation
  glass(s, cols[2], 1.75, 3.85, 4.95, 'allocation card')
  text(s, 'Rep allocation', { x: cols[2] + 0.35, y: 2.0, w: 3.2, h: 0.4, fontSize: 20, bold: true, color: C.text2, objectName: 'alloc title' })
  text(s, 'Hard constraints first, then a weighted ranking of every eligible rep.', { x: cols[2] + 0.35, y: 2.45, w: 3.2, h: 0.9, fontSize: 14, color: C.text1, objectName: 'alloc desc' })
  const weights = [['Distance', 0.4], ['Earliest slot', 0.25], ['Skill match', 0.2], ['Workload', 0.15]]
  weights.forEach(([l, v], k) => {
    const y = 3.55 + k * 0.72
    text(s, l, { x: cols[2] + 0.35, y, w: 2.2, h: 0.3, fontSize: 14, color: C.text1, objectName: `weight ${k + 1}` })
    text(s, v.toFixed(2), { x: cols[2] + 2.7, y, w: 0.8, h: 0.3, fontSize: 14, bold: true, color: C.text2, align: 'right', objectName: `weight val ${k + 1}` })
    s.addShape(S.ROUNDED_RECTANGLE, { x: cols[2] + 0.35, y: y + 0.36, w: 3.15, h: 0.12, rectRadius: 0.06, fill: { color: C.background2 }, line: { type: 'none' }, objectName: `weight track ${k + 1}` })
    s.addShape(S.ROUNDED_RECTANGLE, { x: cols[2] + 0.35, y: y + 0.36, w: 3.15 * v / 0.4, h: 0.12, rectRadius: 0.06, fill: { color: C.accent2 }, line: { type: 'none' }, objectName: `weight bar ${k + 1}` })
  })
  s.addNotes('Judges can ask "why" for any decision: every factor and rule ID is stored and shown on the dashboard.')

  // 9. Section: impact ------------------------------------------------
  pres.addSection({ title: 'Impact' })
  s = pres.addSlide({ masterName: 'SECTION', sectionTitle: 'Impact' })
  s.addText('02', { placeholder: 'number' })
  s.addText('Impact & trust', { placeholder: 'title' })
  s.addText('Measured on 200 simulated leads against a modelled slow manual callback', { placeholder: 'body' })
  s.addNotes('Transition to results.')

  // 10. Impact chart -------------------------------------------------
  s = content('IMPACT', 'Faster contact, more visits, less waste', 'Impact')
  glass(s, 0.6, 1.75, 4.2, 4.95, 'ttfc card')
  await iconDot(s, 0.95, 2.05, 0.75, 'LuTimer', C.accent1)
  text(s, 'Median time to first contact', { x: 0.95, y: 3.0, w: 3.6, h: 0.4, fontSize: 16, color: C.text1, objectName: 'ttfc label' })
  text(s, '39 h', { x: 0.95, y: 3.45, w: 3.6, h: 0.75, fontSize: 36, bold: true, color: C.text1, fontFace: 'Arial', strike: 'sngStrike', transparency: 40, objectName: 'ttfc before' })
  text(s, '26 s', { x: 0.95, y: 4.2, w: 3.6, h: 1.1, fontSize: 66, bold: true, color: C.accent1, fontFace: 'Arial', objectName: 'ttfc after' })
  text(s, 'About 5,000× faster than a manual callback', { x: 0.95, y: 5.45, w: 3.6, h: 0.7, fontSize: 15, bold: true, color: C.text2, objectName: 'ttfc note' })
  glass(s, 5.1, 1.75, 7.63, 4.95, 'chart card')
  s.addChart(pres.charts.BAR, [
    { name: 'Manual baseline', labels: ['Lead-to-visit %', 'Wasted visits %', 'Needs a human %'], values: [15, 20, 100] },
    { name: 'With LeadPilot', labels: ['Lead-to-visit %', 'Wasted visits %', 'Needs a human %'], values: [39.5, 9.4, 4.5] },
  ], {
    x: 5.35, y: 1.95, w: 7.15, h: 4.55, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60,
    chartColors: ['9FB3CC', '00BAF2'], showLegend: true, legendPos: 't', legendFontSize: 12, legendColor: HEX.ink, legendFontFace: '+mn-lt',
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 12, dataLabelColor: HEX.ink, dataLabelFontFace: '+mn-lt', dataLabelFormatCode: 'General',
    catAxisLabelColor: HEX.muted, catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', valAxisHidden: true,
    valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, catAxisLineShow: false,
    showTitle: true, title: 'Before vs after (simulated)', titleFontSize: 14, titleColor: HEX.navy, titleFontFace: '+mn-lt',
    objectName: 'impact chart', altText: 'Clustered column chart comparing manual baseline and LeadPilot',
  })
  text(s, 'Simulated on 200 generated leads; baselines are assumptions to be replaced with Paytm data.', { x: 5.1, y: 6.78, w: 7.6, h: 0.2, fontSize: 10, italic: true, color: C.text1, objectName: 'impact source' })
  s.addNotes('Lead-to-visit 15% → 39.5%. Wasted visits 20% → 9.4%. Only 4.5% of leads needed a human.')

  // 11. Trust --------------------------------------------------------
  s = content('TRUST BY DESIGN', 'Guardrails, roles and a full audit trail', 'Impact')
  const trust = [
    ['LuUsers', 'Role-based access', 'Rep, manager and admin views, enforced on the server'],
    ['LuShieldCheck', 'Consent & DND gate', 'No call without consent, inside permitted hours'],
    ['LuBan', 'Instant opt-out', 'One "don’t call me" adds the number to DNC'],
    ['LuScale', 'No price drift', 'Prices only from the rule table; discounts go to a human'],
    ['LuLock', 'Private by default', 'Phones hashed, encrypted and masked; reveal is audited'],
    ['LuScrollText', 'Every action logged', 'Inputs, outputs and timing for each tool call'],
  ]
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = Math.floor(i / 3)
    const x = 0.6 + col * 4.16, y = 1.75 + row * 2.5
    glass(s, x, y, 3.85, 2.2, `trust card ${i + 1}`)
    await iconDot(s, x + 0.35, y + 0.35, 0.7, trust[i][0], row === 0 ? C.accent2 : C.accent1)
    text(s, trust[i][1], { x: x + 1.25, y: y + 0.42, w: 2.4, h: 0.55, fontSize: 18, bold: true, color: C.text2, valign: 'middle', objectName: `trust title ${i + 1}` })
    text(s, trust[i][2], { x: x + 0.35, y: y + 1.25, w: 3.2, h: 0.8, fontSize: 14, color: C.text1, objectName: `trust desc ${i + 1}` })
  }
  s.addNotes('Telemarketing and DND rules still need to be verified with a qualified person before production.')

  // 12. Tech stack ---------------------------------------------------
  s = content('BUILT WITH', 'A lean stack that runs on a laptop', 'Impact')
  const tech = [
    ['LuMic', 'Sarvam saarika', 'Speech-to-text'], ['LuAudioLines', 'Sarvam bulbul', 'Text-to-speech'],
    ['LuBrainCircuit', 'Sarvam-105b', 'Language understanding'], ['LuServer', 'FastAPI + SQLite', 'Agent, tools, data'],
    ['LuCode', 'React + Vite', 'Glassmorphism dashboard'], ['LuMap', 'OpenStreetMap', 'Leaflet field maps'],
    ['LuZap', 'Server-sent events', 'Live updates'], ['LuKeyRound', 'Signed tokens', 'Role-based access'],
  ]
  for (let i = 0; i < 8; i++) {
    const col = i % 4, row = Math.floor(i / 4)
    const x = 0.6 + col * 3.08, y = 1.75 + row * 2.5
    glass(s, x, y, 2.85, 2.2, `tech card ${i + 1}`)
    await iconDot(s, x + 0.3, y + 0.32, 0.72, tech[i][0], i < 3 ? C.accent1 : C.accent2)
    text(s, tech[i][1], { x: x + 0.3, y: y + 1.2, w: 2.35, h: 0.4, fontSize: 17, bold: true, color: C.text2, objectName: `tech title ${i + 1}` })
    text(s, tech[i][2], { x: x + 0.3, y: y + 1.6, w: 2.35, h: 0.4, fontSize: 14, color: C.text1, objectName: `tech desc ${i + 1}` })
  }
  s.addNotes('Sarvam powers all three voice and language steps; everything else is open source.')

  // 13. Roadmap ------------------------------------------------------
  pres.addSection({ title: 'Next' })
  s = content('ROADMAP', 'From hackathon prototype to Paytm scale', 'Next')
  const phases = [
    ['Today', 'Hackathon MVP', 'Voice agent, scoring, allocation, leakage detector, RBAC'],
    ['Pilot', 'Real channels', 'Telephony (e.g. Exotel), WhatsApp templates, Paytm CRM'],
    ['Scale', 'Learned models', 'Outcome-trained scoring, route grouping, Marathi'],
    ['Vision', 'Predictive acquisition', 'Territory heatmaps and self-learning pitch'],
  ]
  s.addShape(S.LINE, { x: 0.95, y: 2.35, w: 11.4, h: 0, line: { color: C.accent1, width: 3, dashType: 'dash' }, objectName: 'timeline line' })
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + i * 3.12
    s.addShape(S.OVAL, { x: x + 0.15, y: 2.05, w: 0.6, h: 0.6, fill: { color: i === 0 ? C.accent1 : C.accent2 }, line: { color: C.background1, width: 3 }, objectName: `milestone ${i + 1}` })
    text(s, String(i + 1), { x: x + 0.15, y: 2.05, w: 0.6, h: 0.6, fontSize: 16, bold: true, color: C.background1, align: 'center', valign: 'middle', objectName: `milestone num ${i + 1}` })
    glass(s, x, 3.0, 2.85, 3.0, `phase card ${i + 1}`)
    text(s, phases[i][0].toUpperCase(), { x: x + 0.3, y: 3.3, w: 2.3, h: 0.3, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2, objectName: `phase tag ${i + 1}` })
    text(s, phases[i][1], { x: x + 0.3, y: 3.65, w: 2.35, h: 0.8, fontSize: 19, bold: true, color: C.text2, objectName: `phase title ${i + 1}` })
    text(s, phases[i][2], { x: x + 0.3, y: 4.5, w: 2.35, h: 1.3, fontSize: 14, color: C.text1, objectName: `phase desc ${i + 1}` })
  }
  s.addNotes('Ask: a pilot with one Pune sales team and access to the Paytm CRM sandbox.')

  // 14. Team ---------------------------------------------------------
  s = content('THE TEAM', 'Who built LeadPilot', 'Next')
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + i * 3.12
    glass(s, x, 1.85, 2.85, 4.2, `team card ${i + 1}`)
    s.addShape(S.OVAL, { x: x + 0.7, y: 2.1, w: 1.45, h: 1.45, fill: { color: C.background2 }, line: { color: C.accent1, width: 2.5 }, objectName: `photo frame ${i + 1}` })
    s.addImage({ data: await icon('LuUserRound', HEX.navy), x: x + 1.07, y: 2.47, w: 0.71, h: 0.71, altText: 'Replace with a team photo', objectName: `photo placeholder ${i + 1}` })
    text(s, 'Team member name', { x: x + 0.2, y: 3.8, w: 2.45, h: 0.4, fontSize: 17, bold: true, color: C.text2, align: 'center', objectName: `member name ${i + 1}` })
    text(s, ['Role · e.g. AI & voice', 'Role · e.g. Backend', 'Role · e.g. Frontend', 'Role · e.g. Product & pitch'][i], { x: x + 0.2, y: 4.22, w: 2.45, h: 0.35, fontSize: 14, color: C.accent2, align: 'center', objectName: `member role ${i + 1}` })
    text(s, 'One line about what they built for LeadPilot', { x: x + 0.3, y: 4.8, w: 2.25, h: 0.9, fontSize: 14, color: C.text1, align: 'center', objectName: `member bio ${i + 1}` })
  }
  s.addNotes('Replace the icons with photos: right-click the person icon, Change Picture.')

  // 15. Closing ------------------------------------------------------
  s = pres.addSlide({ masterName: 'CLOSING', sectionTitle: 'Next' })
  s.addText('Thank you', { placeholder: 'title' })
  s.addText('Every merchant lead, called in seconds. Questions?', { placeholder: 'body' })
  glass(s, 2.67, 4.3, 8.0, 0.62, 'contact pill', { radius: 0.31, transparency: 20 })
  text(s, 'Team LeadPilot  ·  your.email@example.com  ·  github.com/your-team', { x: 2.87, y: 4.43, w: 7.6, h: 0.36, fontSize: 14, color: C.text2, bold: true, align: 'center', valign: 'middle', objectName: 'contact' })
  s.addNotes('Close on the one-line value: every merchant lead, called in seconds.')

  const out = path.join(__dirname, 'Paytm-AI-Hackathon-LeadPilot.pptx')
  await pres.writeFile({ fileName: out })
  await applyTheme(out, THEME)
  console.log('wrote', out)
}

build().catch((e) => { console.error(e); process.exit(1) })
