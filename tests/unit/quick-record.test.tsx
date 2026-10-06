// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MealSummary, TodayEntry } from '@/data/today'
import type { Person } from '@/data/types'
import { toPlainDate } from '@/domain/plain-date'
import { setLanguage } from '@/i18n/t'
import { PersonMealCard } from '@/features/today/PersonMealCard'

const d = toPlainDate
const calls: string[] = []

const mocks = vi.hoisted(() => ({
  setMealStatus: vi.fn(),
  compressPhoto: vi.fn(),
  uploadCompressedPhoto: vi.fn(),
}))

vi.mock('@/data/mutations', () => ({ setMealStatus: mocks.setMealStatus }))
vi.mock('@/data/photo-compress', () => ({ compressPhoto: mocks.compressPhoto }))
vi.mock('@/data/photos', () => ({
  uploadCompressedPhoto: mocks.uploadCompressedPhoto,
  getSignedUrl: async () => 'https://signed.example/thumb.webp',
  getSignedUrls: async () => new Map(),
}))

const person: Person = {
  id: 'p1', household_id: 'h1', first_name: 'Gonzalo', last_name: null, active: true,
  plan_start_date: '2026-01-01', plan_end_date: null, created_at: '',
}

const meal = (over: Partial<MealSummary> = {}): MealSummary => ({
  id: 'm1', personId: 'p1', householdId: 'h1', mealDate: d('2099-01-05'), mealNo: 3, status: 'scheduled',
  effectiveStatus: 'scheduled', isAutomatic: false, note: null, permissionReason: null, photo: null, ...over,
})

const renderCard = (entry: TodayEntry) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PersonMealCard entry={entry} />
    </QueryClientProvider>,
  )

beforeEach(() => {
  calls.length = 0
  setLanguage('es')
  mocks.setMealStatus.mockReset().mockImplementation(async () => { calls.push('status') })
  mocks.compressPhoto.mockReset().mockImplementation(async () => { calls.push('compress'); return { full: {}, thumb: {} } })
  mocks.uploadCompressedPhoto.mockReset().mockImplementation(async () => { calls.push('upload') })
})

describe('quick record', () => {
  it('offers the four outcomes and never "scheduled"', () => {
    renderCard({ person, meal: meal(), reason: null })
    for (const name of [/^recogí$/i, /^cancelé$/i, /^no recogí$/i, /^pedí permiso$/i]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /pendiente/i })).toBeNull()
  })

  it('saves "Cancelé" with one tap', async () => {
    renderCard({ person, meal: meal(), reason: null })
    await userEvent.click(screen.getByRole('button', { name: /^cancelé$/i }))
    await waitFor(() => expect(mocks.setMealStatus).toHaveBeenCalledTimes(1))
    expect(mocks.setMealStatus.mock.calls[0]![0]).toMatchObject({ mealId: 'm1', status: 'cancelled' })
  })

  it('saves "No recogí" with one tap', async () => {
    renderCard({ person, meal: meal(), reason: null })
    await userEvent.click(screen.getByRole('button', { name: /^no recogí$/i }))
    await waitFor(() => expect(mocks.setMealStatus.mock.calls[0]![0]).toMatchObject({ status: 'not_picked_up' }))
  })

  it('"Recogí" opens the photo step, and skipping saves without any upload (two taps)', async () => {
    renderCard({ person, meal: meal(), reason: null })
    await userEvent.click(screen.getByRole('button', { name: /^recogí$/i }))
    const sheet = await screen.findByRole('dialog')
    await userEvent.click(within(sheet).getByRole('button', { name: /omitir foto/i }))
    await waitFor(() => expect(mocks.setMealStatus).toHaveBeenCalledTimes(1))
    expect(mocks.setMealStatus.mock.calls[0]![0]).toMatchObject({ status: 'picked_up' })
    expect(mocks.compressPhoto).not.toHaveBeenCalled()
    expect(mocks.uploadCompressedPhoto).not.toHaveBeenCalled()
  })

  it('saves the status first, then compresses and uploads the photo', async () => {
    renderCard({ person, meal: meal(), reason: null })
    await userEvent.click(screen.getByRole('button', { name: /^recogí$/i }))
    const file = new File([new Uint8Array(1000)], 'foto.jpg', { type: 'image/jpeg' })
    await userEvent.upload(await screen.findByTestId('photo-input'), file)
    await waitFor(() => expect(mocks.uploadCompressedPhoto).toHaveBeenCalledTimes(1))
    expect(calls).toEqual(['status', 'compress', 'upload'])
    expect(mocks.uploadCompressedPhoto.mock.calls[0]![0]).toMatchObject({ mealId: 'm1', householdId: 'h1', personId: 'p1' })
  })

  it('keeps the recorded status and explains it when the photo upload fails', async () => {
    mocks.uploadCompressedPhoto.mockRejectedValueOnce(new Error('network down'))
    renderCard({ person, meal: meal(), reason: null })
    await userEvent.click(screen.getByRole('button', { name: /^recogí$/i }))
    await userEvent.upload(await screen.findByTestId('photo-input'), new File([new Uint8Array(10)], 'f.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByText(/la comida quedó registrada, pero la foto falló/i)).toBeInTheDocument()
    expect(mocks.setMealStatus).toHaveBeenCalledTimes(1)
  })

  it('records permission with a reason', async () => {
    renderCard({ person, meal: meal(), reason: null })
    await userEvent.click(screen.getByRole('button', { name: /^pedí permiso$/i }))
    const sheet = await screen.findByRole('dialog')
    await userEvent.type(within(sheet).getByRole('textbox'), 'Viaje de trabajo')
    await userEvent.click(within(sheet).getByRole('button', { name: /guardar/i }))
    await waitFor(() => expect(mocks.setMealStatus).toHaveBeenCalledTimes(1))
    expect(mocks.setMealStatus.mock.calls[0]![0]).toMatchObject({ status: 'permission', reason: 'Viaje de trabajo' })
  })

  it('hides the actions on a recorded meal until "Cambiar" is pressed', async () => {
    renderCard({ person, meal: meal({ status: 'picked_up', effectiveStatus: 'picked_up' }), reason: null })
    expect(screen.queryByRole('button', { name: /^cancelé$/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /cambiar/i }))
    expect(screen.getByRole('button', { name: /^cancelé$/i })).toBeInTheDocument()
  })

  it('shows a forgotten past meal as automatic "No recogida" and lets the user fix it', async () => {
    renderCard({ person, meal: meal({ mealDate: d('2020-01-06'), status: 'scheduled', effectiveStatus: 'not_picked_up', isAutomatic: true }), reason: null })
    expect(screen.getByText('(automática)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /cambiar/i }))
    await userEvent.click(screen.getByRole('button', { name: /^cancelé$/i }))
    await waitFor(() => expect(mocks.setMealStatus).toHaveBeenCalledTimes(1))
  })

  it('explains why there is no meal instead of staying blank', () => {
    renderCard({ person, meal: null, reason: 'holiday', holidayName: 'Navidad' })
    expect(screen.getByText(/feriado \(navidad\): no hay comida/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^recogí$/i })).toBeNull()
  })

  it('shows a weekend as a reason with no actions', () => {
    renderCard({ person, meal: null, reason: 'weekend' })
    expect(screen.getByText(/fin de semana/i)).toBeInTheDocument()
  })
})
