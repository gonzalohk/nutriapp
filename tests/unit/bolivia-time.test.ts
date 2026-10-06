import { describe, expect, it } from 'vitest'
import { formatBoliviaDateTime, todayInBolivia } from '@/domain/bolivia-time'

describe('bolivia-time', () => {
  it('uses Bolivia (UTC-4), not UTC, to decide the date', () => {
    // 02:00 UTC on Oct 3 is 22:00 on Oct 2 in La Paz.
    expect(todayInBolivia(new Date('2026-10-03T02:00:00Z'))).toBe('2026-10-02')
    // 04:00 UTC is exactly midnight in La Paz.
    expect(todayInBolivia(new Date('2026-10-03T04:00:00Z'))).toBe('2026-10-03')
    expect(todayInBolivia(new Date('2026-10-03T03:59:59Z'))).toBe('2026-10-02')
  })

  it('handles the year boundary', () => {
    expect(todayInBolivia(new Date('2027-01-01T03:00:00Z'))).toBe('2026-12-31')
    expect(todayInBolivia(new Date('2027-01-01T04:00:00Z'))).toBe('2027-01-01')
  })

  it('gives the same answer whatever timezone the device uses', () => {
    // The suite runs under TZ=UTC, America/La_Paz and Asia/Tokyo (pnpm test:tz); this
    // instant is Oct 3 in Tokyo and UTC but still Oct 2 in La Paz.
    expect(todayInBolivia(new Date('2026-10-03T00:30:00Z'))).toBe('2026-10-02')
  })

  it('formats an instant in Bolivia time', () => {
    expect(formatBoliviaDateTime('2026-10-03T18:05:00Z')).toBe('03/10/2026, 14:05')
  })
})
