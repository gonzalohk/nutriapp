// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { InconsistencyBanner } from '@/features/month/Banners'
import { CounterStrip } from '@/features/month/CounterStrip'
import { computeStats } from '@/domain/stats'
import { toPlainDate } from '@/domain/plain-date'
import { setLanguage } from '@/i18n/t'

const d = toPlainDate

describe('CounterStrip', () => {
  beforeEach(() => setLanguage('es'))

  it('shows the contracted number and every counter (spec US3 example: 14/2/1/1/2 of 20)', () => {
    const meals = [
      ...Array.from({ length: 14 }, (_, i) => ({ date: d(`2026-09-${String(i + 1).padStart(2, '0')}`), status: 'picked_up' as const, hasPhoto: i < 5 })),
      { date: d('2026-09-15'), status: 'cancelled' as const, hasPhoto: false },
      { date: d('2026-09-16'), status: 'cancelled' as const, hasPhoto: false },
      { date: d('2026-09-17'), status: 'not_picked_up' as const, hasPhoto: false },
      { date: d('2026-09-18'), status: 'permission' as const, hasPhoto: false },
      { date: d('2026-10-20'), status: 'scheduled' as const, hasPhoto: false },
      { date: d('2026-10-21'), status: 'scheduled' as const, hasPhoto: false },
    ]
    const stats = computeStats({ meals, contracted: 20, isPartial: false, today: d('2026-10-15') })
    render(<CounterStrip stats={stats} />)
    const region = screen.getByRole('region', { name: /resumen del mes/i })
    expect(within(region).getByText(/contratadas: 20/i)).toBeInTheDocument()
    const value = (label: string) => within(region).getByText(label).previousElementSibling!.textContent
    expect(value('Recogidas')).toBe('14')
    expect(value('Canceladas')).toBe('2')
    expect(value('No recogidas')).toBe('1')
    expect(value('Permisos')).toBe('1')
    expect(value('Pendientes')).toBe('2')
    expect(value('% recogidas')).toBe('70%')
    expect(within(region).getByText(/fotos: 5/i)).toBeInTheDocument()
  })

  it('mentions how many "not picked up" are automatic', () => {
    const stats = computeStats({ meals: [{ date: d('2026-10-01'), status: 'scheduled', hasPhoto: false }], contracted: 1, isPartial: false, today: d('2026-10-15') })
    render(<CounterStrip stats={stats} />)
    expect(screen.getByText('1 automáticas')).toBeInTheDocument()
  })
})

describe('InconsistencyBanner', () => {
  it('states both numbers so the problem is visible', () => {
    setLanguage('es')
    render(<InconsistencyBanner warning={{ kind: 'inconsistent', sum: 19, scheduled: 20 }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('suman 19')
    expect(screen.getByRole('alert')).toHaveTextContent('20 comidas')
  })
})
