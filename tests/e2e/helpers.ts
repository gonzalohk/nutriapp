import type { Page } from '@playwright/test'

/**
 * Make the browser believe it is a weekday (the next one if today is a weekend) so the quick-record
 * specs have a meal to record. Only the clock is fixed; timers keep running.
 */
export async function useWeekday(page: Page): Promise<void> {
  const d = new Date()
  d.setUTCHours(15, 0, 0, 0) // 11:00 in Bolivia
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1)
  await page.clock.setFixedTime(d)
}

export async function signInAsDemo(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel(/correo/i).fill('demo@nutrilara.local')
  await page.getByLabel(/contraseña/i).fill('demo-password-123')
  await page.getByRole('button', { name: /^entrar$/i }).click()
}

/** Choose one person on Today and return their card (the four actions live there). */
export async function openPerson(page: Page, name: string) {
  await page.getByRole('radio', { name }).click()
  return page.getByRole('article', { name: new RegExp(name, 'i') })
}

/** Wait until the service worker controls the page (offline use needs the production build). */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, { timeout: 30_000 })
}
