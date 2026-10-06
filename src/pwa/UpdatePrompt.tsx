import { useRegisterSW } from 'virtual:pwa-register/react'
import { t } from '@/i18n/t'

/** Offers a new version of the app; it is applied only when the user chooses to. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div role="status" className="fixed inset-x-4 bottom-20 z-50 flex items-center justify-between gap-3 rounded-xl bg-slate-900 p-3 text-white shadow-lg print:hidden">
      <span>{t('sync.updateAvailable')}</span>
      <button className="min-h-12 rounded-lg bg-white px-4 font-semibold text-slate-900" onClick={() => void updateServiceWorker(true)}>
        {t('sync.update')}
      </button>
    </div>
  )
}
