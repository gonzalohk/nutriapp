# Data Model: Catering Meal Tracker

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

PostgreSQL (Supabase). All tables live in `public` with Row Level Security enabled. Names are
`snake_case`. Calendar dates use `date`; instants use `timestamptz` (research R6).

## Entity overview

```text
households 1─* household_members *─1 auth.users
households 1─* household_invites
households 1─* people 1─* plan_terms
                   people 1─* monthly_plans 1─* meals 1─* meal_photos
                                               meals 1─* meal_status_changes
households 1─* holiday_overrides        official_holidays (global, per country)
households 1─* exceptional_delivery_dates
```

Every row that belongs to a household carries `household_id` (directly or through its parent) so
RLS stays a single cheap check.

## Enums

- `meal_status`: `scheduled`, `picked_up`, `cancelled`, `not_picked_up`, `permission`
- `member_role`: `owner`, `adult`
- `override_action`: `add`, `remove`

## Tables

### households
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text not null | |
| country_code | text not null default `'BO'` | selects `official_holidays` rows |
| created_at | timestamptz | default now() |

### household_members
| Column | Type | Notes |
|--------|------|-------|
| household_id | uuid FK → households | PK part |
| user_id | uuid FK → auth.users | PK part |
| role | member_role | first member is `owner`; informational only, all members have the same permissions (clarification 2026-10-03) |
| display_name | text not null | shown in change log |
| created_at | timestamptz | |

### household_invites
| Column | Type | Notes |
|--------|------|-------|
| code | text PK | random, single use |
| household_id | uuid FK | |
| created_by | uuid FK → auth.users | |
| expires_at | timestamptz not null | default now() + 7 days |
| used_by / used_at | uuid / timestamptz null | set when consumed |

### people (family members)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| household_id | uuid FK | |
| first_name | text not null | |
| last_name | text null | |
| active | boolean not null default true | inactive: hidden from quick-record, history kept (FR-007). People are never deleted from the app: no delete policy exists on `people` |
| plan_start_date | date not null | meals are never generated before this (Edge Case 1) |
| plan_end_date | date null | meals after this are not generated (Edge Case 2) |
| created_at | timestamptz | |

### plan_terms
Plan configuration effective from a month; a change adds a row, so past months keep their terms
(Edge Case 6).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| person_id | uuid FK → people | |
| effective_from | date not null | first day of a month; check `extract(day) = 1` |
| meals_per_month | int not null | check `> 0`; default 20 (RULE-002) |
| delivery_weekdays | smallint[] not null | ISO weekdays 1–7, default `{1,2,3,4,5}`; check ⊆ 1..7 |
| selection_rule | text not null default `'first_n'` | stored setting for "more days than meals" (spec Q1) |
| pickup_time | time null | optional approximate time |

Unique (person_id, effective_from). The term for a month is the row with the greatest
`effective_from` ≤ that month.

### monthly_plans
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| person_id | uuid FK | |
| household_id | uuid FK | denormalized for RLS |
| month | date not null | first day of month |
| contracted_count | int not null | meals_per_month snapshot used to generate this month |
| is_partial | boolean not null default false | true for the first/last month when start/end dates cut the month; no shortfall alert (spec assumption) |
| needs_review | boolean not null default false | set when a holiday change affects recorded meals (US6 scenario 4) |
| created_at | timestamptz | |

Unique (person_id, month) enforces RULE-001.

### meals
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| monthly_plan_id | uuid FK | |
| person_id | uuid FK | denormalized for lookups by person |
| household_id | uuid FK | denormalized for RLS |
| meal_date | date not null | |
| status | meal_status not null default `scheduled` | exactly one current status (RULE-006) |
| note | text null | |
| permission_reason | text null | used when status = `permission` |
| status_changed_at | timestamptz not null default now() | |
| status_changed_by | uuid null FK → auth.users | |
| created_at / updated_at | timestamptz | `updated_at` maintained by trigger (RULE-016) |

- **Unique (person_id, meal_date)** — RULE-012, also guards double registration.
- **Meal number** is not stored: it is the rank of `meal_date` within the monthly plan, exposed
  by the `meals_numbered` view. This removes a field that could drift after regeneration.
- **Trigger `meals_validate_date`** (before insert/update of `meal_date`): rejects a date that
  is a Saturday/Sunday unless an `exceptional_delivery_dates` row exists for the household
  (RULE-005, RULE-014), and rejects any date in `effective_holidays` (RULE-004, RULE-013).
- **Trigger `meals_log_status`** (after update of `status`): inserts a `meal_status_changes`
  row and sets `status_changed_at/by` (spec FR-018).
- Indexes: (person_id, meal_date) via the unique key; (household_id, meal_date) for the Today
  view; (monthly_plan_id) for month detail.

### meal_status_changes
| Column | Type | Notes |
|--------|------|-------|
| id | bigint identity PK | |
| meal_id | uuid FK → meals (cascade) | |
| from_status / to_status | meal_status | |
| changed_at | timestamptz default now() | |
| changed_by | uuid null FK → auth.users | |

### meal_photos
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| meal_id | uuid FK → meals (cascade), **unique** | at most one photo per meal (spec FR-021) |
| household_id | uuid FK | for RLS |
| storage_path | text not null | full image path in the private bucket |
| thumb_path | text not null | thumbnail path |
| mime_type | text not null | check in (`image/webp`, `image/jpeg`) |
| bytes | int not null | check `<= 2097152` |
| width / height | int | |
| taken_at | timestamptz not null | client capture time |
| created_by | uuid FK → auth.users | |

