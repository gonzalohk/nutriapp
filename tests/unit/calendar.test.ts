import { describe, expect, it } from 'vitest'
import { HolidayDataMissing, planMonth, type PlanMonthInput } from '@/domain/calendar'
import { isoWeekday, toPlainDate } from '@/domain/plain-date'
import { COVERAGE, holidaySet } from './helpers/holidays'

const d = toPlainDate
const HOLIDAYS = holidaySet(2024, 2046)

function input(month: string, overrides: Partial<PlanMonthInput> = {}): PlanMonthInput {
  return {
    month: d(month),
    mealsPerMonth: 20,
    deliveryWeekdays: [1, 2, 3, 4, 5],
    planStart: d('2024-01-01'),
    planEnd: null,
    holidays: HOLIDAYS,
    exceptionalDates: new Set(),
    holidayCoverage: COVERAGE,
    ...overrides,
  }
}

describe('planMonth: delivery days', () => {
  it('uses Monday to Friday only', () => {
    const plan = planMonth(input('2026-10-01'))
    expect(plan.validDays.every((day) => isoWeekday(day) <= 5)).toBe(true)
  })

  it('never includes Saturday or Sunday', () => {
    const plan = planMonth(input('2026-10-01'))
    expect(plan.validDays).not.toContain('2026-10-03')
    expect(plan.validDays).not.toContain('2026-10-04')
  })

  it('excludes a holiday that falls on a weekday (Carnival, Feb 2026)', () => {
    const plan = planMonth(input('2026-02-01'))
    expect(plan.validDays).not.toContain('2026-02-16')
    expect(plan.validDays).not.toContain('2026-02-17')
  })

  it('excludes Corpus Christi and the shifted New Year holiday (Jun 2026)', () => {
    const plan = planMonth(input('2026-06-01'))
    expect(plan.validDays).not.toContain('2026-06-04')
    expect(plan.validDays).not.toContain('2026-06-22')
  })

  it('honours custom delivery weekdays (Monday to Wednesday)', () => {
    const plan = planMonth(input('2026-10-01', { deliveryWeekdays: [1, 2, 3] }))
    expect(plan.validDays.every((day) => isoWeekday(day) <= 3)).toBe(true)
  })
})

describe('planMonth: matching the contracted number', () => {
  it('creates exactly 20 meals when there are exactly 20 valid days (Jun 2026)', () => {
    const plan = planMonth(input('2026-06-01'))
    expect(plan.validDays).toHaveLength(20)
    expect(plan.target).toEqual(plan.validDays)
    expect(plan.extra).toEqual([])
    expect(plan.shortfall).toBe(0)
  })

  it('takes the first 20 when there are more (Oct 2026: 22 weekdays, 1-28 Oct)', () => {
    const plan = planMonth(input('2026-10-01'))
    expect(plan.validDays).toHaveLength(22)
    expect(plan.target).toHaveLength(20)
    expect(plan.target[0]).toBe('2026-10-01')
    expect(plan.target.at(-1)).toBe('2026-10-28')
    expect(plan.extra).toEqual(['2026-10-29', '2026-10-30'])
    expect(plan.shortfall).toBe(0)
  })

  it('generates only the valid days and reports the shortfall when fewer (Feb 2026: 18)', () => {
    const plan = planMonth(input('2026-02-01'))
    expect(plan.validDays).toHaveLength(18)
    expect(plan.target).toHaveLength(18)
    expect(plan.shortfall).toBe(2)
    expect(plan.isPartial).toBe(false)
  })

  it('reports a shortfall of 1 for January 2027 (19 valid days, 1 Jan and 22 Jan are holidays)', () => {
    const plan = planMonth(input('2027-01-01'))
    expect(plan.validDays).toHaveLength(19)
    expect(plan.shortfall).toBe(1)
  })

  it('respects a different number of meals (25 asks for more days than exist)', () => {
    const plan = planMonth(input('2026-10-01', { mealsPerMonth: 25 }))
    expect(plan.target).toHaveLength(22)
    expect(plan.shortfall).toBe(3)
  })

  it('respects a smaller plan (10 meals)', () => {
    const plan = planMonth(input('2026-10-01', { mealsPerMonth: 10 }))
    expect(plan.target).toHaveLength(10)
    expect(plan.extra).toHaveLength(12)
  })

  it('verified examples across 2026 match independent counts', () => {
    const counts: Record<string, number> = {
      '2026-03-01': 22, '2026-04-01': 21, '2026-05-01': 20, '2026-11-01': 20, '2026-12-01': 22,
    }
    for (const [month, expected] of Object.entries(counts)) {
      expect(planMonth(input(month)).validDays, month).toHaveLength(expected)
    }
  })
})

