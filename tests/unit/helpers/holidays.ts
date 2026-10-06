import { bolivianPublicHolidays } from '../../../scripts/holidays-lib'
import { toPlainDate, type PlainDate } from '@/domain/plain-date'

/** Bolivian public holidays for a range of years, as the set the calendar module receives. */
export function holidaySet(fromYear: number, toYear: number): Set<PlainDate> {
  const out = new Set<PlainDate>()
  for (let y = fromYear; y <= toYear; y++) {
    for (const h of bolivianPublicHolidays(y)) out.add(toPlainDate(h.date))
  }
  return out
}

export const COVERAGE = { firstYear: 2024, lastYear: 2045 } as const
