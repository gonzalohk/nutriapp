import type { PhotoExportItem } from '@/data/export-data'
import { mealsCsv, photoFileName, photosCsv } from './csv'

export interface ZipOptions {
  /** Returns the bytes of the photo stored at `storagePath`. */
  fetchPhoto: (storagePath: string) => Promise<Uint8Array>
  onProgress?: (done: number, total: number) => void
}

/**
 * A ZIP with every photo (organized by person) plus `photos.csv`, which maps each file to its meal.
 * fflate is loaded on demand, so it costs nothing until someone exports. Photos are already
 * compressed, so they are stored without recompressing.
 */
export async function buildPhotoZip(items: readonly PhotoExportItem[], options: ZipOptions): Promise<Blob> {
  const { Zip, ZipPassThrough, strToU8 } = await import('fflate')
  const chunks: Uint8Array[] = []
  let failure: Error | null = null
  const zip = new Zip((error, chunk) => {
    if (error) failure = error
    else chunks.push(chunk)
  })

  let done = 0
  for (const { meal, storagePath } of items) {
    const bytes = await options.fetchPhoto(storagePath)
    const entry = new ZipPassThrough(photoFileName(meal.personName, meal.date, meal.mealNo, meal.photoMime ?? 'image/webp'))
    zip.add(entry)
    entry.push(bytes, true)
    options.onProgress?.(++done, items.length)
  }

  const mapping = new ZipPassThrough('photos.csv')
  zip.add(mapping)
  mapping.push(strToU8(photosCsv(items.map((i) => i.meal))), true)
  const records = new ZipPassThrough('meals.csv')
  zip.add(records)
  records.push(strToU8(mealsCsv(items.map((i) => i.meal))), true)

  zip.end()
  if (failure) throw failure
  return new Blob(chunks as BlobPart[], { type: 'application/zip' })
}
