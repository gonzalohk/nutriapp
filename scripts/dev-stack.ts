/**
 * Runs the whole backend on this computer without Docker: a real PostgreSQL with the project
 * migrations, a real PostgREST, and a small stand-in for Supabase Auth and Storage. Creates the demo
 * household on start. DEVELOPMENT ONLY (data is lost when it stops).
 *
 *   pnpm integration:setup   # once, downloads PostgREST
 *   pnpm dev:stack           # then, in another terminal: pnpm dev
 *   DEV_STACK_EMPTY=1 pnpm dev:stack   # no demo data (to try the first-run setup)
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { startStack } from '../tests/integration/stack'
import { signJwt, startDevApi } from '../tools/dev-stack/auth-storage'
import { addMonths, monthStart } from '../src/domain/plain-date'
import { todayInBolivia } from '../src/domain/bolivia-time'

const API_PORT = Number(process.env.DEV_STACK_PORT ?? 54321)
const stack = await startStack({ proxy: false })
const anonKey = signJwt(stack.jwtSecret, { role: 'anon' }, 60 * 60 * 24 * 365)
const server = await startDevApi({ port: API_PORT, restPort: stack.restPort, jwtSecret: stack.jwtSecret, db: stack.db })
const url = `http://localhost:${API_PORT}`

const email = 'demo@nutrilara.local'
const password = 'demo-password-123'

// Demo household, created through the public API like a real user would.
if (!process.env.DEV_STACK_EMPTY) {
  const app = createClient(url, anonKey, { auth: { persistSession: false } })
  const signUp = await app.auth.signUp({ email, password })
  if (signUp.error) throw signUp.error
  const household = await app.rpc('create_household', { p_name: 'Casa Demo', p_display_name: 'Demo' })
  if (household.error) throw household.error
  const start = addMonths(monthStart(todayInBolivia()), -2)
  for (const name of ['Gonzalo', 'Esposa', 'Hijo', 'Hija']) {
    const r = await app.rpc('create_person', { p_first_name: name, p_last_name: '', p_plan_start: start, p_meals_per_month: 20 })
    if (r.error) throw r.error
  }
}

writeFileSync(
  join(import.meta.dirname, '..', '.env.local'),
  `# Written by pnpm dev:stack (local development stack)\nVITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${anonKey}\n`,
)
console.log(`\nLocal stack ready:\n  API      ${url}\n  Postgres postgres://postgres:postgres@127.0.0.1:${stack.pgPort}/app\n  ${process.env.DEV_STACK_EMPTY ? 'Empty: sign up and create the household in the app' : `Sign in  ${email} / ${password}`}\n  .env.local written. Now run: pnpm dev\n`)

const stop = async () => {
  server.close()
  await stack.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
