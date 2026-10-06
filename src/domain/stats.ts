import { effectiveStatus, type MealStatus } from './meal-status'
import type { PlainDate } from './plain-date'

export interface StatMeal {
  date: PlainDate
  /** The stored status; a past `scheduled` meal is counted as an automatic "not picked up". */
  status: MealStatus
  hasPhoto: boolean
}

export interface Counters {
  pickedUp: number
  cancelled: number
  notPickedUp: number
  permission: number
  /** Meals dated today or later that nobody has recorded yet. */
  pending: number
}

export type StatsWarning =
  | { kind: 'shortfall'; scheduled: number; contracted: number }
  | { kind: 'excess'; scheduled: number; contracted: number }
  | { kind: 'inconsistent'; sum: number; scheduled: number }

export interface MonthStats extends Counters {
  contracted: number
  scheduledTotal: number
  /** Part of `notPickedUp` that is automatic (nobody recorded the meal and its day passed). */
  automaticNotPickedUp: number
  photos: number
  pickedUpPercent: number
  isConsistent: boolean
  warnings: StatsWarning[]
}

export function sumCounters(c: Counters): number {
  return c.pickedUp + c.cancelled + c.notPickedUp + c.permission + c.pending
}

/** picked up + cancelled + not picked up + permission + pending must equal the scheduled meals (RULE-015). */
export function countersAreConsistent(counters: Counters, scheduledTotal: number): boolean {
  return sumCounters(counters) === scheduledTotal
}

interface Input {
  meals: readonly StatMeal[]
  contracted: number
  /** First or last month of a plan: fewer meals than contracted is expected, so no shortfall warning. */
  isPartial: boolean
  today: PlainDate
}

export function computeStats({ meals, contracted, isPartial, today }: Input): MonthStats {
  const counters: Counters = { pickedUp: 0, cancelled: 0, notPickedUp: 0, permission: 0, pending: 0 }
  let automaticNotPickedUp = 0
  let photos = 0

  for (const meal of meals) {
    if (meal.hasPhoto) photos++
    const { status, isAutomatic } = effectiveStatus(meal.status, meal.date, today)
    if (isAutomatic) automaticNotPickedUp++
    switch (status) {
      case 'picked_up': counters.pickedUp++; break
      case 'cancelled': counters.cancelled++; break
      case 'not_picked_up': counters.notPickedUp++; break
      case 'permission': counters.permission++; break
      case 'scheduled': counters.pending++; break
    }
  }

  const scheduledTotal = meals.length
  const isConsistent = countersAreConsistent(counters, scheduledTotal)
  const warnings: StatsWarning[] = []
  if (!isConsistent) warnings.push({ kind: 'inconsistent', sum: sumCounters(counters), scheduled: scheduledTotal })
  if (!isPartial && scheduledTotal < contracted) warnings.push({ kind: 'shortfall', scheduled: scheduledTotal, contracted })
  if (!isPartial && scheduledTotal > contracted) warnings.push({ kind: 'excess', scheduled: scheduledTotal, contracted })

  return {
    ...counters,
    contracted,
    scheduledTotal,
    automaticNotPickedUp,
    photos,
    pickedUpPercent: scheduledTotal === 0 ? 0 : Math.round((counters.pickedUp / scheduledTotal) * 100),
    isConsistent,
    warnings,
  }
}
