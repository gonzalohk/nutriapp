import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PersonFilter } from '@/components/PersonFilter'
import { Spinner } from '@/components/Spinner'
import { ensureMonthQuery } from '@/data/ensure'
import { errorMessage } from '@/data/errors'
import { overlayToday } from '@/data/outbox-overlay'
import { useSelectedPerson } from '@/data/selected-person'
import { useOutboxOps } from '@/data/sync'
import { useMonthTotals, usePeople, useToday } from '@/data/queries'
import { todayInBolivia } from '@/domain/bolivia-time'
import { monthStart } from '@/domain/plain-date'
import { longDate } from '@/i18n/format'
import { t } from '@/i18n/t'
import { PersonMealCard } from './PersonMealCard'
import { TodayAllList } from './TodayAllList'

export function TodayPage() {
  const people = usePeople()
  const today = todayInBolivia()
  const active = (people.data ?? []).filter((p) => p.active)
  const [selected, setSelected] = useSelectedPerson()
  const choice = selected && active.some((p) => p.id === selected) ? selected : 'all'

  // Today's meals must exist before they are read, even on the first day of a month.
  const ensured = useQueries({ queries: active.map((p) => ensureMonthQuery(p, monthStart(today))) })
  const ready = people.isSuccess && ensured.every((q) => !q.isPending)
  const entries = useToday(people.data, today, ready)
  const totals = useMonthTotals(monthStart(today), ready)
  const ops = useOutboxOps()
  const shown = useMemo(() => (entries.data ? overlayToday(entries.data, ops) : undefined), [entries.data, ops])

  if (people.isPending || (!ready && !people.isError)) return <Spinner />
  if (people.isError) return <ErrorState message={errorMessage(people.error)} onRetry={() => void people.refetch()} />
  if (active.length === 0) return <EmptyState>{t('today.noPeople')}</EmptyState>
  if (entries.isError) return <ErrorState message={errorMessage(entries.error)} onRetry={() => void entries.refetch()} />
  if (!shown) return <Spinner />

  const failed = ensured.find((q) => q.isError)
  return (
    <section className="flex flex-col gap-3 p-4">
      <header>
        <h1 className="text-2xl font-extrabold">{longDate(today)}</h1>
      </header>
      {failed && <ErrorState message={`${t('month.ensureError')} ${errorMessage(failed.error)}`} onRetry={() => void failed.refetch()} />}
      <PersonFilter people={active} value={choice} onChange={setSelected} showAll />
      {choice === 'all' ? (
        <TodayAllList entries={shown} totals={totals.data} />
      ) : (
        shown
          .filter((entry) => entry.person.id === choice)
          .map((entry) => <PersonMealCard key={entry.person.id} entry={entry} totals={totals.data?.get(entry.person.id)} />)
      )}
    </section>
  )
}
