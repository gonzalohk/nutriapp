import type { QueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { enqueue, flushOutbox, isNetworkError, listOps, subscribeOutbox, type FlushHandlers, type FlushResult, type OutboxOp } from './outbox'
import type { CompressedPhoto } from './photo-compress'
import { uploadCompressedPhoto, type MealPhotoTarget } from './photos'
import { setMealStatus, type SetMealStatusInput } from './mutations'

export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

/** How queued operations are applied once the connection is back. */
export const syncHandlers: FlushHandlers = {
  status: (op) =>
    setMealStatus({ mealId: op.mealId, status: op.status, note: op.note, reason: op.reason, clientTs: new Date(op.clientTs) }),
  photo: (op) => uploadCompressedPhoto(op.target, op.photo, new Date(op.takenAt)),
}

/**
 * Record a status. Without a connection, or if the request cannot reach the server, the change is
 * kept on the device and sent later ("queued"). Server rejections are still reported as errors.
 */
export async function recordStatus(input: SetMealStatusInput): Promise<'saved' | 'queued'> {
  const clientTs = input.clientTs ?? new Date()
  const queue = () =>
    enqueue({ kind: 'status', mealId: input.mealId, status: input.status, note: input.note, reason: input.reason, clientTs: clientTs.toISOString() })
  if (!isOnline()) {
    await queue()
    return 'queued'
  }
  try {
    await setMealStatus({ ...input, clientTs })
    return 'saved'
  } catch (error) {
    if (!isNetworkError(error)) throw error
    await queue()
    return 'queued'
  }
}

/** Upload a compressed photo, or keep it on the device until the connection returns. */
export async function uploadOrQueuePhoto(target: MealPhotoTarget, photo: CompressedPhoto): Promise<'uploaded' | 'queued'> {
  const takenAt = new Date()
  const queue = () => enqueue({ kind: 'photo', target, photo, takenAt: takenAt.toISOString() })
  if (!isOnline()) {
    await queue()
    return 'queued'
  }
  try {
    await uploadCompressedPhoto(target, photo, takenAt)
    return 'uploaded'
  } catch (error) {
    if (!isNetworkError(error)) throw error
    await queue()
    return 'queued'
  }
}

/** Send everything that is waiting and refresh the screens that show it. */
export async function syncNow(queryClient: QueryClient): Promise<FlushResult> {
  const result = await flushOutbox(syncHandlers)
  if (result.applied > 0 || result.rejected > 0) {
    await queryClient.invalidateQueries({ queryKey: ['today'] })
    await queryClient.invalidateQueries({ queryKey: ['month'] })
    await queryClient.invalidateQueries({ queryKey: ['meal'] })
    await queryClient.invalidateQueries({ queryKey: ['signed-url'] })
  }
  return result
}

/**
 * Sync when the app opens, when the connection returns and when the app comes back to the
 * foreground. iOS has no background sync, so these events are the triggers.
 */
export function startAutoSync(queryClient: QueryClient): () => void {
  const run = () => {
    if (isOnline()) void syncNow(queryClient)
  }
  const onVisible = () => document.visibilityState === 'visible' && run()
  window.addEventListener('online', run)
  document.addEventListener('visibilitychange', onVisible)
  run()
  return () => {
    window.removeEventListener('online', run)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

/** The queued operations, kept up to date. */
export function useOutboxOps(): OutboxOp[] {
  const [ops, setOps] = useState<OutboxOp[]>([])
  useEffect(() => {
    let alive = true
    const load = () => void listOps().then((o) => alive && setOps(o))
    load()
    const unsubscribe = subscribeOutbox(load)
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])
  return ops
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline)
  useEffect(() => {
    const update = () => setOnline(isOnline())
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
