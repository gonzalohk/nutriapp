import { describe, expect, it } from 'vitest'
import { changesCsv, mealsCsv, photoFileName, photosCsv, toCsv, type ExportChange, type ExportMeal } from '@/features/export/csv'
import { toPlainDate } from '@/domain/plain-date'

const d = toPlainDate

const meal = (over: Partial<ExportMeal> = {}): ExportMeal => ({
  id: 'm1', personName: 'Gonzalo', date: d('2026-10-01'), mealNo: 1, status: 'picked_up', effectiveStatus: 'picked_up',
  isAutomatic: false, note: null, permissionReason: null, photoMime: null, statusChangedAt: '2026-10-01T16:05:00Z', ...over,
})

describe('toCsv', () => {
  it('quotes commas, quotes and line breaks, and escapes inner quotes', () => {
    const csv = toCsv([['a', 'b,c', 'say "hi"', 'line1\nline2', null, 3, true]])
    expect(csv).toBe('a,"b,c","say ""hi""","line1\nline2",,3,true\r\n')
  })
  it('ends every row with CRLF so spreadsheets read it correctly', () => {
    expect(toCsv([['x'], ['y']])).toBe('x\r\ny\r\n')
  })
})

describe('mealsCsv', () => {
  it('has a header and one row per meal, dates as YYYY-MM-DD', () => {
    const csv = mealsCsv([meal(), meal({ id: 'm2', date: d('2026-10-02'), mealNo: 2 })])
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('person,date,meal_no,status,automatic,recorded_status,note,permission_reason,photo_file,status_changed_at')
    expect(lines[1]!.startsWith('Gonzalo,2026-10-01,1,picked_up,no,picked_up,')).toBe(true)
  })

  it('shows the status the user saw and marks automatic ones, keeping the stored status', () => {
    const row = mealsCsv([meal({ status: 'scheduled', effectiveStatus: 'not_picked_up', isAutomatic: true })]).trim().split('\r\n')[1]!
    expect(row).toContain(',not_picked_up,yes,scheduled,')
  })

  it('keeps cancelled, not picked up and permission as three distinct values', () => {
    const rows = [meal({ effectiveStatus: 'cancelled' }), meal({ effectiveStatus: 'not_picked_up' }), meal({ effectiveStatus: 'permission' })]
    const statuses = mealsCsv(rows).trim().split('\r\n').slice(1).map((l) => l.split(',')[3])
    expect(statuses).toEqual(['cancelled', 'not_picked_up', 'permission'])
  })

  it('includes notes with special characters intact and the photo file name when there is a photo', () => {
    const csv = mealsCsv([meal({ note: 'Llegó "tarde", sin salsa', photoMime: 'image/webp' })])
    expect(csv).toContain('"Llegó ""tarde"", sin salsa"')
    expect(csv).toContain('Gonzalo/2026-10-01_1.webp')
  })

  it('is stable for an empty list (header only)', () => {
    expect(mealsCsv([]).trim().split('\r\n')).toHaveLength(1)
  })
})

describe('changesCsv', () => {
  it('lists each status change with who and when', () => {
    const changes: ExportChange[] = [{ personName: 'Gonzalo', date: d('2026-10-01'), mealNo: 1, fromStatus: 'scheduled', toStatus: 'picked_up', changedAt: '2026-10-01T16:05:00Z', changedBy: 'Gonzalo' }]
    expect(changesCsv(changes).trim().split('\r\n')).toEqual([
      'person,date,meal_no,from_status,to_status,changed_at,changed_by',
      'Gonzalo,2026-10-01,1,scheduled,picked_up,2026-10-01T16:05:00Z,Gonzalo',
    ])
  })
})

describe('photo names for the ZIP', () => {
  it('builds a readable, unique, filesystem-safe name from person, date and meal number', () => {
    expect(photoFileName('Gonzalo', d('2026-10-01'), 3, 'image/webp')).toBe('Gonzalo/2026-10-01_3.webp')
    expect(photoFileName('María José', d('2026-10-01'), 3, 'image/jpeg')).toBe('Maria_Jose/2026-10-01_3.jpg')
    expect(photoFileName('A/B\\C', d('2026-10-01'), 1, 'image/webp')).toBe('A_B_C/2026-10-01_1.webp')
  })

  it('maps each photo file to its meal in photos.csv', () => {
    const csv = photosCsv([meal({ photoMime: 'image/webp' }), meal({ id: 'm2', photoMime: null })])
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(2) // header + the one meal that has a photo
    expect(lines[1]).toBe('Gonzalo/2026-10-01_1.webp,m1,Gonzalo,2026-10-01,1,picked_up')
  })
})