describe('planMonth: exceptional delivery dates', () => {
  it('makes an exceptional Saturday eligible and fills the shortfall', () => {
    const plan = planMonth(input('2026-02-01', { exceptionalDates: new Set([d('2026-02-07')]) }))
    expect(plan.validDays).toContain('2026-02-07')
    expect(plan.validDays).toHaveLength(19)
    expect(plan.shortfall).toBe(1)
  })

  it('never makes a holiday eligible, even if marked exceptional', () => {
    const plan = planMonth(input('2026-02-01', { exceptionalDates: new Set([d('2026-02-16')]) }))
    expect(plan.validDays).not.toContain('2026-02-16')
  })

  it('keeps a Saturday out when it is not exceptional', () => {
    expect(planMonth(input('2026-02-01')).validDays).not.toContain('2026-02-07')
  })
})

describe('planMonth: partial months', () => {
  it('starts at the plan start date and flags the month as partial with no shortfall', () => {
    const plan = planMonth(input('2026-10-01', { planStart: d('2026-10-15') }))
    expect(plan.isPartial).toBe(true)
    expect(plan.target[0]).toBe('2026-10-15')
    expect(plan.validDays).toHaveLength(12) // Oct 15,16,19-23,26-30
    expect(plan.shortfall).toBe(0)
  })

  it('stops at the plan end date', () => {
    const plan = planMonth(input('2026-10-01', { planEnd: d('2026-10-09') }))
    expect(plan.isPartial).toBe(true)
    expect(plan.target.at(-1)).toBe('2026-10-09')
    expect(plan.target).toHaveLength(7)
  })

  it('reports where the plan window starts so earlier meals can be left alone', () => {
    expect(planMonth(input('2026-10-01', { planStart: d('2026-10-26') })).windowStart).toBe('2026-10-26')
    expect(planMonth(input('2026-10-01')).windowStart).toBe('2026-10-01')
  })

  it('returns no meals before the plan starts', () => {
    const plan = planMonth(input('2026-09-01', { planStart: d('2026-10-15') }))
    expect(plan.target).toEqual([])
    expect(plan.isPartial).toBe(true)
  })

  it('is not partial when the plan started before the month', () => {
    expect(planMonth(input('2026-10-01', { planStart: d('2026-01-05') })).isPartial).toBe(false)
  })
})

describe('planMonth: year change and coverage', () => {
  it('excludes 1 January and handles December to January', () => {
    const dec = planMonth(input('2026-12-01'))
    expect(dec.validDays).not.toContain('2026-12-25')
    const jan = planMonth(input('2027-01-01'))
    expect(jan.validDays).not.toContain('2027-01-01')
    expect(jan.target[0]).toBe('2027-01-04')
  })

  it('refuses to plan a month outside the holiday coverage instead of guessing', () => {
    expect(() => planMonth(input('2046-01-01'))).toThrow(HolidayDataMissing)
    expect(() => planMonth(input('2023-12-01'))).toThrow(HolidayDataMissing)
  })

  it('accepts the first and last covered years', () => {
    expect(() => planMonth(input('2024-01-01'))).not.toThrow()
    expect(() => planMonth(input('2045-12-01'))).not.toThrow()
  })

  it('rejects a month that is not the first day of a month', () => {
    expect(() => planMonth(input('2026-10-15'))).toThrow(RangeError)
  })
})
