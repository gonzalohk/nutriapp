import { compareDates, yearOf, type PlainDate } from './plain-date'

/** One month of one person as the history list shows it. */
export interface MonthSummary {
  month: PlainDate
  contracted: number
  scheduled: number
  pickedUp: number
  cancelled: number
  /** Includes the automatic ones (a past meal nobody recorded). */
  notPickedUp: number
  permission: number
  pending: number
  automaticNotPickedUp: number
  photos: number
  isConsistent: boolean
  needsReview: boolean
  isPartial: boolean
}

/** Years that have data, newest first; the current year is always offered. */
export function yearsOf(rows: readonly MonthSummary[], currentYear: number): number[] {
  const years = new Set<number>([currentYear])
  for (const r of rows) years.add(yearOf(r.month))
  return [...years].sort((a, b) => b - a)
}

/** The months of one year in calendar order. */
export function summariesOfYear(rows: readonly MonthSummary[], year: number): MonthSummary[] {
  return rows.filter((r) => yearOf(r.month) === year).sort((a, b) => compareDates(a.month, b.month))
}
