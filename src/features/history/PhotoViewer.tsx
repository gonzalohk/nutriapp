import { Link } from 'wouter'
import { PhotoImage } from '@/components/PhotoThumb'
import { Sheet } from '@/components/Sheet'
import { StatusBadge } from '@/components/StatusBadge'
import { useSignedUrl } from '@/data/queries'
import type { MealSummary } from '@/data/today'
import { PhotoSection } from '@/features/meal/PhotoSection'
import { longDate } from '@/i18n/format'
import { t } from '@/i18n/t'

interface Props {
  meal: MealSummary
  personName: string
  onClose: () => void
}

/**
 * Full-size photo with the meal's date, person, status and note. The big image is requested only
 * now, when the user taps a thumbnail (spec FR-025).
 */
export function PhotoViewer({ meal, personName, onClose }: Props) {
  const full = useSignedUrl(meal.photo?.storagePath)
  return (
    <Sheet title={t('history.photoOf', { date: longDate(meal.mealDate) })} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {full.data ? (
          <img src={full.data} alt={t('history.fullPhoto')} className="max-h-[60vh] w-full rounded-xl object-contain" />
        ) : (
          <div className="flex h-48 items-center justify-center rounded-xl bg-slate-100">
            <PhotoImage url={undefined} failed={full.isError} />
          </div>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="font-semibold">{t('person.select')}</dt>
          <dd>{personName}</dd>
          <dt className="font-semibold">{t('meal.status')}</dt>
          <dd><StatusBadge status={meal.status} mealDate={meal.mealDate} /></dd>
          {meal.note && (
            <>
              <dt className="font-semibold">{t('meal.note')}</dt>
              <dd>{meal.note}</dd>
            </>
          )}
        </dl>
        <PhotoSection meal={meal} showThumb={false} />
        <Link href={`/meal/${meal.id}`} className="font-semibold text-brand underline">
          {t('history.openMeal')}
        </Link>
      </div>
    </Sheet>
  )
}
