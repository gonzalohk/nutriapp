import { describe, expect, it } from 'vitest'
import { planMonth } from '@/domain/calendar'
import { addMonths, isoWeekday, plainDate, toPlainDate } from '@/domain/plain-date'
import { COVERAGE, holidaySet } from './helpers/holidays'

const HOLIDAYS = holidaySet(2024, 2045)

describe('calendar sweep over ten-plus years (spec SC-002)', () => {
  it('never generates a meal on a weekend or a holiday, for any month from 2024 to 2035', () => {
    let month = toPlainDate('2024-01-01')
    let checked = 0
    for (let i = 0; i < 12 * 12; i++) {
      for (const mealsPerMonth of [10, 20, 25]) {
        const plan = planMonth({
          month,
          mealsPerMonth,
          deliveryWeekdays: [1, 2, 3, 4, 5],
          planStart: toPlainDate('2024-01-01'),
          planEnd: null,
          holidays: HOLIDAYS,
          exceptionalDates: new Set(),
          holidayCoverage: COVERAGE,
        })
        for (const day of plan.target) {
          expect(isoWeekday(day), day).toBeLessThanOrEqual(5)
          expect(HOLIDAYS.has(day), day).toBe(false)
          checked++
        }
        expect(plan.target.length).toBeLessThanOrEqual(mealsPerMonth)
        expect(plan.target.length + plan.extra.length).toBe(plan.validDays.length)
      }
      month = addMonths(month, 1)
    }
    expect(checked).toBeGreaterThan(2000)
  })

  it('only allows a weekend date when it was registered as exceptional', () => {
    const saturday = plainDate(2026, 2, 7)
    const plan = planMonth({
      month: toPlainDate('2026-02-01'),
      mealsPerMonth: 20,
      deliveryWeekdays: [1, 2, 3, 4, 5],
      planStart: toPlainDate('2024-01-01'),
      planEnd: null,
      holidays: HOLIDAYS,
      exceptionalDates: new Set([saturday]),
      holidayCoverage: COVERAGE,
    })
    const weekends = plan.target.filter((day) => isoWeekday(day) >= 6)
    expect(weekends).toEqual([saturday])
  })
})
