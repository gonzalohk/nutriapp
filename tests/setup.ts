// Component tests opt into jsdom with `// @vitest-environment jsdom`.
import { afterEach } from 'vitest'

if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')
  const { cleanup } = await import('@testing-library/react')
  afterEach(() => cleanup())
}
