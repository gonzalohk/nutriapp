import { clear, createStore, del, entries, set } from 'idb-keyval'
import type { RecordableStatus } from '@/domain/meal-status'
import { errorCode } from './errors'
import type { CompressedPhoto } from './photo-compress'
import type { MealPhotoTarget } from './photos'

/**
 * Changes made without a connection. They are kept on the device and applied, in order, when the
 * connection returns. Every operation is safe to replay: the server ignores a repeated status and a
 * change older than the one it already has.
 */
export interface StatusOp {
  kind: 'status'
  seq: number
  attempts: number
  mealId: string
  status: RecordableStatus
  note?: string
  reason?: string
  /** When the user actually tapped; lets the server order replays. */
  clientTs: string
}

export interface PhotoOp {
  kind: 'photo'
  seq: number
  attempts: number
  target: MealPhotoTarget
  /** Already compressed, so only a small file waits for the connection. */
  photo: CompressedPhoto
  takenAt: string
}

export type OutboxOp = StatusOp | PhotoOp
type NewOp = Omit<StatusOp, 'seq' | 'attempts'> | Omit<PhotoOp, 'seq' | 'attempts'>

const MAX_ATTEMPTS = 5
let store: ReturnType<typeof createStore> | undefined
const getStore = () => (store ??= createStore('nutrilara-outbox', 'ops'))
const keyOf = (seq: number) => String(seq).padStart(16, '0')
let lastSeq = 0

export async function enqueue(op: NewOp): Promise<void> {
  // Time-based and strictly increasing, so order is kept even across app restarts.
  const seq = Math.max(Date.now(), lastSeq + 1)
  lastSeq = seq
  await set(keyOf(seq), { ...op, seq, attempts: 0 } satisfies OutboxOp, getStore())
  notify()
}

export async function listOps(): Promise<OutboxOp[]> {
  const all = await entries<string, OutboxOp>(getStore())
  return all.sort(([a], [b]) => (a < b ? -1 : 1)).map(([, op]) => op)
}

export async function clearOutbox(): Promise<void> {
  await clear(getStore())
  notify()
}

const removeOp = (op: OutboxOp) => del(keyOf(op.seq), getStore())
const bumpAttempts = (op: OutboxOp) => set(keyOf(op.seq), { ...op, attempts: op.attempts + 1 }, getStore())

/** Network trouble and unknown failures are retried; a server rejection (an E_ code or a constraint) is final. */
export function isTransientError(error: unknown): boolean {
  if (errorCode(error)) return false
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code)
    if (/^(2|4)\d{4}$|^P0001$/.test(code)) return false // SQLSTATE class 2x/4x or a raised exception
  }
  return true
}

export interface FlushHandlers {
  status: (op: StatusOp) => Promise<void>
  photo: (op: PhotoOp) => Promise<void>
}

export interface FlushResult {
  applied: number
  rejected: number
  remaining: number
}

let flushing = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Be told when the queue changes (used to refresh the "pending sync" markers). */
export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Apply queued operations: all status changes first, in order, then the photos. Stops at the first
 * transient failure so nothing is lost; drops operations the server rejects for good. Only one flush
 * runs at a time.
 */
export async function flushOutbox(handlers: FlushHandlers): Promise<FlushResult> {
  if (flushing) return { applied: 0, rejected: 0, remaining: (await listOps()).length }
  flushing = true
  let applied = 0
  let rejected = 0
  try {
    const ops = await listOps()
    const ordered = [...ops.filter((o) => o.kind === 'status'), ...ops.filter((o) => o.kind === 'photo')]
    for (const op of ordered) {
      try {
        if (op.kind === 'status') await handlers.status(op)
        else await handlers.photo(op)
        await removeOp(op)
        applied++
      } catch (error) {
        if (!isTransientError(error) || op.attempts + 1 >= MAX_ATTEMPTS) {
          await removeOp(op)
          rejected++
          continue
        }
        await bumpAttempts(op)
        break // keep order: do not skip ahead past an operation that is still waiting
      }
    }
  } finally {
    flushing = false
    notify()
  }
  return { applied, rejected, remaining: (await listOps()).length }
}

/** A failure to reach the server at all (as opposed to the server answering with an error). */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : ''
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out/i.test(message)
}
