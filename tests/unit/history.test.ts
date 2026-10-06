import { describe, expect, it } from 'vitest'
import { summariesOfYear, yearsOf, type MonthSummary } from '@/domain/history'
import { toPlainDate } from '@/domain/plain-date'

const row = (month: string, over: Partial<MonthSummary> = {}): MonthSummary => ({
  month: toPlainDate(month), contracted: 20, scheduled: 20, pickedUp: 18, cancelled: 1, notPickedUp: 0, permission: 1,
  pending: 0, automaticNotPickedUp: 0, photos: 10, isConsistent: true, needsReview: false, isPartial: false, ...over,
})

describe('history grouping', () => {
  const rows = [row('2027-01-01'), row('2026-03-01'), row('2026-12-01'), row('2026-01-01'), row('2025-12-01')]

  it('lists the years that have data, newest first, and always includes the current year', () => {
    expect(yearsOf(rows, 2026)).toEqual([2027, 2026, 2025])
    expect(yearsOf([], 2026)).toEqual([2026])
    expect(yearsOf([row('2024-05-01')], 2026)).toEqual([2026, 2024])
  })

  it('returns one year\'s months in calendar order (January first)', () => {
    expect(summariesOfYear(rows, 2026).map((r) => r.month)).toEqual(['2026-01-01', '2026-03-01', '2026-12-01'])
  })

  it('keeps December and the following January in their own years (year change)', () => {
    expect(summariesOfYear(rows, 2025).map((r) => r.month)).toEqual(['2025-12-01'])
    expect(summariesOfYear(rows, 2027).map((r) => r.month)).toEqual(['2027-01-01'])
  })

  it('returns nothing for a year without data and does not mutate its input', () => {
    const copy = [...rows]
    expect(summariesOfYear(rows, 2030)).toEqual([])
    expect(rows).toEqual(copy)
  })
})
