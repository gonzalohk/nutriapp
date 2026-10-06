import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { PhotoImage } from '@/components/PhotoThumb'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Spinner } from '@/components/Spinner'
import { StatusBadge } from '@/components/StatusBadge'
import { errorMessage } from '@/data/errors'
import { useMonthMeals, usePeople, useSignedUrls } from '@/data/queries'
import type { MealSummary } from '@/data/today'
import { todayInBolivia } from '@/domain/bolivia-time'
import { monthFromKey } from '@/domain/plain-date'
import { computeStats } from '@/domain/stats'
import { CounterStrip } from '@/features/month/CounterStrip'
import { longDate, monthTitle } from '@/i18n/format'
import { t } from '@/i18n/t'
import { PhotoViewer } from './PhotoViewer'

/** Full detail of one past month: every meal, its note and a small thumbnail (one signed-URL request). */
export function MonthDetail({ personId, monthKeyValue }: { personId: string; monthKeyValue: string }) {
  const month = monthFromKey(monthKeyValue)
  const people = usePeople()
  const meals = useMonthMeals(personId, month)
  const thumbPaths = useMemo(() => (meals.data ?? []).flatMap((m) => (m.photo ? [m.photo.thumbPath] : [])), [meals.data])
  const urls = useSignedUrls(thumbPaths)
  const [viewing, setViewing] = useState<MealSummary | null>(null)

  if (meals.isPending || people.isPending) return <Spinner />
  if (meals.isError) return <ErrorState message={errorMessage(meals.error)} onRetry={() => void meals.refetch()} />
  const person = people.data?.find((p) => p.id === personId)
  const list = meals.data
  const stats = computeStats({
    meals: list.map((m) => ({ date: m.mealDate, status: m.status, hasPhoto: m.photo !== null })),
    contracted: list.length,
    isPartial: true, // the contracted comparison belongs to the Month screen; here we show what happened
    today: todayInBolivia(),
  })
  // The viewer shows the freshest copy of the meal (a replaced photo, a corrected status).
  const current = viewing ? (list.find((m) => m.id === viewing.id) ?? viewing) : null

  return (
    <section className="flex flex-col gap-3 p-4">
      <Link href="/history" className="inline-flex min-h-12 items-center font-semibold text-brand">‹ {t('common.back')}</Link>
      <h1 className="text-2xl font-bold">
        {person?.first_name} · {monthTitle(month)}
      </h1>
      {list.length === 0 && <EmptyState>{t('history.noData')}</EmptyState>}
      {list.length > 0 && <CounterStrip stats={stats} />}
      <ul className="flex flex-col gap-2">
        {list.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <Link href={`/meal/${m.id}`} className="min-w-0 flex-1">
              <p className="font-semibold">
                {t('history.mealRow', { n: m.mealNo })} · {longDate(m.mealDate)}
              </p>
              <StatusBadge status={m.status} mealDate={m.mealDate} />
              {m.note && <p className="mt-1 truncate text-sm text-slate-600">{m.note}</p>}
            </Link>
            {m.photo && (
              <button className="shrink-0" aria-label={t('history.photoOf', { date: longDate(m.mealDate) })} onClick={() => setViewing(m)}>
                <PhotoImage url={urls.data?.get(m.photo.thumbPath)} failed={urls.isError} alt={t('common.photo')} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {current && <PhotoViewer meal={current} personName={person?.first_name ?? ''} onClose={() => setViewing(null)} />}
    </section>
  )
}
