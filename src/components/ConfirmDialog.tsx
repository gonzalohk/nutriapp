import { Button } from './Button'
import { Sheet } from './Sheet'
import { t } from '@/i18n/t'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation for destructive actions (spec FR-026: replacing or removing a photo). */
export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }: Props) {
  return (
    <Sheet title={title} onClose={onCancel}>
      <p className="mb-4 text-slate-700">{message}</p>
      <div className="flex gap-3">
        <Button variant="secondary" block onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} block onClick={onConfirm}>
          {confirmLabel ?? t('common.confirm')}
        </Button>
      </div>
    </Sheet>
  )
}
