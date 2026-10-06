import { useRef } from 'react'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { t } from '@/i18n/t'

interface Props {
  onPhoto: (file: File) => void
  onSkip: () => void
  onClose: () => void
}

/** Camera step after "Picked up". Skipping the photo is always one tap away (spec FR-020). */
export function PhotoStep({ onPhoto, onSkip, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <Sheet title={t('today.photoTitle')} onClose={onClose}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPhoto(file)
          e.target.value = ''
        }}
      />
      <div className="flex flex-col gap-3">
        <Button className="min-h-14 text-lg" onClick={() => input.current?.click()}>
          📷 {t('today.takePhoto')}
        </Button>
        <Button variant="secondary" className="min-h-14 text-lg" onClick={onSkip}>
          {t('today.skipPhoto')}
        </Button>
      </div>
    </Sheet>
  )
}
