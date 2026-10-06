import { describe, expect, it } from 'vitest'
import { noMealReason } from '@/domain/no-meal-reason'
import { toPlainDate } from '@/domain/plain-date'

const d = toPlainDate
const base = { planStart: d('2026-01-01'), planEnd: null }

describe('noMealReason', () => {
  it('explains a weekend', () => {
    expect(noMealReason({ ...base, date: d('2026-10-03') })).toBe('weekend')
  })
  it('explains a holiday on a weekday', () => {
    expect(noMealReason({ ...base, date: d('2026-02-16'), holidayName: 'Lunes de Carnaval' })).toBe('holiday')
  })
  it('explains a date before the plan starts or after it ends', () => {
    expect(noMealReason({ date: d('2025-12-31'), planStart: d('2026-01-01'), planEnd: null })).toBe('outside_plan')
    expect(noMealReason({ date: d('2026-06-01'), planStart: d('2026-01-01'), planEnd: d('2026-05-31') })).toBe('outside_plan')
  })
  it('prefers "outside the plan" over a holiday or weekend', () => {
    expect(noMealReason({ date: d('2025-12-25'), holidayName: 'Navidad', planStart: d('2026-01-01'), planEnd: null })).toBe('outside_plan')
  })
  it('falls back to "no delivery" for a weekday that is not part of the plan', () => {
    expect(noMealReason({ ...base, date: d('2026-10-30') })).toBe('no_delivery')
  })
})
