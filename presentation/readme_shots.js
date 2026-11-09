// README screenshots: every screen in the light theme, plus a live agent conversation and the incoming call.
const puppeteer = require('puppeteer-core')
const path = require('path')
const fs = require('fs')

const BASE = 'http://localhost:5173'
const API = 'http://localhost:8000/api'
const OUT = path.join(__dirname, '..', 'docs', 'images')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(email, password) {
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
  return r.json()
}
async function api(tok, p, body) {
  const r = await fetch(API + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: body ? JSON.stringify(body) : undefined })
  return r.json()
}

async function page(browser, session) {
  const pg = await browser.newPage()
  await pg.setViewport({ width: 1536, height: 900, deviceScaleFactor: 1 })
  await pg.goto(BASE + '/', { waitUntil: 'networkidle2' })
  if (session) await pg.evaluate((s) => localStorage.setItem('leadpilot.session', JSON.stringify(s)), session)
  return pg
}
async function shot(pg, route, name, wait = 2500) {
  await pg.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle2' })
  await pg.reload({ waitUntil: 'networkidle2' })
  await sleep(wait)
  await pg.screenshot({ path: path.join(OUT, name + '.png') })
  console.log('shot', name)
}

;(async () => {
  const admin = await login('admin@leadpilot.in', 'admin123')
  await api(admin.token, '/admin/reset', {})
  const mgr = await login('manager@leadpilot.in', 'manager123')

  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-first-run'] })
  try {
    const anon = await page(browser, null)
    await sleep(800)
    await anon.screenshot({ path: path.join(OUT, 'login.png') })

    const pg = await page(browser, mgr)
    // live agent: a full simulated conversation (Sunita, tea stall, Hindi)
    const lead = await api(mgr.token, '/leads', { name: 'Sunita Pawar', business_name: 'Sunita Amruttulya', phone: '9876543210', mode: 'auto', persona: 'sunita_tea', audio: false })
    for (let i = 0; i < 60; i++) {
      const s = await api(mgr.token, `/sessions/${lead.lead_id}`)
      if (s.ended) break
      await sleep(1000)
    }
    await shot(pg, `live/${lead.lead_id}`, 'live-agent', 3000)
    await shot(pg, 'command', 'overview')
    await shot(pg, `leads/${lead.lead_id}`, 'merchant-record')
    await shot(pg, 'leads', 'merchants')
    await shot(pg, 'field', 'field-operations', 4000)
    await shot(pg, 'analytics', 'analytics', 3000)
    await shot(pg, 'leakage', 'lead-leakage')
    await shot(pg, 'audit', 'audit-log')
    await shot(pg, 'compliance', 'compliance')

    // incoming AI voice call (ring screen), then decline
    await pg.goto(`${BASE}/#/command`, { waitUntil: 'networkidle2' })
    await sleep(1500)
    const call = await api(mgr.token, '/leads', { name: 'Ravi Shinde', business_name: 'Ravi Kirana Stores', phone: '9812345670', mode: 'voice', audio: true })
    await pg.waitForSelector('.incoming', { timeout: 15000 })
    await sleep(2500)
    await pg.screenshot({ path: path.join(OUT, 'incoming-call.png') })
    console.log('shot incoming-call')
    await api(mgr.token, `/voice/${call.lead_id}/answer`, { answer: false })

    // field rep view
    const rep = await login('rahul.patil@leadpilot.in', 'rep123')
    const rp = await page(browser, rep)
    await shot(rp, 'myday', 'rep-my-day', 4000)
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
