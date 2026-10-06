import { useState } from 'react'
import { Sheet } from '@/components/Sheet'
import { StatusBadge } from '@/components/StatusBadge'
import type { TodayEntry } from '@/data/today'
import { t } from '@/i18n/t'
import { PersonMealCard } from './PersonMealCard'

interface Props {
  entries: TodayEntry[]
  totals: Map<string, { pending: number; contracted: number }> | undefined
}

/**
 * Everyone's outcome for today in compact rows, so four people fit on one phone screen
 * (spec SC-005). Tapping a row opens that person's four actions.
 */
export function TodayAllList({ entries, totals }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = entries.find((e) => e.person.id === openId)

  return (
    <>
      <p className="text-sm text-slate-600">{t('today.selectPerson')}</p>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.person.id}>
            <button
              className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left"
              onClick={() => setOpenId(entry.person.id)}
            >
              <span className="text-lg font-bold">{entry.person.first_name}</span>
              {entry.meal ? (
                <StatusBadge status={entry.meal.status} mealDate={entry.meal.mealDate} pendingSync={entry.meal.pendingSync} photoPending={entry.meal.photoPending} />
              ) : (
                <span className="text-sm text-slate-600">{t(`today.noMeal.${entry.reason ?? 'no_delivery'}`, { name: entry.holidayName ?? '' })}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <Sheet title={t('today.mealOf', { name: open.person.first_name })} onClose={() => setOpenId(null)}>
          <PersonMealCard entry={open} totals={totals?.get(open.person.id)} />
        </Sheet>
      )}
    </>
  )
}
