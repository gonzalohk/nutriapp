import { useState } from 'react'
import { Link } from 'wouter'
import { Button } from '@/components/Button'
import { ErrorState, EmptyState } from '@/components/EmptyState'
import { Spinner } from '@/components/Spinner'
import { StatusBadge } from '@/components/StatusBadge'
import { errorMessage } from '@/data/errors'
import { overlayMeal } from '@/data/outbox-overlay'
import { useOutboxOps } from '@/data/sync'
import { useMeal, useStatusChanges } from '@/data/queries'
import { formatBoliviaDateTime } from '@/domain/bolivia-time'
import { isRecordableStatus, STATUS_PRESENTATION } from '@/domain/meal-status'
import type { RecordableStatus } from '@/domain/meal-status'
import { longDate } from '@/i18n/format'
import { t } from '@/i18n/t'
import { StatusButtons } from '@/features/today/StatusButtons'
import { PhotoSection } from './PhotoSection'
import { useRecordMeal } from './useRecordMeal'

/**
 * One meal in detail: set or correct its status, edit the note, manage its single photo and read
 * the change log. This is also how a past or future meal is recorded (quick-record only offers today).
 */
export function MealSheet({ mealId }: { mealId: string }) {
  const found = useMeal(mealId)
  const changes = useStatusChanges(mealId)
  const ops = useOutboxOps()
  const { record, saving, saveError } = useRecordMeal()
  const [note, setNote] = useState<string | null>(null)
  const [reason, setReason] = useState<string | null>(null)

  if (found.isPending) return <Spinner />
  if (found.isError) return <ErrorState message={errorMessage(found.error)} onRetry={() => void found.refetch()} />
  if (!found.data) return <EmptyState>{t('meal.notFound')}</EmptyState>

  const { person } = found.data
  const meal = overlayMeal(found.data.meal, ops)
  const current = isRecordableStatus(meal.status) ? (meal.status as RecordableStatus) : null
  const noteValue = note ?? meal.note ?? ''
  const reasonValue = reason ?? meal.permissionReason ?? ''

  async function saveText() {
    // Same status, new note/reason: the server updates only those fields and logs nothing.
    if (!current) return
    await record({ meal, status: current, note: noteValue, reason: current === 'permission' ? reasonValue : undefined })
    setNote(null)
    setReason(null)
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      <Link href="/" className="inline-flex min-h-12 items-center font-semibold text-brand">
        ‹ {t('common.back')}
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold">{person.first_name}</h1>
        <p className="text-slate-700">{t('meal.heading', { n: meal.mealNo, date: longDate(meal.mealDate) })}</p>
        <div className="mt-2">
          <StatusBadge status={meal.status} mealDate={meal.mealDate} pendingSync={meal.pendingSync} photoPending={meal.photoPending} />
        </div>
      </header>

      <div>
        <h2 className="mb-2 font-bold">{t('meal.status')}</h2>
        <StatusButtons current={current} disabled={saving} onChoose={(status) => void record({ meal, status })} />
        {saveError && <p role="alert" className="mt-2 text-sm text-red-800">{saveError}</p>}
      </div>

      {current && (
        <div className="flex flex-col gap-3">
          {current === 'permission' && (
            <label className="block">
              <span className="mb-1 block font-bold">{t('meal.reason')}</span>
              <input value={reasonValue} onChange={(e) => setReason(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3" />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block font-bold">{t('meal.note')}</span>
            <textarea value={noteValue} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 p-3" />
          </label>
          <Button variant="secondary" disabled={saving || (note === null && reason === null)} onClick={() => void saveText()}>
            {t('meal.saveNote')}
          </Button>
        </div>
      )}

      <div>
        <h2 className="mb-2 font-bold">{t('meal.photo')}</h2>
        <PhotoSection meal={meal} />
      </div>

      <div>
        <h2 className="mb-2 font-bold">{t('meal.changeLog')}</h2>
        {changes.isPending && <Spinner />}
        {changes.data?.length === 0 && <p className="text-slate-600">{t('meal.noChanges')}</p>}
        <ol className="flex flex-col gap-1 text-sm">
          {changes.data?.map((c) => (
            <li key={c.id} className="rounded-lg bg-white p-2">
              <span aria-hidden="true">{STATUS_PRESENTATION[c.fromStatus].icon}</span> {t(STATUS_PRESENTATION[c.fromStatus].labelKey)} →{' '}
              <span aria-hidden="true">{STATUS_PRESENTATION[c.toStatus].icon}</span> {t(STATUS_PRESENTATION[c.toStatus].labelKey)}
              <span className="block text-slate-600">
                {formatBoliviaDateTime(c.changedAt)}
                {c.changedByName ? ` · ${t('meal.changeBy', { name: c.changedByName })}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </div>

    </section>
  )
}
