import type { MessageKey } from '@/i18n/t'
import { compareDates, type PlainDate } from './plain-date'

export const MEAL_STATUSES = [
  'scheduled',
  'picked_up',
  'cancelled',
  'not_picked_up',
  'permission',
] as const

export type MealStatus = (typeof MEAL_STATUSES)[number]

/** Statuses a user can choose. `scheduled` is only the initial state (spec FR-015). */
export const RECORDABLE_STATUSES = [
  'picked_up',
  'cancelled',
  'not_picked_up',
  'permission',
] as const satisfies readonly MealStatus[]

export type RecordableStatus = (typeof RECORDABLE_STATUSES)[number]

export function isMealStatus(value: string): value is MealStatus {
  return (MEAL_STATUSES as readonly string[]).includes(value)
}

export function isRecordableStatus(value: string): value is RecordableStatus {
  return (RECORDABLE_STATUSES as readonly string[]).includes(value)
}

/** A change is allowed to any recordable status; choosing the current status is a no-op. */
export function isStatusChange(current: MealStatus, next: RecordableStatus): boolean {
  return current !== next
}

export interface EffectiveStatus {
  status: MealStatus
  /** True when the status was derived because the day passed without a record (spec FR-015a). */
  isAutomatic: boolean
}

/**
 * A meal still `scheduled` once its day has ended counts as "not picked up". The stored value is
 * never changed; this is derived on read so no scheduled job is needed.
 */
export function effectiveStatus(
  status: MealStatus,
  mealDate: PlainDate,
  today: PlainDate,
): EffectiveStatus {
  if (status === 'scheduled' && compareDates(mealDate, today) < 0) {
    return { status: 'not_picked_up', isAutomatic: true }
  }
  return { status, isAutomatic: false }
}

export interface StatusPresentation {
  /** Short glyph; every status has its own so color is never the only signal. */
  icon: string
  labelKey: MessageKey
  /** Name of the Tailwind palette (`bg-{tone}-bg text-{tone}-fg`). */
  tone: 'pending' | 'picked' | 'cancelled' | 'missed' | 'permission'
}

export const STATUS_PRESENTATION: Record<MealStatus, StatusPresentation> = {
  scheduled: { icon: '⏳', labelKey: 'status.scheduled', tone: 'pending' },
  picked_up: { icon: '✔', labelKey: 'status.picked_up', tone: 'picked' },
  cancelled: { icon: '✖', labelKey: 'status.cancelled', tone: 'cancelled' },
  not_picked_up: { icon: '⚠', labelKey: 'status.not_picked_up', tone: 'missed' },
  permission: { icon: '✋', labelKey: 'status.permission', tone: 'permission' },
}
