import { AppError } from './errors'
import { PHOTO_CONFIG, type PhotoMime } from './photo-config'

export interface Dimensions {
  width: number
  height: number
}

/** Encodes the picture at a size and quality. The browser implementation lives in photo-codec.ts. */
export type Encoder = (width: number, height: number, quality: number, type: PhotoMime) => Promise<Blob>

export interface FitResult extends Dimensions {
  blob: Blob
  mimeType: PhotoMime
  quality: number
}

export interface CompressedPhoto {
  full: FitResult
  thumb: Blob
}

/** Scale so the long side is at most `maxSide`, keeping the aspect ratio and never enlarging. */
export function scaleToLongSide({ width, height }: Dimensions, maxSide: number): Dimensions {
  const longSide = Math.max(width, height)
  if (longSide <= maxSide) return { width, height }
  const ratio = maxSide / longSide
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }
}

/** Basic checks before spending time decoding the file. */
export function validatePhotoInput(file: { type: string; size: number }): void {
  if (!file.type.startsWith('image/')) throw new AppError('photo.notImage')
  if (file.size <= 0) throw new AppError('photo.unreadable')
  if (file.size > PHOTO_CONFIG.maxInputBytes) throw new AppError('photo.tooLarge')
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Find the best encoding that fits the size cap: lower the quality step by step, then the
 * dimensions. Starts with WebP and switches to JPEG if the browser cannot produce WebP (Safari
 * returns another format). If nothing reaches the target, the smallest attempt is accepted as long
 * as it is under the hard limit; otherwise the photo is rejected.
 */
export async function fitPhoto(
  source: Dimensions,
  encode: Encoder,
  config: typeof PHOTO_CONFIG,
): Promise<FitResult> {
  let format: PhotoMime = 'image/webp'
  let last: FitResult | null = null

  for (const side of [config.maxSide, ...config.fallbackSides]) {
    const size = scaleToLongSide(source, side)
    for (let q: number = config.quality; q >= config.minQuality - 1e-9; q = round1(q - config.qualityStep)) {
      let blob = await encode(size.width, size.height, q, format)
      if (format === 'image/webp' && blob.type !== 'image/webp') {
        format = 'image/jpeg'
        blob = await encode(size.width, size.height, q, format)
      }
      last = { blob, width: size.width, height: size.height, mimeType: format, quality: q }
      if (blob.size <= config.maxBytes) return last
    }
  }

  if (!last || last.blob.size > config.hardLimitBytes) throw new AppError('photo.tooLarge')
  return last
}

/**
 * Compress a photo on the device before it is uploaded. The heavy work runs in a Web Worker so the
 * interface never freezes; where workers or OffscreenCanvas are missing it falls back to the main
 * thread.
 */
export async function compressPhoto(file: Blob): Promise<CompressedPhoto> {
  validatePhotoInput(file)
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    try {
      return await compressInWorker(file)
    } catch (error) {
      if (error instanceof AppError) throw error
      // The worker itself could not start: fall through to the main thread.
    }
  }
  const { compressWithCanvas } = await import('./photo-codec')
  return compressWithCanvas(file)
}

function compressInWorker(file: Blob): Promise<CompressedPhoto> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./photo-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ ok: true; result: CompressedPhoto } | { ok: false; code: string }>) => {
      worker.terminate()
      if (event.data.ok) resolve(event.data.result)
      else reject(new AppError(event.data.code))
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message))
    }
    worker.postMessage({ file })
  })
}
