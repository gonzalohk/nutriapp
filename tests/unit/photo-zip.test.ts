import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import type { PhotoExportItem } from '@/data/export-data'
import { toPlainDate } from '@/domain/plain-date'
import { buildPhotoZip } from '@/features/export/photo-zip'

const item = (n: number, person: string, mime = 'image/webp'): PhotoExportItem => ({
  storagePath: `h/${person}/${n}.${mime === 'image/webp' ? 'webp' : 'jpg'}`,
  meal: {
    id: `m${n}`, personName: person, date: toPlainDate(`2026-10-0${n}`), mealNo: n, status: 'picked_up', effectiveStatus: 'picked_up',
    isAutomatic: false, note: null, permissionReason: null, photoMime: mime, statusChangedAt: '2026-10-01T00:00:00Z',
  },
})

describe('buildPhotoZip', () => {
  it('contains every photo under its person, plus the mapping and records files', async () => {
    const items = [item(1, 'Gonzalo'), item(2, 'María', 'image/jpeg')]
    const progress = vi.fn()
    const blob = await buildPhotoZip(items, {
      fetchPhoto: async (path) => new TextEncoder().encode(`bytes of ${path}`),
      onProgress: progress,
    })
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(Object.keys(files).sort()).toEqual(['Gonzalo/2026-10-01_1.webp', 'Maria/2026-10-02_2.jpg', 'meals.csv', 'photos.csv'])
    expect(strFromU8(files['Gonzalo/2026-10-01_1.webp']!)).toBe('bytes of h/Gonzalo/1.webp')
    const mapping = strFromU8(files['photos.csv']!).trim().split('\r\n')
    expect(mapping[1]).toBe('Gonzalo/2026-10-01_1.webp,m1,Gonzalo,2026-10-01,1,picked_up')
    expect(progress).toHaveBeenLastCalledWith(2, 2)
  })

  it('produces a valid ZIP even when there are no photos', async () => {
    const blob = await buildPhotoZip([], { fetchPhoto: async () => new Uint8Array() })
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(Object.keys(files).sort()).toEqual(['meals.csv', 'photos.csv'])
  })

  it('stops with the underlying error if a photo cannot be downloaded', async () => {
    await expect(buildPhotoZip([item(1, 'Gonzalo')], { fetchPhoto: async () => { throw new Error('network down') } })).rejects.toThrow('network down')
  })
})
