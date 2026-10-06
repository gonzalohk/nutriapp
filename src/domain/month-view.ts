import type { MealStatus } from './meal-status'
import { datesInMonth, isoWeekday, type IsoWeekday, type PlainDate } from './plain-date'

export interface MonthMeal {
  id: string
  date: PlainDate
  mealNo: number
  status: MealStatus
  /** Status as the user should see it (a past `scheduled` meal is an automatic "not picked up"). */
  effectiveStatus: MealStatus
  isAutomatic: boolean
  hasPhoto: boolean
}

export type DayCell =
  /** Empty cell that aligns the first week to Monday. */
  | { kind: 'padding' }
  | { kind: 'meal'; date: PlainDate; day: number; meal: MonthMeal }
  | { kind: 'holiday'; date: PlainDate; day: number; holidayName: string }
  | { kind: 'weekend'; date: PlainDate; day: number }
  /** A valid delivery day beyond the contracted number: "not part of the plan". */
  | { kind: 'extra'; date: PlainDate; day: number }
  /** A weekday with no meal (outside the plan window or not a delivery weekday). */
  | { kind: 'off'; date: PlainDate; day: number }

interface BuildInput {
  month: PlainDate
  meals: readonly MonthMeal[]
  holidays: ReadonlyMap<PlainDate, string>
  extraDays: readonly PlainDate[]
}

/** Lay a month out as a Monday-first grid of cells. */
export function buildCalendarCells({ month, meals, holidays, extraDays }: BuildInput): DayCell[] {
  const mealByDate = new Map(meals.map((m) => [m.date, m]))
  const extra = new Set(extraDays)
  const days = datesInMonth(month)
  const leading = (isoWeekday(days[0]!) - 1) as number
  const cells: DayCell[] = Array.from({ length: leading }, () => ({ kind: 'padding' as const }))

  for (const date of days) {
    const day = Number(date.slice(8, 10))
    const meal = mealByDate.get(date)
    const holidayName = holidays.get(date)
    if (meal) cells.push({ kind: 'meal', date, day, meal })
    else if (holidayName !== undefined) cells.push({ kind: 'holiday', date, day, holidayName })
    else if (isoWeekday(date) >= 6) cells.push({ kind: 'weekend', date, day })
    else if (extra.has(date)) cells.push({ kind: 'extra', date, day })
    else cells.push({ kind: 'off', date, day })
  }
  return cells
}

export const WEEKDAY_ORDER: readonly IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]
