import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WCAG 2.1 AA: normal text needs a contrast ratio of at least 4.5:1.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const css = readFileSync(join(import.meta.dirname, '..', '..', 'src', 'index.css'), 'utf8')
const token = (name: string) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))![1]!

describe('status colors (spec FR-029: readable, never color alone)', () => {
  for (const tone of ['pending', 'picked', 'cancelled', 'missed', 'permission']) {
    it(`${tone}: text on background is at least 4.5:1`, () => {
      expect(contrast(token(`${tone}-fg`), token(`${tone}-bg`))).toBeGreaterThanOrEqual(4.5)
    })
  }
})

// Hex values of the Tailwind classes the screens combine.
const C = {
  white: '#ffffff', slate50: '#f8fafc', slate100: '#f1f5f9', slate200: '#e2e8f0', slate500: '#64748b', slate600: '#475569',
  slate700: '#334155', slate800: '#1e293b', amber50: '#fffbeb', amber900: '#78350f', red50: '#fef2f2', red800: '#991b1b', red900: '#7f1d1d',
}

describe('other text and background pairs used by the screens', () => {
  const pairs: [string, string, string][] = [
    ['body text on page', '#0f172a', '#f8faf8'],
    ['secondary text (slate-600) on white', C.slate600, C.white],
    ['secondary text (slate-600) on page', C.slate600, '#f8faf8'],
    ['weekday number on calendar (slate-500) on white', C.slate500, C.white],
    ['holiday cell (slate-700 on slate-200)', C.slate700, C.slate200],
    ['weekend cell (slate-600 on slate-100)', C.slate600, C.slate100],
    ['warning banner (amber-900 on amber-50)', C.amber900, C.amber50],
    ['error banner (red-900 on red-50)', C.red900, C.red50],
    ['inline error (red-800) on white', C.red800, C.white],
    ['primary button (white on brand)', C.white, token('brand')],
    ['primary button pressed (white on brand-dark)', C.white, token('brand-dark')],
    ['link (brand on white)', token('brand'), C.white],
    ['link (brand on page)', token('brand'), '#f8faf8'],
    ['selected chip (white on brand)', C.white, token('brand')],
    ['update bar (white on slate-900)', C.white, '#0f172a'],
  ]
  for (const [name, fg, bg] of pairs) {
    it(`${name} is at least 4.5:1`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('the contrast calculator is correct (black on white is 21:1)', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })
})
