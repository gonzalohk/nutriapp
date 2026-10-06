import { expect, test } from '@playwright/test'
import { signInAsDemo } from './helpers'

// Needs the demo stack (`pnpm dev:stack`). The first-run flow has its own spec (first-run.spec.ts).
const main = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: /principal/i })

test('signed-out users are sent to the login page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})

test('a wrong password shows an error and stays on the login page', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/correo/i).fill('demo@nutrilara.local')
  await page.getByLabel(/contraseña/i).fill('not-the-password')
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('sign out removes access and signing in again brings it back', async ({ page }) => {
  await signInAsDemo(page)
  await expect(main(page)).toBeVisible()
  await page.getByRole('link', { name: /más/i }).click()
  await page.getByRole('button', { name: /salir/i }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/') // the session and the cached data are gone
  await expect(page).toHaveURL(/\/login$/)
  await signInAsDemo(page)
  await expect(main(page)).toBeVisible()
})

test('a second adult joins with a one-time invite code and sees the household', async ({ browser, page }) => {
  await signInAsDemo(page)
  await page.getByRole('link', { name: /más/i }).click()
  await page.getByRole('link', { name: /hogar e invitaciones/i }).click()
  await page.getByRole('button', { name: /crear invitación/i }).click()
  const code = (await page.getByTestId('invite-code').textContent())?.trim()
  expect(code).toMatch(/^[0-9a-f]{20}$/)

  const guest = await (await browser.newContext({ locale: 'es-BO' })).newPage()
  const email = `guest-${Date.now()}@example.com`
  await guest.goto('/login')
  await guest.getByRole('button', { name: /crear cuenta/i }).first().click()
  await guest.getByLabel(/correo/i).fill(email)
  await guest.getByLabel(/contraseña/i).fill('guest-password-1')
  await guest.getByRole('button', { name: /crear cuenta/i }).last().click()
  await expect(guest).toHaveURL(/\/setup$/) // a new account sees no data until it joins
  await guest.getByRole('link', { name: /únete a un hogar existente/i }).click()
  await guest.getByLabel(/código/i).fill(code!)
  await guest.getByLabel(/tu nombre/i).fill('Invitada')
  await guest.getByRole('button', { name: /unirme/i }).click()
  await expect(main(guest)).toBeVisible()
  await guest.getByRole('radio', { name: 'Gonzalo' }).click() // sees the same people

  // the code works only once
  const other = await (await browser.newContext({ locale: 'es-BO' })).newPage()
  await other.goto('/login')
  await other.getByRole('button', { name: /crear cuenta/i }).first().click()
  await other.getByLabel(/correo/i).fill(`other-${Date.now()}@example.com`)
  await other.getByLabel(/contraseña/i).fill('other-password-1')
  await other.getByRole('button', { name: /crear cuenta/i }).last().click()
  await other.goto('/join')
  await other.getByLabel(/código/i).fill(code!)
  await other.getByLabel(/tu nombre/i).fill('Otra')
  await other.getByRole('button', { name: /unirme/i }).click()
  await expect(other.getByRole('alert')).toContainText(/ya se usó|venció|no existe/i)
})
