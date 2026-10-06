import { compareDates, isWeekend, type PlainDate } from './plain-date'

export type NoMealReason = 'outside_plan' | 'holiday' | 'weekend' | 'no_delivery'

interface Input {
  date: PlainDate
  planStart: PlainDate
  planEnd: PlainDate | null
  /** Name of the holiday on that date, if any. */
  holidayName?: string
}

/** Why a person has no meal on a date, so the Today screen can say so instead of staying blank. */
export function noMealReason({ date, planStart, planEnd, holidayName }: Input): NoMealReason {
  if (compareDates(date, planStart) < 0) return 'outside_plan'
  if (planEnd && compareDates(date, planEnd) > 0) return 'outside_plan'
  if (holidayName !== undefined) return 'holiday'
  if (isWeekend(date)) return 'weekend'
  return 'no_delivery'
}
