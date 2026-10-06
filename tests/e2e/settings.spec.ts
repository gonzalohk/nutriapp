import { expect, test } from '@playwright/test'

// Needs a running backend with demo data (quickstart.md scenario F).
test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/correo/i).fill('demo@nutrilara.local')
  await page.getByLabel(/contraseña/i).fill('demo-password-123')
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await page.getByRole('link', { name: /más/i }).click()
})

test('a custom holiday shows its effect first and then removes the scheduled meal', async ({ page }) => {
  await page.getByRole('link', { name: /feriados y entregas/i }).click()
  await page.getByRole('button', { name: /agregar feriado/i }).click()
  const date = await page.evaluate(() => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() + 12)
    while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  await page.getByLabel(/fecha/i).fill(date)
  await page.getByLabel(/nombre/i).fill('Feriado de prueba')
  await page.getByRole('button', { name: /continuar/i }).click()
  await expect(page.getByText(/se quitan/i).first()).toBeVisible() // the effect is shown before saving
  await page.getByRole('button', { name: /aplicar cambio/i }).click()
  await expect(page.getByText('Feriado de prueba')).toBeVisible()

  // clean up so the spec can run again: removing the holiday shows its effect too
  await page.getByRole('listitem').filter({ hasText: 'Feriado de prueba' }).getByRole('button', { name: /quitar/i }).click()
  await page.getByRole('button', { name: /aplicar cambio/i }).click()
  await expect(page.getByText('Feriado de prueba')).toHaveCount(0)
})

test('a plan change applies from the chosen month and keeps earlier months unchanged', async ({ page }) => {
  await page.getByRole('link', { name: /personas/i }).click()
  await page.getByRole('listitem').filter({ hasText: 'Gonzalo' }).getByRole('button', { name: /^plan$/i }).click()
  await page.getByLabel(/comidas por mes/i).fill('25')
  await page.getByRole('button', { name: /guardar/i }).click()
  await page.getByRole('link', { name: /mes/i }).click()
  await page.getByRole('radio', { name: 'Gonzalo' }).click()
  await page.getByRole('button', { name: /mes siguiente/i }).click()
  await expect(page.getByText(/contratadas: 25/i)).toBeVisible()
  await page.getByRole('button', { name: /mes anterior/i }).click()
  await expect(page.getByText(/contratadas: 20/i)).toBeVisible()
})

test('an invitation code can be created and is 20 hexadecimal characters', async ({ page }) => {
  await page.getByRole('link', { name: /hogar e invitaciones/i }).click()
  await page.getByRole('button', { name: /crear invitación/i }).click()
  await expect(page.getByTestId('invite-code')).toHaveText(/^[0-9a-f]{20}$/)
})
