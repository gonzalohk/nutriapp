// Fails when the JavaScript downloaded at startup (what index.html loads, gzip) is over budget, or
// when the holiday library ends up in the browser bundle. Run after `pnpm build`.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGET_KB = 160
const dist = new URL('../dist/', import.meta.url).pathname
const html = readFileSync(join(dist, 'index.html'), 'utf8')

const initial = new Set(
  [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]),
)
if (initial.size === 0) throw new Error('No startup scripts found in dist/index.html. Did the build run?')

let total = 0
for (const file of initial) {
  const size = gzipSync(readFileSync(join(dist, file))).length
  total += size
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${file}`)
}
const kb = total / 1024
console.log(`Startup JavaScript: ${kb.toFixed(1)} KB gzip (budget ${BUDGET_KB} KB)`)

// The holiday library is only for the build-time generator; it must never reach the phone.
for (const file of readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'))) {
  if (readFileSync(join(dist, 'assets', file), 'utf8').includes('date-holidays')) {
    throw new Error(`date-holidays found in ${file}`)
  }
}
if (kb > BUDGET_KB) {
  console.error(`Over budget by ${(kb - BUDGET_KB).toFixed(1)} KB`)
  process.exit(1)
}
