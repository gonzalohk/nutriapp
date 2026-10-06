import { describe, expect, it } from 'vitest'
import { en } from '@/i18n/en'
import { es } from '@/i18n/es'
import { loadLanguage, setLanguage, t } from '@/i18n/t'

describe('i18n', () => {
  it('has identical keys in Spanish and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
  })

  it('has no empty translations', () => {
    for (const [key, value] of [...Object.entries(es), ...Object.entries(en)]) {
      expect(value, key).not.toBe('')
    }
  })

  it('defaults to Spanish and loads English on demand', async () => {
    setLanguage('es')
    expect(t('tab.today')).toBe('Hoy')
    await loadLanguage('en')
    expect(t('tab.today')).toBe('Today')
    setLanguage('es')
  })
})
