import { expect, test } from '@playwright/test'

// Needs a running backend with demo data (quickstart.md scenario D).
test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/correo/i).fill('demo@nutrilara.local')
  await page.getByLabel(/contraseña/i).fill('demo-password-123')
  await page.getByRole('button', { name: /^entrar$/i }).click()
})

test('Today with "Todos" lists every active person on one screen', async ({ page }) => {
  await page.getByRole('radio', { name: /todos/i }).click()
  for (const name of ['Gonzalo', 'Esposa', 'Hijo', 'Hija']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible()
  }
})

test('switching to one person shows only that person', async ({ page }) => {
  await page.getByRole('radio', { name: 'Hijo' }).click()
  await expect(page.getByRole('article', { name: /hijo/i })).toBeVisible()
  await expect(page.getByRole('article', { name: /hija/i })).toHaveCount(0)
})

test('a deactivated person leaves Today but stays in the people list', async ({ page }) => {
  await page.getByRole('link', { name: /más/i }).click()
  await page.getByRole('link', { name: /personas/i }).click()
  const row = page.getByRole('listitem').filter({ hasText: 'Hija' })
  await row.getByRole('button', { name: /desactivar/i }).click()
  await page.getByRole('button', { name: /^desactivar$/i }).last().click()
  await expect(row.getByText(/inactiva/i)).toBeVisible()
  await page.getByRole('link', { name: /hoy/i }).click()
  await page.getByRole('radio', { name: /todos/i }).click()
  await expect(page.getByRole('button', { name: /hija/i })).toHaveCount(0)
  // undo
  await page.getByRole('link', { name: /más/i }).click()
  await page.getByRole('link', { name: /personas/i }).click()
  await row.getByRole('button', { name: /reactivar/i }).click()
  await expect(row.getByText(/✔ activa/i)).toBeVisible()
})
