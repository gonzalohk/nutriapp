import { effectiveStatus, STATUS_PRESENTATION, type MealStatus } from '@/domain/meal-status'
import { todayInBolivia } from '@/domain/bolivia-time'
import type { PlainDate } from '@/domain/plain-date'
import { t } from '@/i18n/t'
import { TONE_CLASSES } from './tones'


interface Props {
  status: MealStatus
  /** When given, a past `scheduled` meal is shown as automatic "not picked up". */
  mealDate?: PlainDate
  today?: PlainDate
  /** Flags shown when the change is queued for sync (offline). */
  pendingSync?: boolean
  photoPending?: boolean
}

/** Status is always icon + text + color, never color alone (spec FR-029). */
export function StatusBadge({ status, mealDate, today, pendingSync, photoPending }: Props) {
  const effective = mealDate
    ? effectiveStatus(status, mealDate, today ?? todayInBolivia())
    : { status, isAutomatic: false }
  const p = STATUS_PRESENTATION[effective.status]
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${TONE_CLASSES[p.tone]}`}>
        <span aria-hidden="true">{p.icon}</span>
        <span>{t(p.labelKey)}</span>
        {effective.isAutomatic && <span className="font-normal">({t('status.automatic')})</span>}
      </span>
      {pendingSync && <span className="text-xs text-slate-600">⟳ {t('status.pendingSync')}</span>}
      {photoPending && <span className="text-xs text-slate-600">📷 {t('status.photoPending')}</span>}
    </span>
  )
}
