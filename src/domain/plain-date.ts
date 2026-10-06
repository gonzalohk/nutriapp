/**
 * Calendar dates without a time or a timezone.
 *
 * A meal belongs to a calendar date, not to an instant, so dates are plain `YYYY-MM-DD` strings
 * and all arithmetic goes through UTC components of a Y-M-D triple. `Date` objects built from
 * local time are never used here, which keeps every result identical in any device timezone.
 */

export type PlainDate = string & { readonly __brand: 'PlainDate' }

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export interface Ymd {
  year: number
  month: number
  day: number
}

function utcMs({ year, month, day }: Ymd): number {
  return Date.UTC(year, month - 1, day)
}

function fromMs(ms: number): PlainDate {
  const d = new Date(ms)
  return plainDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function plainDate(year: number, month: number, day: number): PlainDate {
  const s = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return s as PlainDate
}

export function isValidPlainDate(value: string): value is PlainDate {
  const m = PATTERN.exec(value)
  if (!m) return false
  const ymd = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
  const d = new Date(utcMs(ymd))
  return d.getUTCFullYear() === ymd.year && d.getUTCMonth() + 1 === ymd.month && d.getUTCDate() === ymd.day
}

export function parsePlainDate(value: string): Ymd {
  if (!isValidPlainDate(value)) throw new RangeError(`Invalid plain date: ${value}`)
  const m = PATTERN.exec(value)!
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

export function toPlainDate(value: string): PlainDate {
  parsePlainDate(value)
  return value as PlainDate
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addDays(date: PlainDate, days: number): PlainDate {
  return fromMs(utcMs(parsePlainDate(date)) + days * 86_400_000)
}

/** First day of the month containing `date`. */
export function monthStart(date: PlainDate): PlainDate {
  const { year, month } = parsePlainDate(date)
  return plainDate(year, month, 1)
}

/** Last day of the month containing `date`. */
export function monthEnd(date: PlainDate): PlainDate {
  const { year, month } = parsePlainDate(date)
  return plainDate(year, month, daysInMonth(year, month))
}

/** First day of the month `months` away from the month containing `date` (negative = earlier). */
export function addMonths(date: PlainDate, months: number): PlainDate {
  const { year, month } = parsePlainDate(date)
  const index = year * 12 + (month - 1) + months
  return plainDate(Math.floor(index / 12), (index % 12) + 1, 1)
}

/** Every date of the month containing `date`, in ascending order. */
export function datesInMonth(date: PlainDate): PlainDate[] {
  const { year, month } = parsePlainDate(date)
  const count = daysInMonth(year, month)
  return Array.from({ length: count }, (_, i) => plainDate(year, month, i + 1))
}

export function isoWeekday(date: PlainDate): IsoWeekday {
  const jsDay = new Date(utcMs(parsePlainDate(date))).getUTCDay() // 0 = Sunday
  return (jsDay === 0 ? 7 : jsDay) as IsoWeekday
}

export function isWeekend(date: PlainDate): boolean {
  return isoWeekday(date) >= 6
}

/** ISO strings sort chronologically, so plain string comparison is correct. */
export function compareDates(a: PlainDate, b: PlainDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function yearOf(date: PlainDate): number {
  return parsePlainDate(date).year
}

/** `YYYY-MM` key for a month, handy for routes and storage paths. */
export function monthKey(date: PlainDate): string {
  return date.slice(0, 7)
}

export function monthFromKey(key: string): PlainDate {
  return toPlainDate(`${key}-01`)
}
