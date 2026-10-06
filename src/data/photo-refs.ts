import { supabase } from './supabase'

export interface MealPhotoRef {
  id: string
  thumbPath: string
  storagePath: string
}

/** The photo (if any) of each given meal, by meal id. */
export async function fetchPhotoRefs(mealIds: readonly string[]): Promise<Map<string, MealPhotoRef>> {
  if (mealIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('meal_photos')
    .select('id, meal_id, thumb_path, storage_path')
    .in('meal_id', mealIds as string[])
  if (error) throw error
  return new Map(data.map((p) => [p.meal_id, { id: p.id, thumbPath: p.thumb_path, storagePath: p.storage_path }]))
}
