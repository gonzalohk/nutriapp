import type { MealStatus } from './meal-status'
import { compareDates, type PlainDate } from './plain-date'

export interface ExistingMeal {
  date: PlainDate
  /** Stored status (not the derived "automatic" one). */
  status: MealStatus
}

export interface ReconcileSummary {
  /** Scheduled meals that no longer fit and will be removed. */
  remove: PlainDate[]
  /** Valid days that will get a new meal. */
  add: PlainDate[]
  /** Recorded meals on days that no longer fit: kept, and the month is flagged for review. */
  keptFlagged: PlainDate[]
  unchanged: number
  hasChanges: boolean
}

const sortedUnique = (dates: Iterable<PlainDate>) => [...new Set(dates)].sort(compareDates)

/**
 * What applying a new delivery calendar to a month would do. Mirrors the database function
 * `apply_month_plan`: only still-scheduled meals are ever removed, recorded ones are never touched.
 */
export function reconcileSummary(
  existing: readonly ExistingMeal[],
  target: readonly PlainDate[],
  /** Meals before this date belong to an earlier plan period and are ignored. */
  windowStart?: PlainDate,
): ReconcileSummary {
  const inWindow = (m: ExistingMeal) => windowStart === undefined || compareDates(m.date, windowStart) >= 0
  const wanted = new Set(target)
  const have = new Set(existing.map((m) => m.date))
  const remove = sortedUnique(existing.filter((m) => inWindow(m) && m.status === 'scheduled' && !wanted.has(m.date)).map((m) => m.date))
  const keptFlagged = sortedUnique(existing.filter((m) => inWindow(m) && m.status !== 'scheduled' && !wanted.has(m.date)).map((m) => m.date))
  const add = sortedUnique(target.filter((date) => !have.has(date)))
  const unchanged = existing.filter((m) => inWindow(m) && wanted.has(m.date)).length
  return { remove, add, keptFlagged, unchanged, hasChanges: remove.length + add.length + keptFlagged.length > 0 }
}
