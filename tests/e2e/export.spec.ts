import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Needs a running backend with demo data and at least one photo (quickstart.md scenario I).
test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/correo/i).fill('demo@nutrilara.local')
  await page.getByLabel(/contraseña/i).fill('demo-password-123')
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await page.getByRole('link', { name: /más/i }).click()
  await page.getByRole('link', { name: /exportar datos/i }).click()
})

test('the meals CSV has one row per meal', async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /comidas \(csv\)/i }).click()])
  const csv = readFileSync(await download.path(), 'utf8').replace(String.fromCharCode(0xfeff), '')
  const lines = csv.trim().split('\r\n')
  expect(lines[0]).toBe('person,date,meal_no,status,automatic,recorded_status,note,permission_reason,photo_file,status_changed_at')
  expect(lines.length).toBeGreaterThan(20)
})

test('the photos ZIP is a ZIP that includes the mapping file', async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('button', { name: /fotos \(zip\)/i }).click()])
  const bytes = readFileSync(await download.path())
  expect(bytes.subarray(0, 2).toString()).toBe('PK')
  expect(bytes.includes(Buffer.from('photos.csv'))).toBe(true)
})

test('the monthly report opens and offers printing', async ({ page }) => {
  await page.goBack()
  await page.getByRole('link', { name: /reporte mensual/i }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/REPORTE/)
  await expect(page.getByRole('button', { name: /imprimir/i })).toBeVisible()
})
