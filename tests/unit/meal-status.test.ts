import { describe, expect, it } from 'vitest'
import {
  effectiveStatus,
  isRecordableStatus,
  isStatusChange,
  MEAL_STATUSES,
  RECORDABLE_STATUSES,
  STATUS_PRESENTATION,
} from '@/domain/meal-status'
import { toPlainDate } from '@/domain/plain-date'

const d = toPlainDate

describe('meal-status', () => {
  it('has the five statuses and four recordable ones', () => {
    expect(MEAL_STATUSES).toHaveLength(5)
    expect(RECORDABLE_STATUSES).toEqual(['picked_up', 'cancelled', 'not_picked_up', 'permission'])
    expect(isRecordableStatus('scheduled')).toBe(false)
  })

  it('treats choosing the current status as a no-op', () => {
    expect(isStatusChange('picked_up', 'picked_up')).toBe(false)
    expect(isStatusChange('not_picked_up', 'picked_up')).toBe(true)
    expect(isStatusChange('scheduled', 'cancelled')).toBe(true)
  })

  it('derives "not picked up" (automatic) for a past scheduled meal', () => {
    expect(effectiveStatus('scheduled', d('2026-10-01'), d('2026-10-02'))).toEqual({
      status: 'not_picked_up',
      isAutomatic: true,
    })
  })

  it('keeps today and future scheduled meals pending', () => {
    expect(effectiveStatus('scheduled', d('2026-10-02'), d('2026-10-02')).status).toBe('scheduled')
    expect(effectiveStatus('scheduled', d('2026-10-03'), d('2026-10-02')).status).toBe('scheduled')
  })

  it('never rewrites a recorded status', () => {
    for (const status of RECORDABLE_STATUSES) {
      expect(effectiveStatus(status, d('2026-09-01'), d('2026-10-02'))).toEqual({
        status,
        isAutomatic: false,
      })
    }
  })

  it('gives every status a distinct icon and label (never color alone)', () => {
    const icons = new Set(Object.values(STATUS_PRESENTATION).map((p) => p.icon))
    const labels = new Set(Object.values(STATUS_PRESENTATION).map((p) => p.labelKey))
    expect(icons.size).toBe(5)
    expect(labels.size).toBe(5)
  })
})
