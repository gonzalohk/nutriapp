import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PersonFilter } from '@/components/PersonFilter'
import { Spinner } from '@/components/Spinner'
import { errorMessage } from '@/data/errors'
import { useHistory, usePeople } from '@/data/queries'
import { useSelectedPerson } from '@/data/selected-person'
import { todayInBolivia } from '@/domain/bolivia-time'
import { summariesOfYear, yearsOf } from '@/domain/history'
import { monthKey, yearOf } from '@/domain/plain-date'
import { monthTitle } from '@/i18n/format'
import { t } from '@/i18n/t'

/** Months of a year with "scheduled / contracted" and the count of each outcome. */
export function HistoryPage() {
  const people = usePeople()
  const [selected, setSelected] = useSelectedPerson()
  const active = useMemo(() => (people.data ?? []).filter((p) => p.active), [people.data])
  const person = active.find((p) => p.id === selected) ?? active[0]
  const history = useHistory(person?.id)
  const currentYear = yearOf(todayInBolivia())
  const [year, setYear] = useState<number>(currentYear)

  if (people.isPending) return <Spinner />
  if (people.isError) return <ErrorState message={errorMessage(people.error)} onRetry={() => void people.refetch()} />
  if (!person) return <EmptyState>{t('month.noPeople')}</EmptyState>

  const rows = history.data ?? []
  const years = yearsOf(rows, currentYear)
  const months = summariesOfYear(rows, year)

  return (
    <section className="flex flex-col gap-3 p-4">
      <h1 className="sr-only">{t('history.title')}</h1>
      <PersonFilter people={active} value={person.id} onChange={setSelected} />
      <div role="radiogroup" aria-label={t('history.year')} className="flex gap-2 overflow-x-auto">
        {years.map((y) => (
          <button key={y} role="radio" aria-checked={y === year} onClick={() => setYear(y)}
            className={`min-h-12 rounded-full px-4 font-semibold ${y === year ? 'bg-brand text-white' : 'border border-slate-300 bg-white'}`}>
            {y}
          </button>
        ))}
      </div>

      {history.isPending && <Spinner />}
      {history.isError && <ErrorState message={errorMessage(history.error)} onRetry={() => void history.refetch()} />}
      {history.isSuccess && months.length === 0 && <EmptyState>{t('history.noData')}</EmptyState>}

      <ul className="flex flex-col gap-2">
        {months.map((m) => (
          <li key={m.month}>
            <Link
              href={`/history/${person.id}/${monthKey(m.month)}`}
              aria-label={t('history.openMonth', { month: monthTitle(m.month) })}
              className="block rounded-2xl border border-slate-200 bg-white p-3"
            >
              <p className="flex items-center justify-between">
                <span className="text-lg font-bold">{monthTitle(m.month)}</span>
                <span className="font-semibold">{t('history.monthRow', { scheduled: m.scheduled, contracted: m.contracted })}</span>
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-700">
                <span>✔ {m.pickedUp}</span>
                <span>✖ {m.cancelled}</span>
                <span>⚠ {m.notPickedUp}</span>
                <span>✋ {m.permission}</span>
                {m.pending > 0 && <span>⏳ {m.pending}</span>}
                <span>📷 {m.photos}</span>
              </p>
              {(m.isPartial || m.needsReview) && (
                <p className="mt-1 text-xs text-slate-600">
                  {m.isPartial && t('history.partial')} {m.needsReview && `· ${t('history.needsReview')}`}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
