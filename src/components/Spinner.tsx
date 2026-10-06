import { t } from '@/i18n/t'

export function Spinner() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 p-6 text-slate-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
      <span>{t('common.loading')}</span>
    </div>
  )
}
