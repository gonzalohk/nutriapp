import { describe, expect, it } from 'vitest'
import { AppError } from '@/data/errors'
import { PHOTO_CONFIG } from '@/data/photo-config'
import { fitPhoto, scaleToLongSide, validatePhotoInput, type Encoder } from '@/data/photo-compress'

const KB = 1024

/** Fake encoder whose output size grows with pixels and quality, like a real lossy codec. */
function fakeEncoder(opts: { webp?: boolean; bytesPerPixel?: number } = {}): { encode: Encoder; calls: Array<[number, number, number, string]> } {
  const calls: Array<[number, number, number, string]> = []
  const bpp = opts.bytesPerPixel ?? 0.2
  const encode: Encoder = async (width, height, quality, type) => {
    calls.push([width, height, quality, type])
    const produced = type === 'image/webp' && opts.webp === false ? 'image/png' : type
    return new Blob([new Uint8Array(Math.round(width * height * quality * bpp))], { type: produced })
  }
  return { encode, calls }
}

describe('scaleToLongSide', () => {
  it('shrinks a landscape photo so the long side is 1600 px', () => {
    expect(scaleToLongSide({ width: 4000, height: 3000 }, 1600)).toEqual({ width: 1600, height: 1200 })
  })
  it('shrinks a portrait photo the same way', () => {
    expect(scaleToLongSide({ width: 3000, height: 4000 }, 1600)).toEqual({ width: 1200, height: 1600 })
  })
  it('never enlarges a small photo', () => {
    expect(scaleToLongSide({ width: 800, height: 600 }, 1600)).toEqual({ width: 800, height: 600 })
  })
  it('keeps at least one pixel on the short side', () => {
    expect(scaleToLongSide({ width: 10000, height: 1 }, 1600).height).toBe(1)
  })
})

describe('fitPhoto', () => {
  it('encodes once as WebP at the configured quality when it already fits', async () => {
    const { encode, calls } = fakeEncoder({ bytesPerPixel: 0.05 })
    const out = await fitPhoto({ width: 4000, height: 3000 }, encode, PHOTO_CONFIG)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual([1600, 1200, 0.8, 'image/webp'])
    expect(out.mimeType).toBe('image/webp')
    expect(out.blob.size).toBeLessThanOrEqual(PHOTO_CONFIG.maxBytes)
  })

  it('lowers the quality step by step until the file fits in 500 KB', async () => {
    // 1600x1200x0.8x0.35 = 537 KB (too big); at 0.7 it is 470 KB.
    const { encode, calls } = fakeEncoder({ bytesPerPixel: 0.35 })
    const out = await fitPhoto({ width: 4000, height: 3000 }, encode, PHOTO_CONFIG)
    expect(out.blob.size).toBeLessThanOrEqual(500 * KB)
    expect(calls.map((c) => c[2])).toEqual([0.8, 0.7])
    expect(calls.every((c) => c[0] === 1600)).toBe(true)
  })

  it('reduces the dimensions when the quality floor is not enough', async () => {
    const { encode, calls } = fakeEncoder({ bytesPerPixel: 0.6 })
    const out = await fitPhoto({ width: 4000, height: 3000 }, encode, PHOTO_CONFIG)
    expect(out.blob.size).toBeLessThanOrEqual(500 * KB)
    expect(calls.at(-1)![0]).toBe(1280)
    expect(out.width).toBe(1280)
  })

  it('falls back to JPEG when the browser cannot encode WebP', async () => {
    const { encode, calls } = fakeEncoder({ webp: false, bytesPerPixel: 0.05 })
    const out = await fitPhoto({ width: 4000, height: 3000 }, encode, PHOTO_CONFIG)
    expect(out.mimeType).toBe('image/jpeg')
    expect(calls.map((c) => c[3])).toEqual(['image/webp', 'image/jpeg'])
  })

  it('stays on JPEG for later attempts once WebP is known to be unsupported', async () => {
    const { encode, calls } = fakeEncoder({ webp: false, bytesPerPixel: 0.35 })
    await fitPhoto({ width: 4000, height: 3000 }, encode, PHOTO_CONFIG)
    expect(calls.slice(2).every((c) => c[3] === 'image/jpeg')).toBe(true)
  })

  it('accepts the smallest attempt when it is over 500 KB but under the 2 MB hard limit', async () => {
    // Even at the smallest size and quality (1024 px, 0.5) this is 786 KB.
    const { encode } = fakeEncoder({ bytesPerPixel: 2.0 })
    const out = await fitPhoto({ width: 4000, height: 3000 }, encode, PHOTO_CONFIG)
    expect(out.width).toBe(1024)
    expect(out.blob.size).toBeGreaterThan(500 * KB)
    expect(out.blob.size).toBeLessThanOrEqual(2 * 1024 * KB)
  })

  it('fails with photo.tooLarge when it cannot get under 2 MB', async () => {
    const { encode } = fakeEncoder({ bytesPerPixel: 20 })
    await expect(fitPhoto({ width: 4000, height: 3000 }, encode, PHOTO_CONFIG)).rejects.toMatchObject({ code: 'photo.tooLarge' })
  })
})

describe('validatePhotoInput', () => {
  it('accepts an ordinary photo', () => {
    expect(() => validatePhotoInput({ type: 'image/jpeg', size: 5 * 1024 * KB })).not.toThrow()
  })
  it('rejects files that are not images', () => {
    expect(() => validatePhotoInput({ type: 'text/plain', size: 10 })).toThrow(AppError)
    expect(() => validatePhotoInput({ type: 'application/pdf', size: 10 })).toThrowError(expect.objectContaining({ code: 'photo.notImage' }))
  })
  it('rejects empty and oversized inputs (over 25 MB)', () => {
    expect(() => validatePhotoInput({ type: 'image/jpeg', size: 0 })).toThrowError(expect.objectContaining({ code: 'photo.unreadable' }))
    expect(() => validatePhotoInput({ type: 'image/jpeg', size: 26 * 1024 * KB })).toThrowError(expect.objectContaining({ code: 'photo.tooLarge' }))
  })
})

describe('config', () => {
  it('keeps the thumbnail small and the original limit generous', () => {
    expect(PHOTO_CONFIG.thumbSide).toBe(320)
    expect(PHOTO_CONFIG.maxInputBytes).toBe(25 * 1024 * KB)
    expect(PHOTO_CONFIG.maxBytes).toBe(500 * KB)
  })
})
