import { expect, test } from '@playwright/test'
import { openPerson, signInAsDemo, useWeekday } from './helpers'
import path from 'node:path'

// Needs a running backend with demo data: `pnpm seed:demo` (see quickstart.md scenario B).
// The demo user has four people with a meal for each delivery day of the current month.
const photo = path.join(import.meta.dirname, '..', 'fixtures', 'meal-3000x2000.jpg')

test.beforeEach(async ({ page }) => {
  await useWeekday(page)
  await signInAsDemo(page)
  await expect(page.getByRole('navigation', { name: /principal/i })).toBeVisible()
  // one person at a time: the full card with the four actions
})

test.describe('quick record (only meaningful on a delivery day)', () => {
  test('picked up without a photo takes two taps', async ({ page }) => {
    const card = await openPerson(page, 'Gonzalo')
    test.skip((await card.getByRole('button', { name: /^recogí$/i }).count()) === 0, 'no pending meal today')
    await card.getByRole('button', { name: /^recogí$/i }).click()
    await page.getByRole('button', { name: /omitir foto/i }).click()
    await expect(card.getByText('Recogida')).toBeVisible()
  })

  test('picked up with a photo stores a compressed image of at most 500 KB', async ({ page }) => {
    const card = await openPerson(page, 'Esposa')
    test.skip((await card.getByRole('button', { name: /^recogí$/i }).count()) === 0, 'no pending meal today')
    await card.getByRole('button', { name: /^recogí$/i }).click()
    await page.getByTestId('photo-input').setInputFiles(photo)
    await expect(card.getByText('Recogida')).toBeVisible()
    const thumb = card.getByRole('img')
    await expect(thumb).toBeVisible({ timeout: 15_000 })
    const sizes = await page.evaluate(async () => {
      const src = (document.querySelector('article img') as HTMLImageElement).src
      return (await (await fetch(src)).blob()).size
    })
    expect(sizes).toBeLessThan(60 * 1024) // thumbnail, not the original
  })

  test('cancelled, not picked up and permission are distinct statuses', async ({ page }) => {
    const hijo = await openPerson(page, 'Hijo')
    test.skip((await hijo.getByRole('button', { name: /^cancelé$/i }).count()) === 0, 'no pending meal today')
    await hijo.getByRole('button', { name: /^cancelé$/i }).click()
    await expect(hijo.getByText('Cancelada')).toBeVisible()

    const hija = await openPerson(page, 'Hija')
    await hija.getByRole('button', { name: /^pedí permiso$/i }).click()
    await page.getByRole('textbox').fill('Viaje')
    await page.getByRole('button', { name: /guardar/i }).click()
    await expect(hija.getByText('Permiso')).toBeVisible()
  })
})
