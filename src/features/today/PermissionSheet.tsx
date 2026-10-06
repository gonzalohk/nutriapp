import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { t } from '@/i18n/t'

interface Props {
  onSave: (reason: string, photo: File | null) => void
  onClose: () => void
}

/** Permission to skip a meal: an optional reason and an optional photo, one Save button. */
export function PermissionSheet({ onSave, onClose }: Props) {
  const [reason, setReason] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  return (
    <Sheet title={t('today.permissionTitle')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('today.reason')}</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        <Button variant="secondary" onClick={() => input.current?.click()}>
          📷 {photo ? `✔ ${t('common.photo')}` : t('today.takePhoto')}
        </Button>
        <Button block onClick={() => onSave(reason.trim(), photo)}>
          {t('common.save')}
        </Button>
      </div>
    </Sheet>
  )
}
