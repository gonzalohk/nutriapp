// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MealSummary } from '@/data/today'
import type { Person } from '@/data/types'
import { toPlainDate } from '@/domain/plain-date'
import { setLanguage } from '@/i18n/t'
import { ReportPage } from '@/features/export/ReportPage'

const d = toPlainDate
const person: Person = { id: 'p1', household_id: 'h', first_name: 'Gonzalo', last_name: null, active: true, plan_start_date: '2026-01-01', plan_end_date: null, created_at: '' }
const meal = (n: number, date: string, status: MealSummary['status'], photo = false, note: string | null = null): MealSummary => ({
  id: `m${n}`, personId: 'p1', householdId: 'h', mealDate: d(date), mealNo: n, status, effectiveStatus: status, isAutomatic: false, note, permissionReason: null,
  photo: photo ? { id: 'ph', thumbPath: 't', storagePath: 's' } : null,
})
const meals = [
  meal(1, '2026-03-02', 'picked_up', true), meal(2, '2026-03-03', 'picked_up', true), meal(3, '2026-03-04', 'cancelled'),
  meal(4, '2026-03-05', 'not_picked_up', false, 'No fui'), meal(5, '2026-03-06', 'permission'),
]

vi.mock('@/data/history', () => ({ loadMonthMeals: async () => meals, loadHistory: async () => [] }))
vi.mock('@/data/photos', () => ({ getSignedUrl: async () => 'x', getSignedUrls: async () => new Map() }))
vi.mock('@/data/supabase', () => ({
  isConfigured: true,
  supabase: { from: () => ({ select: () => ({ order: async () => ({ data: [person], error: null }) }) }) },
}))

describe('ReportPage (spec US7, report example)', () => {
  beforeEach(() => { setLanguage('es'); sessionStorage.clear() })

  it('shows the title, the contracted count, the counts and one detail row per meal', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ReportPage monthKeyValue="2026-03" />
      </QueryClientProvider>,
    )
    const report = await screen.findByRole('article', { name: /reporte mensual/i })
    expect(within(report).getByRole('heading', { level: 1 })).toHaveTextContent(/REPORTE — marzo de 2026|REPORTE — marzo 2026/i)
    expect(await within(report).findByText('5 comidas')).toBeInTheDocument()
    expect(within(report).getByText('Recogidas: 2')).toBeInTheDocument()
    expect(within(report).getByText('Canceladas: 1')).toBeInTheDocument()
    expect(within(report).getByText('No recogidas: 1')).toBeInTheDocument()
    expect(within(report).getByText('Permisos: 1')).toBeInTheDocument()
    const rows = within(report).getAllByRole('listitem').filter((li) => /\d\d\/\d\d/.test(li.textContent ?? ''))
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('02/03')
    expect(rows[0]).toHaveTextContent('Foto')
    expect(rows[3]).toHaveTextContent('No fui')
  })

  it('has a print button and hides navigation controls when printing', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <ReportPage monthKeyValue="2026-03" />
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('button', { name: /imprimir/i })).toBeInTheDocument()
    expect(container.querySelector('.print\\:hidden')).not.toBeNull()
  })
})
