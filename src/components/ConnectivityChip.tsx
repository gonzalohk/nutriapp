import { useQueryClient } from '@tanstack/react-query'
import { syncNow, useOnline, useOutboxOps } from '@/data/sync'
import { t } from '@/i18n/t'

/** Tells the user when the phone is offline and how many changes are waiting to be sent. */
export function ConnectivityChip() {
  const online = useOnline()
  const ops = useOutboxOps()
  const queryClient = useQueryClient()
  if (online && ops.length === 0) return null
  return (
    <div role="status" className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">
      <span>
        {!online && <span>📴 {t('sync.offline')} </span>}
        {ops.length > 0 && <span>⟳ {t('sync.pending', { n: ops.length })}</span>}
      </span>
      {online && ops.length > 0 && (
        <button className="min-h-12 shrink-0 font-semibold underline" onClick={() => void syncNow(queryClient)}>
          {t('sync.syncNow')}
        </button>
      )}
    </div>
  )
}
