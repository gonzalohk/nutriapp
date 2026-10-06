import { useState } from 'react'
import { Link } from 'wouter'
import { Button } from '@/components/Button'
import { errorMessage } from '@/data/errors'
import { loadExportData } from '@/data/export-data'
import { getSignedUrls } from '@/data/photos'
import { todayInBolivia } from '@/domain/bolivia-time'
import { t } from '@/i18n/t'
import { changesCsv, mealsCsv } from './csv'
import { csvBlob, downloadBlob } from './download'

type Job = 'meals' | 'changes' | 'photos'

/** Export every record (CSV) and every photo (ZIP) so nothing is ever locked in the app. */
export function ExportPage() {
  const [job, setJob] = useState<Job | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [empty, setEmpty] = useState(false)
  const stamp = todayInBolivia()

  async function run(kind: Job) {
    setJob(kind)
    setError(null)
    setEmpty(false)
    setProgress(null)
    try {
      const data = await loadExportData()
      if (data.meals.length === 0) {
        setEmpty(true)
      } else if (kind === 'meals') {
        downloadBlob(csvBlob(mealsCsv(data.meals)), `nutrilara-comidas-${stamp}.csv`)
      } else if (kind === 'changes') {
        downloadBlob(csvBlob(changesCsv(data.changes)), `nutrilara-cambios-${stamp}.csv`)
      } else {
        const { buildPhotoZip } = await import('./photo-zip')
        // Signed URLs are requested in batches, then each photo is downloaded one at a time.
        const urls = new Map<string, string>()
        const paths = data.photos.map((p) => p.storagePath)
        for (let i = 0; i < paths.length; i += 100) {
          for (const [path, url] of await getSignedUrls(paths.slice(i, i + 100))) urls.set(path, url)
        }
        const zip = await buildPhotoZip(data.photos, {
          fetchPhoto: async (path) => {
            const res = await fetch(urls.get(path)!)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return new Uint8Array(await res.arrayBuffer())
          },
          onProgress: (done, total) => setProgress({ done, total }),
        })
        downloadBlob(zip, `nutrilara-fotos-${stamp}.zip`)
      }
    } catch (e) {
      setError(errorMessage(e))
    }
    setJob(null)
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      <Link href="/more" className="inline-flex min-h-12 items-center font-semibold text-brand">‹ {t('common.back')}</Link>
      <h1 className="text-2xl font-bold">{t('export.title')}</h1>
      <p className="text-slate-700">{t('export.intro')}</p>
      <Button disabled={job !== null} onClick={() => void run('meals')}>⬇ {t('export.meals')}</Button>
      <Button variant="secondary" disabled={job !== null} onClick={() => void run('changes')}>⬇ {t('export.changes')}</Button>
      <div>
        <Button variant="secondary" block disabled={job !== null} onClick={() => void run('photos')}>⬇ {t('export.photos')}</Button>
        <p className="mt-1 text-sm text-slate-600">{t('export.photosHint')}</p>
      </div>
      <div aria-live="polite" className="text-slate-700">
        {job && !progress && <p>{t('export.working')}</p>}
        {progress && <p>{t('export.progress', progress)}</p>}
        {empty && <p>{t('export.empty')}</p>}
      </div>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    </section>
  )
}
