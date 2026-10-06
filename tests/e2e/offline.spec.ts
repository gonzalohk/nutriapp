import { expect, test } from '@playwright/test'
import { openPerson, signInAsDemo, useWeekday, waitForServiceWorker } from './helpers'
import path from 'node:path'

// Needs the demo stack AND the production build (the service worker does not run in `pnpm dev`):
//   pnpm build && pnpm preview --port 4173   then   E2E_BASE_URL=http://localhost:4173 pnpm test:e2e offline
// (quickstart.md scenario G). Uses the browser's offline mode.
test.skip(!process.env.E2E_BASE_URL, 'needs the production build: set E2E_BASE_URL (see the comment above)')

const photo = path.join(import.meta.dirname, '..', 'fixtures', 'meal-3000x2000.jpg')

test('a status and photo recorded offline reach the server when the connection returns', async ({ page, context }) => {
  await useWeekday(page)
  await signInAsDemo(page)
  await waitForServiceWorker(page)
  const card = await openPerson(page, 'Gonzalo')
  test.skip((await card.getByRole('button', { name: /^recogí$/i }).count()) === 0, 'no pending meal today')

  await context.setOffline(true)
  await expect(page.getByText(/sin conexión/i)).toBeVisible()
  await card.getByRole('button', { name: /^recogí$/i }).click()
  await page.getByTestId('photo-input').setInputFiles(photo)
  await expect(card.getByText('Recogida')).toBeVisible()
  await expect(card.getByText(/sin sincronizar/i)).toBeVisible()
  await expect(card.getByText(/foto pendiente/i)).toBeVisible()

  await context.setOffline(false)
  await expect(card.getByText(/sin sincronizar/i)).toHaveCount(0, { timeout: 30_000 })
  await expect(card.getByRole('img')).toBeVisible({ timeout: 30_000 }) // the photo arrived
  await page.reload()
  await expect(card.getByText('Recogida')).toBeVisible()
})

test('the app opens offline with the last loaded data', async ({ page, context }) => {
  await page.goto('/login')
  await page.getByLabel(/correo/i).fill('demo@nutrilara.local')
  await page.getByLabel(/contraseña/i).fill('demo-password-123')
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await expect(page.getByRole('navigation', { name: /principal/i })).toBeVisible()
  await waitForServiceWorker(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('navigation', { name: /principal/i })).toBeVisible()
})
