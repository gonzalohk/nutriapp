import { useState } from 'react'
import { Link } from 'wouter'
import { PhotoThumb } from '@/components/PhotoThumb'
import { StatusBadge } from '@/components/StatusBadge'
import type { TodayEntry } from '@/data/today'
import type { RecordableStatus } from '@/domain/meal-status'
import { t } from '@/i18n/t'
import { useRecordMeal } from '@/features/meal/useRecordMeal'
import { PermissionSheet } from './PermissionSheet'
import { PhotoStep } from './PhotoStep'
import { StatusButtons } from './StatusButtons'

/** Today's meal for one person: current outcome, the four actions, and the photo if any. */
export function PersonMealCard({
  entry,
  totals,
}: {
  entry: TodayEntry
  totals?: { pending: number; contracted: number }
}) {
  const { person, meal } = entry
  const { record, saving, saveError, uploading, photoError, clearPhotoError } = useRecordMeal()
  const [step, setStep] = useState<'photo' | 'permission' | null>(null)
  const [changing, setChanging] = useState(false)

  if (!meal) {
    const reasonText = t(`today.noMeal.${entry.reason ?? 'no_delivery'}`, {
      name: entry.holidayName ?? '',
    })
    return (
      <article
        className="rounded-2xl border border-slate-200 bg-white p-4"
        aria-label={t('today.mealOf', { name: person.first_name })}
      >
        <h2 className="text-lg font-bold">{person.first_name}</h2>
        <p className="mt-1 text-slate-600">{reasonText}</p>
      </article>
    )
  }

  const pending = meal.effectiveStatus === 'scheduled'
  const showActions = pending || changing
  const isUploading = uploading.has(meal.id)

  const choose = (status: RecordableStatus) => {
    if (status === 'picked_up') setStep('photo')
    else if (status === 'permission') setStep('permission')
    else {
      void record({ meal, status })
      setChanging(false)
    }
  }

  return (
    <article
      className="rounded-2xl border border-slate-200 bg-white p-4"
      aria-label={t('today.mealOf', { name: person.first_name })}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{person.first_name}</h2>
          <StatusBadge
            status={meal.status}
            mealDate={meal.mealDate}
            pendingSync={meal.pendingSync}
            photoPending={meal.photoPending}
          />
          {meal.note && <p className="mt-1 text-sm text-slate-600">{meal.note}</p>}
          {totals && <p className="mt-1 text-sm text-slate-600">{t('stats.remaining', totals)}</p>}
        </div>
        {meal.photo && <PhotoThumb path={meal.photo.thumbPath} />}
      </header>

      {showActions && (
        <StatusButtons
          onChoose={choose}
          current={pending ? null : (meal.status as RecordableStatus)}
          disabled={saving}
        />
      )}

      {!pending && (
        <div className="mt-2 flex gap-2">
          <button
            className="min-h-12 flex-1 rounded-xl font-semibold text-brand underline"
            onClick={() => setChanging((c) => !c)}
          >
            {t('today.change')}
          </button>
          <Link
            href={`/meal/${meal.id}`}
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl font-semibold text-brand underline"
          >
            {t('today.details')}
          </Link>
        </div>
      )}

      <div aria-live="polite" className="mt-2 text-sm text-slate-600">
        {saving && <p>{t('today.saving')}</p>}
        {isUploading && <p>{t('today.uploading')}</p>}
      </div>
      {saveError && (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {saveError}
        </p>
      )}
      {photoError && (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {photoError}{' '}
          <button className="underline" onClick={clearPhotoError}>
            {t('common.close')}
          </button>
        </p>
      )}

        {step === 'photo' && (
          <PhotoStep
            onClose={() => setStep(null)}
            onSkip={() => {
              setStep(null)
              setChanging(false)
              void record({ meal, status: 'picked_up' })
            }}
            onPhoto={(file) => {
              setStep(null)
              setChanging(false)
              void record({ meal, status: 'picked_up', photo: file })
            }}
          />
        )}
        {step === 'permission' && (
          <PermissionSheet
            onClose={() => setStep(null)}
            onSave={(reason, photo) => {
              setStep(null)
              setChanging(false)
              void record({ meal, status: 'permission', reason, photo })
            }}
          />
        )}
    </article>
  )
}
