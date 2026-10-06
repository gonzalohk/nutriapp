import { Link } from 'wouter'
import { TONE_CLASSES } from '@/components/tones'
import { STATUS_PRESENTATION } from '@/domain/meal-status'
import type { DayCell } from '@/domain/month-view'
import { WEEKDAY_ORDER } from '@/domain/month-view'
import { longDate, weekdayShort } from '@/i18n/format'
import { t } from '@/i18n/t'

const BASE = 'flex min-h-14 flex-col items-center justify-center rounded-lg p-1 text-sm'

/** One month as a Monday-first grid. Status is always icon + text label, never color alone. */
export function CalendarGrid({ cells }: { cells: DayCell[] }) {
  return (
    <div role="grid" aria-label={t('month.title')} className="grid grid-cols-7 gap-1">
      {WEEKDAY_ORDER.map((w) => (
        <div key={w} role="columnheader" className="py-1 text-center text-xs font-semibold uppercase text-slate-600">
          {weekdayShort(w)}
        </div>
      ))}
      {cells.map((cell, i) => (
        <Cell key={i} cell={cell} />
      ))}
    </div>
  )
}

function Cell({ cell }: { cell: DayCell }) {
  switch (cell.kind) {
    case 'padding':
      return <div role="gridcell" aria-hidden="true" />
    case 'meal': {
      const { meal } = cell
      const p = STATUS_PRESENTATION[meal.effectiveStatus]
      const label = `${longDate(cell.date)}: ${t('month.mealLabel', { n: meal.mealNo })}, ${t(p.labelKey)}${meal.isAutomatic ? ` (${t('status.automatic')})` : ''}${meal.hasPhoto ? `, ${t('common.photo')}` : ''}`
      return (
        <Link href={`/meal/${meal.id}`} role="gridcell" aria-label={label} className={`${BASE} ${TONE_CLASSES[p.tone]}`}>
          <span className="text-[10px] leading-none opacity-80">#{meal.mealNo}</span>
          <span className="font-bold leading-tight">{cell.day}</span>
          <span aria-hidden="true" className="leading-none">
            {p.icon}
            {meal.hasPhoto ? '📷' : ''}
          </span>
        </Link>
      )
    }
    case 'holiday':
      return (
        <div
          role="gridcell"
          aria-label={`${longDate(cell.date)}: ${t('month.holiday')}, ${cell.holidayName}`}
          title={cell.holidayName}
          className={`${BASE} bg-slate-200 text-slate-700`}
        >
          <span className="font-bold leading-tight">{cell.day}</span>
          <span className="w-full truncate text-center text-[10px] leading-none">{t('month.holiday')}</span>
        </div>
      )
    case 'weekend':
      return (
        <div role="gridcell" aria-label={`${longDate(cell.date)}: ${t('month.weekend')}`} className={`${BASE} bg-slate-100 text-slate-600`}>
          <span className="leading-tight">{cell.day}</span>
        </div>
      )
    case 'extra':
      return (
        <div
          role="gridcell"
          aria-label={`${longDate(cell.date)}: ${t('month.notInPlan')}`}
          className={`${BASE} border-2 border-dashed border-slate-300 text-slate-600`}
        >
          <span className="leading-tight">{cell.day}</span>
          <span className="w-full text-center text-[9px] leading-tight">{t('month.notInPlan')}</span>
        </div>
      )
    case 'off':
      return (
        <div role="gridcell" aria-label={`${longDate(cell.date)}: ${t('month.noMeal')}`} className={`${BASE} text-slate-500`}>
          <span className="leading-tight">{cell.day}</span>
        </div>
      )
  }
}
