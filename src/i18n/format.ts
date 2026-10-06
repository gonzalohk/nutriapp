import type { IsoWeekday, PlainDate } from '@/domain/plain-date'
import { getLanguage } from './t'

// All formatting runs in UTC on a Y-M-D triple, so a date never shifts with the device timezone.
const locale = () => (getLanguage() === 'es' ? 'es-BO' : 'en-US')
const utc = (date: PlainDate) => new Date(`${date}T00:00:00Z`)

/** Only the first letter, so "octubre de 2026" becomes "Octubre de 2026" (CSS capitalize would also change "de"). */
const upperFirst = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1)

export function weekdayShort(weekday: IsoWeekday): string {
  // 2024-01-01 is a Monday, so day N of January 2024 has ISO weekday N for 1..7.
  return new Intl.DateTimeFormat(locale(), { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, weekday)),
  )
}

/** "octubre 2026" */
export function monthTitle(month: PlainDate): string {
  return upperFirst(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utc(month)))
}

/** "lunes, 5 de octubre" */
export function longDate(date: PlainDate): string {
  return upperFirst(new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(utc(date)))
}

/** "05/10" */
export function shortDate(date: PlainDate): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`
}
