import { defineConfig, devices } from '@playwright/test'

// E2E needs a running backend: `pnpm integration:setup` once, then `pnpm dev:stack` and `pnpm dev`
// (or a real Supabase project configured through the VITE_ variables). The default project uses the
// Chrome installed on the machine; set E2E_IPHONE=1 to add a WebKit iPhone project (needs
// `pnpm exec playwright install webkit`).
const projects = [{ name: 'android', use: { ...devices['Pixel 7'], channel: 'chrome', launchOptions: { args: ['--no-sandbox'] } } }]
if (process.env.E2E_IPHONE) projects.push({ name: 'iphone', use: { ...devices['iPhone 14'] } } as never)

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173', trace: 'retain-on-failure', locale: 'es-BO', timezoneId: 'America/La_Paz' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: true },
  projects,
})
