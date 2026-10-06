# Nutrilara

Mobile-first web app (installable PWA) to control the meals a family receives from a healthy-catering
service: a monthly plan per person (20 meals by default, Monday to Friday, never on Bolivian
holidays), one outcome per meal (picked up, cancelled, not picked up, permission), optional
compressed photo as proof, exact monthly counters, history, reports and exports.

Registering a meal takes two taps: open the app, tap **Picked up**, optionally take a photo.

## Documentation

The project follows [Spec Kit](https://github.com/github/spec-kit): the specification is the source
of truth and lives next to the code.

| Document | What it is |
|----------|------------|
| [Constitution](.specify/memory/constitution.md) | Principles: English, simple code, open and free technologies, lightweight, docs aligned with code |
| [Specification](specs/001-catering-meal-tracker/spec.md) | What the product does, rules, acceptance scenarios |
| [Plan](specs/001-catering-meal-tracker/plan.md) and [research](specs/001-catering-meal-tracker/research.md) | Architecture and the decisions behind it |
| [Data model](specs/001-catering-meal-tracker/data-model.md) and [contracts](specs/001-catering-meal-tracker/contracts) | Tables, functions, screens |
| [Tasks](specs/001-catering-meal-tracker/tasks.md) | Implementation checklist |
| [Deployment](docs/deployment.md) | Supabase and free hosting setup |
| [Backup and restore](docs/restore.md) | How data and photos are protected |
| [Offline and installing](docs/pwa.md) | Using the app on a phone |
| [Licenses](docs/licenses.md) | Every dependency and its license |

## Stack

React + TypeScript + Vite + Tailwind CSS (static single-page app, no custom server) talking directly
to **Supabase** (PostgreSQL with Row Level Security, Auth, private Storage). Everything runs on free
tiers. Domain rules (the delivery calendar) are pure functions in `src/domain`, re-checked by
database constraints and triggers.

## Quick start (local)

Requirements: Node.js 22+, pnpm, a Supabase project (free) **or** the Supabase CLI with Docker.

```bash
pnpm install
cp .env.example .env.local        # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
supabase link --project-ref <ref> && supabase db push   # creates tables, rules, holidays, photo bucket
pnpm dev                          # http://localhost:5173
```

Create the first account in the app (it asks for the household), or load demo data:

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... pnpm seed:demo
# sign in with demo@nutrilara.local / demo-password-123
```

The service-role key is only read from your shell for the demo seed. It never goes in `.env.local`
or in the app.

## Run it on your computer without a Supabase account

No Docker and no account needed. `pnpm dev:stack` starts a real PostgreSQL with all the migrations, a
real PostgREST and a small stand-in for Supabase's sign-in and photo storage, creates a demo household
and writes `.env.local`:

```bash
pnpm install
pnpm integration:setup     # once: downloads the PostgREST binary
pnpm dev:stack             # terminal 1 (data is lost when it stops)
pnpm dev                   # terminal 2 -> http://localhost:5173
# sign in with demo@nutrilara.local / demo-password-123
```

It is for development only: passwords live in memory and photos are not checked against the storage
policies (the database tests cover those). `DEV_STACK_EMPTY=1 pnpm dev:stack` starts without demo data.

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | app (`.env.local`, hosting settings) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | app | Public anon key. Safe in the browser because Row Level Security protects the data |
| `SUPABASE_DB_URL` | CI secret for the backup job only | Database connection string for `supabase db dump` |
| `SUPABASE_SERVICE_ROLE_KEY` | your shell, `seed:demo` only | Creates the demo user. Never commit it |

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` / `pnpm build` / `pnpm preview` | Run, build and preview the app |
| `pnpm test` | Unit and component tests plus database tests (no Docker needed) |
| `pnpm test:tz` | The suite under three timezones (UTC, America/La_Paz, Asia/Tokyo) |
| `pnpm test:db` | Migrations, triggers and security rules on an embedded Postgres (PGlite) |
| `pnpm integration:setup` then `pnpm test:integration` | The app's data layer against a real PostgreSQL and PostgREST |
| `pnpm test:e2e` | Playwright on a phone-sized viewport with the Chrome on your machine. Needs `pnpm dev:stack` and `pnpm dev` running; restart the stack for a clean state. Offline specs need the production build (`E2E_BASE_URL=http://localhost:4173` with `pnpm preview --port 4173`); `first-run.spec.ts` needs `DEV_STACK_EMPTY=1` and `E2E_EMPTY=1` |
| `pnpm lint` / `pnpm typecheck` | Static checks |
| `pnpm check:bundle` | Fails if the startup JavaScript exceeds the size budget (run after `build`) |
| `pnpm types` | Regenerates `src/data/database.types.ts` from the migrations |
| `pnpm dev:stack` | The whole backend on your computer (see above) |
| `pnpm holidays:generate` | Regenerates the Bolivian holiday migration (see Deployment) |

## Project layout

```text
src/domain/        pure rules: dates, delivery calendar, statuses, counters, reconcile (no I/O)
src/data/          Supabase access, photo compression, offline outbox, cache
src/features/      one folder per screen group: today, month, history, people, holidays, export...
src/components/    shared UI
src/i18n/          Spanish (default) and English texts
supabase/          migrations (schema, rules, holidays, bucket, security)
scripts/           holiday generator, type generator, demo seed, backup, bundle check
tests/             unit, db (PGlite), integration (real Postgres + PostgREST), e2e
tools/photo-lab/   try the photo compression with your own photos (open /tools/photo-lab/ while `pnpm dev` runs)
tools/dev-stack/   stand-in for Supabase sign-in and storage used by `pnpm dev:stack`
```

## Rules worth knowing

- Meals only on delivery days (Monday to Friday by default), never on Bolivian public holidays;
  a weekend date needs an explicit exceptional delivery. Enforced in the app **and** the database.
- A month with more valid days than contracted meals uses the first N; with fewer, an alert is shown.
- A meal nobody recorded counts as **Not picked up (automatic)** once its day has passed.
- Dates are Bolivia calendar dates (`America/La_Paz`), never the phone's timezone.
- People are never deleted, only deactivated. One photo per meal, compressed on the phone.

## License

Dependencies are open source (see [docs/licenses.md](docs/licenses.md)).
