import type { StatsWarning } from '@/domain/stats'
import { t } from '@/i18n/t'

const BOX = 'rounded-xl border p-3'

export function InconsistencyBanner({ warning }: { warning: Extract<StatsWarning, { kind: 'inconsistent' }> }) {
  return (
    <div role="alert" className={`${BOX} border-red-300 bg-red-50 text-red-900`}>
      ⚠ {t('stats.inconsistent', { sum: warning.sum, scheduled: warning.scheduled })}
    </div>
  )
}

export function ExcessBanner({ warning }: { warning: Extract<StatsWarning, { kind: 'excess' }> }) {
  return (
    <div role="alert" className={`${BOX} border-amber-300 bg-amber-50 text-amber-900`}>
      ⚠ {t('stats.excess', { scheduled: warning.scheduled, contracted: warning.contracted })}
    </div>
  )
}

export function NeedsReviewBanner() {
  return (
    <div role="alert" className={`${BOX} border-amber-300 bg-amber-50 text-amber-900`}>
      ⚠ {t('stats.needsReview')}
    </div>
  )
}
