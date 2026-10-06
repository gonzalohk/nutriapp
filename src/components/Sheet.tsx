import { useEffect, useId, type ReactNode } from 'react'
import { t } from '@/i18n/t'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Bottom sheet dialog. Closes on Escape or on a tap outside it. */
export function Sheet({ title, onClose, children }: Props) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90%] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button className="min-h-12 min-w-12 text-slate-600" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
