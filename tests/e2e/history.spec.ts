import { expect, test } from '@playwright/test'

// Needs a running backend with demo data (quickstart.md scenario E).
test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/correo/i).fill('demo@nutrilara.local')
  await page.getByLabel(/contraseña/i).fill('demo-password-123')
  await page.getByRole('button', { name: /^entrar$/i }).click()
})

test('correcting a meal logs the change and re-submitting the same status adds nothing', async ({ page }) => {
  await page.getByRole('link', { name: /mes/i }).click()
  await page.getByRole('gridcell', { name: /comida 1,/i }).first().click()
  await page.getByRole('button', { name: /^no recogí$/i }).click()
  await page.getByRole('button', { name: /^recogí$/i }).click()
  const log = page.getByRole('heading', { name: /historial de cambios/i }).locator('xpath=following-sibling::ol[1]/li')
  await expect(log).toHaveCount(2)
  await page.getByRole('button', { name: /^recogí$/i }).click() // same status again
  await expect(log).toHaveCount(2)
  await expect(log.last()).toContainText('No recogida')
})

test('history lists the months of the year and opens a month detail', async ({ page }) => {
  await page.getByRole('link', { name: /historial/i }).click()
  const row = page.getByRole('link', { name: /^ver /i }).first()
  await expect(row).toContainText('/')
  await row.click()
  await expect(page.getByRole('region', { name: /resumen del mes/i })).toBeVisible()
})
