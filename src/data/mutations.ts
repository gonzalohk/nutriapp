import type { RecordableStatus } from '@/domain/meal-status'
import type { PlainDate } from '@/domain/plain-date'
import { computeMonthPlan } from './calendar-data'
import { supabase } from './supabase'
import type { Person } from './types'

/**
 * Make the stored meals of a person's month match the delivery calendar.
 * Returns the monthly plan id, or null when the person has no plan in that month.
 * Idempotent: running it again changes nothing.
 */
export async function ensureMonthPlan(person: Person, month: PlainDate): Promise<string | null> {
  const plan = await computeMonthPlan(person, month)
  if (!plan) return null

  if (plan.target.length === 0) {
    // Nothing to plan; only reconcile when a plan row already exists (for example after a plan end).
    const { data, error } = await supabase
      .from('monthly_plans')
      .select('id')
      .eq('person_id', person.id)
      .eq('month', month)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
  }

  const { data, error } = await supabase.rpc('apply_month_plan', {
    p_person: person.id,
    p_month: month,
    p_dates: plan.target,
    p_contracted: plan.contracted,
    p_is_partial: plan.isPartial,
    p_window_start: plan.windowStart,
  })
  if (error) throw error
  return data
}

export async function addExceptionalDelivery(date: PlainDate, note: string | null): Promise<void> {
  const { error } = await supabase.rpc('add_exceptional_delivery', { p_date: date, p_note: note ?? '' })
  if (error) throw error
}

export async function removeExceptionalDelivery(date: PlainDate): Promise<void> {
  const { error } = await supabase.rpc('remove_exceptional_delivery', { p_date: date })
  if (error) throw error
}

export interface SetMealStatusInput {
  mealId: string
  status: RecordableStatus
  /** Undefined keeps the current note; an empty string clears it. */
  note?: string
  /** Only meaningful with the permission status. */
  reason?: string
  /** When the user actually tapped; lets the server order replays from the offline queue. */
  clientTs?: Date
}

/** Record what happened to a meal. Idempotent and safe to replay. */
export async function setMealStatus({ mealId, status, note, reason, clientTs }: SetMealStatusInput): Promise<void> {
  const { error } = await supabase.rpc('set_meal_status', {
    p_meal: mealId,
    p_status: status,
    p_note: note,
    p_reason: reason,
    p_client_ts: (clientTs ?? new Date()).toISOString(),
  })
  if (error) throw error
}
