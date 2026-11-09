// Blank presentation template in the PARAM Shavak light style: aurora backgrounds, Segoe UI,
// navy + royal blue, letter-spaced caps. No content — only the hackathon logo and editable placeholders.
const pptxgen = require('pptxgenjs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const sharp = require('sharp')
const lu = require('react-icons/lu')
const path = require('path')
const { applyTheme } = require(path.join(process.env.PPTX_SKILL, 'scripts', 'apply_theme.js'))

const THEME = {
  name: 'PARAM Shavak Light',
  headFontFace: 'Segoe UI Semibold',
  bodyFontFace: 'Segoe UI',
  colors: {
    dk1: '0B1B4D', lt1: 'FFFFFF', dk2: '46557F', lt2: 'EEF3FF',
    accent1: '2A5BFF', accent2: '4F86FF', accent3: '0726A8', accent4: '6A9CFF', accent5: 'A9C4FF', accent6: '7F95D1',
    hlink: '2A5BFF', folHlink: '46557F',
  },
}

const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE' // 13.333 x 7.5, same as the reference deck
pres.title = 'Presentation template'
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace }
const C = pres.SchemeColor
const F = (f) => path.join(__dirname, f)
const LOGO_R = 343 / 1286
const HEAD = 'Segoe UI Semibold'

const logoSmall = { image: { x: 10.95, y: 0.42, w: 1.8, h: 1.8 * LOGO_R, path: F('logo_hackathon.png') } }
const slideNum = { x: 12.0, y: 6.93, w: 0.75, h: 0.3, fontSize: 10, color: '46557F', align: 'right' }
const footer = { placeholder: { options: { name: 'footer', type: 'body', x: 0.6, y: 6.93, w: 7, h: 0.3, fontSize: 10, color: C.text2, charSpacing: 4, margin: 0 }, text: 'FOOTER TEXT' } }
const title = (o = {}) => ({ placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.55, w: 10.1, h: 0.85, fontSize: 32, color: C.text1, fontFace: HEAD, align: 'left', valign: 'bottom', margin: 0, ...o }, text: 'SLIDE TITLE' } })
const subtitle = (o = {}) => ({ placeholder: { options: { name: 'subtitle', type: 'body', x: 0.6, y: 1.45, w: 10.1, h: 0.6, fontSize: 16, color: C.text2, align: 'left', valign: 'top', margin: 0, ...o }, text: 'Subtitle or one-line summary' } })
const body = (name, x, y, w, h, prompt = 'Add text', o = {}) => ({ placeholder: { options: { name, type: 'body', x, y, w, h, fontSize: 16, color: C.text1, align: 'left', valign: 'top', margin: 0, ...o }, text: prompt } })

