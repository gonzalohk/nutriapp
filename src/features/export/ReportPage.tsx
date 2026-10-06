import { useMemo } from 'react'
import { Link } from 'wouter'
import { Button } from '@/components/Button'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PersonFilter } from '@/components/PersonFilter'
import { Spinner } from '@/components/Spinner'
import { StatusBadge } from '@/components/StatusBadge'
import { errorMessage } from '@/data/errors'
import { useMonthMeals, usePeople } from '@/data/queries'
import { useSelectedPerson } from '@/data/selected-person'
import { todayInBolivia } from '@/domain/bolivia-time'
import { effectiveStatus } from '@/domain/meal-status'
import { addMonths, monthFromKey, monthKey, monthStart } from '@/domain/plain-date'
import { computeStats } from '@/domain/stats'
import { monthTitle, shortDate } from '@/i18n/format'
import { t } from '@/i18n/t'
import { STATUS_PRESENTATION } from '@/domain/meal-status'

/** Printable monthly report for one person. "Save as PDF" in the print dialog gives the PDF. */
export function ReportPage({ monthKeyValue }: { monthKeyValue?: string }) {
  const people = usePeople()
  const [selected, setSelected] = useSelectedPerson()
  const today = todayInBolivia()
  const month = monthKeyValue ? monthFromKey(monthKeyValue) : monthStart(today)
  const active = useMemo(() => (people.data ?? []).filter((p) => p.active), [people.data])
  const person = active.find((p) => p.id === selected) ?? active[0]
  const meals = useMonthMeals(person?.id ?? '', month)

  if (people.isPending) return <Spinner />
  if (people.isError) return <ErrorState message={errorMessage(people.error)} onRetry={() => void people.refetch()} />
  if (!person) return <EmptyState>{t('month.noPeople')}</EmptyState>

  const list = meals.data ?? []
  const stats = computeStats({
    meals: list.map((m) => ({ date: m.mealDate, status: m.status, hasPhoto: m.photo !== null })),
    contracted: list.length,
    isPartial: true,
    today,
  })
  const previous = monthKey(addMonths(month, -1))
  const next = monthKey(addMonths(month, 1))

  return (
    <section className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-3 print:hidden">
        <Link href="/more" className="inline-flex min-h-12 items-center font-semibold text-brand">‹ {t('common.back')}</Link>
        <PersonFilter people={active} value={person.id} onChange={setSelected} />
        <div className="flex items-center justify-between">
          <Link href={`/report/${previous}`} aria-label={t('month.previous')} className="flex min-h-12 min-w-12 items-center justify-center text-2xl">‹</Link>
          <p className="font-bold">{monthTitle(month)}</p>
          <Link href={`/report/${next}`} aria-label={t('month.next')} className="flex min-h-12 min-w-12 items-center justify-center text-2xl">›</Link>
        </div>
        <Button onClick={() => window.print()}>🖨 {t('report.print')}</Button>
      </div>

      <article aria-label={t('report.title')} className="rounded-2xl bg-white p-4 print:p-0">
        <h1 className="text-xl font-extrabold uppercase">{t('report.heading', { month: monthTitle(month) })}</h1>
        <p className="font-semibold">{person.first_name} {person.last_name ?? ''}</p>
        <p className="mb-2">{t('report.contracted', { n: stats.scheduledTotal })}</p>

        {meals.isPending && <Spinner />}
        {meals.isError && <ErrorState message={errorMessage(meals.error)} />}
        {meals.isSuccess && list.length === 0 && <p>{t('report.noMeals')}</p>}
        {list.length > 0 && (
          <>
            <h2 className="mt-2 font-bold">{t('report.counts')}</h2>
            <ul className="mb-2">
              <li>{t('stats.pickedUp')}: {stats.pickedUp}</li>
              <li>{t('stats.cancelled')}: {stats.cancelled}</li>
              <li>{t('stats.notPickedUp')}: {stats.notPickedUp}{stats.automaticNotPickedUp > 0 ? ` (${t('stats.automaticCount', { n: stats.automaticNotPickedUp })})` : ''}</li>
              <li>{t('stats.permission')}: {stats.permission}</li>
              <li>{t('stats.pending')}: {stats.pending}</li>
              <li>{t('stats.photos')}: {stats.photos}</li>
            </ul>
            <h2 className="font-bold">{t('report.detail')}</h2>
            <ul className="divide-y divide-slate-200">
              {list.map((m) => {
                const e = effectiveStatus(m.status, m.mealDate, today)
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-2 py-1">
                    <span className="font-mono">{shortDate(m.mealDate)}</span>
                    <span>— {STATUS_PRESENTATION[e.status].icon} <StatusBadge status={m.status} mealDate={m.mealDate} today={today} /></span>
                    {m.photo && <span>— 📷 {t('report.photoYes')}</span>}
                    {m.note && <span className="text-slate-600">— {m.note}</span>}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </article>
    </section>
  )
}
