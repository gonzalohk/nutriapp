import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { Spinner } from '@/components/Spinner'
import type { PreviewRow } from '@/data/change-preview'
import { monthTitle, shortDate } from '@/i18n/format'
import { t } from '@/i18n/t'

interface Props {
  title?: string
  /** Undefined while the effect is being computed. */
  rows: PreviewRow[] | undefined
  error?: string | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Shows what a change will do to people's meals before it is saved; recorded meals are never touched. */
export function ChangePreviewSheet({ title, rows, error, busy, onConfirm, onCancel }: Props) {
  return (
    <Sheet title={title ?? t('holidays.previewTitle')} onClose={onCancel}>
      {!rows ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.length === 0 && <p>{t('holidays.previewNone')}</p>}
          {rows.map((row) => (
            <div key={`${row.person.id}-${row.month}`} className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-bold">{t('holidays.previewLine', { name: row.person.first_name, month: monthTitle(row.month) })}</p>
              {row.summary.remove.length > 0 && (
                <p>➖ {t('holidays.previewRemove', { n: row.summary.remove.length, dates: row.summary.remove.map(shortDate).join(', ') })}</p>
              )}
              {row.summary.add.length > 0 && (
                <p>➕ {t('holidays.previewAdd', { n: row.summary.add.length, dates: row.summary.add.map(shortDate).join(', ') })}</p>
              )}
              {row.summary.keptFlagged.length > 0 && (
                <p>⚠ {t('holidays.previewFlag', { n: row.summary.keptFlagged.length, dates: row.summary.keptFlagged.map(shortDate).join(', ') })}</p>
              )}
            </div>
          ))}
          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" block onClick={onCancel}>{t('common.cancel')}</Button>
            <Button block disabled={busy} onClick={onConfirm}>{t('holidays.applyChange')}</Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
