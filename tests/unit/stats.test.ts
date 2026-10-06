import { describe, expect, it } from 'vitest'
import { computeStats, countersAreConsistent, type StatMeal } from '@/domain/stats'
import { toPlainDate } from '@/domain/plain-date'

const d = toPlainDate
const TODAY = d('2026-10-15')

const m = (date: string, status: StatMeal['status'], hasPhoto = false): StatMeal => ({ date: d(date), status, hasPhoto })

describe('computeStats', () => {
  it('counts the five statuses and they add up to the scheduled meals (spec US3 example)', () => {
    // 14 picked up, 2 cancelled, 1 not picked up, 1 permission, 2 pending = 20
    const meals: StatMeal[] = [
      ...Array.from({ length: 14 }, (_, i) => m(`2026-09-${String(i + 1).padStart(2, '0')}`, 'picked_up')),
      m('2026-09-15', 'cancelled'), m('2026-09-16', 'cancelled'),
      m('2026-09-17', 'not_picked_up'), m('2026-09-18', 'permission'),
      m('2026-10-16', 'scheduled'), m('2026-10-19', 'scheduled'),
    ]
    const s = computeStats({ meals, contracted: 20, isPartial: false, today: TODAY })
    expect(s).toMatchObject({ scheduledTotal: 20, pickedUp: 14, cancelled: 2, notPickedUp: 1, permission: 1, pending: 2 })
    expect(s.isConsistent).toBe(true)
    expect(s.pickedUpPercent).toBe(70)
    expect(s.warnings).toEqual([])
  })

  it('counts a past unrecorded meal as an automatic "not picked up", not as pending', () => {
    const s = computeStats({ meals: [m('2026-10-14', 'scheduled'), m('2026-10-15', 'scheduled'), m('2026-10-16', 'scheduled')], contracted: 3, isPartial: false, today: TODAY })
    expect(s.notPickedUp).toBe(1)
    expect(s.automaticNotPickedUp).toBe(1)
    expect(s.pending).toBe(2) // today and the future
    expect(s.isConsistent).toBe(true)
  })

  it('keeps recorded not-picked-up and automatic ones separate in the detail but together in the total', () => {
    const s = computeStats({ meals: [m('2026-10-01', 'not_picked_up'), m('2026-10-02', 'scheduled')], contracted: 2, isPartial: false, today: TODAY })
    expect(s.notPickedUp).toBe(2)
    expect(s.automaticNotPickedUp).toBe(1)
  })

  it('counts photos and computes the picked-up percentage over scheduled meals', () => {
    const s = computeStats({ meals: [m('2026-10-01', 'picked_up', true), m('2026-10-02', 'picked_up'), m('2026-10-05', 'cancelled'), m('2026-10-06', 'permission', true)], contracted: 4, isPartial: false, today: TODAY })
    expect(s.photos).toBe(2)
    expect(s.pickedUpPercent).toBe(50)
  })

  it('reports 0% (not NaN) for an empty month', () => {
    const s = computeStats({ meals: [], contracted: 20, isPartial: true, today: TODAY })
    expect(s.pickedUpPercent).toBe(0)
    expect(s.scheduledTotal).toBe(0)
  })

  it('warns when fewer meals are scheduled than contracted (full month)', () => {
    const s = computeStats({ meals: [m('2026-10-01', 'picked_up')], contracted: 20, isPartial: false, today: TODAY })
    expect(s.warnings).toContainEqual({ kind: 'shortfall', scheduled: 1, contracted: 20 })
  })

  it('does not warn about a shortfall in a partial month', () => {
    const s = computeStats({ meals: [m('2026-10-01', 'picked_up')], contracted: 20, isPartial: true, today: TODAY })
    expect(s.warnings).toEqual([])
  })

  it('warns when more meals are scheduled than contracted', () => {
    const meals = Array.from({ length: 3 }, (_, i) => m(`2026-10-0${i + 1}`, 'picked_up'))
    const s = computeStats({ meals, contracted: 2, isPartial: false, today: TODAY })
    expect(s.warnings).toContainEqual({ kind: 'excess', scheduled: 3, contracted: 2 })
  })

  it('detects counters that do not add up to the scheduled meals', () => {
    const ok = { pickedUp: 14, cancelled: 2, notPickedUp: 1, permission: 1, pending: 2 }
    expect(countersAreConsistent(ok, 20)).toBe(true)
    expect(countersAreConsistent(ok, 21)).toBe(false)
    expect(countersAreConsistent({ ...ok, pickedUp: 15 }, 20)).toBe(false)
  })

  it('treats cancelled, not picked up and permission as three different counters', () => {
    const s = computeStats({ meals: [m('2026-10-01', 'cancelled'), m('2026-10-02', 'not_picked_up'), m('2026-10-05', 'permission')], contracted: 3, isPartial: false, today: TODAY })
    expect([s.cancelled, s.notPickedUp, s.permission]).toEqual([1, 1, 1])
  })
})
