import { monthKey, type PlainDate } from '@/domain/plain-date'
import { AppError } from './errors'
import type { CompressedPhoto } from './photo-compress'
import { supabase } from './supabase'

const BUCKET = 'meal-photos'

/** What a photo needs to know about the meal it belongs to (also the folder it is stored in). */
export interface MealPhotoTarget {
  mealId: string
  householdId: string
  personId: string
  mealDate: PlainDate
}

const extensionOf = (mime: string) => (mime === 'image/webp' ? 'webp' : 'jpg')

interface PreviousPaths {
  previous_storage_path: string | null
  previous_thumb_path: string | null
}

/**
 * Store an already compressed photo for a meal, replacing the previous one. Order matters: upload
 * first, then point the meal at the new objects, then delete the old ones, so a failure at any step
 * never leaves the meal without its existing photo.
 */
export async function uploadCompressedPhoto(
  target: MealPhotoTarget,
  photo: CompressedPhoto,
  takenAt: Date = new Date(),
): Promise<void> {
  const photoId = crypto.randomUUID()
  const ext = extensionOf(photo.full.mimeType)
  const folder = `${target.householdId}/${target.personId}/${monthKey(target.mealDate)}/${target.mealId}`
  const storagePath = `${folder}/${photoId}.${ext}`
  const thumbPath = `${folder}/${photoId}_thumb.${ext}`
  const storage = supabase.storage.from(BUCKET)

  const full = await storage.upload(storagePath, photo.full.blob, { contentType: photo.full.mimeType })
  if (full.error) throw full.error
  const thumb = await storage.upload(thumbPath, photo.thumb, { contentType: photo.full.mimeType })
  if (thumb.error) {
    await storage.remove([storagePath])
    throw thumb.error
  }

  const { data, error } = await supabase.rpc('replace_meal_photo', {
    p_meal: target.mealId,
    p_photo: photoId,
    p_storage_path: storagePath,
    p_thumb_path: thumbPath,
    p_mime: photo.full.mimeType,
    p_bytes: photo.full.blob.size,
    p_width: photo.full.width,
    p_height: photo.full.height,
    p_taken_at: takenAt.toISOString(),
  })
  if (error) {
    await storage.remove([storagePath, thumbPath]) // do not leave orphan objects behind
    throw error
  }

  const previous = data as unknown as PreviousPaths
  const stale = [previous.previous_storage_path, previous.previous_thumb_path].filter((p): p is string => Boolean(p))
  if (stale.length > 0) await storage.remove(stale)
}

/** Remove a meal's photo. The meal's status is not touched (spec FR-026). */
export async function removeMealPhoto(photoId: string): Promise<void> {
  const { data, error } = await supabase.rpc('delete_meal_photo', { p_photo: photoId })
  if (error) throw error
  const paths = data as unknown as { storage_path: string; thumb_path: string }
  await supabase.storage.from(BUCKET).remove([paths.storage_path, paths.thumb_path])
}

/** Short-lived signed URLs for private objects, requested in one batch. */
export async function getSignedUrls(paths: readonly string[], expiresInSeconds = 3600): Promise<Map<string, string>> {
  const unique = [...new Set(paths)]
  if (unique.length === 0) return new Map()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, expiresInSeconds)
  if (error) throw error
  const out = new Map<string, string>()
  for (const item of data) {
    if (item.signedUrl && item.path) out.set(item.path, item.signedUrl)
  }
  return out
}

export async function getSignedUrl(path: string): Promise<string> {
  const url = (await getSignedUrls([path])).get(path)
  if (!url) throw new AppError('E_NOT_FOUND')
  return url
}
