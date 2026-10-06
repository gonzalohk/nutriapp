import { Button } from '@/components/Button'
import type { RecordableStatus } from '@/domain/meal-status'
import { t, type MessageKey } from '@/i18n/t'

const ACTIONS: { status: RecordableStatus; icon: string; label: MessageKey; variant: 'primary' | 'secondary' }[] = [
  { status: 'picked_up', icon: '📷', label: 'action.pickedUp', variant: 'primary' },
  { status: 'cancelled', icon: '✖', label: 'action.cancelled', variant: 'secondary' },
  { status: 'not_picked_up', icon: '⚠', label: 'action.notPickedUp', variant: 'secondary' },
  { status: 'permission', icon: '✋', label: 'action.permission', variant: 'secondary' },
]

interface Props {
  onChoose: (status: RecordableStatus) => void
  /** Highlight the current status when correcting a meal. */
  current?: RecordableStatus | null
  disabled?: boolean
}

/** The four large outcome buttons. "Scheduled" is never offered (spec FR-015). */
export function StatusButtons({ onChoose, current, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ACTIONS.map((a) => (
        <Button
          key={a.status}
          variant={current === a.status ? 'primary' : a.variant}
          className="min-h-14 text-lg"
          disabled={disabled}
          aria-pressed={current === a.status}
          onClick={() => onChoose(a.status)}
        >
          <span aria-hidden="true">{a.icon}</span> {t(a.label)}
        </Button>
      ))}
    </div>
  )
}
