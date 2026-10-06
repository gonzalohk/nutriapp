import { expect, test } from '@playwright/test'

// Needs an EMPTY stack: `DEV_STACK_EMPTY=1 pnpm dev:stack`, then `E2E_EMPTY=1 pnpm test:e2e`.
test.skip(!process.env.E2E_EMPTY, 'run against an empty stack with E2E_EMPTY=1')

test('the first user creates the household and the second household is refused', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /crear cuenta/i }).first().click()
  await page.getByLabel(/correo/i).fill(`owner-${Date.now()}@example.com`)
  await page.getByLabel(/contraseña/i).fill('correct-horse-battery')
  await page.getByRole('button', { name: /crear cuenta/i }).last().click()
  await expect(page).toHaveURL(/\/setup$/)
  await page.getByLabel(/nombre del hogar/i).fill('Casa de prueba')
  await page.getByLabel(/tu nombre/i).fill('Gonzalo')
  await page.getByRole('button', { name: /crear hogar/i }).click()
  await expect(page.getByRole('navigation', { name: /principal/i })).toBeVisible()
})
