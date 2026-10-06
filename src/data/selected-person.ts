import { useCallback, useState } from 'react'

const KEY = 'nutrilara.person'

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null // storage can be unavailable (private mode); the selection then lives in memory only
  }
}

/** The person chip last chosen in this session ('all' or a person id). */
export function useSelectedPerson(): [string | null, (value: string) => void] {
  const [value, setValue] = useState<string | null>(read)
  const set = useCallback((next: string) => {
    setValue(next)
    try {
      sessionStorage.setItem(KEY, next)
    } catch {
      /* in-memory only */
    }
  }, [])
  return [value, set]
}
