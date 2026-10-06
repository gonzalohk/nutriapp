import type { MealStatus } from '@/domain/meal-status'
import type { PlainDate } from '@/domain/plain-date'

type Cell = string | number | boolean | null | undefined

/** RFC 4180 CSV: quote when needed, double the inner quotes, CRLF line ends. */
export function toCsv(rows: readonly (readonly Cell[])[]): string {
  const cell = (value: Cell): string => {
    if (value === null || value === undefined) return ''
    const s = String(value)
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  return rows.map((row) => row.map(cell).join(',') + '\r\n').join('')
}

export interface ExportMeal {
  id: string
  personName: string
  date: PlainDate
  mealNo: number
  /** Recorded status. */
  status: MealStatus
  /** Status as the user saw it (a forgotten past meal is an automatic "not picked up"). */
  effectiveStatus: MealStatus
  isAutomatic: boolean
  note: string | null
  permissionReason: string | null
  /** MIME type of the meal's photo, or null when it has none. */
  photoMime: string | null
  statusChangedAt: string
}

export interface ExportChange {
  personName: string
  date: PlainDate
  mealNo: number
  fromStatus: MealStatus
  toStatus: MealStatus
  changedAt: string
  changedBy: string | null
}

const extension = (mime: string) => (mime === 'image/webp' ? 'webp' : 'jpg')

/** Replace anything that is not safe in a file name. Accents are transliterated. */
function safeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'persona'
}

/** `Person/2026-10-01_3.webp`, unique per person, date and meal number. */
export function photoFileName(personName: string, date: PlainDate, mealNo: number, mime: string): string {
  return `${safeName(personName)}/${date}_${mealNo}.${extension(mime)}`
}

const photoFile = (m: ExportMeal) => (m.photoMime ? photoFileName(m.personName, m.date, m.mealNo, m.photoMime) : null)

export function mealsCsv(meals: readonly ExportMeal[]): string {
  return toCsv([
    ['person', 'date', 'meal_no', 'status', 'automatic', 'recorded_status', 'note', 'permission_reason', 'photo_file', 'status_changed_at'],
    ...meals.map((m) => [
      m.personName, m.date, m.mealNo, m.effectiveStatus, m.isAutomatic ? 'yes' : 'no', m.status,
      m.note, m.permissionReason, photoFile(m), m.statusChangedAt,
    ]),
  ])
}

export function changesCsv(changes: readonly ExportChange[]): string {
  return toCsv([
    ['person', 'date', 'meal_no', 'from_status', 'to_status', 'changed_at', 'changed_by'],
    ...changes.map((c) => [c.personName, c.date, c.mealNo, c.fromStatus, c.toStatus, c.changedAt, c.changedBy]),
  ])
}

/** Maps each photo file in the ZIP to its meal. */
export function photosCsv(meals: readonly ExportMeal[]): string {
  return toCsv([
    ['file', 'meal_id', 'person', 'date', 'meal_no', 'status'],
    ...meals.filter((m) => m.photoMime).map((m) => [photoFile(m), m.id, m.personName, m.date, m.mealNo, m.effectiveStatus]),
  ])
}
