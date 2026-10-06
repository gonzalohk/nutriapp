import type { Person } from '@/data/types'
import { t } from '@/i18n/t'

interface Props {
  people: readonly Person[]
  /** Selected person id, or 'all' when `showAll` is on. */
  value: string | 'all'
  onChange: (value: string | 'all') => void
  /** Offer the "All" chip (only the Today screen supports it). */
  showAll?: boolean
}

/** Chips to switch quickly between people. */
export function PersonFilter({ people, value, onChange, showAll }: Props) {
  const chip = (selected: boolean) =>
    `min-h-12 shrink-0 rounded-full px-4 text-base font-semibold ${selected ? 'bg-brand text-white' : 'bg-white text-slate-800 border border-slate-300'}`
  return (
    <div role="radiogroup" aria-label={t('person.select')} className="flex gap-2 overflow-x-auto py-1">
      {showAll && (
        <button role="radio" aria-checked={value === 'all'} className={chip(value === 'all')} onClick={() => onChange('all')}>
          {t('common.all')}
        </button>
      )}
      {people.map((p) => (
        <button key={p.id} role="radio" aria-checked={value === p.id} className={chip(value === p.id)} onClick={() => onChange(p.id)}>
          {p.first_name}
        </button>
      ))}
    </div>
  )
}
