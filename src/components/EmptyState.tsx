import type { ReactNode } from 'react'
import { t } from '@/i18n/t'

export function EmptyState({ children }: { children?: ReactNode }) {
  return <p className="p-6 text-center text-slate-600">{children ?? t('common.empty')}</p>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="p-6 text-center">
      <p className="mb-3 text-red-800">{message}</p>
      {onRetry && (
        <button className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 font-semibold" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}
