import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PhotoThumb } from '@/components/PhotoThumb'
import { errorMessage } from '@/data/errors'
import { removeMealPhoto } from '@/data/photos'
import type { MealSummary } from '@/data/today'
import { t } from '@/i18n/t'
import { useRecordMeal } from './useRecordMeal'

/** A meal's single photo: add, replace (with confirmation) or remove (with confirmation). */
export function PhotoSection({ meal, showThumb = true }: { meal: MealSummary; showThumb?: boolean }) {
  const queryClient = useQueryClient()
  const { attachPhoto, uploading, photoError, clearPhotoError } = useRecordMeal()
  const input = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState<'replace' | 'remove' | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  async function remove() {
    setRemoveError(null)
    try {
      await removeMealPhoto(meal.photo!.id)
      await queryClient.invalidateQueries()
    } catch (error) {
      setRemoveError(errorMessage(error))
    }
    setConfirm(null)
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="photo-section-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          if (meal.photo) {
            setPendingFile(file)
            setConfirm('replace')
          } else void attachPhoto(meal, file)
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        {showThumb && meal.photo && <PhotoThumb path={meal.photo.thumbPath} />}
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={uploading.has(meal.id)}>
          📷 {meal.photo ? t('meal.replacePhoto') : t('meal.addPhoto')}
        </Button>
        {meal.photo && (
          <Button variant="ghost" onClick={() => setConfirm('remove')}>
            {t('meal.removePhoto')}
          </Button>
        )}
      </div>
      {uploading.has(meal.id) && <p className="mt-2 text-sm text-slate-600">{t('today.uploading')}</p>}
      {photoError && (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {photoError} <button className="underline" onClick={clearPhotoError}>{t('common.close')}</button>
        </p>
      )}
      {removeError && <p role="alert" className="mt-2 text-sm text-red-800">{removeError}</p>}

      {confirm === 'replace' && (
        <ConfirmDialog
          title={t('meal.confirmReplaceTitle')}
          message={t('meal.confirmReplace')}
          onCancel={() => {
            setConfirm(null)
            setPendingFile(null)
          }}
          onConfirm={() => {
            setConfirm(null)
            if (pendingFile) void attachPhoto(meal, pendingFile)
            setPendingFile(null)
          }}
        />
      )}
      {confirm === 'remove' && (
        <ConfirmDialog danger title={t('meal.confirmRemoveTitle')} message={t('meal.confirmRemove')} confirmLabel={t('meal.removePhoto')} onCancel={() => setConfirm(null)} onConfirm={() => void remove()} />
      )}
    </div>
  )
}
