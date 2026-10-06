# Dependency licenses

Every dependency is open source (constitution Principle III). Versions are the ones in
`pnpm-lock.yaml`; re-check licenses when upgrading.

## Runtime (shipped to the browser)

| Package | License | Purpose |
|---------|---------|---------|
| react, react-dom | MIT | UI |
| wouter | Unlicense | Routing (about 2 KB) |
| @tanstack/react-query | MIT | Server-state cache |
| @tanstack/react-query-persist-client | MIT | Persist the cache for offline reading |
| @supabase/supabase-js | MIT | Backend client (Auth, Postgres, Storage) |
| idb-keyval | Apache-2.0 | Tiny IndexedDB wrapper (cache and outbox) |
| fflate | MIT | ZIP of photos, loaded only when exporting |

## Build and test only (not shipped)

| Package | License |
|---------|---------|
| vite, @vitejs/plugin-react, vite-plugin-pwa | MIT |
| workbox-window (service-worker registration, included in the app bundle) | MIT |
| tailwindcss, @tailwindcss/vite | MIT |
| typescript | Apache-2.0 |
| vitest, jsdom, fake-indexeddb | MIT, MIT, Apache-2.0 |
| @electric-sql/pglite | Apache-2.0 |
| embedded-postgres, pg (integration tests) | MIT (embedded-postgres downloads PostgreSQL binaries, PostgreSQL license) |
| PostgREST binary (integration tests, downloaded by `pnpm integration:setup`, not in the repo) | MIT |
| @playwright/test | Apache-2.0 |
| @testing-library/* | MIT |
| eslint, typescript-eslint, eslint-plugin-react-hooks, @eslint/js, globals, prettier, tsx | MIT |
| date-holidays | ISC AND CC-BY-3.0 (see below) |

## Attribution: holiday data

`date-holidays` (ISC for the code, **CC-BY-3.0 for the holiday data**) is used only by
`scripts/generate-holidays.ts` to produce `supabase/seed/official_holidays.sql`. The data is
derived from the project's holiday definitions: https://github.com/commenthol/date-holidays.
Keep this attribution with the generated file.

## Services (free tiers)

| Service | Use | Open source / self-hostable |
|---------|-----|------------------------------|
| Supabase (Free plan) | Postgres, Auth, Storage | Yes (Apache-2.0) |
| Cloudflare Pages (Free) or Vercel Hobby | Static hosting | No, but the build output is plain static files and can be moved to any host |
