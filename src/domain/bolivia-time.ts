import { type PlainDate, toPlainDate } from './plain-date'

/** Bolivia is UTC-4 all year (no daylight saving). Every "today" and month boundary uses it. */
export const BOLIVIA_TIMEZONE = 'America/La_Paz'

const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: BOLIVIA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The current calendar date in Bolivia, regardless of the device timezone. */
export function todayInBolivia(now: Date = new Date()): PlainDate {
  const parts = Object.fromEntries(dateParts.formatToParts(now).map((p) => [p.type, p.value]))
  return toPlainDate(`${parts.year}-${parts.month}-${parts.day}`)
}

/** Format an instant (ISO timestamp) for display in Bolivia time, e.g. "03/10/2026 14:05". */
export function formatBoliviaDateTime(instant: string | Date, locale = 'es-BO'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: BOLIVIA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(typeof instant === 'string' ? new Date(instant) : instant)
}
