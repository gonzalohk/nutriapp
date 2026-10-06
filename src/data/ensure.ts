import type { UseQueryOptions } from '@tanstack/react-query'
import { monthKey, type PlainDate } from '@/domain/plain-date'
import { ensureMonthPlan } from './mutations'
import type { Person } from './types'

export const ENSURE_KEY = 'ensure'

/**
 * Query that makes sure a person's month exists. Running it as a query dedupes the work across
 * screens and remembers it for a while; it is invalidated whenever holidays, delivery days or
 * plan terms change.
 */
export function ensureMonthQuery(person: Person, month: PlainDate): UseQueryOptions<string | null> {
  return {
    queryKey: [ENSURE_KEY, person.id, monthKey(month)],
    queryFn: () => ensureMonthPlan(person, month),
    staleTime: 1000 * 60 * 60 * 6,
    retry: 1,
  }
}
