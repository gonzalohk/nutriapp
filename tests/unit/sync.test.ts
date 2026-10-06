// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearOutbox, listOps } from '@/data/outbox'
import { overlayMeal, overlayToday } from '@/data/outbox-overlay'
import type { MealSummary, TodayEntry } from '@/data/today'
import type { Person } from '@/data/types'
import { toPlainDate } from '@/domain/plain-date'

const mocks = vi.hoisted(() => ({ setMealStatus: vi.fn(), uploadCompressedPhoto: vi.fn() }))
vi.mock('@/data/mutations', () => ({ setMealStatus: mocks.setMealStatus }))
vi.mock('@/data/photos', () => ({ uploadCompressedPhoto: mocks.uploadCompressedPhoto }))

import { recordStatus, uploadOrQueuePhoto } from '@/data/sync'

const setOnline = (online: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
const target = { mealId: 'm1', householdId: 'h', personId: 'p', mealDate: toPlainDate('2026-10-01') }
const photo = { full: { blob: new Blob(['x']), width: 1, height: 1, mimeType: 'image/webp' as const, quality: 0.8 }, thumb: new Blob(['y']) }

beforeEach(async () => {
  await clearOutbox()
  mocks.setMealStatus.mockReset().mockResolvedValue(undefined)
  mocks.uploadCompressedPhoto.mockReset().mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('recording a status', () => {
  it('sends it straight away when online', async () => {
    setOnline(true)
    expect(await recordStatus({ mealId: 'm1', status: 'picked_up' })).toBe('saved')
    expect(mocks.setMealStatus).toHaveBeenCalledTimes(1)
    expect(await listOps()).toEqual([])
  })

  it('keeps it on the device when there is no connection, with the time the user tapped', async () => {
    setOnline(false)
    expect(await recordStatus({ mealId: 'm1', status: 'picked_up', clientTs: new Date('2026-10-01T15:00:00Z') })).toBe('queued')
    expect(mocks.setMealStatus).not.toHaveBeenCalled()
    expect(await listOps()).toMatchObject([{ kind: 'status', mealId: 'm1', status: 'picked_up', clientTs: '2026-10-01T15:00:00.000Z' }])
  })

  it('queues it when the request cannot reach the server', async () => {
    setOnline(true)
    mocks.setMealStatus.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await recordStatus({ mealId: 'm1', status: 'cancelled' })).toBe('queued')
    expect((await listOps()).length).toBe(1)
  })

  it('reports a server rejection instead of hiding it in the queue', async () => {
    setOnline(true)
    mocks.setMealStatus.mockRejectedValueOnce({ message: 'E_NOT_FOUND' })
    await expect(recordStatus({ mealId: 'gone', status: 'picked_up' })).rejects.toMatchObject({ message: 'E_NOT_FOUND' })
    expect(await listOps()).toEqual([])
  })
})

describe('taking a photo', () => {
  it('uploads straight away when online', async () => {
    setOnline(true)
    expect(await uploadOrQueuePhoto(target, photo)).toBe('uploaded')
    expect(await listOps()).toEqual([])
  })

  it('keeps the compressed photo until the connection returns (spec Edge Case 10)', async () => {
    setOnline(false)
    expect(await uploadOrQueuePhoto(target, photo)).toBe('queued')
    expect(mocks.uploadCompressedPhoto).not.toHaveBeenCalled()
    expect(await listOps()).toMatchObject([{ kind: 'photo', target: { mealId: 'm1' } }])
  })

  it('queues the photo when the upload cannot reach the server', async () => {
    setOnline(true)
    mocks.uploadCompressedPhoto.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await uploadOrQueuePhoto(target, photo)).toBe('queued')
  })
})

describe('showing queued changes on top of the server data', () => {
  const meal: MealSummary = {
    id: 'm1', personId: 'p', householdId: 'h', mealDate: toPlainDate('2026-10-01'), mealNo: 1, status: 'scheduled',
    effectiveStatus: 'not_picked_up', isAutomatic: true, note: null, permissionReason: null, photo: null,
  }
  const person = { id: 'p', first_name: 'Ana' } as Person
  const status = (s: 'picked_up' | 'permission', over = {}) => ({ kind: 'status' as const, seq: 1, attempts: 0, mealId: 'm1', status: s, clientTs: 't', ...over })

  it('shows a status recorded offline as recorded and pending sync', () => {
    const shown = overlayMeal(meal, [status('picked_up')])
    expect(shown).toMatchObject({ status: 'picked_up', effectiveStatus: 'picked_up', isAutomatic: false, pendingSync: true })
  })

  it('the latest queued change wins, and the permission reason is kept only for permission', () => {
    const shown = overlayMeal(meal, [status('permission', { reason: 'Viaje' }), status('picked_up', { seq: 2 })])
    expect(shown).toMatchObject({ status: 'picked_up', permissionReason: null })
  })

  it('marks a waiting photo without changing the status', () => {
    const shown = overlayMeal(meal, [{ kind: 'photo', seq: 1, attempts: 0, target, photo, takenAt: 't' }])
    expect(shown).toMatchObject({ photoPending: true, status: 'scheduled' })
  })

  it('leaves other meals and an empty queue untouched', () => {
    expect(overlayMeal(meal, [status('picked_up', { mealId: 'other' })])).toEqual(meal)
    const entries: TodayEntry[] = [{ person, meal, reason: null }, { person, meal: null, reason: 'weekend' }]
    expect(overlayToday(entries, [])).toEqual(entries)
    expect(overlayToday(entries, [status('picked_up')])[0]!.meal).toMatchObject({ pendingSync: true })
    expect(overlayToday(entries, [status('picked_up')])[1]!.meal).toBeNull()
  })
})
