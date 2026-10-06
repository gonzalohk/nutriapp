# Quickstart: Validation Guide

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

How to run the app and prove the feature works end to end. Commands assume the layout in the plan;
details of schema and functions live in [data-model.md](data-model.md) and
[contracts/rpc.md](contracts/rpc.md).

## Prerequisites

- Node.js 22+ and pnpm
- Docker (for the local Supabase stack and database tests)
- Supabase CLI
- A free Supabase project and a free Cloudflare Pages (or Vercel) account for deployment

## 1. Local setup

```bash
pnpm install
cp .env.example .env.local        # fill values, see variable table
supabase start                    # local Postgres, Auth, Storage
supabase db reset                 # applies migrations and seed (including holidays)
pnpm dev                          # http://localhost:5173
```

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL (local or hosted) |
| `VITE_SUPABASE_ANON_KEY` | Public anon key; safe in the browser because RLS protects data |

The service-role key is never placed in the app or in `.env.local`; it is only used by the
backup job via CI secrets.

## 2. Tests

```bash
pnpm test                  # Vitest unit tests (run with TZ=UTC, America/La_Paz and Asia/Tokyo)
pnpm test:db               # PGlite: constraints, triggers, RLS (no Docker needed)
pnpm integration:setup     # once: downloads the PostgREST binary
pnpm test:integration      # app data layer vs a real Postgres + PostgREST (no Docker)
pnpm dev:stack              # terminal 1: real Postgres + PostgREST + demo data (no Docker)
pnpm dev                    # terminal 2
pnpm test:e2e               # Playwright, mobile viewport, Chrome on this machine (restart the stack for a clean state)
```

Expected: all green; the unit suite must pass in all three timezones.

## 3. Validation scenarios

Each scenario maps to spec acceptance scenarios. Use the demo seed (household with Gonzalo,
Esposa, Hijo, Hija; 20-meal plans).

### A. Calendar correctness (US2, SC-002)
1. Open **Month → Gonzalo → October 2026**.
2. Expect 20 meals, 1 Oct to 28 Oct; 29 and 30 Oct appear "not in plan"; weekends muted.
3. Open **February 2026**: 16 Feb and 17 Feb (Carnival) show the holiday name and have no meal.
4. Open **June 2026**: 4 Jun (Corpus Christi) and 22 Jun (substitute holiday) have no meal.
5. Try inserting a meal on a Saturday directly in the database: expect `E_INVALID_DATE`.

6. Open **Month** for the previous month of a person with no meals there: nothing is created by
   browsing; **Generate this month** creates them on request.

### B. Quick record in under 10 seconds (US1, SC-001)
1. Open **Today** on a phone-sized viewport (a weekday with meals).
2. Tap **Picked up** → **Skip photo**. Expect status saved and counters updated.
3. Repeat with a photo from a 12 MP picture: expect an upload of at most about 500 KB (check
   the `bytes` column) plus a thumbnail, and the photo visible in **History**.

### C. Counters (US3, SC-003)
1. Record 14 picked up, 2 cancelled, 1 not picked up, 1 permission for one person; leave 2.
2. **Month** shows 14/2/1/1/2 and total 20 with no warning.
3. Delete a meal row directly in the database: expect the inconsistency/shortfall warning.
4. Leave a past-dated meal unrecorded: expect it counted as Not picked up with the automatic tag,
   and Pending to include only today and future meals.

### D. Several people (US4)
1. **Today → All** shows every active person's status.
2. Deactivate one person: they leave Today but their history remains.

### E. Corrections and audit (US5)
1. Change a meal from Not picked up to Picked up.
2. Open the meal sheet: change log shows from → to, who and when.
3. Re-submit the same status: no new log entry.

### F. Holidays and exceptional days (US6)
1. Add a custom holiday on a date with a scheduled meal and confirm: the scheduled meal is
   removed and the month is flagged; a recorded meal on the same date is kept and flagged for review.
2. Add an exceptional Saturday: it becomes eligible and counts toward the contracted total.

### G. Offline (US8, SC-011)
1. Load **Today**, switch the browser to offline.
2. Record a status with a photo: shown as "pending sync".
3. Go online: the status and photo appear; the pending badge disappears.

### H. Security (FR-001, FR-002, FR-024)
1. Signed out: every data route redirects to `/login`.
2. With a second household's user (database test fixture): queries return no rows from the first.
3. Request a photo path without a signed URL: denied. Upload a text file renamed `.webp`:
   rejected.

### I. Export and report (US7)
1. **More → Export** downloads a CSV with every meal and status; the photo ZIP contains the
   images and a mapping file.
2. **Report** for October 2026 matches the counters; **Print** produces a clean page.

## 4. Deploy (summary)

1. Create the hosted Supabase project; run `supabase link` and `supabase db push`.
2. Auth settings: disable email confirmation; keep sign-up enabled (access is gated by invite
   code).
3. Create the storage bucket via the migration (already included); confirm it is private.
4. Connect the repository to Cloudflare Pages: build `pnpm build`, output `dist`, set the two
   `VITE_` variables, add SPA fallback.
5. Add the weekly backup workflow secrets and confirm the first run.

Full instructions go in the README produced during implementation.
