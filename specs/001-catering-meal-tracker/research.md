# Research: Catering Meal Tracker

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-03

Facts below were checked against vendor documentation or by running the library on 2026-10-03.
Pricing and free-tier limits change; re-verify them before relying on a number.

## R1. Application architecture

**Decision**: Static single-page app (React + TypeScript + Vite + Tailwind CSS), installable as a
PWA, talking directly to Supabase (Auth, PostgreSQL, Storage). No custom backend server.

**Rationale**:
- With Row Level Security the database already enforces who can read/write, so there is no server
  code to write, host or secure. This is the simplest option (constitution II).
- A static bundle can be hosted for free with no usage clause that could make it non-free later.
- Offline support is easier with a static app shell and a client-side cache than with server
  rendering (spec FR-037).
- Everything is behind login, so server-side rendering and SEO bring no benefit.
- Lighter first load than a server-rendered framework runtime (constitution IV).

**Alternatives considered**:

| Option | Why not |
|--------|---------|
| Next.js + Supabase (the user's suggested stack) | Works, but adds a server runtime and rendering model we do not need, and complicates offline caching. Kept as the fallback if server-side secrets are ever required. |
| SvelteKit / Vite + PocketBase (self-hosted) | PocketBase needs an always-on server; no genuinely free host. Violates the free-hosting goal. |
| Firebase (Firestore + Storage) | Cloud Storage requires the paid Blaze plan since 2026-02-03, even at tiny volumes. Fails constitution III. |
| Native app (Expo/Flutter) | Store accounts, build pipeline and review cycles for a single-family tool. Out of scope per spec assumptions. |

## R2. Backend, database, authentication

**Decision**: Supabase free project: PostgreSQL + Auth (email/password) + Storage (private bucket).

**Free-plan facts** (supabase.com/pricing): 500 MB database, 1 GB file storage, 50 MB max upload,
50,000 monthly active users, 5 GB egress, 2 active projects, **projects pause after 1 week of
inactivity**, **no automatic backups on Free** (backups doc), and **storage objects are not part
of database backups**. Image transformations are **Pro-only**.

**Rationale**: Open source (Apache 2.0) and self-hostable, so the lock-in risk is bounded
(constitution III). One service covers auth, relational data with constraints/RLS, and private
file storage. Relational integrity (unique person+date, triggers, views) fits this domain.

**Measured cost**: after route-level code splitting the startup JavaScript is 153 KB gzip: React and
the app about 83 KB, `supabase-js` 55 KB (it bundles an unused realtime client), TanStack Query 7 KB.
The budget is 160 KB and `pnpm check:bundle` enforces it. If more room is ever needed, assembling the
client from `postgrest-js`, `auth-js` and `storage-js` without realtime would save roughly 15 KB.

**Consequences and mitigations**:
- Pausing: a weekly scheduled job queries the database (also used for backups, R8). A paused
  project can be resumed manually from the dashboard; documented in the README.
- No automatic backups: weekly `supabase db dump` job plus in-app CSV/photo export (R8).
- No server-side image resizing: thumbnails are generated on the device at upload (R5).
- Email: Supabase's built-in email sender is heavily rate-limited, so the design avoids
  depending on email (no magic links, email confirmation off, invite code instead; R7).

**Alternatives considered**: Neon/Turso (DB only, no auth/storage, more glue); self-hosted
Postgres (needs a server); Appwrite cloud free (smaller community, fewer SQL guarantees).

## R3. Hosting

**Decision**: Cloudflare Pages (free) for the static build. Vercel Hobby is an acceptable
drop-in alternative because the output is plain static files.

**Facts**: Cloudflare Pages Free: 500 builds/month, 20,000 files/site, 25 MiB max file; no
commercial-use restriction in the limits doc. Vercel Hobby is free but restricted to
non-commercial personal use (fair-use guidelines); fine for this family tool, but a clause to
keep in mind.

**Rationale**: No server, so any static host works; Cloudflare Pages has no usage clause that
could later conflict with "free" and requires SPA fallback routing only.

## R4. Bolivian holidays

**Decision**: Generate official holidays with the `date-holidays` library (ISC license, v3.37.0)
at **build/seed time**, store them in an `official_holidays` table, and let each household
add or suppress dates through `holiday_overrides`. Only holidays of type `public` block
deliveries; type `observance` (e.g., Mother's Day, Maundy Thursday) does not.

**Verified output** (run 2026-10-03): the library returns Bolivia's movable holidays by rule
(Carnival Monday/Tuesday, Good Friday, Corpus Christi) and a **shifted holiday**
("Año Nuevo Andino Amazónico Chaqueño (substituto)" on 2026-06-22 because 06-21 is a Sunday).
Example 2026: 01-01, 01-22, 02-16, 02-17, 04-03, 05-01, 06-04, 06-21, 06-22, 08-06, 11-02, 12-25.

**Rationale**:
- Computed by rule, so any year works without manual entry (spec FR-010).
- The library bundles every country's data and is large, so it must not ship to the phone.
  Running it in a script and storing rows keeps the app small (constitution IV) and makes
  holidays editable data.
- Seeding 2024–2045 in one migration removes any yearly chore; the script is re-runnable.

**Risks and mitigations**:
- Bolivia sometimes decrees extraordinary or moved holidays; the library cannot know. The
  household override table (add/suppress) is the escape hatch (spec FR-011).
- Regional holidays (department days) are not in the national set; households add them as
  custom holidays (spec assumption).
- A holiday on which the caterer does deliver is handled by suppressing it for the household.
  Exceptional delivery dates apply only to non-delivery weekdays, so holidays are never
  silently overridden.

**Alternatives considered**: Hard-coded fixed dates (wrong for movable holidays); public
holiday web APIs (runtime dependency, availability and key concerns); manual yearly entry
(rejected by the user).

## R5. Photo capture, compression and storage

**Decision**:
- Capture with a standard file input using the camera hint (`accept="image/*" capture`), which
  works on Android and iOS without permission code.
- Compress on the device before upload: decode honoring EXIF orientation, scale so the long
  side is at most **1600 px**, encode **WebP at quality ~0.8**, falling back to **JPEG** when
  the browser cannot encode WebP (Safari historically returns a different format; the code
  checks the produced MIME type). If the result exceeds **500 KB**, lower quality in steps
  (0.8 → 0.5), then the long side (1600 → 1280), until it fits. Re-encoding through a canvas
  strips EXIF/GPS metadata.
- Also produce a **320 px thumbnail** (~15–30 KB) at upload, because server-side resizing is
  Pro-only.
- Store both in a **private** Supabase Storage bucket; the database stores paths, not URLs.
  Display through **signed URLs** (short expiry, requested in batch for a month view).
- Bucket constraints: max object 2 MB, allowed types `image/webp` and `image/jpeg`, and
  storage RLS tied to household membership.

**Numbers are targets** (the user asked not to assume them): the 1600 px / 0.8 / 500 KB values
are the starting point and the size-fit loop guarantees the limit. A task validates them on real
phone photos (legibility of food and receipts) and adjusts constants in one config file.

**Measured (2026-10-04, Chrome, real canvas encoder, synthetic photos)**: a noisy 12 MP image
(1.7 MB JPEG) became a 1600x1200 WebP of **186 KB at quality 0.8** in 157 ms, with a 14 KB
thumbnail; a simple 3000x2000 image became 16 KB. The size-fit loop did not need to lower the quality.
Synthetic images do not prove that food and receipts stay legible, and real phone photos can be
larger and noisier, so the values still have to be confirmed with real photos: run `pnpm dev`, open
`/tools/photo-lab/`, pick your photos and judge the previews (task T094 stays open until then).

**Capacity estimate**: 4 people x 20 meals x ~350 KB + 25 KB thumbnail = about 30 MB/month with a
photo for every meal, so the 1 GB free storage lasts about 2.5–3 years in the worst case.
Mitigations: photos are optional, the export allows archiving and deleting old photos, and the
quality constants can be lowered.

**Alternatives compared**:

| Option | Free tier | Verdict |
|--------|-----------|---------|
| Supabase Storage (chosen) | 1 GB, 50 MB/file, private buckets, RLS | Same service and auth as the data; signed URLs; no extra account. Limit: 1 GB and no free transformations. |
| Cloudflare R2 | 10 GB-month, 1M Class A / 10M Class B ops, free egress | Larger, but needs a separate account, a signed-URL service (a Worker) and has unverified card requirements. Good escape hatch if 1 GB runs out. |
| Cloudinary | 25 credits/month (1 credit = 1 GB storage, 1 GB bandwidth or 1,000 transforms) | Easy transformations, but separate vendor, credit accounting, and private delivery on the free plan is not confirmed. |
| Firebase Storage | none without Blaze | Rejected (R1). |
| Git repository | n/a | Rejected by RULE-009 and bad practice (history bloat, public by default). |

## R6. Dates and timezone strategy

**Decision**:
- Calendar dates are `date` columns in the database and plain `YYYY-MM-DD` strings in code.
  Never `Date` objects for meal dates, never `toISOString()` on a local date.
- Month arithmetic and weekday calculation use a small helper built on UTC components of a
  `Y-M-D` triple (no local-time parsing), unit-tested for month ends, leap years and the
  Dec/Jan boundary.
- "Today" is derived with `Intl.DateTimeFormat` using `America/La_Paz` (UTC−4, no DST), never
  from the device timezone.
- Timestamps (`created_at`, `status_changed_at`) are `timestamptz`, stored in UTC and displayed
  in Bolivia time.

**Rationale**: Prevents the classic off-by-one bugs where a UTC midnight shifts a meal to the
previous day. The tests required by the user (weekday exclusion, month boundaries) run with the
process timezone set to several values (UTC, America/La_Paz, Asia/Tokyo) to prove independence.

## R7. Authentication and household access

**Decision**: Supabase Auth with email + password. One **household** per deployment with multiple
adult users (spec Q2 = one sign-in per adult, equal access). Public sign-up creates an empty,
isolated account (RLS shows nothing); joining requires a one-time **invite code**. The very first
household is created via a bootstrap function that refuses to run once a household exists.
Email confirmation is off because the built-in sender is rate-limited and no data is reachable
without membership.

**Rationale**: No email dependency, minimal screens, and no data exposure because every table is
guarded by household membership. Attribution of changes comes from the signed-in user id.

**Alternatives considered**: Magic links (email rate limits); OAuth with Google (extra provider
setup, dependency on a third party); a single shared password (no attribution, rejected by Q2).

## R8. Backup and export

**Decision**: Three layers.
1. **In-app export**: all meals with status history as CSV; photos as a ZIP with a CSV mapping
   file names to meals (ZIP built on the device with a lazily loaded small library).
2. **Scheduled database dump**: weekly GitHub Actions job running `supabase db dump`, stored as
   a workflow artifact in a private repository. The job's query also keeps the free project
   awake (R2).
3. **Documented restore** in the README.

**Rationale**: Free plan has no backups and excludes storage objects, so both data and photos
need a path out. Layers 1 and 2 are cheap and require no paid service.

## R9. Offline and PWA

**Decision (v1)**:
- PWA with manifest, icons, splash and an app-shell service worker (Workbox via a Vite plugin):
  installable on Android and iOS.
- Read cache: server state cached with TanStack Query and persisted to IndexedDB so the last
  loaded month opens offline.
- Write **outbox** in IndexedDB: status changes and compressed photos queue locally with a
  client timestamp and are flushed when the app regains connectivity or returns to the
  foreground. The server ignores a queued status change older than the current
  `status_changed_at`, and a repeated status is a no-op, so replays are safe (idempotent).
- Background Sync is not available on iOS, so flushing is triggered by `online` and
  `visibilitychange` events, not a background worker.

**Deferred to a later phase**: offline editing of people/plans/holidays, background sync,
push notifications.

## R10. Notifications

**Decision**: Defer to phase 2; v1 ships without reminders (spec FR-038 is MAY, default off).

**Rationale**: Web Push needs a push service, VAPID keys, subscription storage and a scheduler
(for example Edge Functions with pg_cron). iOS only delivers web push to home-screen-installed
PWAs. That is real infrastructure for a nice-to-have, so it is out of the first release.
**Free path when wanted**: Supabase Edge Function + `pg_cron` + Web Push, or an email/Telegram
bot message. Keeping a `reminder_settings` table out of v1 avoids dead schema.

## R11. Reports

**Decision**: v1 = CSV export and an on-screen monthly report with print-optimized styles, so
"Save as PDF" from the browser produces the PDF. No PDF library is shipped.

**Rationale**: Zero added bundle weight and no PDF layout code to maintain; meets the "CSV and/or
PDF" request with the simplest path. A generated PDF can follow if browser printing proves
insufficient.

## R12. Testing strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Domain unit tests | Vitest | calendar, selection rule, shortfall, counters, state transitions, timezone-independence, compression sizing logic, outbox ordering |
| Database tests | Vitest on PGlite (embedded Postgres, no Docker; migrations applied as-is, Supabase `auth`/`storage` schemas stubbed) | unique person+date, weekend/holiday trigger, RLS isolation between households, status-change log, idempotent status RPC |
| Integration | Vitest + a real PostgreSQL (`embedded-postgres`) + a real PostgREST binary; runs the app's own data layer through the same REST layer Supabase uses (`pnpm integration:setup`, then `pnpm test:integration`); Auth and Storage are not included |
| End-to-end | Playwright (mobile viewport) | login, record meal, photo with a fixture image, history view, offline queue |

Test runs set `TZ` to several values to catch UTC/local bugs (R6).

## R13. Internationalization

**Decision**: Typed dictionary files (`es`, `en`) with a minimal `t()` helper; Spanish is the
default UI language. No i18n framework.

**Rationale**: Satisfies constitution I (text externalized) at about 1 KB rather than adding a
large library.

## Resolved unknowns

| Item | Resolution |
|------|-----------|
| Stack | R1, R2, R3 |
| Holidays | R4 |
| Photo pipeline and storage | R5 |
| Timezone | R6 |
| Auth and household model | R7 |
| Backups | R8 |
| Offline/PWA | R9 |
| Notifications | R10 (deferred) |
| Reports | R11 |
