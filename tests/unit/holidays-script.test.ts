import { describe, expect, it } from 'vitest'
import { bolivianPublicHolidays, buildHolidayMigration } from '../../scripts/holidays-lib'

const dates = (year: number) => bolivianPublicHolidays(year).map((h) => h.date)

describe('Bolivian public holidays', () => {
  it('matches the pinned list for 2026 (12 dates, including the shifted New Year on Jun 22)', () => {
    expect(dates(2026)).toEqual([
      '2026-01-01', '2026-01-22', '2026-02-16', '2026-02-17', '2026-04-03', '2026-05-01',
      '2026-06-04', '2026-06-21', '2026-06-22', '2026-08-06', '2026-11-02', '2026-12-25',
    ])
  })

  it('matches the pinned list for 2027 (movable holidays move)', () => {
    expect(dates(2027)).toEqual([
      '2027-01-01', '2027-01-22', '2027-02-08', '2027-02-09', '2027-03-26', '2027-05-01',
      '2027-05-27', '2027-06-21', '2027-08-06', '2027-11-02', '2027-12-25',
    ])
  })

  it('excludes observances such as Maundy Thursday and Mother\'s Day', () => {
    expect(dates(2026)).not.toContain('2026-04-02')
    expect(dates(2026)).not.toContain('2026-05-27')
  })

  it('returns sorted, unique dates', () => {
    for (const year of [2026, 2027, 2030, 2045]) {
      const list = dates(year)
      expect(list).toEqual([...new Set(list)].sort())
    }
  })

  it('builds an idempotent migration with the coverage range and the data attribution', () => {
    const sql = buildHolidayMigration(2024, 2025)
    expect(sql).toContain('insert into public.official_holidays')
    expect(sql).toContain("on conflict (country_code, holiday_date) do update")
    expect(sql).toContain('official_holiday_years')
    expect(sql).toContain('CC-BY-3.0')
    expect(sql).toContain("('BO', '2025-12-25'")
  })
})
