import { useSignedUrl } from '@/data/queries'
import { t } from '@/i18n/t'

type Size = 'sm' | 'md'
const BOX: Record<Size, string> = { sm: 'h-12 w-12', md: 'h-16 w-16' }

/** Presentational thumbnail; `url` is a short-lived signed URL, or undefined while it loads. */
export function PhotoImage({ url, size = 'md', alt, failed }: { url: string | undefined; size?: Size; alt?: string; failed?: boolean }) {
  if (!url) {
    return (
      <span aria-hidden="true" className={`${BOX[size]} inline-flex items-center justify-center rounded-lg bg-slate-200 ${failed ? 'text-red-700' : 'animate-pulse'}`}>
        📷
      </span>
    )
  }
  return <img src={url} alt={alt ?? t('common.photo')} loading="lazy" className={`${BOX[size]} rounded-lg object-cover`} />
}

interface Props {
  /** Storage path of the thumbnail; the image is requested with a short-lived signed URL. */
  path: string
  size?: Size
  alt?: string
}

/** A small private photo. Only the thumbnail is fetched, never the full-size image. */
export function PhotoThumb({ path, size, alt }: Props) {
  const { data: url, isError } = useSignedUrl(path)
  return <PhotoImage url={url} size={size} alt={alt} failed={isError} />
}
