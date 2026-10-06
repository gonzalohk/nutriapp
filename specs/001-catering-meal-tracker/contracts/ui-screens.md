# Contract: Screens and Navigation

**Feature**: [spec.md](../spec.md) | **Data**: [rpc.md](rpc.md)

Mobile-first. A bottom tab bar with four tabs keeps the app shallow. Large touch targets (at
least 48 px), one primary action per screen, status always shown as icon plus text plus color.

## Navigation

| Tab | Route | Purpose |
|-----|-------|---------|
| Today | `/` | Quick record, default screen (spec US1, US4) |
| Month | `/month` | Calendar + counters (US2, US3); person and month are screen state, kept for the session |
| History | `/history`, `/history/:person/:yyyy-mm` | Year list and month detail with photos (US5) |
| More | `/more` | Menu: people, holidays and deliveries, household, report, export, sign-out (US4, US6, US7) |

Other routes: `/login`, `/setup` (first-run household), `/join` (invite code), `/meal/:id` (meal detail),
`/more/people`, `/more/holidays`, `/more/household`, `/more/export`, `/report` and `/report/:yyyy-mm`
(printable monthly report for the selected person).

Everything except Today and sign-in loads on demand (code splitting) to keep the first download small.
A connectivity banner appears on every screen when the phone is offline or changes are waiting to
be sent, and an **Update** bar appears when a new version is ready.

## Today (`/`)

- Header: today's date in Bolivia time and a person filter chips row: **All**, then each active person.
- One card per person with a meal today. Card shows name, current status, and four large
  buttons: **Picked up**, **Cancelled**, **Not picked up**, **Permission**.
  - Picked up → opens the photo step (camera input, **Skip photo** visible at the same level).
  - Permission → optional reason field, optional photo, **Save**.
  - Cancelled / Not picked up → saved immediately; **Add note** is optional after the save.
- A recorded card shows its status, a photo thumbnail if present, and **Change** to correct it.
- Person with no meal today: muted line with the reason (weekend, holiday, outside plan).
- Connectivity chip when offline, and "pending sync" badges on queued items.
- Tap budget: one tap for Cancelled / Not picked up, two for Picked up without photo.

## Month (`/month`)

- Person selector, month stepper (previous/next). Browsing is bounded from the person's first plan month (or the first month that exists) to the next month. The current and next month are created automatically; an earlier month without data offers **Generate this month** instead of creating meals by itself.
- Counter strip: contracted, picked up, cancelled, not picked up, permission, pending, %
  picked up, photos. Warning banners: **shortfall** ("18 of 20 delivery days available"),
  **inconsistency**, **needs review**.
- Calendar grid: weekends and holidays muted with the holiday name; meal days show the meal
  number, status icon and a photo dot. Tapping a day opens the meal sheet.
- Days that are valid but beyond the contracted count are shown dashed "not in plan".
- Action in the menu: **Add exceptional delivery date**.

## History (`/history`)

- Year selector; one row per month: "scheduled / contracted" and counts by status.
- Month detail: list of meals with status, note and thumbnail. Tapping a thumbnail opens the
  photo viewer with date, person, status, note. Full image is requested on tap only.

## More

- **People**: add/edit/deactivate and reactivate (no permanent delete), plan start/end, meals per month with "effective from" month
  (default next month), delivery weekdays, pickup time.
- **Holidays**: list for the selected year with source (official/custom), add custom, suppress
  official; after a change, show affected months with **Reconcile** actions.
- **Export**: CSV of all records; photos ZIP.
- **Report**: month and person picker, opens `/report/...`.
- **Household**: invite code (any member), members list.

## Meal sheet (`/meal/:id`)

Status buttons, note, reason (permission), the meal's single photo with replace/remove
(confirmation on both), and the change log (who, when, from → to).

## Report (`/report/:person/:yyyy-mm`)

Printable layout: title, person, contracted count, status counts, detail rows
(`dd/mm — status — photo yes/no — note`). The **Print / Save as PDF** button calls the
browser print dialog. Print stylesheet hides navigation.

## Accessibility and states

- Status never relies on color alone: each status has a distinct icon and label.
- Text contrast meets WCAG AA; focus order follows visual order; buttons have text labels.
- Every list has loading, empty and error states; destructive actions ask for confirmation.
- All strings come from the translation dictionaries (default Spanish).

## Status presentation

| Status | Icon | Label (es) | Suggested color |
|--------|------|------------|-----------------|
| scheduled | clock | Pendiente (today or future only) | amber |
| picked_up | check | Recogida | green |
| cancelled | x | Cancelada | blue-gray |
| not_picked_up | alert | No recogida | red |
| permission | hand/shield | Permiso | purple |
| automatic not picked up | alert + "auto" tag | No recogida (automática) | red, lighter |
| non-delivery day | none | — | gray |
