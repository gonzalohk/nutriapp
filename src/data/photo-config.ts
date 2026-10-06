/**
 * Photo compression settings, in one place so they can be tuned after trying real phone photos
 * (see research R5). The starting values are targets, not guarantees: `fitPhoto` enforces the size cap.
 */
export const PHOTO_CONFIG = {
  /** Long side of the stored photo, in pixels. */
  maxSide: 1600,
  /** Smaller long sides tried when lowering quality alone is not enough. */
  fallbackSides: [1280, 1024],
  /** First quality tried, then lowered by `qualityStep` down to `minQuality`. */
  quality: 0.8,
  minQuality: 0.5,
  qualityStep: 0.1,
  /** Target size of the stored photo. */
  maxBytes: 500 * 1024,
  /** Hard limit enforced by the database and the storage bucket. */
  hardLimitBytes: 2 * 1024 * 1024,
  /** Thumbnail used in lists; server-side resizing is a paid feature, so it is made on the device. */
  thumbSide: 320,
  thumbQuality: 0.7,
  /** Largest original accepted before compression. */
  maxInputBytes: 25 * 1024 * 1024,
} as const

export type PhotoMime = 'image/webp' | 'image/jpeg'
