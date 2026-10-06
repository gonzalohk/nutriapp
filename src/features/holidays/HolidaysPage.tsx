import { useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Sheet } from '@/components/Sheet'
import { Spinner } from '@/components/Spinner'
import { previewDateChange, type DateChange } from '@/data/change-preview'
import { fetchHolidayCoverage } from '@/data/calendar-data'
import { ENSURE_KEY } from '@/data/ensure'
import { errorMessage } from '@/data/errors'
import { addHoliday, fetchExceptionalList, fetchYearHolidays, removeHoliday } from '@/data/holidays'
import { addExceptionalDelivery, removeExceptionalDelivery } from '@/data/mutations'
import { usePeople } from '@/data/queries'
import { todayInBolivia } from '@/domain/bolivia-time'
import { isValidPlainDate, toPlainDate, yearOf, type PlainDate } from '@/domain/plain-date'
import { longDate } from '@/i18n/format'
import { t } from '@/i18n/t'
import { ChangePreviewSheet } from './ChangePreviewSheet'

interface Pending {
  change: DateChange
  date: PlainDate
  apply: () => Promise<void>
}

const input = 'min-h-12 w-full rounded-xl border border-slate-300 px-3'

/** Holiday calendar and one-off delivery dates. Every change shows its effect before it is saved. */
export function HolidaysPage() {
  const queryClient = useQueryClient()
  const people = usePeople()
  const today = todayInBolivia()
  const [year, setYear] = useState(yearOf(today))
  const holidays = useQuery({ queryKey: ['holidays', year], queryFn: () => fetchYearHolidays(year) })
  const exceptional = useQuery({ queryKey: ['exceptional'], queryFn: fetchExceptionalList })
  const coverage = useQuery({ queryKey: ['holiday-coverage'], queryFn: () => fetchHolidayCoverage() })
  const [adding, setAdding] = useState<'holiday' | 'exceptional' | null>(null)
  const [date, setDate] = useState<string>(today)
  const [name, setName] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const preview = useQuery({
    queryKey: ['preview', pending?.change, pending?.date],
    enabled: Boolean(pending) && Boolean(people.data),
    queryFn: () => previewDateChange(people.data!, pending!.date, pending!.change, today),
    gcTime: 0,
  })

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['holidays'] })
    await queryClient.invalidateQueries({ queryKey: ['exceptional'] })
    await queryClient.invalidateQueries({ queryKey: [ENSURE_KEY] }) // current and next month regenerate
    await queryClient.invalidateQueries({ queryKey: ['month'] })
    await queryClient.invalidateQueries({ queryKey: ['today'] })
  }

  async function confirm() {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      await pending.apply()
      await refresh()
      setPending(null)
      setAdding(null)
      setName('')
    } catch (e) {
      setError(errorMessage(e))
    }
    setBusy(false)
  }

  function submitAdd(e: FormEvent) {
    e.preventDefault()
    if (!isValidPlainDate(date)) return
    const d = toPlainDate(date)
    if (adding === 'holiday') {
      setPending({ change: 'holiday-add', date: d, apply: () => addHoliday(d, name.trim() || 'Feriado') })
    } else {
      setPending({ change: 'exceptional-add', date: d, apply: () => addExceptionalDelivery(d, name.trim() || null) })
    }
  }

  const years = coverage.data ? Array.from({ length: coverage.data.lastYear - coverage.data.firstYear + 1 }, (_, i) => coverage.data.firstYear + i) : [year]
  const nearEnd = coverage.data && coverage.data.lastYear - yearOf(today) <= 1

  return (
    <section className="flex flex-col gap-4 p-4">
      <Link href="/more" className="inline-flex min-h-12 items-center font-semibold text-brand">‹ {t('common.back')}</Link>
      <h1 className="text-2xl font-bold">{t('holidays.title')}</h1>
      {nearEnd && coverage.data && (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t('holidays.coverageWarning', { year: coverage.data.lastYear })}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">{t('holidays.year')}</span>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={input}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>

      {holidays.isPending && <Spinner />}
      {holidays.isError && <ErrorState message={errorMessage(holidays.error)} onRetry={() => void holidays.refetch()} />}
      <ul className="flex flex-col gap-2">
        {holidays.data?.map((h) => (
          <li key={h.date} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3">
            <div>
              <p className="font-semibold">{longDate(h.date)}</p>
              <p className="text-sm text-slate-600">
                {h.name} · {h.source === 'custom' ? t('holidays.custom') : t('holidays.official')}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setPending({ change: 'holiday-remove', date: h.date, apply: () => removeHoliday(h.date) })}>
              {t('holidays.remove')}
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" onClick={() => { setAdding('holiday'); setDate(today) }}>＋ {t('holidays.add')}</Button>

      <h2 className="mt-2 text-xl font-bold">{t('holidays.exceptional')}</h2>
      {exceptional.data?.length === 0 && <EmptyState>{t('holidays.noExceptional')}</EmptyState>}
      <ul className="flex flex-col gap-2">
        {exceptional.data?.map((x) => (
          <li key={x.date} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3">
            <div>
              <p className="font-semibold">{longDate(x.date)}</p>
              {x.note && <p className="text-sm text-slate-600">{x.note}</p>}
            </div>
            <Button variant="ghost" onClick={async () => { await removeExceptionalDelivery(x.date); await refresh() }}>
              {t('holidays.removeExceptional')}
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" onClick={() => { setAdding('exceptional'); setDate(today) }}>＋ {t('holidays.addExceptional')}</Button>

      {adding && !pending && (
        <Sheet title={adding === 'holiday' ? t('holidays.add') : t('holidays.addExceptional')} onClose={() => setAdding(null)}>
          <form onSubmit={submitAdd} className="flex flex-col gap-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{t('holidays.date')}</span>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{adding === 'holiday' ? t('holidays.name') : t('month.exceptionalNote')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
            </label>
            <Button type="submit" block>{t('holidays.continue')}</Button>
          </form>
        </Sheet>
      )}
      {pending && (
        <ChangePreviewSheet
          rows={preview.isError ? [] : preview.data}
          error={error ?? (preview.isError ? errorMessage(preview.error) : null)}
          busy={busy}
          onCancel={() => { setPending(null); setError(null) }}
          onConfirm={() => void confirm()}
        />
      )}
    </section>
  )
}
