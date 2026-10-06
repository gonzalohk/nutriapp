import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { ENSURE_KEY } from '@/data/ensure'
import { errorMessage } from '@/data/errors'
import { addExceptionalDelivery } from '@/data/mutations'
import { isValidPlainDate, monthStart, type PlainDate } from '@/domain/plain-date'
import { t } from '@/i18n/t'

interface Props {
  /** Month being viewed; the date picker starts there. */
  month: PlainDate
  onClose: () => void
}

/** Register a one-off delivery date (for example a Saturday) for the whole household. */
export function ExceptionalDeliverySheet({ month, onClose }: Props) {
  const queryClient = useQueryClient()
  const [date, setDate] = useState<string>(month)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isValidPlainDate(date)) return
    setBusy(true)
    setError(null)
    try {
      await addExceptionalDelivery(date, note.trim() || null)
      // Regenerate the affected month for everyone: the new day may now be eligible.
      await queryClient.invalidateQueries({ queryKey: [ENSURE_KEY] })
      await queryClient.invalidateQueries({ queryKey: ['month'] })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Sheet title={t('month.exceptionalTitle')} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('month.exceptionalDate')}</span>
          <input
            type="date"
            required
            min={monthStart(month)}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-slate-300 px-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('month.exceptionalNote')}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3" />
        </label>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <Button type="submit" block disabled={busy}>
          {t('common.save')}
        </Button>
      </form>
    </Sheet>
  )
}
