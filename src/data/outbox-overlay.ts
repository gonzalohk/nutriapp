import type { OutboxOp } from './outbox'
import type { MealSummary, TodayEntry } from './today'

/**
 * Show queued changes on top of what the server last told us, so a status recorded offline keeps
 * showing as recorded (and "pending sync") even when the screen is refreshed before it is sent.
 */
export function overlayMeal(meal: MealSummary, ops: readonly OutboxOp[]): MealSummary {
  let result = meal
  for (const op of ops) {
    if (op.kind === 'status' && op.mealId === meal.id) {
      result = {
        ...result,
        status: op.status,
        effectiveStatus: op.status,
        isAutomatic: false,
        note: op.note === undefined ? result.note : op.note || null,
        permissionReason: op.status === 'permission' ? (op.reason ?? result.permissionReason) : null,
        pendingSync: true,
      }
    } else if (op.kind === 'photo' && op.target.mealId === meal.id) {
      result = { ...result, photoPending: true }
    }
  }
  return result
}

export function overlayToday(entries: readonly TodayEntry[], ops: readonly OutboxOp[]): TodayEntry[] {
  if (ops.length === 0) return [...entries]
  return entries.map((e) => (e.meal ? { ...e, meal: overlayMeal(e.meal, ops) } : e))
}
