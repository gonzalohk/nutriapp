// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MealSummary } from '@/data/today'
import type { Person } from '@/data/types'
import { toPlainDate } from '@/domain/plain-date'
import { setLanguage } from '@/i18n/t'
import { MonthDetail } from '@/features/history/MonthDetail'

const d = toPlainDate
const person: Person = {
  id: 'p1', household_id: 'h1', first_name: 'Gonzalo', last_name: null, active: true,
  plan_start_date: '2026-01-01', plan_end_date: null, created_at: '',
}

const meal = (n: number, date: string, status: MealSummary['status'], withPhoto: boolean, note: string | null = null): MealSummary => ({
  id: `m${n}`, personId: 'p1', householdId: 'h1', mealDate: d(date), mealNo: n, status, effectiveStatus: status, isAutomatic: false,
  note, permissionReason: null,
  photo: withPhoto ? { id: `ph${n}`, thumbPath: `h1/p1/2026-01/m${n}/t.webp`, storagePath: `h1/p1/2026-01/m${n}/f.webp` } : null,
})
const meals = [
  meal(1, '2026-01-05', 'picked_up', true),
  meal(2, '2026-01-06', 'cancelled', false, 'Cancelada por teléfono'),
  meal(3, '2026-01-07', 'permission', true, 'Viaje'),
  meal(4, '2026-01-08', 'picked_up', true),
]

const mocks = vi.hoisted(() => ({ getSignedUrls: vi.fn(), getSignedUrl: vi.fn() }))
vi.mock('@/data/history', () => ({ loadMonthMeals: async () => meals, loadHistory: async () => [] }))
vi.mock('@/data/photos', () => ({
  getSignedUrls: mocks.getSignedUrls,
  getSignedUrl: mocks.getSignedUrl,
  uploadCompressedPhoto: vi.fn(),
  removeMealPhoto: vi.fn(),
}))
vi.mock('@/data/mutations', () => ({ setMealStatus: vi.fn() }))
vi.mock('@/data/photo-compress', () => ({ compressPhoto: vi.fn() }))
vi.mock('@/data/supabase', () => ({
  isConfigured: true,
  supabase: { from: () => ({ select: () => ({ order: async () => ({ data: [person], error: null }) }) }) },
}))

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MonthDetail personId="p1" monthKeyValue="2026-01" />
    </QueryClientProvider>,
  )

beforeEach(() => {
  setLanguage('es')
  mocks.getSignedUrls.mockReset().mockImplementation(async (paths: string[]) => new Map(paths.map((p) => [p, `https://signed/${p}`])))
  mocks.getSignedUrl.mockReset().mockImplementation(async (p: string) => `https://signed/${p}`)
})

describe('month detail with photos (spec US5)', () => {
  it('lists every meal with its status and note', async () => {
    renderPage()
    expect(await screen.findByText(/comida 2 · /i)).toBeInTheDocument()
    expect(screen.getByText('Cancelada por teléfono')).toBeInTheDocument()
    expect(screen.getAllByText('Recogida')).toHaveLength(2)
  })

  it('requests all thumbnails in one batch and never the full-size images', async () => {
    renderPage()
    await waitFor(() => expect(mocks.getSignedUrls).toHaveBeenCalledTimes(1))
    expect(mocks.getSignedUrls.mock.calls[0]![0]).toEqual([
      'h1/p1/2026-01/m1/t.webp', 'h1/p1/2026-01/m3/t.webp', 'h1/p1/2026-01/m4/t.webp',
    ])
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it('opens the full photo only when a thumbnail is tapped, with date, person, status and note', async () => {
    renderPage()
    await screen.findByText(/comida 3 · /i)
    await userEvent.click(screen.getAllByRole('button', { name: /foto de .*7 de enero/i })[0]!)
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(mocks.getSignedUrl).toHaveBeenCalledWith('h1/p1/2026-01/m3/f.webp'))
    expect(await within(dialog).findByAltText(/foto completa/i)).toHaveAttribute('src', 'https://signed/h1/p1/2026-01/m3/f.webp')
    expect(within(dialog).getByText('Gonzalo')).toBeInTheDocument()
    expect(within(dialog).getByText('Permiso')).toBeInTheDocument()
    expect(within(dialog).getByText('Viaje')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /reemplazar foto/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /quitar foto/i })).toBeInTheDocument()
  })

  it('asks for confirmation before removing a photo', async () => {
    renderPage()
    await screen.findByText(/comida 1 · /i)
    await userEvent.click(screen.getAllByRole('button', { name: /foto de/i })[0]!)
    await userEvent.click(await screen.findByRole('button', { name: /quitar foto/i }))
    expect(await screen.findByText(/el estado de la comida no cambia/i)).toBeInTheDocument()
  })
})
