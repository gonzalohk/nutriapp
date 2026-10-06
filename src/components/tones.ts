import type { StatusPresentation } from '@/domain/meal-status'

/** Static class names so Tailwind can see them. Pairs are chosen for WCAG AA contrast. */
export const TONE_CLASSES: Record<StatusPresentation['tone'], string> = {
  pending: 'bg-pending-bg text-pending-fg',
  picked: 'bg-picked-bg text-picked-fg',
  cancelled: 'bg-cancelled-bg text-cancelled-fg',
  missed: 'bg-missed-bg text-missed-fg',
  permission: 'bg-permission-bg text-permission-fg',
}
