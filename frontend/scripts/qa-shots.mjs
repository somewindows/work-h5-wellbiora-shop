/**
 * QA 截图脚本：用本机 Chrome（无头）对页面截图，供视觉走查
 * 用法：node scripts/qa-shots.mjs [url路径...]   默认截首页/列表/详情
 * 前提：dev server 已在 5199 端口运行（npm run dev -- --port 5199）
 * 产物：qa/*.png（已 gitignore）
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.QA_BASE || 'http://localhost:5199/#'
const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/', '/products', '/product/p2']

mkdirSync('qa', { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
})

for (const t of targets) {
  await page.goto(`${BASE}${t}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const name = (t === '/' ? 'home' : t.replaceAll('/', '_')) + '.png'
  await page.screenshot({ path: `qa/${name}`, fullPage: true })
  console.log(`shot: qa/${name}`)
}

// 附加：首页首卡与模块标题的左缘对齐测量
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const metrics = await page.evaluate(() => {
  const head = document.querySelector('.sec-head')
  const ticket = document.querySelector('.ticket')
  const grid = document.querySelector('.grid-v2, .pgrid, [class*=grid]')
  const r = (el) => (el ? Math.round(el.getBoundingClientRect().left * 10) / 10 : null)
  return { secHeadText: r(head?.querySelector('.cn')), ticketFirst: r(ticket), gridFirst: r(grid?.firstElementChild) }
})
console.log('对齐测量（左缘 px）:', JSON.stringify(metrics))

await browser.close()
