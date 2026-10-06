import { AppError } from './errors'
import { PHOTO_CONFIG, type PhotoMime } from './photo-config'
import { fitPhoto, scaleToLongSide, type CompressedPhoto, type Encoder } from './photo-compress'

async function drawAndEncode(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
  type: PhotoMime,
): Promise<Blob> {
  // Re-encoding through a canvas also strips EXIF and GPS metadata.
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
    return canvas.convertToBlob({ type, quality })
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new AppError('photo.unreadable'))), type, quality),
  )
}

/** Decode, scale and encode a photo and its thumbnail. Runs in a worker or on the main thread. */
export async function compressWithCanvas(file: Blob): Promise<CompressedPhoto> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new AppError('photo.unreadable')
  }
  try {
    const encode: Encoder = (w, h, q, type) => drawAndEncode(bitmap, w, h, q, type)
    const source = { width: bitmap.width, height: bitmap.height }
    const full = await fitPhoto(source, encode, PHOTO_CONFIG)
    const thumbSize = scaleToLongSide(source, PHOTO_CONFIG.thumbSide)
    const thumb = await encode(thumbSize.width, thumbSize.height, PHOTO_CONFIG.thumbQuality, full.mimeType)
    return { full, thumb }
  } finally {
    bitmap.close()
  }
}
