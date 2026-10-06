// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from '@/components/StatusBadge'
import { toPlainDate } from '@/domain/plain-date'
import { setLanguage } from '@/i18n/t'

const d = toPlainDate

describe('StatusBadge', () => {
  it('shows icon-independent text for every status', () => {
    setLanguage('es')
    render(<StatusBadge status="permission" />)
    expect(screen.getByText('Permiso')).toBeInTheDocument()
  })

  it('shows a past unrecorded meal as automatic "not picked up"', () => {
    setLanguage('es')
    render(<StatusBadge status="scheduled" mealDate={d('2026-10-01')} today={d('2026-10-02')} />)
    expect(screen.getByText('No recogida')).toBeInTheDocument()
    expect(screen.getByText('(automática)')).toBeInTheDocument()
  })

  it('keeps today pending and shows sync flags', () => {
    setLanguage('es')
    render(<StatusBadge status="scheduled" mealDate={d('2026-10-02')} today={d('2026-10-02')} pendingSync photoPending />)
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText(/Sin sincronizar/)).toBeInTheDocument()
    expect(screen.getByText(/Foto pendiente/)).toBeInTheDocument()
  })
})
