/**
 * Generates the data migration with Bolivian public holidays.
 *   pnpm holidays:generate                       -> 2024-2045 into 0004_official_holidays.sql
 *   pnpm holidays:generate --from 2046 --to 2060 --out supabase/migrations/0100_official_holidays_2046_2060.sql
 * Run it again before the last covered year (2045) so the calendar never runs out of holiday data.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { buildHolidayMigration } from './holidays-lib'

const { values } = parseArgs({
  options: {
    from: { type: 'string', default: '2024' },
    to: { type: 'string', default: '2045' },
    out: { type: 'string', default: 'supabase/migrations/0004_official_holidays.sql' },
  },
})

const from = Number(values.from)
const to = Number(values.to)
if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) {
  throw new Error(`Invalid range ${values.from}-${values.to}`)
}

const target = join(import.meta.dirname, '..', values.out!)
writeFileSync(target, buildHolidayMigration(from, to))
console.log(`Wrote ${values.out} (${from}-${to})`)
