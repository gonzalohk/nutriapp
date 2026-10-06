import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '@/data/errors'
import { compressPhoto } from '@/data/photo-compress'
import { uploadOrQueuePhoto } from '@/data/sync'
import { useSetMealStatus } from '@/data/queries'
import type { MealSummary } from '@/data/today'
import type { RecordableStatus } from '@/domain/meal-status'
import { t } from '@/i18n/t'

export interface RecordInput {
  meal: MealSummary
  status: RecordableStatus
  note?: string
  reason?: string
  /** Photo taken with the camera; compressed and uploaded after the status is saved. */
  photo?: Blob | null
}

/**
 * Record what happened to a meal and, optionally, attach a photo.
 * The status is saved first so a slow or failed upload never loses the outcome (spec Edge Case 10).
 */
export function useRecordMeal() {
  const queryClient = useQueryClient()
  const setStatus = useSetMealStatus()
  const [uploading, setUploading] = useState<ReadonlySet<string>>(new Set())
  const [photoError, setPhotoError] = useState<string | null>(null)

  const setBusy = (id: string, busy: boolean) =>
    setUploading((prev) => {
      const next = new Set(prev)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })

  /** Compress and upload a photo for a meal, replacing any existing one. */
  const attachPhoto = useCallback(
    async (meal: MealSummary, photo: Blob) => {
      setPhotoError(null)
      setBusy(meal.id, true)
      try {
        const compressed = await compressPhoto(photo)
        await uploadOrQueuePhoto(
          { mealId: meal.id, householdId: meal.householdId, personId: meal.personId, mealDate: meal.mealDate },
          compressed,
        )
        await queryClient.invalidateQueries({ queryKey: ['today'] })
        await queryClient.invalidateQueries({ queryKey: ['month'] })
        await queryClient.invalidateQueries({ queryKey: ['meal'] })
        await queryClient.invalidateQueries({ queryKey: ['signed-url'] })
      } catch (error) {
        setPhotoError(t('today.photoFailed', { error: errorMessage(error) }))
      } finally {
        setBusy(meal.id, false)
      }
    },
    [queryClient],
  )

  const record = useCallback(
    async ({ meal, status, note, reason, photo }: RecordInput) => {
      await setStatus.mutateAsync({ mealId: meal.id, status, note, reason })
      if (photo) await attachPhoto(meal, photo)
    },
    [setStatus, attachPhoto],
  )

  return {
    record,
    attachPhoto,
    saving: setStatus.isPending,
    saveError: setStatus.error ? errorMessage(setStatus.error) : null,
    uploading,
    photoError,
    clearPhotoError: () => setPhotoError(null),
  }
}
