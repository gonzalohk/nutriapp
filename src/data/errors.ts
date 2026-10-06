import { isMessageKey, t, type MessageKey } from '@/i18n/t'

/** Error raised by our own code (for example photo validation) with a stable code. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'AppError'
  }
}

const SERVER_CODE = /\bE_[A-Z_]+\b/

/** Extract our stable error code from a thrown value (database function errors or AppError). */
export function errorCode(error: unknown): string | null {
  if (error instanceof AppError) return error.code
  if (error instanceof Error && error.name === 'HolidayDataMissing') return 'HolidayDataMissing'
  if (error && typeof error === 'object' && 'message' in error) {
    const match = SERVER_CODE.exec(String((error as { message: unknown }).message))
    if (match) return match[0]
  }
  return null
}

/** A user-facing, translated message for any thrown value. */
export function errorMessage(error: unknown): string {
  const code = errorCode(error)
  const key = code ? `error.${code}` : null
  if (key && isMessageKey(key)) return t(key as MessageKey)
  return t('error.unknown')
}
