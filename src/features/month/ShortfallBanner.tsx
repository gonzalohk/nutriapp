import { t } from '@/i18n/t'

interface Props {
  available: number
  contracted: number
  onAddExceptional?: () => void
}

/** Shown when the month has fewer delivery days than contracted meals (spec US2 scenario 5). */
export function ShortfallBanner({ available, contracted, onAddExceptional }: Props) {
  return (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
      <p className="font-semibold">
        ⚠ {t('month.shortfall', { available, contracted, missing: contracted - available })}
      </p>
      <p className="mt-1 text-sm">{t('month.shortfallHint')}</p>
      {onAddExceptional && (
        <button className="mt-2 min-h-12 rounded-xl border border-amber-400 bg-white px-4 font-semibold" onClick={onAddExceptional}>
          {t('month.addExceptional')}
        </button>
      )}
    </div>
  )
}
