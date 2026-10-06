import { useState, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { errorMessage } from '@/data/errors'
import type { Person } from '@/data/types'
import { todayInBolivia } from '@/domain/bolivia-time'
import { isValidPlainDate } from '@/domain/plain-date'
import { t } from '@/i18n/t'
import { usePeopleActions } from './usePeopleActions'

const inputClass = 'min-h-12 w-full rounded-xl border border-slate-300 px-3'

/** Add a person, or rename an existing one. The plan start and meals per month are set once, at creation. */
export function PersonForm({ person, onClose }: { person?: Person; onClose: () => void }) {
  const { create, rename } = usePeopleActions()
  const [firstName, setFirstName] = useState(person?.first_name ?? '')
  const [lastName, setLastName] = useState(person?.last_name ?? '')
  const [planStart, setPlanStart] = useState<string>(todayInBolivia())
  const [meals, setMeals] = useState('20')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (person) {
        await rename.mutateAsync({ person, firstName: firstName.trim(), lastName: lastName.trim() })
      } else {
        if (!isValidPlainDate(planStart)) return
        await create.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim(), planStart, mealsPerMonth: Number(meals) })
      }
      onClose()
    } catch (err) {
      setError(`${t('people.createError')} ${errorMessage(err)}`)
    }
  }

  const busy = create.isPending || rename.isPending
  return (
    <Sheet title={person ? t('people.edit') : t('people.add')} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('people.firstName')}</span>
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('people.lastName')}</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
        </label>
        {!person && (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{t('people.planStart')}</span>
              <input type="date" required value={planStart} onChange={(e) => setPlanStart(e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{t('people.mealsPerMonth')}</span>
              <input type="number" inputMode="numeric" min={1} max={31} required value={meals} onChange={(e) => setMeals(e.target.value)} className={inputClass} />
            </label>
          </>
        )}
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <Button type="submit" block disabled={busy}>
          {t('common.save')}
        </Button>
      </form>
    </Sheet>
  )
}
