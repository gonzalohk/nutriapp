import { describe, expect, it } from 'vitest'
import { AppError, errorCode, errorMessage } from '@/data/errors'
import { setLanguage } from '@/i18n/t'

describe('errors', () => {
  it('extracts the stable code from a database error message', () => {
    expect(errorCode({ message: 'E_INVITE_INVALID' })).toBe('E_INVITE_INVALID')
    expect(errorCode({ message: 'rpc failed: E_INVALID_DATE (context)' })).toBe('E_INVALID_DATE')
    expect(errorCode(new Error('boom'))).toBeNull()
    expect(errorCode('nope')).toBeNull()
  })

  it('translates known codes and falls back for unknown ones', () => {
    setLanguage('es')
    expect(errorMessage({ message: 'E_INVITE_INVALID' })).toContain('código')
    expect(errorMessage(new Error('boom'))).toBe('Ocurrió un error inesperado.')
    expect(errorMessage({ message: 'E_SOMETHING_NEW' })).toBe('Ocurrió un error inesperado.')
  })

  it('supports app-raised errors with their own codes', () => {
    setLanguage('es')
    expect(errorMessage(new AppError('photo.notImage'))).toBe('El archivo no es una imagen.')
  })
})
