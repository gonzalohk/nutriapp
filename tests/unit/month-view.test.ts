import { describe, expect, it } from 'vitest'
import { buildCalendarCells, type MonthMeal } from '@/domain/month-view'
import { toPlainDate } from '@/domain/plain-date'

const d = toPlainDate
const meal = (date: string, mealNo: number): MonthMeal => ({
  id: `m${mealNo}`, date: d(date), mealNo, status: 'scheduled', effectiveStatus: 'scheduled', isAutomatic: false, hasPhoto: false,
})

describe('buildCalendarCells', () => {
  const holidays = new Map([[d('2026-02-16'), 'Lunes de Carnaval']])

  it('aligns the first week to Monday (Oct 2026 starts on a Thursday)', () => {
    const cells = buildCalendarCells({ month: d('2026-10-01'), meals: [], holidays: new Map(), extraDays: [] })
    expect(cells.slice(0, 3).every((c) => c.kind === 'padding')).toBe(true)
    expect(cells[3]).toMatchObject({ kind: 'off', day: 1 })
    expect(cells).toHaveLength(3 + 31)
  })

  it('marks weekends, holidays, meals and extra days distinctly', () => {
    const cells = buildCalendarCells({
      month: d('2026-02-01'),
      meals: [meal('2026-02-02', 1)],
      holidays,
      extraDays: [d('2026-02-27')],
    })
    const byDay = (day: number) => cells.find((c) => 'day' in c && c.day === day)
    expect(byDay(1)).toMatchObject({ kind: 'weekend' }) // Sunday
    expect(byDay(2)).toMatchObject({ kind: 'meal' })
    expect(byDay(7)).toMatchObject({ kind: 'weekend' }) // Saturday
    expect(byDay(16)).toMatchObject({ kind: 'holiday', holidayName: 'Lunes de Carnaval' })
    expect(byDay(27)).toMatchObject({ kind: 'extra' })
    expect(byDay(3)).toMatchObject({ kind: 'off' })
  })

  it('never shows a weekend or holiday as a meal day unless a meal exists there', () => {
    const cells = buildCalendarCells({ month: d('2026-02-01'), meals: [meal('2026-02-02', 1)], holidays, extraDays: [] })
    const meals = cells.filter((c) => c.kind === 'meal')
    expect(meals).toHaveLength(1)
  })

  it('shows an exceptional Saturday meal as a meal', () => {
    const cells = buildCalendarCells({ month: d('2026-02-01'), meals: [meal('2026-02-07', 1)], holidays, extraDays: [] })
    expect(cells.find((c) => 'day' in c && c.day === 7)).toMatchObject({ kind: 'meal' })
  })
})
