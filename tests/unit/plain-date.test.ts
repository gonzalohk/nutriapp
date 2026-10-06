import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  compareDates,
  datesInMonth,
  daysInMonth,
  isoWeekday,
  isValidPlainDate,
  isWeekend,
  monthEnd,
  monthKey,
  monthStart,
  parsePlainDate,
  toPlainDate,
} from '@/domain/plain-date'

const d = toPlainDate

describe('plain-date', () => {
  it('validates real calendar dates only', () => {
    expect(isValidPlainDate('2026-10-01')).toBe(true)
    expect(isValidPlainDate('2024-02-29')).toBe(true)
    expect(isValidPlainDate('2026-02-29')).toBe(false)
    expect(isValidPlainDate('2026-13-01')).toBe(false)
    expect(isValidPlainDate('2026-1-1')).toBe(false)
    expect(isValidPlainDate('not a date')).toBe(false)
    expect(() => parsePlainDate('2026-02-30')).toThrow(RangeError)
  })

  it('knows month lengths including leap years', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2100, 2)).toBe(28)
    expect(daysInMonth(2000, 2)).toBe(29)
    expect(daysInMonth(2026, 10)).toBe(31)
  })

  it('computes ISO weekdays: 2026-10-01 is a Thursday', () => {
    expect(isoWeekday(d('2026-10-01'))).toBe(4)
    expect(isoWeekday(d('2026-10-03'))).toBe(6)
    expect(isoWeekday(d('2026-10-04'))).toBe(7)
    expect(isoWeekday(d('2026-10-05'))).toBe(1)
    expect(isWeekend(d('2026-10-03'))).toBe(true)
    expect(isWeekend(d('2026-10-02'))).toBe(false)
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01')
    expect(addDays(d('2027-01-01'), -1)).toBe('2026-12-31')
    expect(addDays(d('2024-02-28'), 1)).toBe('2024-02-29')
    expect(addDays(d('2024-02-28'), 2)).toBe('2024-03-01')
    expect(addDays(d('2026-10-01'), 0)).toBe('2026-10-01')
  })

  it('adds months and always returns the first of the month', () => {
    expect(addMonths(d('2026-12-15'), 1)).toBe('2027-01-01')
    expect(addMonths(d('2027-01-31'), -1)).toBe('2026-12-01')
    expect(addMonths(d('2026-01-01'), -1)).toBe('2025-12-01')
    expect(addMonths(d('2026-10-20'), 0)).toBe('2026-10-01')
    expect(addMonths(d('2026-10-20'), 15)).toBe('2028-01-01')
  })

  it('finds month start and end', () => {
    expect(monthStart(d('2026-10-17'))).toBe('2026-10-01')
    expect(monthEnd(d('2026-02-03'))).toBe('2026-02-28')
    expect(monthEnd(d('2024-02-03'))).toBe('2024-02-29')
  })

  it('lists every date of a month', () => {
    const days = datesInMonth(d('2026-02-10'))
    expect(days).toHaveLength(28)
    expect(days[0]).toBe('2026-02-01')
    expect(days.at(-1)).toBe('2026-02-28')
  })

  it('compares chronologically', () => {
    expect(compareDates(d('2026-01-31'), d('2026-02-01'))).toBe(-1)
    expect(compareDates(d('2027-01-01'), d('2026-12-31'))).toBe(1)
    expect(compareDates(d('2026-10-01'), d('2026-10-01'))).toBe(0)
  })

  it('builds month keys', () => {
    expect(monthKey(d('2026-10-17'))).toBe('2026-10')
  })

  it('is stable over a whole decade (no drift from local time)', () => {
    let cursor = d('2024-01-01')
    let weekdays = 0
    for (let i = 0; i < 3653; i++) {
      if (!isWeekend(cursor)) weekdays++
      cursor = addDays(cursor, 1)
    }
    expect(cursor).toBe('2034-01-01')
    expect(weekdays).toBe(2610) // cross-checked with Python datetime
  })
})
