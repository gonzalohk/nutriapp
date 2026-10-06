import { describe, expect, it } from 'vitest'
import { planMonth } from '@/domain/calendar'
import { reconcileSummary, type ExistingMeal } from '@/domain/reconcile'
import { toPlainDate } from '@/domain/plain-date'
import { COVERAGE, holidaySet } from './helpers/holidays'

const d = toPlainDate
const meal = (date: string, status: ExistingMeal['status'] = 'scheduled'): ExistingMeal => ({ date: d(date), status })

describe('reconcileSummary', () => {
  it('removes only scheduled meals that left the plan, adds missing days, and flags recorded ones', () => {
    const existing = [meal('2026-10-05'), meal('2026-10-06', 'picked_up'), meal('2026-10-07'), meal('2026-10-08', 'cancelled')]
    const target = [d('2026-10-05'), d('2026-10-09')]
    expect(reconcileSummary(existing, target)).toEqual({
      remove: ['2026-10-07'],
      add: ['2026-10-09'],
      keptFlagged: ['2026-10-06', '2026-10-08'],
      unchanged: 1,
      hasChanges: true,
    })
  })

  it('reports no changes when the stored meals already match', () => {
    const existing = [meal('2026-10-05'), meal('2026-10-06', 'permission')]
    const s = reconcileSummary(existing, [d('2026-10-05'), d('2026-10-06')])
    expect(s).toMatchObject({ remove: [], add: [], keptFlagged: [], unchanged: 2, hasChanges: false })
  })

  it('adding a holiday on a day with a scheduled meal removes it and the next valid day takes its place (Oct 2026)', () => {
    const base = { month: d('2026-10-01'), mealsPerMonth: 20, deliveryWeekdays: [1, 2, 3, 4, 5] as const, planStart: d('2024-01-01'), planEnd: null, exceptionalDates: new Set<never>(), holidayCoverage: COVERAGE }
    const before = planMonth({ ...base, holidays: holidaySet(2024, 2045) })
    const existing = before.target.map((date) => ({ date, status: 'scheduled' as const }))
    const withHoliday = new Set(holidaySet(2024, 2045)).add(d('2026-10-14'))
    const after = planMonth({ ...base, holidays: withHoliday })
    expect(reconcileSummary(existing, after.target)).toMatchObject({ remove: ['2026-10-14'], add: ['2026-10-29'], keptFlagged: [], hasChanges: true })
  })

  it('adding a holiday on a day with a recorded meal keeps it, flagged for review', () => {
    const existing = [meal('2026-10-14', 'picked_up'), meal('2026-10-15')]
    expect(reconcileSummary(existing, [d('2026-10-15')])).toMatchObject({ remove: [], keptFlagged: ['2026-10-14'] })
  })

  it('ignores meals before the plan window: they belong to an earlier period', () => {
    const existing = [meal('2026-10-15'), meal('2026-10-16', 'picked_up'), meal('2026-10-27')]
    const s = reconcileSummary(existing, [d('2026-10-26'), d('2026-10-27')], d('2026-10-26'))
    expect(s).toMatchObject({ remove: [], keptFlagged: [], add: ['2026-10-26'], unchanged: 1 })
  })

  it('never lists a date twice and returns dates in order', () => {
    const s = reconcileSummary([meal('2026-10-09'), meal('2026-10-07')], [d('2026-10-12'), d('2026-10-08'), d('2026-10-08')])
    expect(s.remove).toEqual(['2026-10-07', '2026-10-09'])
    expect(s.add).toEqual(['2026-10-08', '2026-10-12'])
  })
})
