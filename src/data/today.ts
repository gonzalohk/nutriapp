import type { MealStatus } from '@/domain/meal-status'
import { noMealReason, type NoMealReason } from '@/domain/no-meal-reason'
import { toPlainDate, type PlainDate } from '@/domain/plain-date'
import { fetchHolidays } from './calendar-data'
import { fetchPhotoRefs, type MealPhotoRef } from './photo-refs'
import { supabase } from './supabase'
import type { Person } from './types'

/** A meal as the quick-record screens use it. */
export interface MealSummary {
  id: string
  personId: string
  householdId: string
  mealDate: PlainDate
  mealNo: number
  status: MealStatus
  effectiveStatus: MealStatus
  isAutomatic: boolean
  note: string | null
  permissionReason: string | null
  photo: MealPhotoRef | null
  /** A change recorded offline that has not reached the server yet. */
  pendingSync?: boolean
  /** A photo waiting for the connection. */
  photoPending?: boolean
}

export interface TodayEntry {
  person: Person
  meal: MealSummary | null
  /** Set when there is no meal today. */
  reason: NoMealReason | null
  holidayName?: string
}

const MEAL_COLUMNS =
  'id, person_id, household_id, meal_date, meal_no, status, effective_status, is_automatic, note, permission_reason'

type MealRowLike = {
  id: string | null
  person_id: string | null
  household_id: string | null
  meal_date: string | null
  meal_no: number | null
  status: MealStatus | null
  effective_status: MealStatus | null
  is_automatic: boolean | null
  note: string | null
  permission_reason: string | null
}

export function toMealSummary(row: MealRowLike, photo: MealPhotoRef | null): MealSummary {
  return {
    id: row.id!,
    personId: row.person_id!,
    householdId: row.household_id!,
    mealDate: toPlainDate(row.meal_date!),
    mealNo: row.meal_no!,
    status: row.status!,
    effectiveStatus: row.effective_status!,
    isAutomatic: row.is_automatic!,
    note: row.note,
    permissionReason: row.permission_reason,
    photo,
  }
}

/** Every active person with their meal for `today`, or the reason there is none. */
export async function loadToday(people: readonly Person[], today: PlainDate): Promise<TodayEntry[]> {
  const [mealsRes, holidays] = await Promise.all([
    supabase.from('meals_numbered').select(MEAL_COLUMNS).eq('meal_date', today),
    fetchHolidays(today, today),
  ])
  if (mealsRes.error) throw mealsRes.error
  const photos = await fetchPhotoRefs(mealsRes.data.map((m) => m.id!))
  const byPerson = new Map(mealsRes.data.map((m) => [m.person_id!, m]))

  return people
    .filter((p) => p.active)
    .map((person): TodayEntry => {
      const row = byPerson.get(person.id)
      if (row) return { person, meal: toMealSummary(row, photos.get(row.id!) ?? null), reason: null }
      const holidayName = holidays.get(today)
      return {
        person,
        meal: null,
        reason: noMealReason({
          date: today,
          planStart: toPlainDate(person.plan_start_date),
          planEnd: person.plan_end_date ? toPlainDate(person.plan_end_date) : null,
          holidayName,
        }),
        holidayName,
      }
    })
}

export async function loadMeal(mealId: string): Promise<{ meal: MealSummary; person: Person } | null> {
  const { data, error } = await supabase.from('meals_numbered').select(MEAL_COLUMNS).eq('id', mealId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [photos, person] = await Promise.all([
    fetchPhotoRefs([mealId]),
    supabase.from('people').select('*').eq('id', data.person_id!).single(),
  ])
  if (person.error) throw person.error
  return { meal: toMealSummary(data, photos.get(mealId) ?? null), person: person.data }
}

export interface StatusChange {
  id: number
  fromStatus: MealStatus
  toStatus: MealStatus
  changedAt: string
  changedBy: string | null
  changedByName: string | null
}

export async function loadStatusChanges(mealId: string): Promise<StatusChange[]> {
  const { data, error } = await supabase
    .from('meal_status_changes')
    .select('id, from_status, to_status, changed_at, changed_by')
    .eq('meal_id', mealId)
    .order('id')
  if (error) throw error
  const userIds = [...new Set(data.map((c) => c.changed_by).filter((u): u is string => Boolean(u)))]
  const names = new Map<string, string>()
  if (userIds.length > 0) {
    const members = await supabase.from('household_members').select('user_id, display_name').in('user_id', userIds)
    if (members.error) throw members.error
    for (const m of members.data) names.set(m.user_id, m.display_name)
  }
  return data.map((c) => ({
    id: c.id,
    fromStatus: c.from_status,
    toStatus: c.to_status,
    changedAt: c.changed_at,
    changedBy: c.changed_by,
    changedByName: c.changed_by ? (names.get(c.changed_by) ?? null) : null,
  }))
}
