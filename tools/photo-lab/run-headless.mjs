// Runs the photo lab on image files in headless Chrome and prints the measurements as JSON.
//   node tools/photo-lab/run-headless.mjs tests/fixtures/meal-3000x2000.jpg   (needs `pnpm dev` running on :5173)
import { chromium } from '@playwright/test'

const base = process.env.LAB_URL ?? 'http://localhost:5173'
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] })
for (const file of process.argv.slice(2)) {
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('page error:', e.message))
  await page.goto(`${base}/tools/photo-lab/?fixture=/${file}`)
  await page.waitForSelector('#json:not([hidden])', { timeout: 60_000 })
  console.log(await page.textContent('#json'))
  await page.close()
}
await browser.close()
