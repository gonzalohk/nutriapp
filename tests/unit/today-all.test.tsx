// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MealSummary, TodayEntry } from '@/data/today'
import type { Person } from '@/data/types'
import { toPlainDate } from '@/domain/plain-date'
import { setLanguage } from '@/i18n/t'
import { TodayAllList } from '@/features/today/TodayAllList'

vi.mock('@/data/mutations', () => ({ setMealStatus: vi.fn(async () => {}) }))
vi.mock('@/data/photo-compress', () => ({ compressPhoto: vi.fn() }))
vi.mock('@/data/photos', () => ({ uploadCompressedPhoto: vi.fn(), getSignedUrl: async () => 'x', getSignedUrls: async () => new Map() }))

const d = toPlainDate
const person = (id: string, name: string): Person => ({
  id, household_id: 'h', first_name: name, last_name: null, active: true, plan_start_date: '2026-01-01', plan_end_date: null, created_at: '',
})
const meal = (id: string, personId: string, status: MealSummary['status']): MealSummary => ({
  id, personId, householdId: 'h', mealDate: d('2099-01-05'), mealNo: 1, status, effectiveStatus: status, isAutomatic: false, note: null, permissionReason: null, photo: null,
})

const entries: TodayEntry[] = [
  { person: person('1', 'Gonzalo'), meal: meal('m1', '1', 'picked_up'), reason: null },
  { person: person('2', 'Esposa'), meal: meal('m2', '2', 'picked_up'), reason: null },
  { person: person('3', 'Hijo'), meal: meal('m3', '3', 'not_picked_up'), reason: null },
  { person: person('4', 'Hija'), meal: meal('m4', '4', 'permission'), reason: null },
]

const renderList = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TodayAllList entries={entries} totals={undefined} />
    </QueryClientProvider>,
  )

describe('Today: all people (spec US4)', () => {
  beforeEach(() => setLanguage('es'))

  it('shows every person with their outcome in one compact list, like the example in the spec', () => {
    renderList()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(4)
    expect(within(rows[0]!).getByText('Gonzalo')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('Recogida')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('No recogida')).toBeInTheDocument()
    expect(within(rows[3]!).getByText('Permiso')).toBeInTheDocument()
  })

  it('opens one person\'s actions on tap, without showing the others\' buttons', async () => {
    renderList()
    expect(screen.queryByRole('button', { name: /^cancelé$/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /hijo/i }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: 'Comida de Hijo' })).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: /cambiar/i }))
    expect(within(sheet).getByRole('button', { name: /^cancelé$/i })).toBeInTheDocument()
  })
})
