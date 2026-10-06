import { TONE_CLASSES } from '@/components/tones'
import { STATUS_PRESENTATION } from '@/domain/meal-status'
import type { MonthStats } from '@/domain/stats'
import { t } from '@/i18n/t'

interface Props {
  stats: MonthStats
}

function Tile({ label, value, hint, className }: { label: string; value: number | string; hint?: string; className: string }) {
  return (
    <div className={`rounded-xl p-2 text-center ${className}`}>
      <dd className="text-2xl font-extrabold leading-tight">{value}</dd>
      <dt className="text-xs font-semibold leading-tight">{label}</dt>
      {hint && <p className="text-[10px] leading-tight opacity-80">{hint}</p>}
    </div>
  )
}

/** The monthly control: contracted, the five outcomes, percentage and photo count. */
export function CounterStrip({ stats }: Props) {
  const tone = (s: keyof typeof STATUS_PRESENTATION) => TONE_CLASSES[STATUS_PRESENTATION[s].tone]
  return (
    <section aria-label={t('stats.title')} className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="mb-2 text-sm font-semibold text-slate-700">
        {t('stats.contracted')}: {stats.contracted}
      </p>
      <dl className="grid grid-cols-3 gap-2">
        <Tile label={t('stats.pickedUp')} value={stats.pickedUp} className={tone('picked_up')} />
        <Tile label={t('stats.cancelled')} value={stats.cancelled} className={tone('cancelled')} />
        <Tile
          label={t('stats.notPickedUp')}
          value={stats.notPickedUp}
          hint={stats.automaticNotPickedUp > 0 ? t('stats.automaticCount', { n: stats.automaticNotPickedUp }) : undefined}
          className={tone('not_picked_up')}
        />
        <Tile label={t('stats.permission')} value={stats.permission} className={tone('permission')} />
        <Tile label={t('stats.pending')} value={stats.pending} className={tone('scheduled')} />
        <Tile label={t('stats.percent')} value={`${stats.pickedUpPercent}%`} className="bg-slate-100 text-slate-900" />
      </dl>
      <p className="mt-2 text-sm text-slate-600">
        📷 {t('stats.photos')}: {stats.photos}
      </p>
    </section>
  )
}
