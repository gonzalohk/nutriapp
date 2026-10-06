import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompressedPhoto } from '@/data/photo-compress'
import { clearOutbox, enqueue, flushOutbox, isTransientError, listOps, type FlushHandlers } from '@/data/outbox'
import { toPlainDate } from '@/domain/plain-date'

const photo = (): CompressedPhoto => ({
  full: { blob: new Blob([new Uint8Array(100)], { type: 'image/webp' }), width: 800, height: 600, mimeType: 'image/webp', quality: 0.8 },
  thumb: new Blob([new Uint8Array(10)], { type: 'image/webp' }),
})
const target = { mealId: 'm1', householdId: 'h', personId: 'p', mealDate: toPlainDate('2026-10-01') }

function handlers(over: Partial<FlushHandlers> = {}): FlushHandlers & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    status: async (op) => { calls.push(`status:${op.mealId}:${op.status}`) },
    photo: async (op) => { calls.push(`photo:${op.target.mealId}`) },
    ...over,
  }
}

beforeEach(async () => { await clearOutbox() })

describe('outbox', () => {
  it('keeps queued operations across restarts, in the order they were made', async () => {
    await enqueue({ kind: 'status', mealId: 'a', status: 'picked_up', clientTs: '2026-10-01T10:00:00Z' })
    await enqueue({ kind: 'status', mealId: 'b', status: 'cancelled', clientTs: '2026-10-01T10:01:00Z' })
    const ops = await listOps()
    expect(ops.map((o) => (o.kind === 'status' ? o.mealId : ''))).toEqual(['a', 'b'])
    expect(ops[0]!.seq).toBeLessThan(ops[1]!.seq)
  })

  it('replays status changes in order and then photos, removing each one once applied', async () => {
    await enqueue({ kind: 'photo', target, photo: photo(), takenAt: '2026-10-01T10:00:00Z' })
    await enqueue({ kind: 'status', mealId: 'm1', status: 'not_picked_up', clientTs: '2026-10-01T10:00:00Z' })
    await enqueue({ kind: 'status', mealId: 'm1', status: 'picked_up', clientTs: '2026-10-01T10:30:00Z' })
    const h = handlers()
    const result = await flushOutbox(h)
    expect(h.calls).toEqual(['status:m1:not_picked_up', 'status:m1:picked_up', 'photo:m1'])
    expect(result).toEqual({ applied: 3, rejected: 0, remaining: 0 })
    expect(await listOps()).toEqual([])
  })

  it('stops at the first transient failure and keeps everything that was not applied', async () => {
    await enqueue({ kind: 'status', mealId: 'a', status: 'picked_up', clientTs: 't' })
    await enqueue({ kind: 'status', mealId: 'b', status: 'cancelled', clientTs: 't' })
    const h = handlers({ status: async (op) => { if (op.mealId === 'a') throw new TypeError('Failed to fetch') } })
    const result = await flushOutbox(h)
    expect(result).toMatchObject({ applied: 0, remaining: 2 })
    expect((await listOps()).length).toBe(2)
  })

  it('keeps a photo queued after an upload failure and retries it later', async () => {
    await enqueue({ kind: 'photo', target, photo: photo(), takenAt: 't' })
    let fail = true
    const h = handlers({ photo: async () => { if (fail) throw new TypeError('Failed to fetch') } })
    expect((await flushOutbox(h)).remaining).toBe(1)
    const stored = (await listOps())[0]!
    expect(stored.kind === 'photo' && stored.photo.full.blob.size).toBe(100) // the blob survived storage
    fail = false
    expect(await flushOutbox(h)).toMatchObject({ applied: 1, remaining: 0 })
  })

  it('drops an operation the server rejects for good, without blocking the others', async () => {
    await enqueue({ kind: 'status', mealId: 'gone', status: 'picked_up', clientTs: 't' })
    await enqueue({ kind: 'status', mealId: 'ok', status: 'cancelled', clientTs: 't' })
    const h = handlers({ status: async (op) => { if (op.mealId === 'gone') throw { message: 'E_NOT_FOUND' }; } })
    const result = await flushOutbox(h)
    expect(result).toEqual({ applied: 1, rejected: 1, remaining: 0 })
  })

  it('gives up on an operation that keeps failing for an unknown reason after five attempts', async () => {
    await enqueue({ kind: 'status', mealId: 'weird', status: 'picked_up', clientTs: 't' })
    const h = handlers({ status: async () => { throw new Error('something odd') } })
    let rejected = 0
    const remaining: number[] = []
    for (let i = 0; i < 5; i++) {
      const r = await flushOutbox(h)
      rejected += r.rejected
      remaining.push(r.remaining)
    }
    expect(remaining).toEqual([1, 1, 1, 1, 0]) // retried four times, dropped on the fifth failure
    expect(rejected).toBe(1)
  })

  it('does not run two flushes at once (a replay must not apply an operation twice)', async () => {
    await enqueue({ kind: 'status', mealId: 'a', status: 'picked_up', clientTs: 't' })
    const apply = vi.fn(async () => { await new Promise((r) => setTimeout(r, 20)) })
    const h = handlers({ status: apply })
    const [r1, r2] = await Promise.all([flushOutbox(h), flushOutbox(h)])
    expect(apply).toHaveBeenCalledTimes(1)
    expect(r1.applied + r2.applied).toBe(1)
  })

  it('discarding the queue leaves nothing behind', async () => {
    await enqueue({ kind: 'status', mealId: 'a', status: 'picked_up', clientTs: 't' })
    await clearOutbox()
    expect(await listOps()).toEqual([])
  })
})

describe('isTransientError', () => {
  it('treats network failures as transient and server rejections as permanent', () => {
    expect(isTransientError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isTransientError({ message: 'TypeError: NetworkError when attempting to fetch resource.' })).toBe(true)
    expect(isTransientError({ message: 'E_NOT_FOUND' })).toBe(false)
    expect(isTransientError({ message: 'E_INVALID_STATUS' })).toBe(false)
    expect(isTransientError({ message: 'new row violates check constraint', code: '23514' })).toBe(false)
  })
})
