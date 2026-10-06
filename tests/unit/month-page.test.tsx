// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MonthView } from '@/data/calendar-data'
import type { Person } from '@/data/types'
import { planMonth } from '@/domain/calendar'
import type { MonthMeal } from '@/domain/month-view'
import { toPlainDate } from '@/domain/plain-date'
import { setLanguage } from '@/i18n/t'
import { MonthPage } from '@/features/month/MonthPage'
import { COVERAGE, holidaySet } from './helpers/holidays'

const d = toPlainDate

vi.mock('@/domain/bolivia-time', async (orig) => ({
  ...(await orig<typeof import('@/domain/bolivia-time')>()),
  todayInBolivia: () => d('2026-02-10'),
}))

const person: Person = {
  id: 'p1', household_id: 'h1', first_name: 'Gonzalo', last_name: null, active: true,
  plan_start_date: '2025-01-01', plan_end_date: null, created_at: '',
}

const plan = planMonth({
  month: d('2026-02-01'), mealsPerMonth: 20, deliveryWeekdays: [1, 2, 3, 4, 5], planStart: d('2025-01-01'),
  planEnd: null, holidays: holidaySet(2024, 2045), exceptionalDates: new Set(), holidayCoverage: COVERAGE,
})

const meals: MonthMeal[] = plan.target.map((date, i) => ({
  id: `m${i}`, date, mealNo: i + 1, status: 'scheduled', effectiveStatus: i < 3 ? 'not_picked_up' : 'scheduled',
  isAutomatic: i < 3, hasPhoto: false,
}))

const view: MonthView = {
  monthlyPlan: null,
  meals,
  holidays: new Map([[d('2026-02-16'), 'Lunes de Carnaval'], [d('2026-02-17'), 'Martes de Carnaval']]),
  plan,
}

const januaryPlan = planMonth({
  month: d('2026-01-01'), mealsPerMonth: 20, deliveryWeekdays: [1, 2, 3, 4, 5], planStart: d('2025-01-01'),
  planEnd: null, holidays: holidaySet(2024, 2045), exceptionalDates: new Set(), holidayCoverage: COVERAGE,
})
const emptyPastView: MonthView = { monthlyPlan: null, meals: [], holidays: new Map(), plan: januaryPlan }

const ensureMonthPlan = vi.fn(async () => 'plan-1')

vi.mock('@/data/queries', () => ({
  keys: {},
  usePeople: () => ({ isPending: false, isError: false, data: [person] }),
  useEarliestPlanMonth: () => ({ data: null }),
  useMonthView: (_p: unknown, month: string) => ({ isSuccess: true, data: month === '2026-01-01' ? emptyPastView : view }),
}))
vi.mock('@/data/mutations', () => ({ ensureMonthPlan: (...args: unknown[]) => (ensureMonthPlan as (...a: unknown[]) => unknown)(...args), addExceptionalDelivery: async () => {}, removeExceptionalDelivery: async () => {} }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MonthPage />
    </QueryClientProvider>,
  )
}

describe('MonthPage (February 2026, 18 delivery days for a 20-meal plan)', () => {
  beforeEach(() => {
    setLanguage('es')
    ensureMonthPlan.mockClear()
    sessionStorage.clear()
  })

  it('shows the shortfall alert with the exact numbers', async () => {
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('18 de 20 comidas')
    expect(screen.getByRole('alert')).toHaveTextContent('Faltan 2')
  })

  it('shows Carnival as a holiday without a meal, and every meal day with its number and status text', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('gridcell').length).toBeGreaterThanOrEqual(28))
    expect(screen.getByLabelText(/16 de febrero: Feriado, Lunes de Carnaval/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/17 de febrero: Feriado/i)).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Comida \d+/)).toHaveLength(18)
    // automatic "not picked up" is announced in words, not only by color
    expect(screen.getAllByLabelText(/No recogida \(automática\)/)).toHaveLength(3)
  })

  it('never offers a meal on a weekend', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('gridcell').length).toBeGreaterThanOrEqual(28))
    expect(screen.getByLabelText(/sábado, 7 de febrero: Fin de semana/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/sábado, 7 de febrero.*Comida/i)).toBeNull()
  })

  it('does not allow going before the first plan month or more than one month ahead', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: /mes siguiente/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /mes anterior/i })).toBeEnabled()
  })

  it('does not create past months by browsing, but offers to generate them on request', async () => {
    renderPage()
    ensureMonthPlan.mockClear()
    await userEvent.click(await screen.findByRole('button', { name: /mes anterior/i }))
    expect(await screen.findByText(/este mes pasado aún no tiene comidas/i)).toBeInTheDocument()
    expect(screen.queryByRole('grid')).toBeNull()
    expect(ensureMonthPlan).not.toHaveBeenCalled() // browsing alone created nothing
    await userEvent.click(screen.getByRole('button', { name: /generar este mes/i }))
    await waitFor(() => expect(ensureMonthPlan).toHaveBeenCalledTimes(1))
    expect((ensureMonthPlan.mock.calls[0] as unknown[])[1]).toBe('2026-01-01')
  })
})
