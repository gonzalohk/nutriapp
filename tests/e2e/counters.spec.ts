import { expect, test } from '@playwright/test'

// Needs a running backend with demo data (quickstart.md scenario C).
test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/correo/i).fill('demo@nutrilara.local')
  await page.getByLabel(/contraseña/i).fill('demo-password-123')
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await page.getByRole('link', { name: /mes/i }).click()
})

test('the five counters always add up to the scheduled meals', async ({ page }) => {
  const region = page.getByRole('region', { name: /resumen del mes/i })
  await expect(region).toBeVisible()
  const read = async (label: string) =>
    Number(await region.getByText(label, { exact: true }).locator('xpath=preceding-sibling::dd[1]').textContent())
  const total =
    (await read('Recogidas')) + (await read('Canceladas')) + (await read('No recogidas')) + (await read('Permisos')) + (await read('Pendientes'))
  const mealCells = await page.getByRole('gridcell', { name: /comida \d+/i }).count()
  expect(total).toBe(mealCells)
})

test('a forgotten past meal counts as automatic "not picked up", not as pending', async ({ page }) => {
  // The demo plan started two months ago and nothing was recorded, so past meals are automatic.
  await page.getByRole('button', { name: /mes anterior/i }).click()
  // past months are not created by browsing: generate it explicitly
  await page.getByRole('button', { name: /generar este mes/i }).click()
  const region = page.getByRole('region', { name: /resumen del mes/i })
  await expect(region.getByText(/automáticas/)).toBeVisible()
  const pending = await region.getByText('Pendientes', { exact: true }).locator('xpath=preceding-sibling::dd[1]').textContent()
  expect(Number(pending)).toBe(0)
})
