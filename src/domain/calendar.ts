/**
 * The delivery calendar: which dates of a month become meals for a person.
 *
 * Pure and free of I/O so the most error-prone rules of the product are tested in milliseconds.
 * The algorithm is specified once in specs/001-catering-meal-tracker/data-model.md.
 */
import {
  compareDates,
  datesInMonth,
  isoWeekday,
  parsePlainDate,
  type IsoWeekday,
  type PlainDate,
} from './plain-date'

export interface PlanMonthInput {
  /** First day of the month to plan. */
  month: PlainDate
  /** Contracted meals per month (default 20). */
  mealsPerMonth: number
  /** ISO weekdays that are delivery days (default Monday to Friday). */
  deliveryWeekdays: readonly IsoWeekday[]
  /** The person's first plan day; nothing is planned before it. */
  planStart: PlainDate
  /** The person's last plan day, or null while the plan continues. */
  planEnd: PlainDate | null
  /** Effective holidays (official minus suppressed plus custom). */
  holidays: ReadonlySet<PlainDate>
  /** Dates the household registered as extra deliveries (for example a Saturday). */
  exceptionalDates: ReadonlySet<PlainDate>
  /** Years for which holiday data exists. Planning outside it is refused. */
  holidayCoverage: { firstYear: number; lastYear: number }
}

export interface MonthPlan {
  month: PlainDate
  /** Every eligible delivery date in the month, ascending. */
  validDays: PlainDate[]
  /** The dates that become meals: the first `mealsPerMonth` valid days. */
  target: PlainDate[]
  /** Valid days beyond the contracted number; shown as "not part of the plan". */
  extra: PlainDate[]
  /** Contracted meals that cannot be placed on delivery days. Zero for partial months. */
  shortfall: number
  /** True when the start or end date cut the month, so no shortfall is expected. */
  isPartial: boolean
  /**
   * First day of the person's current plan window in this month. Meals before it belong to an
   * earlier period (someone who left and came back) and are never changed.
   */
  windowStart: PlainDate
  contracted: number
}

/** Thrown when a month falls outside the years that have holiday data. */
export class HolidayDataMissing extends Error {
  constructor(readonly year: number) {
    super(`No holiday data for year ${year}; generate it with "pnpm holidays:generate".`)
    this.name = 'HolidayDataMissing'
  }
}

export function planMonth(input: PlanMonthInput): MonthPlan {
  const { year, day } = parsePlainDate(input.month)
  if (day !== 1) throw new RangeError(`Month must be the first day of a month, got ${input.month}`)
  if (year < input.holidayCoverage.firstYear || year > input.holidayCoverage.lastYear) {
    throw new HolidayDataMissing(year)
  }

  const all = datesInMonth(input.month)
  const candidates = all.filter(
    (date) =>
      compareDates(date, input.planStart) >= 0 &&
      (input.planEnd === null || compareDates(date, input.planEnd) <= 0),
  )
  const isPartial = candidates.length < all.length

  const weekdays = new Set<number>(input.deliveryWeekdays)
  const validDays = candidates.filter((date) => {
    if (input.holidays.has(date)) return false // holidays are never delivery days, not even exceptional ones
    return weekdays.has(isoWeekday(date)) || input.exceptionalDates.has(date)
  })

  const target = validDays.slice(0, input.mealsPerMonth)
  const extra = validDays.slice(input.mealsPerMonth)
  const shortfall = isPartial ? 0 : Math.max(0, input.mealsPerMonth - validDays.length)

  return {
    month: input.month,
    validDays,
    target,
    extra,
    shortfall,
    isPartial,
    windowStart: candidates[0] ?? input.month,
    contracted: input.mealsPerMonth,
  }
}
