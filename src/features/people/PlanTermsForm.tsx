import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { Spinner } from '@/components/Spinner'
import { ENSURE_KEY } from '@/data/ensure'
import { errorMessage } from '@/data/errors'
import { fetchPlanTerm, savePlanTerm } from '@/data/plan-terms'
import type { Person } from '@/data/types'
import { todayInBolivia } from '@/domain/bolivia-time'
import { addMonths, monthStart, type IsoWeekday } from '@/domain/plain-date'
import { WEEKDAY_ORDER } from '@/domain/month-view'
import { weekdayShort } from '@/i18n/format'
import { t } from '@/i18n/t'

const input = 'min-h-12 w-full rounded-xl border border-slate-300 px-3'

/**
 * Change meals per month, delivery days or pickup time from a month on. New terms are added; earlier
 * months keep the terms they were generated with, and past months are never recalculated.
 */
export function PlanTermsForm({ person, onClose }: { person: Person; onClose: () => void }) {
  const queryClient = useQueryClient()
  const thisMonth = monthStart(todayInBolivia())
  const nextMonth = addMonths(thisMonth, 1)
  const current = useQuery({ queryKey: ['plan-term', person.id, nextMonth], queryFn: () => fetchPlanTerm(person.id, nextMonth) })
  const [from, setFrom] = useState(nextMonth)
  const [meals, setMeals] = useState<string | null>(null)
  const [days, setDays] = useState<IsoWeekday[] | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (current.isPending) return <Sheet title={t('plan.title', { name: person.first_name })} onClose={onClose}><Spinner /></Sheet>

  const mealsValue = meals ?? String(current.data?.meals_per_month ?? 20)
  const daysValue = days ?? ((current.data?.delivery_weekdays ?? [1, 2, 3, 4, 5]) as IsoWeekday[])
  const timeValue = time ?? current.data?.pickup_time?.slice(0, 5) ?? ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (daysValue.length === 0) {
      setError(t('plan.noWeekday'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await savePlanTerm({ personId: person.id, effectiveFrom: from, mealsPerMonth: Number(mealsValue), weekdays: [...daysValue].sort(), pickupTime: timeValue || null })
      await queryClient.invalidateQueries({ queryKey: [ENSURE_KEY] })
      await queryClient.invalidateQueries({ queryKey: ['month'] })
      await queryClient.invalidateQueries({ queryKey: ['today'] })
      await queryClient.invalidateQueries({ queryKey: ['plan-term'] })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Sheet title={t('plan.title', { name: person.first_name })} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('plan.effectiveFrom')}</span>
          <select value={from} onChange={(e) => setFrom(e.target.value as typeof from)} className={input}>
            <option value={nextMonth}>{t('plan.nextMonth')}</option>
            <option value={thisMonth}>{t('plan.thisMonth')}</option>
          </select>
          <span className="mt-1 block text-xs text-slate-600">{t('plan.hint')}</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('plan.mealsPerMonth')}</span>
          <input type="number" inputMode="numeric" min={1} max={31} required value={mealsValue} onChange={(e) => setMeals(e.target.value)} className={input} />
        </label>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">{t('plan.weekdays')}</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_ORDER.map((w) => {
              const on = daysValue.includes(w)
              return (
                <button type="button" key={w} role="checkbox" aria-checked={on}
                  onClick={() => setDays(on ? daysValue.filter((x) => x !== w) : [...daysValue, w])}
                  className={`min-h-12 min-w-12 rounded-xl px-3 font-semibold ${on ? 'bg-brand text-white' : 'border border-slate-300 bg-white'}`}>
                  {weekdayShort(w)}
                </button>
              )
            })}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('plan.pickupTime')}</span>
          <input type="time" value={timeValue} onChange={(e) => setTime(e.target.value)} className={input} />
        </label>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <Button type="submit" block disabled={busy}>{t('common.save')}</Button>
      </form>
    </Sheet>
  )
}
