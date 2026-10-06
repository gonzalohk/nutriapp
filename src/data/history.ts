import type { MonthSummary } from '@/domain/history'
import { toPlainDate, type PlainDate } from '@/domain/plain-date'
import { supabase } from './supabase'
import { fetchPhotoRefs } from './photo-refs'
import { toMealSummary, type MealSummary } from './today'

/** Every month of a person with its counters (one query; the list is small). */
export async function loadHistory(personId: string): Promise<MonthSummary[]> {
  const { data, error } = await supabase
    .from('monthly_stats')
    .select('*')
    .eq('person_id', personId)
    .order('month')
  if (error) throw error
  return data.map((r) => ({
    month: toPlainDate(r.month!),
    contracted: r.contracted_count!,
    scheduled: r.scheduled_total!,
    pickedUp: r.picked_up!,
    cancelled: r.cancelled!,
    notPickedUp: r.not_picked_up!,
    permission: r.permission!,
    pending: r.pending!,
    automaticNotPickedUp: r.automatic_not_picked_up!,
    photos: r.photos!,
    isConsistent: r.is_consistent!,
    needsReview: r.needs_review!,
    isPartial: r.is_partial!,
  }))
}

/** The meals of one person and month with their photo references, in date order. */
export async function loadMonthMeals(personId: string, month: PlainDate, monthEndDate: PlainDate): Promise<MealSummary[]> {
  const { data, error } = await supabase
    .from('meals_numbered')
    .select('id, person_id, household_id, meal_date, meal_no, status, effective_status, is_automatic, note, permission_reason')
    .eq('person_id', personId)
    .gte('meal_date', month)
    .lte('meal_date', monthEndDate)
    .order('meal_date')
  if (error) throw error
  const photos = await fetchPhotoRefs(data.map((m) => m.id!))
  return data.map((m) => toMealSummary(m, photos.get(m.id!) ?? null))
}