The database stores **paths, not URLs**; URLs are signed on demand. Deleting a photo removes the
row and its two storage objects; the meal status is untouched (spec FR-026, Edge Case 9).

### official_holidays
Global reference data, written only by the generated data migration (`0004_official_holidays.sql`).

| Column | Type | Notes |
|--------|------|-------|
| country_code | text | PK part |
| holiday_date | date | PK part |
| name | text not null | |

Contains only `public` holidays from the generator (research R4). Readable by any signed-in user.

### official_holiday_years
| Column | Type | Notes |
|--------|------|-------|
| country_code | text PK | |
| first_year / last_year | int not null | range the generator covered; the app refuses to generate a month outside it (spec SC-002) |

### holiday_overrides
| Column | Type | Notes |
|--------|------|-------|
| household_id | uuid FK | PK part |
| holiday_date | date | PK part |
| action | override_action | `add` = custom holiday, `remove` = suppress an official one |
| name | text null | label for `add` |

### exceptional_delivery_dates
| Column | Type | Notes |
|--------|------|-------|
| household_id | uuid FK | PK part |
| delivery_date | date | PK part; a trigger rejects a holiday date (a CHECK cannot query other tables) |
| note | text null | |

Applies to non-delivery weekdays only; holidays are handled by suppressing the holiday.

### Views

- **`effective_holidays`** (security invoker): per household, official holidays for its country
  minus `remove` overrides plus `add` overrides, exposing `household_id, holiday_date, name, source` (`official` or `custom`).
- **`meals_numbered`**: `meals` plus `meal_no = row_number() over (partition by monthly_plan_id
  order by meal_date)` and `effective_status`: the stored status, except that `scheduled` with
  `meal_date` before today in Bolivia time (`America/La_Paz`, a constant, not a column) becomes `not_picked_up`, with
  `is_automatic = true` (spec FR-015a). Nothing is written to the table for this; it is derived
  on read, so no scheduled job is needed.
- **`monthly_stats`**: per `monthly_plan_id`, counting **`effective_status`**: `scheduled_total`, `picked_up`,
  `cancelled`, `not_picked_up` (recorded plus automatic), `permission`, `pending` (stored
  `scheduled` dated today or later), `photos`, and the derived
  `is_consistent` (`sum of five counters = scheduled_total`).

## Functions added during implementation

`create_person` (person plus first plan terms in one transaction), `set_meal_status`,
`replace_meal_photo`, `delete_meal_photo`, `apply_month_plan` (with the plan window start),
`add_holiday` / `remove_holiday`, `add_exceptional_delivery` / `remove_exceptional_delivery`,
`create_household`, `create_invite`, `join_household`. Their contracts are in
[contracts/rpc.md](contracts/rpc.md). Views are read-only for the app and closed to the anonymous role
(migration `0011`).

## Validation rules (traceability)

| Rule | Enforced by |
|------|-------------|
| RULE-001 one plan per person per month | unique (person_id, month) |
| RULE-002 configurable count, default 20 | `plan_terms.meals_per_month` |
| RULE-003 Mon–Fri | `delivery_weekdays` + generation logic |
| RULE-004 / 013 holidays blocked | `meals_validate_date` trigger + generation logic |
| RULE-005 / 014 weekends blocked | `meals_validate_date` trigger + generation logic |
| RULE-006 one status | single `status` column |
| RULE-007 photo on picked up | UI prompt; no DB restriction (permission also allowed); one photo per meal by unique (meal_id) |
| RULE-008 compressed | client pipeline + 2 MB and MIME limits in DB/storage |
| RULE-009 no photos in Git | private bucket; `.gitignore` for fixtures |
| RULE-010 / 011 distinct statuses | separate enum values, never merged in views |
| RULE-012 no duplicates | unique (person_id, meal_date) |
| RULE-015 stats match | `monthly_stats.is_consistent` + UI warning |
| RULE-016 updated_at | trigger on `meals` |

## State transitions

```text
scheduled ─► picked_up | cancelled | not_picked_up | permission
any status ─► any other status   (corrections allowed at any time, each logged)
```

A `scheduled` meal whose date has passed is *shown* as `not_picked_up` (automatic) without a
stored change; the first explicit status the user records is logged as `scheduled → <new>`.
Same status again is a no-op. A queued change older than `status_changed_at` is ignored
(offline replay safety).

## Generation algorithm (specified once, implemented in the domain module)

Inputs: person, month, plan term, holidays, exceptional dates.

1. `candidates` = every date in the month where date ≥ `plan_start_date` and (no end or date ≤
   `plan_end_date`).
2. `valid` = candidates whose ISO weekday is in `delivery_weekdays` and not an effective
   holiday, plus candidates that are exceptional delivery dates.
3. Sort ascending. `target = first N` of `valid` (N = `meals_per_month`).
4. `extra = valid \ target` is shown as "not part of the plan".
5. `shortfall = max(0, N − |valid|)`; reported only when the month is not partial.
6. A month is partial when the start/end dates removed days from the candidates.

Applying a target to the database (`apply_month_plan`, see [contracts](contracts/rpc.md))
is a **reconcile** (meals before the plan window start, `windowStart`, are an earlier period and are left alone): delete `scheduled` meals not in `target`, insert missing dates, keep recorded
meals (and set `needs_review` if one no longer fits), all in one transaction.

## Example: October 2026

Weekdays: 22 (Oct 1 is a Thursday). No national public holiday falls on a weekday (Oct 11 is a
Sunday observance), so `valid` has 22 dates and `target` is Oct 1 – Oct 28, leaving Oct 29, 30
as "not part of the plan".
