import { es, type Dictionary } from './es'

export type Lang = 'es' | 'en'
export type MessageKey = keyof Dictionary

// Spanish is bundled. Other languages are downloaded only when selected, to keep the first load small.
const dictionaries: Partial<Record<Lang, Dictionary>> = { es }
let current: Lang = 'es'

/** Download (if needed) and switch to a language. */
export async function loadLanguage(lang: Lang): Promise<void> {
  if (!dictionaries[lang]) {
    dictionaries[lang] = (await import('./en')).en
  }
  current = lang
}

/** Switch to a language that is already loaded (Spanish always is). */
export function setLanguage(lang: Lang): void {
  if (!dictionaries[lang]) throw new Error(`Language "${lang}" is not loaded; call loadLanguage first.`)
  current = lang
}

export function getLanguage(): Lang {
  return current
}

/** Translate a key, replacing `{name}` placeholders with params. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = (dictionaries[current] ?? es)[key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

/** Whether a string is a known message key (used when mapping server error codes). */
export function isMessageKey(key: string): key is MessageKey {
  return key in es
}
