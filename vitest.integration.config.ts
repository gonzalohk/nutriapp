import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Real PostgreSQL + PostgREST. Run with: pnpm test:integration (after pnpm integration:setup).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
