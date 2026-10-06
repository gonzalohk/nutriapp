import type { PostgrestError } from '@supabase/supabase-js'
import type { ExportChange, ExportMeal } from '@/features/export/csv'
import { toPlainDate } from '@/domain/plain-date'
import { supabase } from './supabase'

const PAGE = 1000 // PostgREST returns at most 1000 rows per request

/** Read every row of a query by pages, so exports are never silently cut at 1000 rows. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

export interface PhotoExportItem {
  meal: ExportMeal
  storagePath: string
}

export interface ExportData {
  meals: ExportMeal[]
  changes: ExportChange[]
  photos: PhotoExportItem[]
}

/** Everything needed to export the records: meals, status changes and photo locations. */
export async function loadExportData(): Promise<ExportData> {
  const [people, mealRows, photoRows, changeRows, members] = await Promise.all([
    fetchAll((from, to) => supabase.from('people').select('id, first_name').order('id').range(from, to)),
    fetchAll((from, to) =>
      supabase
        .from('meals_numbered')
        .select('id, person_id, meal_date, meal_no, status, effective_status, is_automatic, note, permission_reason, status_changed_at')
        .order('meal_date')
        .order('id')
        .range(from, to),
    ),
    fetchAll((from, to) => supabase.from('meal_photos').select('meal_id, mime_type, storage_path').order('meal_id').range(from, to)),
    fetchAll((from, to) =>
      supabase.from('meal_status_changes').select('meal_id, from_status, to_status, changed_at, changed_by').order('id').range(from, to),
    ),
    fetchAll((from, to) => supabase.from('household_members').select('user_id, display_name').order('user_id').range(from, to)),
  ])

  const personName = new Map(people.map((p) => [p.id, p.first_name]))
  const memberName = new Map(members.map((m) => [m.user_id, m.display_name]))
  const photoByMeal = new Map(photoRows.map((p) => [p.meal_id, p]))

  const meals: ExportMeal[] = mealRows.map((m) => ({
    id: m.id!,
    personName: personName.get(m.person_id!) ?? '',
    date: toPlainDate(m.meal_date!),
    mealNo: m.meal_no!,
    status: m.status!,
    effectiveStatus: m.effective_status!,
    isAutomatic: m.is_automatic!,
    note: m.note,
    permissionReason: m.permission_reason,
    photoMime: photoByMeal.get(m.id!)?.mime_type ?? null,
    statusChangedAt: m.status_changed_at!,
  }))
  const mealById = new Map(meals.map((m) => [m.id, m]))

  const changes: ExportChange[] = changeRows.flatMap((c) => {
    const meal = mealById.get(c.meal_id)
    if (!meal) return []
    return [{
      personName: meal.personName, date: meal.date, mealNo: meal.mealNo, fromStatus: c.from_status, toStatus: c.to_status,
      changedAt: c.changed_at, changedBy: c.changed_by ? (memberName.get(c.changed_by) ?? null) : null,
    }]
  })

  const photos: PhotoExportItem[] = meals.flatMap((m) => {
    const p = photoByMeal.get(m.id)
    return p ? [{ meal: m, storagePath: p.storage_path }] : []
  })
  return { meals, changes, photos }
}
