---

description: "Task list for the Catering Meal Tracker"
---

# Tasks: Catering Meal Tracker

**Input**: Design documents from `/specs/001-catering-meal-tracker/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rpc.md, contracts/ui-screens.md, quickstart.md

**Tests**: Included. The user explicitly required tests for the calendar, statuses, counters, photos, duplicates, status changes, multiple people and timezones (spec SC-002, SC-003; research R12). Write each test first and watch it fail before implementing.

**Organization**: Tasks are grouped by user story. Story order is by dependency, not by number: **US2 (calendar) comes first** because every other story needs meals to exist, then US1, then US3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: User story from spec.md (US1–US8)
- All paths are relative to the repository root `/home/zalo/Documents/nutrilara/`

## Path Conventions

Single repository, see plan.md "Source Code": app in `src/`, unit tests in `tests/unit/`, e2e in `tests/e2e/`, database in `supabase/migrations/` with database tests in `tests/db/` (PGlite), scripts in `scripts/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project scaffold and tooling

- [X] T001 Run `git init`, then initialize a Vite + React 19 + TypeScript (strict) project with pnpm: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`
- [X] T002 [P] Configure Tailwind CSS in `tailwind.config.ts`, `postcss.config.js` and `src/index.css` (mobile-first, system font stack, base touch-target size 48 px)
- [X] T003 [P] Configure ESLint, Prettier and `.editorconfig` (`eslint.config.js`, `.prettierrc`)
- [X] T004 [P] Configure Vitest in `vitest.config.ts` and add package scripts `test` and `test:tz` that run the suite with `TZ=UTC`, `TZ=America/La_Paz` and `TZ=Asia/Tokyo`
- [X] T005 [P] Configure Playwright in `playwright.config.ts` with a mobile viewport project (Pixel 7) and an iPhone project
- [X] T006 [P] Create `.env.example` documenting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and a `.gitignore` that excludes `.env*`, `dist/`, `node_modules/`, `test-results/` and any photo fixtures outside `tests/fixtures/` (RULE-009)
- [X] T007 Initialize Supabase in `supabase/config.toml`: email confirmation off, sign-up on, JWT expiry default, storage file size limit 2 MiB
- [X] T008 [P] Add GitHub Actions CI in `.github/workflows/ci.yml`: install, lint, typecheck, `pnpm test:tz`, build
- [X] T009 [P] Create the i18n module: `src/i18n/t.ts` (typed `t(key, params?)`), `src/i18n/es.ts` (default) and `src/i18n/en.ts`, plus `tests/unit/i18n.test.ts` asserting both dictionaries have identical keys
- [X] T010 [P] Create `tests/db/harness.ts` (PGlite helper: Supabase stub for `auth.users`, `auth.uid()`, roles, `storage.buckets`/`storage.objects`; applies `supabase/migrations/*.sql` in order; `asUser(id)` to switch the simulated caller) and `docs/licenses.md` listing every dependency and its license (constitution III), to be completed as dependencies are added

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Households, authentication, people/plan tables, date helpers and the app shell. **No user story can start until this phase is complete.**

- [X] T011 Write migration `supabase/migrations/0001_core.sql`: enum `member_role` (`owner`, `adult`); tables `households` (id uuid PK, name text not null, country_code text not null default `'BO'`, timezone text not null default `'America/La_Paz'`, created_at timestamptz), `household_members` (household_id, user_id → auth.users, role member_role, display_name text not null, created_at; PK household_id+user_id; role is informational only, all members have the same permissions) and `household_invites` (code text PK, household_id, created_by, expires_at timestamptz not null default now() + 7 days, used_by null, used_at null); function `is_household_member(uuid)` (security definer, stable); RLS on all three; functions `create_household(p_name, p_display_name)` (raises `E_HOUSEHOLD_EXISTS` if any household exists), `create_invite()` (any member, single-use, 7 days, code = 16 random characters from `gen_random_bytes`, so guessing is infeasible) and `join_household(p_code, p_display_name)` (raises `E_INVITE_INVALID` / `E_ALREADY_MEMBER`), per contracts/rpc.md
- [X] T012 Write migration `supabase/migrations/0002_people_plans.sql`: table `people` (id uuid PK, household_id, first_name text not null, last_name text null, active boolean not null default true, plan_start_date date not null, plan_end_date date null, created_at) with RLS that allows select/insert/update for members and **no delete policy** (people are never deleted from the app, spec FR-007); table `plan_terms` (id uuid PK, person_id, effective_from date not null with check `extract(day from effective_from) = 1`, meals_per_month int not null check `> 0` default 20, delivery_weekdays smallint[] not null default `{1,2,3,4,5}` with check that all values are within 1..7, selection_rule text not null default `'first_n'`, pickup_time time null; unique (person_id, effective_from)) with RLS through the person's household
- [X] T013 [P] Write database tests `tests/db/core-rls.test.ts` (Vitest on PGlite, migrations applied to an in-memory Postgres with a small Supabase stub for `auth.users`/`auth.uid()`): a user of household A sees no rows of household B in every table; `create_household` fails with `E_HOUSEHOLD_EXISTS` once one exists; invite is single-use, expires after 7 days; a user with no membership sees no rows; `people` rejects delete for members
- [X] T014 [P] Implement `src/domain/plain-date.ts`: `YYYY-MM-DD` string type, `daysInMonth`, `addDays`, `isoWeekday` (1=Mon..7=Sun), `monthStart`, `monthRange`, `compare`, all via UTC components of a Y-M-D triple and never local `Date` parsing (research R6)
- [X] T015 [P] Write `tests/unit/plain-date.test.ts`: leap years (2024-02-29), month ends, Dec 31 → Jan 1 (year change), weekday of 2026-10-01 is Thursday (4), results identical under every `TZ` in `test:tz`
- [X] T016 [P] Implement `src/domain/bolivia-time.ts`: `todayInBolivia(now?: Date)` using `Intl.DateTimeFormat` with `timeZone: 'America/La_Paz'`, `formatBoliviaDateTime`; test in `tests/unit/bolivia-time.test.ts` including the instant 2026-10-03T02:00:00Z being 2026-10-02 in Bolivia and a device timezone of Asia/Tokyo
- [X] T017 [P] Implement `src/domain/meal-status.ts`: the five statuses (`scheduled`, `picked_up`, `cancelled`, `not_picked_up`, `permission`), allowed transitions (any → any other, same status is a no-op), presentation keys (icon, i18n label key, color token) from contracts/ui-screens.md, and `effectiveStatus(status, mealDate, today)` returning `not_picked_up` + `isAutomatic: true` for a stored `scheduled` meal dated before `today` (spec FR-015a); test in `tests/unit/meal-status.test.ts`
- [X] T018 Generate database types into `src/data/database.types.ts` with `supabase gen types typescript --local` (script `pnpm types`) and create the client in `src/data/supabase.ts` using the two `VITE_` variables
- [X] T019 [P] Implement `src/data/errors.ts` mapping stable RPC error codes (`E_HOUSEHOLD_EXISTS`, `E_INVITE_INVALID`, `E_ALREADY_MEMBER`, `E_INVALID_DATE`, `E_NOT_FOUND`) to i18n keys, with both messages in `src/i18n/es.ts` and `src/i18n/en.ts`
- [X] T020 [P] Build shared components in `src/components/`: `Button.tsx` (min 48 px), `Sheet.tsx`, `StatusBadge.tsx` (icon + text + color, never color alone), `EmptyState.tsx`, `Spinner.tsx`, `ConfirmDialog.tsx`
- [X] T021 Build the app shell: `src/App.tsx` (wouter routes from contracts/ui-screens.md, auth guard), `src/components/TabBar.tsx` (Today, Month, History, More), TanStack Query provider in `src/data/query-client.ts`, error boundary `src/components/ErrorBoundary.tsx`
- [X] T022 Implement auth in `src/features/auth/`: `LoginPage.tsx` (email + password), `SetupPage.tsx` (create household when none exists), `JoinPage.tsx` (invite code + display name), `useSession.ts`; signed-out users redirect to `/login`
- [X] T023 [P] Write Playwright test `tests/e2e/auth.spec.ts`: first-run setup, sign-out, sign-in, redirect when signed out, joining with an invite code (covers spec FR-001, FR-003)

**Checkpoint**: Foundation ready. Users can sign in; the database has households, people and plan terms.

---

## Phase 3: User Story 2 - Correct monthly delivery calendar (Priority: P1) 🎯 MVP

**Goal**: Each person's month contains meals only on valid delivery days, adding up to the contracted number (spec US2, SC-002).

**Independent Test**: Generate October 2026 for a 20-meal person and see 1–28 Oct (29, 30 "not in plan"); Carnival 16–17 Feb 2026 and 4 and 22 Jun 2026 have no meal; a Saturday insert is rejected (quickstart scenario A).

### Tests for User Story 2 ⚠️ write first, they must fail

- [X] T024 [P] [US2] Write `tests/unit/calendar.test.ts` covering: weekdays only; Saturday and Sunday excluded; holiday excluded; exactly 20 valid days → 20 meals; 22 valid days → first 20 and 2 "extra"; fewer than 20 → only valid days and `shortfall` computed; partial first/last month (`isPartial`, no shortfall); exceptional Saturday becomes eligible; an exceptional date on a holiday is **not** eligible; custom `delivery_weekdays`; December→January year change with 1 Jan excluded; October 2026 example (22 weekdays, target 1–28 Oct); February 2026 Carnival; June 2026 Corpus Christi and the 22 Jun substitute; run under all three `TZ` values
- [X] T025 [P] [US2] Write `tests/unit/calendar-sweep.test.ts`: for every month from 2024 to 2035, no generated date is a weekend (unless exceptional) or a holiday from the generated data (spec SC-002)
- [X] T026 [P] [US2] Write `tests/unit/holidays-script.test.ts` pinning the generated Bolivian `public` holidays for 2026 and 2027, and that `docs/deployment.md` explains re-running `pnpm holidays:generate` before the last seeded year (2045) (12 dates in 2026 including 2026-06-22; Maundy Thursday and Mother's Day excluded because they are `observance`)
- [X] T027 [P] [US2] Write database tests `tests/db/meals-calendar.test.ts` (PGlite): Saturday insert fails `E_INVALID_DATE`; holiday insert fails; Saturday succeeds when an exceptional delivery date exists; duplicate (person_id, meal_date) fails (RULE-012); `apply_month_plan` is idempotent, deletes only `scheduled` meals not in the list, never deletes a recorded meal and sets `needs_review` when one no longer fits; one `monthly_plans` row per (person_id, month) (RULE-001)

### Implementation for User Story 2

- [X] T028 [US2] Implement `scripts/generate-holidays.ts`: use `date-holidays` (dev dependency, ISC) for `BO`, years 2024–2045, keep only `type === 'public'`, emit the data migration `supabase/migrations/0004_official_holidays.sql` (idempotent upserts into `official_holidays` plus the covered year range in `official_holiday_years`; flags `--from`, `--to`, `--out` allow generating a later range as a new migration); it is a migration, not a seed, because `supabase db push` does not run seeds; add package script `pnpm holidays:generate`, keep the pure `bolivianPublicHolidays(year)` in `scripts/holidays-lib.ts`, and commit the generated SQL (research R4)
- [X] T029 [US2] Write migration `supabase/migrations/0003_calendar.sql` (before the data migration of T028, so write it first): `official_holidays` (country_code, holiday_date, name text not null; PK country_code+holiday_date; readable by any signed-in user, writable by nobody), `official_holiday_years` (country_code PK, first_year, last_year: the range the generator covered, used by the app to refuse generating a month outside it), `holiday_overrides` (household_id, holiday_date, action `override_action` enum `add`|`remove`, name text null; PK household_id+holiday_date), `exceptional_delivery_dates` (household_id, delivery_date, note text null; PK household_id+delivery_date; a trigger `exceptional_delivery_validate` rejects a date that is in `effective_holidays`, because a CHECK constraint cannot query other tables), view `effective_holidays` (security invoker: official minus `remove` plus `add`), functions `add_holiday`, `remove_holiday`, `add_exceptional_delivery`, `remove_exceptional_delivery` per contracts/rpc.md; (holiday data itself arrives in T028's migration `0004_official_holidays.sql`)
- [X] T030 [US2] Write migration `supabase/migrations/0005_meals.sql`: enum `meal_status` (`scheduled`, `picked_up`, `cancelled`, `not_picked_up`, `permission`); `monthly_plans` (id, person_id, household_id, month date not null, contracted_count int not null, is_partial boolean not null default false, needs_review boolean not null default false, created_at; **unique (person_id, month)**); `meals` (id, monthly_plan_id, person_id, household_id, meal_date date not null, status meal_status not null default `'scheduled'`, note text null, permission_reason text null, status_changed_at timestamptz not null default now(), status_changed_by uuid null → auth.users, created_at, updated_at; **unique (person_id, meal_date)**; indexes on (household_id, meal_date) and (monthly_plan_id)); `updated_at` trigger (RULE-016); trigger `meals_validate_date` that raises `E_INVALID_DATE` for Saturday/Sunday without an exceptional delivery date and for any date in `effective_holidays` (RULE-004, 005, 013, 014); view `meals_numbered` with `meal_no = row_number() over (partition by monthly_plan_id order by meal_date)` and `effective_status` / `is_automatic` computed against today in the household timezone (spec FR-015a); function `apply_month_plan(p_person, p_month, p_dates, p_contracted, p_is_partial)` as specified in contracts/rpc.md; RLS on every table; `meals` and `monthly_plans` are select-only for the app (insert/update/delete are revoked) and change only through `SECURITY DEFINER` functions that check household membership
- [X] T031 [US2] Implement `src/domain/calendar.ts` exactly per the data-model.md "Generation algorithm": `deliveryDays`, `planMonth(input) → { target, extra, shortfall, isPartial }`, selection rule `first_n` stored as a setting; pure and free of I/O; `planMonth` throws a typed `HolidayDataMissing` error when the month's year is outside the supplied holiday coverage (first and last seeded year) instead of silently generating meals on unlisted holidays (spec SC-002); make T024 and T025 pass
- [X] T032 [P] [US2] Implement `src/data/calendar-data.ts`: read the seeded holiday coverage (min/max year of `official_holidays`), `effective_holidays`, `exceptional_delivery_dates` and the applicable `plan_terms` row (greatest `effective_from` ≤ month) for a person and month
- [X] T033 [US2] Implement `ensureMonthPlan(person, month)` in `src/data/mutations.ts`: loads inputs (T032), calls `planMonth`, then `apply_month_plan`; add hook `src/features/month/useEnsureMonthPlan.ts` that runs it **at app start for the current and next month of every active person** (so Today is never empty on the 1st) and when a month is opened; month navigation is bounded from the person's `plan_start_date` month to one month ahead, so browsing never creates rows for distant months
- [X] T034 [P] [US2] Build `src/features/month/CalendarGrid.tsx`: weekends and holidays muted with holiday name, meal days show meal number, status icon and photo dot, valid-but-beyond-plan days dashed "not in plan"
- [X] T035 [US2] Build `src/features/month/MonthPage.tsx` with person selector, month stepper, `CalendarGrid`, and a shortfall banner ("18 of 20 delivery days available") shown only when `shortfall > 0` and the month is not partial; menu action **Add exceptional delivery date**
- [X] T036 [P] [US2] Write `scripts/seed-demo.ts` (local only, uses the service role key from the shell, never from `.env.local`): creates a demo user, household, four active people with a 20-meal plan and generates the current month; document in `README` during Polish

**Checkpoint**: Months generate correctly; invalid dates are impossible at both the app and database layer. Quickstart scenario A passes.

---

## Phase 4: User Story 1 - Record today's meal in seconds (Priority: P1) 🎯 MVP

**Goal**: Open the app, tap one large action, optionally add a compressed private photo, in under 10 s (no photo) / 20 s (photo) (spec US1, SC-001).

**Independent Test**: With one person and a meal today, tap **Picked up**, take or skip the photo, and see the meal recorded; quickstart scenario B.

### Tests for User Story 1 ⚠️ write first

- [X] T037 [P] [US1] Write database tests `tests/db/set-meal-status.test.ts` (PGlite): same status again returns the row unchanged with no log row; a `p_client_ts` older than `status_changed_at` is ignored; a change writes one `meal_status_changes` row with from/to status and user; a different household's meal raises `E_NOT_FOUND`; `permission_reason` is stored only with `permission`
- [X] T038 [P] [US1] Write database tests `tests/db/photos.test.ts` (PGlite): `meal_photos.meal_id` is unique (second photo for a meal fails); `mime_type` outside (`image/webp`, `image/jpeg`) fails; `bytes` over 2097152 fails; `replace_meal_photo` returns the previous paths; storage policy denies another household's path and anonymous access; `delete_meal_photo` leaves the meal status unchanged
- [X] T039 [P] [US1] Write `tests/unit/photo-compress.test.ts` for the pure sizing logic: scales long side to ≤ 1600 px keeping aspect ratio; falls back from WebP to JPEG when the produced MIME type is not `image/webp`; step-down loop (quality 0.8 → 0.5, then long side 1600 → 1280) stops once the blob is ≤ 500 KB; rejects non-image input and inputs over the raw size cap (25 MB, constant `MAX_INPUT_BYTES` in `photo-config.ts`) with a typed error; thumbnail long side 320 px
- [X] T040 [P] [US1] Write Playwright `tests/e2e/quick-record.spec.ts`: Picked up without photo; Picked up with a fixture image (assert stored `bytes` ≤ 524288 and a thumbnail exists); Cancelled; Not picked up; Permission with a reason; no actions on a weekend with the reason shown

### Implementation for User Story 1

- [X] T041 [US1] Write migration `supabase/migrations/0006_meal_status.sql`: `meal_status_changes` (id bigint identity PK, meal_id → meals on delete cascade, from_status, to_status, changed_at timestamptz default now(), changed_by uuid null → auth.users); trigger `meals_log_status` (after update of `status`: insert log row, set `status_changed_at/by`); function `set_meal_status(p_meal, p_status, p_note, p_reason, p_client_ts)` with the no-op and stale-timestamp rules from contracts/rpc.md; RLS through the meal's household
- [X] T042 [US1] Write migration `supabase/migrations/0007_photos.sql`: table `meal_photos` (id uuid PK, meal_id → meals on delete cascade **unique**, household_id, storage_path text not null, thumb_path text not null, mime_type text not null check in (`image/webp`, `image/jpeg`), bytes int not null check `<= 2097152`, width int, height int, taken_at timestamptz not null, created_by → auth.users); private bucket `meal-photos` (max object 2 MB, allowed MIME `image/webp`, `image/jpeg`) with policies restricting the first path segment to the caller's households; functions `replace_meal_photo(...)` and `delete_meal_photo(p_photo)` per contracts/rpc.md
- [X] T043 [P] [US1] Implement `src/data/photo-compress.ts`: decode with EXIF orientation (`createImageBitmap` with `imageOrientation: 'from-image'`), draw to an `OffscreenCanvas` inside a Web Worker (`src/data/photo-worker.ts`) so decoding and encoding never block the UI thread (constitution IV), falling back to the main thread only when `OffscreenCanvas` is unavailable; the canvas re-encode strips metadata; encode WebP then JPEG fallback, size-fit loop and 320 px thumbnail; constants in `src/data/photo-config.ts` (max side 1600, quality 0.8, byte cap 500 KB, thumb 320 px) so tuning is one edit; make T039 pass
- [X] T044 [US1] Implement `src/data/photos.ts`: upload both objects to `{household_id}/{person_id}/{yyyy-mm}/{meal_id}/{photo_id}.{ext}` and `..._thumb.{ext}`, call `replace_meal_photo`, delete the previous objects it returns, clean up orphans on failure, and `getSignedUrls(paths, 3600)` in batch
- [X] T045 [US1] Implement `setMealStatus(...)` in `src/data/mutations.ts` calling `set_meal_status` with `p_client_ts = now`, with optimistic cache update and rollback, and `useTodayMeals` in `src/data/queries.ts` (meals for `todayInBolivia()` joined to active people)
- [X] T046 [P] [US1] Build `src/features/today/PersonMealCard.tsx` and `StatusButtons.tsx`: four large buttons (Picked up, Cancelled, Not picked up, Permission), current status via `StatusBadge`, **Change** for a recorded meal; Cancelled and Not picked up save immediately with optional **Add note** afterward
- [X] T047 [P] [US1] Build `src/features/today/PhotoStep.tsx`: `<input type="file" accept="image/*" capture="environment">`, **Skip photo** at the same level as **Take photo**, progress and error states (too large, unsupported file), replace-confirmation when the meal already has a photo
- [X] T048 [P] [US1] Build `src/features/today/PermissionSheet.tsx`: optional reason and optional photo, one **Save** button
- [X] T049 [US1] Build `src/features/today/TodayPage.tsx` (calls the app-start `ensureMonthPlan` for the current month before reading meals): today's date in Bolivia time, one card per active person with a meal today, muted line with the reason when there is none (weekend, holiday, outside plan), future meals not offered for quick-record (spec Edge Case 16)
- [X] T068 [US1] Build `src/features/meal/MealSheet.tsx` (route `/meal/:id`): status buttons, note, permission reason, the single photo, and the change log (who, when, from → to) from `meal_status_changes`; wire it to calendar day taps in `CalendarGrid.tsx`, to the **Change** action on Today and, later, to history rows; this is also how a past or future meal (and an automatic not-picked-up meal) is recorded or corrected, so it ships with the MVP (moved from US5)

**Checkpoint**: A meal can be recorded in one or two taps with an optional private compressed photo. Quickstart scenario B passes.

---

## Phase 5: User Story 3 - Know where the contracted meals stand (Priority: P1) 🎯 MVP

**Goal**: Per person and month, the five counters always sum to the scheduled meals, with explicit warnings (spec US3, SC-003, SC-007).

**Independent Test**: Record 14 picked up, 2 cancelled, 1 not picked up, 1 permission, leave 2 pending and read exactly those counts and total 20; quickstart scenario C.

### Tests for User Story 3 ⚠️ write first

- [X] T050 [P] [US3] Write `tests/unit/stats.test.ts`: counters from a list of meals, picked-up percentage, consistency check, shortfall vs contracted, a past `scheduled` meal counted as `not_picked_up` (automatic) and excluded from `pending`, photo count
- [X] T051 [P] [US3] Write database tests `tests/db/monthly-stats.test.ts` (PGlite): `monthly_stats` counts by `effective_status`, `pending` counts only today and future, `is_consistent` is true when the five counters sum to `scheduled_total`, photo count matches `meal_photos`, no leakage across households (RULE-015)

### Implementation for User Story 3

- [X] T052 [US3] Write migration `supabase/migrations/0008_monthly_stats.sql`: view `monthly_stats` (security invoker) per `monthly_plan_id` with `scheduled_total`, `picked_up`, `cancelled`, `not_picked_up` (recorded plus automatic), `permission`, `pending`, `photos`, `is_consistent`
- [X] T053 [P] [US3] Implement `src/domain/stats.ts` (counters, percentage, consistency, warnings) and make T050 pass
- [X] T054 [P] [US3] Build `src/features/month/CounterStrip.tsx` (contracted, picked up, cancelled, not picked up, permission, pending, % picked up, photos) and warning banners `ShortfallBanner.tsx`, `InconsistencyBanner.tsx`, `NeedsReviewBanner.tsx`
- [X] T055 [US3] Integrate the counter strip and banners into `src/features/month/MonthPage.tsx` and a compact "remaining meals" line on `src/features/today/TodayPage.tsx`; show the "automatic" tag on auto not-picked-up meals in `StatusBadge`
- [X] T056 [P] [US3] Write Playwright `tests/e2e/counters.spec.ts` for quickstart scenario C including the automatic not-picked-up case

**Checkpoint**: The MVP (US2 + US1 + US3) is complete: correct calendar, fast recording, exact counters.

---

## Phase 6: User Story 4 - Several family members, one view (Priority: P2)

**Goal**: Manage people, switch between one person or **All**, and see a consolidated Today (spec US4).

**Independent Test**: Four people with different plans; Today → All lists each person's status; deactivating one removes them from Today but keeps history (quickstart scenario D).

- [X] T057 [P] [US4] Write `tests/unit/multi-person.test.ts`: month generation, stats and filtering are strictly per person; two people with different `meals_per_month` do not affect each other
- [X] T058 [P] [US4] Write database tests `tests/db/people.test.ts` (PGlite): inactive people excluded from today's quick-record query but their meals remain readable; no delete is possible on `people`; a person added mid-month starts at `plan_start_date`
- [X] T059 [US4] Build `src/features/people/PeopleListPage.tsx` and `PersonForm.tsx` (creating through `create_person`, migration `0009_people_functions.sql`): first_name required, last_name optional, plan_start_date required, meals per month default 20; **Deactivate** sets `plan_end_date` to yesterday (not earlier than the start) and **Reactivate** clears it and moves `plan_start_date` to today when the person had left; no permanent delete anywhere in the UI (spec FR-007)
- [X] T060 [US4] After creating, deactivating or reactivating a person, refresh the people list and regenerate their current and next month through the `ensure` queries (`src/data/people-actions.ts`), so a mid-month start gets a partial month and still-scheduled meals after an end date are removed while recorded ones are kept (spec Edge Cases 1, 2); the Month screen creates past months only on an explicit **Generate this month** action
- [X] T061 [P] [US4] Build `src/components/PersonFilter.tsx` (chips: **All** plus each active person) and use it on Today (where **All** is available); Month and History require a single person and hide **All**; remember the last selection per session
- [X] T062 [US4] Make `TodayPage.tsx` support **All**: compact rows "name — status" (four people fit on one phone screen, spec SC-005) whose tap opens the four-action sheet for that person
- [X] T063 [P] [US4] Write Playwright `tests/e2e/multi-person.spec.ts` for quickstart scenario D

---

## Phase 7: User Story 5 - Monthly calendar and history with photos (Priority: P2)

**Goal**: Browse months and years, see the full detail with thumbnails, open a photo with its context, and correct past meals with an audit trail (spec US5).

**Independent Test**: Open a past month with mixed outcomes and photos; verify statuses, totals, thumbnails, photo detail and the change log (quickstart scenario E).

- [X] T064 [P] [US5] Write `tests/unit/history.test.ts`: year grouping with a December→January boundary, month rows "scheduled / contracted", ordering
- [X] T065 [US5] Build `src/features/history/HistoryPage.tsx`: year selector, one row per month with "scheduled / contracted" and counts by status, drill-down to month detail
- [X] T066 [US5] Build `src/features/history/MonthDetail.tsx`: meal list with status, note and thumbnail; request signed thumbnail URLs for the whole month in one batch (`src/data/photos.ts`) and never load full-size images until tapped (spec FR-025)
- [X] T067 [P] [US5] Build `src/features/history/PhotoViewer.tsx`: loads one full-size signed URL on tap; shows date, person, status, note; **Replace** and **Remove** photo with confirmation (spec FR-026, Edge Case 9); remove leaves the meal status unchanged
- [X] T069 [P] [US5] Write Playwright `tests/e2e/history.spec.ts` for quickstart scenario E: correct Not picked up → Picked up, log shows the change, re-submitting the same status adds no log entry

---

## Phase 8: User Story 6 - Plan, family and holiday settings (Priority: P2)

**Goal**: Change plan terms without rewriting history, manage holidays and exceptional delivery dates, and reconcile affected months safely (spec US6).

**Independent Test**: Change meals per month from 20 to 25 from next month; add a custom holiday on a date with meals; add an exceptional Saturday (quickstart scenario F).

- [X] T070 [P] [US6] Write `tests/unit/reconcile.test.ts`: adding a holiday removes only `scheduled` meals on that date and keeps recorded ones flagged `needs_review`; removing a holiday proposes (does not apply) regeneration; plan change from 20 to 25 leaves earlier months untouched
- [X] T071 [US6] Build `src/features/people/PlanTermsForm.tsx`: meals per month (integer > 0), **effective from** month (first day of a month, default next month), delivery weekdays (values within 1..7), optional pickup time; **Scheduled** is never user-selectable, it is only the initial state; saving inserts a new `plan_terms` row and never edits earlier ones (spec Edge Case 6)
- [X] T072 [P] [US6] Build `src/features/holidays/HolidaysPage.tsx`: holidays of the selected year with source (official or custom), **Add custom holiday**, **Suppress official holiday**, **Add exceptional delivery date**; after a change list the affected (person, month) pairs returned by `add_holiday` / `remove_holiday`
- [X] T073 [US6] Implement the reconcile action in `src/data/mutations.ts` and `src/features/holidays/ReconcileList.tsx`: for each affected pair recompute `planMonth` and call `apply_month_plan`; show a summary of removed, added and flagged meals before the user confirms (spec US6 scenario 4)
- [X] T074 [P] [US6] Build `src/features/household/HouseholdPage.tsx`: generate an invite code (any member), list members; route under **More**
- [X] T075 [P] [US6] Write Playwright `tests/e2e/settings.spec.ts` for quickstart scenario F

---

## Phase 9: User Story 7 - Monthly report and data export (Priority: P3)

**Goal**: Report per person and month, CSV export of everything, photo export, and a backup that survives a lost free-tier project (spec US7, FR-033, FR-034).

**Independent Test**: Generate the October 2026 report and compare to the counters; export all records and photos (quickstart scenario I).

- [X] T076 [P] [US7] Write `tests/unit/csv.test.ts`: header, quoting of commas/quotes/newlines in notes, dates as `YYYY-MM-DD`, effective status and an `automatic` column, one row per meal, status change history in a second file
- [X] T077 [P] [US7] Implement `src/features/export/csv.ts` (pure builders) and `src/features/export/ExportPage.tsx` with **Download CSV** for all records
- [X] T078 [US7] Implement `src/features/export/photo-zip.ts` using `fflate` loaded lazily with a dynamic import: downloads signed URLs sequentially, writes images and a `photos.csv` mapping file names to meal id, person, date and status; progress indicator; add `fflate` to `docs/licenses.md`
- [X] T079 [P] [US7] Build `src/features/export/ReportPage.tsx` (route `/report/:person/:yyyy-mm`) with contracted count, status counts and rows `dd/mm — status — photo yes/no — note`, plus Tailwind `print:` variants (instead of a separate print.css) that hide navigation, and a **Print / Save as PDF** button
- [X] T080 [P] [US7] Add `scripts/backup.sh` (`supabase db dump` using a connection string from the environment) and `.github/workflows/backup.yml` running weekly, uploading the dump as an artifact with 90-day retention; the run also queries the database to keep a free project awake (research R2, R8)
- [X] T081 [P] [US7] Write `docs/restore.md`: restoring the dump into a new Supabase project, re-creating the bucket and re-importing photos from the ZIP; link it from the README
- [X] T082 [P] [US7] Write Playwright `tests/e2e/export.spec.ts` for quickstart scenario I (CSV row count equals meals; ZIP contains images and the mapping file)

---

## Phase 10: User Story 8 - Limited offline use and PWA (Priority: P3)

**Goal**: Installable app; view loaded data offline; queue statuses and photos and sync them later (spec US8, FR-037, SC-011). Reminders are deferred (research R10).

**Independent Test**: Go offline, record a status with a photo, return online, and see both applied (quickstart scenario G).

### Tests for User Story 8 ⚠️ write first

- [X] T083 [P] [US8] Write `tests/unit/outbox.test.ts` with `fake-indexeddb`: operations replay in order; replaying a status twice is a no-op; a stale queued change is ignored by the server rule; a photo blob stays queued after an upload failure and is retried; discarding a pending photo keeps the status
- [X] T084 [P] [US8] Write Playwright `tests/e2e/offline.spec.ts` for quickstart scenario G using the browser offline mode

### Implementation for User Story 8

- [X] T085 [US8] Implement `src/data/outbox.ts`: IndexedDB queue of `{type, payload, clientTs, blob?}`; `enqueue`, `flush` triggered by the `online` event, `visibilitychange` and app start; exponential backoff; status changes flushed before photos
- [X] T086 [US8] Route `setMealStatus` and photo upload through the outbox when `navigator.onLine` is false or a request fails, update the UI optimistically and mark items "pending sync" / "photo pending" in `StatusBadge.tsx`; add a connectivity chip in `src/components/ConnectivityChip.tsx`
- [X] T087 [P] [US8] Persist the TanStack Query cache to IndexedDB in `src/data/query-persist.ts` so the last loaded Today and Month screens open offline
- [X] T088 [P] [US8] Configure `vite-plugin-pwa` in `vite.config.ts` and create `public/manifest.webmanifest`, icons (192, 512, maskable) and Apple splash/touch icons in `public/icons/`; precache the app shell; SPA fallback; update prompt component `src/pwa/UpdatePrompt.tsx`
- [X] T089 [P] [US8] Document in `docs/pwa.md` how to install on Android and iOS and the iOS limits (no background sync, installed-app requirement)

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Release readiness across all stories (spec Final Delivery list; constitution V)

- [X] T090 [P] Write `README.md`: purpose, local setup, scripts, test commands, project layout, how to seed demo data, link to docs
- [X] T091 [P] Write `docs/deployment.md`: create the Supabase project, link and push migrations, auth settings (email confirmation off, invite-code flow), confirm the bucket is private, deploy the static build to Cloudflare Pages (build `pnpm build`, output `dist`, SPA fallback, the two `VITE_` variables) and the Vercel alternative; resume steps for a paused project
- [X] T092 [P] Complete `docs/licenses.md` and `.env.example` with every dependency and variable, and verify no key other than the anon key is in the repository (`git grep` check in CI)
- [X] T093 Add a bundle-size budget check `scripts/check-bundle.mjs` failing CI when the Today route's initial JS exceeds 150 KB gzip, and confirm `date-holidays` is not in the bundle (budget raised to 160 KB after measuring 153 KB, see plan.md)
- [ ] T094 (automated measurement done on synthetic photos, see research R5; **needs the user's real photos** via `/tools/photo-lab/`) Validate the photo constants against 10 real phone photos (food and a receipt): confirm legibility, size ≤ 500 KB, and adjust only `src/data/photo-config.ts`; record the result in `research.md` R5
- [X] T095 [P] Accessibility pass: contrast AA for all status colors, every status has an icon and text, focus order, labels on icon buttons, 48 px touch targets; fix findings in `src/components/` and `src/features/`
- [X] T096 [P] Add an i18n completeness test `tests/unit/no-hardcoded-text.test.ts` that fails on JSX string literals outside `src/i18n/`, and fix offenders
- [X] T097 [P] Security review: confirm RLS on every table, storage policies, the signed-URL expiry, rejected non-image uploads (quickstart scenario H), and that sign-up alone exposes no data; add the missing cases to `tests/db/`
- [ ] T098 (scenarios A–I pass as Playwright specs against the local stack: 20 in development mode, 2 offline specs against the production build, 1 first-run spec on an empty stack; what is **pending** is a run on a real phone against a real Supabase project) Run the full `quickstart.md` scenarios A–I on a phone-sized viewport and fix any failure
- [X] T099 Run `/speckit-analyze` and reconcile any inconsistency between spec.md, plan.md and tasks.md before release (constitution V)
- [X] T100 Final cleanup: remove dead code, ensure comments explain why not what, confirm the function and file names read clearly (constitution II)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories.
- **Polish (Phase 11)** depends on all desired stories.

### User Story Dependencies

- **US2 (Phase 3)**: after Foundational. Creates the meals everything else uses. Build first.
- **US1 (Phase 4)**: after US2 (needs meals to record against).
- **US3 (Phase 5)**: after US1 for realistic data, but its view and domain code only need US2.
- **US4 (Phase 6)**: after US2; uses US1's Today page for the consolidated view (T062 follows T049).
- **US5 (Phase 7)**: after US1 (photos, status history).
- **US6 (Phase 8)**: after US2 (reconcile uses `apply_month_plan` and the calendar domain).
- **US7 (Phase 9)**: after US3 (counts) and US1 (photos).
- **US8 (Phase 10)**: after US1 (wraps its mutations and photo upload).

### Within Each User Story

- Tests first, confirm they fail, then implement.
- Migrations before the data layer, data layer before screens.
- Domain code is pure and tested before it is used by screens.

### Parallel Opportunities

- Phase 1: T002–T006, T008–T010 in parallel after T001.
- Phase 2: T013–T017, T019, T020, T023 in parallel; T011 then T012 sequentially (same schema area).
- Each story: all tasks marked [P] in its test group run together; components in different files run together.
- After US1, US4, US5, US6 and US8 can proceed in parallel; US7 follows US3.

---

## Parallel Example: User Story 2

```bash
# All tests for US2 together:
Task: "Write tests/unit/calendar.test.ts"                        # T024
Task: "Write tests/unit/calendar-sweep.test.ts"                  # T025
Task: "Write tests/unit/holidays-script.test.ts"                 # T026
Task: "Write supabase/tests/002_meals_calendar.sql"              # T027

# Then data access and UI pieces together:
Task: "Implement src/data/calendar-data.ts"                      # T032
Task: "Build src/features/month/CalendarGrid.tsx"                # T034
Task: "Write scripts/seed-demo.ts"                               # T036
```

---

## Implementation Strategy

### MVP First (US2 + US1 + US3, all P1)

1. Phase 1 Setup, Phase 2 Foundational.
2. Phase 3 (US2): correct calendar. **Validate quickstart A.**
3. Phase 4 (US1): quick record with photo. **Validate quickstart B.**
4. Phase 5 (US3): counters and warnings. **Validate quickstart C.**
5. Deploy and use it for a real month before building more.

### Incremental Delivery

1. MVP above → deployed.
2. US4 (all family members) → US5 (history) → US6 (settings).
3. US7 (report, export, backup) → US8 (offline, PWA).
4. Polish and release.

### Notes

- [P] = different files, no dependency on an unfinished task.
- Commit after each task or logical group; docs change in the same commit as behavior (constitution V).
- Do not add photos or secrets to Git (RULE-009).
- Notifications are not in this task list by design (research R10).