async function build() {
  let svg = renderToStaticMarkup(React.createElement(lu.LuAsterisk, { size: 256, color: '#2A5BFF', strokeWidth: 2.2 })).replace(/currentColor/g, '#2A5BFF')
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(F('asterisk.png'))

  // 1. Cover -------------------------------------------------------------
  pres.defineSlideMaster({
    title: 'Cover',
    background: { path: F('bg_cover.jpg') },
    objects: [
      { image: { x: 9.55, y: 0.45, w: 3.2, h: 3.2 * LOGO_R, path: F('logo_hackathon.png') } },
      { image: { x: 7.35, y: 1.25, w: 0.62, h: 0.62, path: F('asterisk.png') } },
      body('eyebrow', 0.8, 1.35, 6.2, 0.5, 'ORGANISATION  •  PARTNER', { fontSize: 18, fontFace: HEAD, charSpacing: 2, valign: 'middle' }),
      body('tags', 0.8, 2.55, 6.4, 0.9, 'TAG ONE     TAG TWO     TAG THREE', { fontSize: 12, charSpacing: 2 }),
      { placeholder: { options: { name: 'title', type: 'title', x: 0.75, y: 3.65, w: 7.9, h: 2.75, fontSize: 80, color: C.text1, fontFace: HEAD, align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 0.9 }, text: 'PROJECT\nTITLE' } },
      body('kicker', 8.95, 2.35, 3.9, 0.75, 'A SHORT KICKER LINE\nON TWO LINES', { fontSize: 12, color: C.text2, charSpacing: 6, fontFace: HEAD }),
      body('subtitle', 8.95, 4.3, 3.9, 1.5, 'One sentence that says what this project is.', { fontSize: 24 }),
      body('promise', 8.95, 6.0, 3.9, 0.95, 'FIRST PROMISE\nSECOND PROMISE\nTHIRD PROMISE', { fontSize: 12, color: C.accent1, charSpacing: 5 }),
    ],
  })

  // 2. Title and content -------------------------------------------------
  pres.defineSlideMaster({
    title: 'Title and Content', background: { path: F('bg_content.jpg') }, slideNumber: slideNum,
    objects: [logoSmall, title(), subtitle(), body('body', 0.6, 2.35, 12.13, 4.25, 'Add your points', { bullet: true }), footer],
  })

  // 3. Two columns -------------------------------------------------------
  pres.defineSlideMaster({
    title: 'Two Columns', background: { path: F('bg_content.jpg') }, slideNumber: slideNum,
    objects: [
      logoSmall, title(), subtitle(),
      body('heading left', 0.6, 2.35, 5.8, 0.45, 'Left heading', { fontSize: 19, fontFace: HEAD }),
      body('body left', 0.6, 2.9, 5.8, 3.7, 'Add text', { bullet: true }),
      body('heading right', 6.93, 2.35, 5.8, 0.45, 'Right heading', { fontSize: 19, fontFace: HEAD }),
      body('body right', 6.93, 2.9, 5.8, 3.7, 'Add text', { bullet: true }),
      footer,
    ],
  })

  // 4. Image with text (photo panel left, like the reference slide 2) ----
  pres.defineSlideMaster({
    title: 'Image and Text', background: { path: F('bg_content.jpg') }, slideNumber: slideNum,
    objects: [
      { image: { x: 10.7, y: 6.86, w: 1.1, h: 1.1 * LOGO_R, path: F('logo_hackathon.png') } },
      { placeholder: { options: { name: 'picture', type: 'pic', x: 0.75, y: 0.75, w: 4.4, h: 5.85, color: C.text2 }, text: 'Drop an image here' } },
      title({ x: 5.75, y: 0.6, w: 7.0, h: 0.85 }),
      subtitle({ x: 5.75, y: 1.5, w: 7.0, h: 0.9 }),
      body('body', 5.75, 2.65, 7.0, 3.9, 'Add your points', { bullet: true }),
      footer,
    ],
  })

  // 5. Four steps (like the reference slide 3) ---------------------------
  const steps = []
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + i * 3.1
    steps.push(body(`number ${i + 1}`, x, 2.45, 2.7, 0.85, String(i + 1).padStart(2, '0'), { fontSize: 44, fontFace: HEAD, color: C.accent1, valign: 'middle' }))
    steps.push(body(`step title ${i + 1}`, x, 3.4, 2.7, 0.5, 'Step title', { fontSize: 19, fontFace: HEAD }))
    steps.push(body(`step text ${i + 1}`, x, 3.95, 2.7, 1.2, 'Short description of this step.', { fontSize: 14, color: C.text2 }))
  }
  pres.defineSlideMaster({
    title: 'Four Steps', background: { path: F('bg_content.jpg') }, slideNumber: slideNum,
    objects: [logoSmall, title(), subtitle(), ...steps,
      body('closing line', 0.6, 5.45, 9.5, 0.8, 'CLOSING LINE.', { fontSize: 40, fontFace: HEAD, valign: 'middle' }),
      body('closing sub', 0.6, 6.25, 9.5, 0.4, 'A short line under the closing statement.', { fontSize: 14, color: C.text2 }),
      footer],
  })

  // 6. Big numbers -------------------------------------------------------
  const stats = []
  for (let i = 0; i < 3; i++) {
    const x = 0.6 + i * 4.15
    stats.push(body(`stat ${i + 1}`, x, 2.7, 3.8, 1.4, '00', { fontSize: 72, fontFace: HEAD, color: C.accent1, valign: 'bottom' }))
    stats.push(body(`stat label ${i + 1}`, x, 4.2, 3.6, 0.45, 'METRIC LABEL', { fontSize: 13, color: C.text1, charSpacing: 4, fontFace: HEAD }))
    stats.push(body(`stat note ${i + 1}`, x, 4.7, 3.6, 1.0, 'What this number means.', { fontSize: 14, color: C.text2 }))
  }
  pres.defineSlideMaster({
    title: 'Big Numbers', background: { path: F('bg_content.jpg') }, slideNumber: slideNum,
    objects: [logoSmall, title(), subtitle(), ...stats, footer],
  })

  // 7. Section divider ---------------------------------------------------
  pres.defineSlideMaster({
    title: 'Section', background: { path: F('bg_section.jpg') }, slideNumber: slideNum,
    objects: [
      logoSmall,
      { image: { x: 0.8, y: 1.15, w: 0.55, h: 0.55, path: F('asterisk.png') } },
      body('number', 0.8, 1.9, 4, 1.4, '01', { fontSize: 96, fontFace: HEAD, color: C.accent1, valign: 'bottom' }),
      { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 3.4, w: 8.6, h: 1.15, fontSize: 48, color: C.text1, fontFace: HEAD, align: 'left', valign: 'top', margin: 0 }, text: 'SECTION TITLE' } },
      body('subtitle', 0.82, 4.6, 7.8, 0.9, 'One line on what this section covers', { fontSize: 18, color: C.text2 }),
    ],
  })

  // 8. Statement ---------------------------------------------------------
  pres.defineSlideMaster({
    title: 'Statement', background: { path: F('bg_content.jpg') }, slideNumber: slideNum,
    objects: [
      logoSmall,
      body('kicker', 0.8, 1.9, 9, 0.4, 'A SHORT KICKER', { fontSize: 13, color: C.accent1, charSpacing: 6, fontFace: HEAD }),
      { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 2.45, w: 11.7, h: 1.85, fontSize: 60, color: C.text1, fontFace: HEAD, align: 'left', valign: 'top', margin: 0 }, text: 'A BOLD STATEMENT.' } },
      body('subtitle', 0.82, 4.45, 10, 0.6, 'Supporting line for the statement.', { fontSize: 18, color: C.text2 }),
      footer,
    ],
  })

  // 9. Title only (for diagrams, charts, screenshots) ---------------------
  pres.defineSlideMaster({
    title: 'Title Only', background: { path: F('bg_content.jpg') }, slideNumber: slideNum,
    objects: [logoSmall, title(), subtitle(), footer],
  })

  // 10. Closing ----------------------------------------------------------
  pres.defineSlideMaster({
    title: 'Closing', background: { path: F('bg_closing.jpg') },
    objects: [
      { image: { x: 4.47, y: 0.85, w: 4.4, h: 4.4 * LOGO_R, path: F('logo_hackathon.png') } },
      { placeholder: { options: { name: 'title', type: 'title', x: 1.0, y: 2.75, w: 11.33, h: 1.2, fontSize: 64, color: C.text1, fontFace: HEAD, align: 'center', valign: 'middle', margin: 0 }, text: 'THANK YOU.' } },
      body('subtitle', 2.0, 4.05, 9.33, 0.6, 'Closing line or call to action', { fontSize: 20, color: C.text2, align: 'center' }),
      body('contact', 2.0, 4.85, 9.33, 0.5, 'NAME  ·  EMAIL  ·  LINK', { fontSize: 12, color: C.accent1, align: 'center', charSpacing: 5 }),
    ],
  })

  // 11. Blank ------------------------------------------------------------
  pres.defineSlideMaster({ title: 'Blank', background: { path: F('bg_content.jpg') }, slideNumber: slideNum, objects: [logoSmall] })

  // One empty sample slide per layout (placeholders show their prompts in PowerPoint's editor only)
  for (const name of ['Cover', 'Title and Content', 'Two Columns', 'Image and Text', 'Four Steps', 'Big Numbers', 'Section', 'Statement', 'Title Only', 'Closing', 'Blank']) {
    pres.addSlide({ masterName: name })
  }

  const out = F('Hackathon-Template-PARAM-Light.pptx')
  await pres.writeFile({ fileName: out })
  await applyTheme(out, THEME)
  console.log('wrote', out)
}

build().catch((e) => { console.error(e); process.exit(1) })
