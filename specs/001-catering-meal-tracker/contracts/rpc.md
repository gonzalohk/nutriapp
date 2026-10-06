# Contract: Database Functions and Storage

**Feature**: [spec.md](../spec.md) | **Data model**: [data-model.md](../data-model.md)

The app has no custom server. Its interface to the backend is (a) plain table/view reads through
the Supabase client, protected by RLS, (b) the functions below for writes that must be atomic or
carry a rule, and (c) the private storage bucket. All functions are `SECURITY INVOKER` unless
noted, so RLS applies to the caller, and all require an authenticated user.

Errors are raised with a stable code in the message prefix so the UI can translate them.

## Reads (RLS-filtered, no function needed)

| Need | Source | Filter |
|------|--------|--------|
| Today across people | `meals` join `people` | `meal_date = today_bo`, `people.active` |
| One person's month | `meals_numbered` | `person_id`, `monthly_plan_id` |
| Month counters | `monthly_stats` | `monthly_plan_id` / `person_id`, `month` |
| Year history | `monthly_stats` | `person_id`, `month between` |
| Holidays in range | `effective_holidays` | `holiday_date between` |
| Change log | `meal_status_changes` | `meal_id` |
| Photos of a month | `meal_photos` | `meal_id in (...)` |

## Functions

### `create_household(p_name text, p_display_name text) → uuid`
Creates the household and makes the caller its `owner`.
- Fails with `E_HOUSEHOLD_EXISTS` if any household already exists (single-household deployment).

### `create_person(p_first_name text, p_last_name text, p_plan_start date, p_meals_per_month int default 20) → people`
Creates the person and their first `plan_terms` row (effective from the first day of the start
month, Monday to Friday) in one transaction, so a person never exists without terms. Any member.
- Constraint violations (blank name, meals_per_month <= 0) roll everything back.

### `create_invite() → text`
Any household member. Returns a single-use code valid for 7 days (80 random bits).
- `E_FORBIDDEN` if the caller is not in a household.

### `join_household(p_code text, p_display_name text) → uuid`
Consumes a valid code and adds the caller as `adult`.
- `E_INVITE_INVALID` if unknown, expired or used; `E_ALREADY_MEMBER` if already joined.

### `apply_month_plan(p_person uuid, p_month date, p_dates date[], p_contracted int, p_is_partial boolean, p_window_start date default null) → uuid`
Reconciles a person's meals for a month with `p_dates` (computed by the domain module) in one
transaction and returns the `monthly_plan_id`.
1. Upsert the `monthly_plans` row (`contracted_count = p_contracted`, `is_partial`).
2. Delete `scheduled` meals whose date is not in `p_dates`.
3. Insert missing dates as `scheduled`.
4. Recorded meals (any other status) are never deleted; if one is not in `p_dates`, set
   `needs_review = true`.
5. Meals dated before `p_window_start` (the start of the person's current plan window) belong to an
   earlier period, for example before someone left and came back, and are never removed or flagged.
- `E_INVALID_DATE` if a date is a weekend without an exceptional delivery date, a holiday, or
  outside the month (raised by the `meals_validate_date` trigger).
- Idempotent: calling twice with the same arguments changes nothing.

### `set_meal_status(p_meal uuid, p_status meal_status, p_note text, p_reason text, p_client_ts timestamptz) → meals`
Records an outcome. Used for online and replayed offline writes.
- Same `p_status` as current: returns the row unchanged (no-op, no log entry).
- `p_client_ts` older than `status_changed_at`: ignored, returns the current row.
- Otherwise updates status/note/reason; triggers set `status_changed_at/by` and write
  `meal_status_changes`.
- `E_NOT_FOUND` if the meal is not visible to the caller; `E_INVALID_STATUS` if `scheduled` is requested
  (users never choose it).
- `p_note` null keeps the current note, an empty string clears it; the permission reason is stored only
  with the `permission` status. The change time is the client time clamped to "now", so queued
  changes from one device keep their order after syncing.

### `add_holiday(p_date date, p_name text)` / `remove_holiday(p_date date)` → `jsonb`
Insert a `holiday_overrides` row (`add`/`remove`). Return the `(person_id, month)` pairs the change
may affect so the UI can offer to reconcile: for `add`, pairs with an existing meal on that date;
for `remove`, every active person's month containing that date. Never touches meals itself.

### `add_exceptional_delivery(p_date date, p_note text)` / `remove_exceptional_delivery(p_date date)`
Maintain `exceptional_delivery_dates`. `E_INVALID_DATE` if the date is a holiday. Adding a date that
is already a regular delivery weekday is harmless and has no effect.

### `replace_meal_photo(p_meal uuid, p_photo uuid, p_storage_path text, p_thumb_path text, p_mime text, p_bytes int, p_width int, p_height int, p_taken_at timestamptz) → meal_photos`
Upserts the single photo row for the meal and returns the previous `storage_path` and
`thumb_path` (if any) so the client can delete the old objects. One photo per meal is enforced
by a unique key on `meal_id`.

### `delete_meal_photo(p_photo uuid) → jsonb`
Deletes the `meal_photos` row and returns `{storage_path, thumb_path}` so the client can remove the
two storage objects. The meal status is unchanged. `E_NOT_FOUND` if the photo is not visible.

## Storage

- **Bucket**: `meal-photos`, **private**, max object size 2 MB, allowed MIME `image/webp`,
  `image/jpeg`.
- **Object path**: `{household_id}/{person_id}/{yyyy-mm}/{meal_id}/{photo_id}.{ext}` and
  `{...}/{photo_id}_thumb.{ext}`. A replacement uses a new `photo_id`, so a failed upload never
  damages the existing photo.
- **Policies**: a user may read/insert/delete only objects whose first path segment is a
  household they belong to.
- **Access**: never public URLs. The client requests signed URLs (1 hour) in a batch for the
  thumbnails of the month and a single signed URL for a full photo on tap.

## Upload sequence (client)

1. Compress the image and produce a thumbnail (see [research R5](../research.md)).
2. Upload both objects.
3. Call `replace_meal_photo` (insert, or replace the meal's existing photo after confirmation),
   then delete the previous two objects it returns.
4. On failure after step 2, remove the orphan objects; on failure before, keep the blob in the
   outbox and retry (spec Edge Case 10).

## Error codes

`E_NOT_AUTHENTICATED`, `E_FORBIDDEN`, `E_HOUSEHOLD_EXISTS`, `E_INVITE_INVALID`, `E_ALREADY_MEMBER`, `E_INVALID_DATE`,
`E_NOT_FOUND`. Each has a Spanish and English message in the translation files.
