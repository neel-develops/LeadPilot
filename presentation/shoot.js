// Headless screenshots of every dashboard screen (QA for the light theme).
const puppeteer = require('puppeteer-core')
const path = require('path')
const fs = require('fs')

const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = path.join(__dirname, 'shots')
fs.mkdirSync(OUT, { recursive: true })

async function as(browser, email, password, pages, prefix) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1536, height: 900 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await page.screenshot({ path: path.join(OUT, `${prefix}-00-login.png`) })
  await page.evaluate(async (email, password) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
    localStorage.setItem('leadpilot.session', JSON.stringify(await r.json()))
  }, email, password)
  for (const [i, p] of pages.entries()) {
    await page.goto(`${BASE}/#/${p}`, { waitUntil: 'networkidle2' })
    await page.reload({ waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 2200))
    await page.screenshot({ path: path.join(OUT, `${prefix}-${String(i + 1).padStart(2, '0')}-${p.replace('/', '_')}.png`) })
  }
  console.log(prefix, 'errors:', errors.filter((e) => !e.includes('favicon')).slice(0, 5))
  await page.close()
}

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--no-first-run', '--disable-gpu'],
  })
  try {
    await as(browser, 'manager@leadpilot.in', 'manager123',
      ['command', 'live', 'leads', 'leads/LD-1050', 'field', 'analytics', 'leakage', 'audit', 'compliance'], 'mgr')
    await as(browser, 'rahul.patil@leadpilot.in', 'rep123', ['myday', 'leads'], 'rep')
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
