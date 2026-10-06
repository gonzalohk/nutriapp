import { useQueries } from '@tanstack/react-query'
import { ensureMonthQuery } from '@/data/ensure'
import { usePeople } from '@/data/queries'
import { todayInBolivia } from '@/domain/bolivia-time'
import { addMonths } from '@/domain/plain-date'

/**
 * Makes sure every active person has meals for the current and the next month as soon as the app
 * opens, so Today is never empty on the first day of a month.
 */
export function EnsureCurrentMonths() {
  const people = usePeople()
  const today = todayInBolivia()
  const active = (people.data ?? []).filter((p) => p.active)
  useQueries({
    queries: active.flatMap((p) => [0, 1].map((i) => ensureMonthQuery(p, addMonths(today, i)))),
  })
  return null
}
