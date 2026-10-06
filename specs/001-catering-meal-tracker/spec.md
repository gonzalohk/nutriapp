# Feature Specification: Catering Meal Tracker

**Feature Branch**: `001-catering-meal-tracker`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "A mobile-first web app to track and manage the meals a family receives from a healthy-catering service: a monthly plan per person (default 20 meals, Monday–Friday, excluding Bolivian holidays), a per-meal outcome (picked up, cancelled, not picked up, permission), optional compressed photo evidence, monthly counters, history, family members, reports and backups. Specification-first; fast daily use from a phone (under 10 seconds)."

## Product Summary

A family contracts a healthy-catering service. Each person has a monthly plan of a fixed number of
meals (20 today) delivered only on valid delivery days. The household needs to know, for every
person and every day, what happened to each meal, keep optional photo proof, and see exactly how
many of the contracted meals were picked up, cancelled, missed, excused or are still pending. The
product is used almost exclusively from a phone, several times a week, so recording an outcome
must take only a few seconds.

**Primary users**: adult household members, who all have the same access: they manage plans and
record outcomes for everyone (see Assumptions).

## Clarifications

### Session 2026-10-03

- Q: Can every adult change people, plans and holidays, or only one designated owner? → A: Every adult has full access, including settings, people, plans, holidays and invitations.
- Q: What happens to a meal still pending after its day has passed? → A: It automatically counts as Not picked up (flagged as automatic) and can be corrected like any other status.
- Q: How many photos can one meal have? → A: One. Taking another replaces the previous one after confirmation.
- Q: Can a person and their history be deleted permanently? → A: No. People can only be deactivated; their records and photos are always kept.
- Q: Does each person have a sign-in linked to their own record? → A: No. Sign-ins belong to adults only and are not linked to people; a person's meals are recorded by any adult.

## Delivery Calendar Rules (summary)

These rules are the core of the product and are referenced by the requirements below.

1. A **delivery day** is a date whose weekday is a configured delivery weekday (default Monday to
   Friday) and that is not a holiday.
2. Saturdays and Sundays are never delivery days unless the household explicitly registers an
   **exceptional delivery date** (e.g., the caterer delivers on a Saturday once).
3. Bolivian official holidays (fixed-date and movable) are never delivery days.
4. For a person and month, the system lists all delivery days, then selects the ones that become
   meals according to the contracted number of meals:
   - **Exactly the contracted number**: every delivery day becomes a meal.
   - **More than contracted**: the first N delivery days of the month become meals (N = contracted
     number); the remaining valid days are shown as "not part of the plan". The rule is stored as
     a setting so it can be changed later.
   - **Fewer than contracted**: the system generates only the valid days, shows a clear shortfall
     alert, and never invents dates on weekends or holidays.
5. All dates are calendar dates in Bolivia local time (UTC−4, no daylight saving). A meal belongs
   to a calendar date, not to an instant, so the same meal is on the same date for every viewer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record today's meal in seconds (Priority: P1)

As a household member, I open the app and see today's meal for each active family member. I tap
one large action for a person — **Picked up**, **Cancelled**, **Not picked up** or **Asked
permission** — and the outcome is saved. For **Picked up** I can optionally take a photo, which is
shrunk automatically and attached as proof; I can skip the photo.

**Why this priority**: This is the product's reason to exist and the daily habit that makes every
other feature meaningful. If only this works, the household already has a useful record.

**Independent Test**: With one person and one scheduled meal for today, open the app, tap
**Picked up**, take a photo, and confirm the meal shows as picked up with a thumbnail — completed
in under 10 seconds without the photo, and under 20 seconds with the photo.

**Acceptance Scenarios**:

1. **Given** a meal for today in status Scheduled, **When** I tap Picked up and skip the photo,
   **Then** the meal status becomes Picked up with no photo and today's counters update immediately.
2. **Given** a meal for today in status Scheduled, **When** I tap Picked up and take a photo,
   **Then** the photo is reduced in size automatically, stored privately, and linked to that meal;
   and the meal shows a photo indicator.
3. **Given** a meal for today in status Scheduled, **When** I tap Cancelled, Not picked up, or Asked
   permission, **Then** the status is saved as exactly that status and an optional note (and, for
   permission, an optional reason and photo) can be added without being required.
4. **Given** a meal already recorded as Picked up, **When** I record it as Picked up again,
   **Then** no duplicate is created and the existing record is unchanged.
5. **Given** a day with no meal (weekend, holiday, or outside the person's plan), **When** I open
   Today, **Then** no recording actions are offered for that person and the reason is shown.

---

### User Story 2 - Correct monthly delivery calendar (Priority: P1)

As a household member, I need each person's monthly meals to fall only on valid delivery days, so
that I never see a meal on a Saturday, Sunday or Bolivian holiday, and the month adds up to the
contracted number of meals.

**Why this priority**: Every counter and report depends on the calendar being right. A wrong
calendar silently corrupts the whole record.

**Independent Test**: Generate October 2026 for a person with a 20-meal plan and verify the listed
dates against the weekday and holiday calendar; repeat for months with more than 20 and fewer than
20 delivery days.

**Acceptance Scenarios**:

1. **Given** a date that is an official Bolivian holiday, **When** the monthly calendar is
   generated, **Then** that date produces no meal.
2. **Given** any Saturday or Sunday, **When** the monthly calendar is generated, **Then** that date
   produces no meal (unless an exceptional delivery date was registered for it).
3. **Given** a month with exactly 20 delivery days and a 20-meal plan, **When** the calendar is
   generated, **Then** exactly those 20 dates become meals, numbered 1 to 20 in date order.
4. **Given** a month with more than 20 delivery days and a 20-meal plan, **When** the calendar is
   generated, **Then** exactly 20 meals are created following the first-N-days rule and the
   unselected valid days are shown as "not part of the plan".
5. **Given** a month with fewer than 20 delivery days and a 20-meal plan, **When** the calendar is
   generated, **Then** only the valid days become meals and a visible alert states the shortfall
   (e.g., "18 of 20 — 2 meals cannot be scheduled on delivery days"), with the option to register
   exceptional delivery dates.
6. **Given** a meal already exists for a person and date, **When** another meal is created for the
   same person and date, **Then** the system rejects it.
7. **Given** the year changes (December to January), **When** the January calendar is generated,
   **Then** January 1 is excluded as a holiday and the month is calculated like any other.

---

### User Story 3 - Know where the contracted meals stand (Priority: P1)

As a household member, I see for the current month, per person, how many of the contracted meals
are Picked up, Cancelled, Not picked up, Permission and Pending, and these always add up to the
number of scheduled meals.

**Why this priority**: The user explicitly marked controlling the monthly meals as "very
important"; it is the answer to "what did I pay for versus what did I use".

**Independent Test**: Record a mix of outcomes for one person and verify the five counters, the
total, the picked-up percentage and the photo count against the records.

**Acceptance Scenarios**:

1. **Given** a person with 20 scheduled meals, **When** 14 are Picked up, 2 Cancelled, 1 Not picked
   up, 1 Permission and 2 Scheduled, **Then** the dashboard shows exactly those counts and a total
   of 20.
2. **Given** the counters, **When** their sum differs from the number of scheduled meals or the
   scheduled meals differ from the contracted number, **Then** the dashboard shows an explicit
   inconsistency or shortfall warning instead of silently showing the numbers.
3. **Given** a meal's status is changed (e.g., from Not picked up to Picked up), **When** I return
   to the dashboard, **Then** the counters and percentage reflect the change immediately.
4. **Given** a meal dated yesterday that nobody recorded, **When** I open the dashboard today,
   **Then** it counts as Not picked up, is marked automatic, and the Pending count includes
   only today's and future meals.

---

### User Story 4 - Several family members, one view (Priority: P2)

As a household member, I manage several people, switch quickly between one person or **All**, and
see a consolidated **Today** list showing every person's outcome for the day.

**Why this priority**: The household's value multiplies once the whole family is covered, but a
single-person flow (P1) is already useful.

**Independent Test**: Create four people with different plans; open Today with All selected and
confirm each person's status for the day; switch to a single person and confirm only their data
appears.

**Acceptance Scenarios**:

1. **Given** four active people with meals today, **When** I open Today with All selected, **Then**
   I see each person's name with their current status for today.
2. **Given** a person marked inactive, **When** I open Today, **Then** that person does not appear
   in recording actions, but their past records remain in history.
3. **Given** I add a new family member, **When** I set their plan start month and meal count,
   **Then** their meals are generated from their start date and nobody else's data changes.
4. **Given** one person's data is shown, **When** I switch to another person, **Then** counters,
   calendar and history are strictly that person's.

---

### User Story 5 - Monthly calendar and history with photos (Priority: P2)

As a household member, I browse a monthly calendar and past months to see what happened each day,
and open any photo to view it with its date, person, status and note.

**Why this priority**: History is how I prove and review what happened (e.g., when disputing a
charge), but it only has value once outcomes are being recorded.

**Independent Test**: Open a past month with mixed outcomes and photos; verify day-by-day statuses,
monthly totals, thumbnail display and photo detail.

**Acceptance Scenarios**:

1. **Given** a month view, **When** it loads, **Then** weekends and holidays are visibly distinct
   from meal days, and each meal day shows its status through both a color and an icon/label (never
   color alone).
2. **Given** the history list, **When** I open it, **Then** I see each month of the selected year
   with "scheduled / contracted", and counts per status; selecting a month shows the full detail.
3. **Given** a meal with a photo, **When** I view the history, **Then** I see a small thumbnail and
   the full-size photo is loaded only when I tap it.
4. **Given** the photo detail, **When** it opens, **Then** it shows the date, person, status and
   note of that meal.
5. **Given** a past meal recorded wrongly, **When** I change its status, **Then** the change is
   saved, the time of change is recorded, and the previous status is kept in the meal's change log.

---

### User Story 6 - Plan, family and holiday settings (Priority: P2)

As a household member, I configure each person's plan (meals per month, delivery weekdays, start
month, optional approximate pickup time) and manage the holiday calendar, including adding or
removing an exceptional holiday or a one-off delivery date.

**Why this priority**: The defaults cover today's need, but settings make the plan adjustable
without changing the product.

**Independent Test**: Change a person's meals per month from 20 to 25 starting next month and
verify that next month produces 25 meals while the current and past months are untouched.

**Acceptance Scenarios**:

1. **Given** the holiday calendar, **When** a new year starts, **Then** that year's Bolivian
   holidays (including movable ones) are available without me typing them in.
2. **Given** an extraordinary holiday, **When** I add it, **Then** it is treated like any other
   holiday from then on; the same applies when I remove or move a holiday.
3. **Given** a meals-per-month change, **When** I save it, **Then** it applies from the chosen
   month (default: next month) and past months remain unchanged.
4. **Given** a holiday is added on a date that already has meals, **When** I confirm, **Then** meals
   still in Scheduled status on that date are removed and the month is flagged for rebalancing,
   while meals already recorded are kept and flagged for my review — nothing recorded is silently
   deleted.

---

### User Story 7 - Monthly report and data export (Priority: P3)

As a household member, I generate a monthly report per person (counts plus a day-by-day detail with
status and whether a photo exists) and export my records so I never lose them.

**Why this priority**: Valuable for dispute and safekeeping, but not needed for daily use.

**Independent Test**: Generate the October 2026 report for one person and verify that the counts
and detail rows match the records; export all records and confirm the file contains every meal.

**Acceptance Scenarios**:

1. **Given** a month and a person, **When** I request the report, **Then** it shows the contracted
   count, the status counts, and one detail row per meal with date, status and photo indicator.
2. **Given** my data, **When** I request an export, **Then** I get a file with all meals, statuses,
   notes and change timestamps in a widely readable format.
3. **Given** my photos, **When** I request a photo export, **Then** I can download them together
   with the identifiers that tie each to its meal.

---

### User Story 8 - Limited offline use, with optional reminders deferred (Priority: P3)

As a household member, I may opt in to a morning reminder ("Today's meal is scheduled for …") and
an afternoon check ("Did you pick up today's meal?"). When my connection is poor, I can still view
already-loaded meals and record a status that is saved when the connection returns, with the
photo uploaded later.

**Why this priority**: Convenience features. The product must work fully without them.

**Independent Test**: Turn off the connection, record a status with a photo, restore the
connection, and confirm the status and photo appear on the meal.

**Acceptance Scenarios**:

1. *(Deferred, not in the first release — see Assumptions)* **Given** reminders are off (default), **When** a meal day passes, **Then** no reminder is sent.
2. *(Deferred, not in the first release)* **Given** reminders are on, **When** the configured time arrives on a delivery day with an
   unrecorded meal, **Then** I receive the reminder; on days without meals I receive nothing.
3. **Given** no connection, **When** I record an outcome, **Then** it is accepted locally, clearly
   marked "pending sync", and applied to the record when the connection returns.
4. **Given** a photo was taken offline, **When** the connection returns, **Then** it is compressed
   and attached without further action, and a failure leaves the status saved with a visible
   "photo pending" indicator.

---

### Edge Cases

Each case below defines the rule the system follows.

1. **Person starts mid-month**: meals are generated only from the start date onward, up to the
   contracted number; the earlier part of the month has no meals for that person.
2. **Person leaves mid-month**: still-Scheduled meals after the end date are removed; recorded
   meals are kept; history is preserved.
3. **Extraordinary holiday**: treated as a holiday once added (see US6 scenario 4).
4. **Holiday date changed**: removing a holiday makes its date a delivery day and proposes
   regeneration for affected months; recorded meals are never changed automatically.
5. **Caterer delivers on a Saturday once**: the household registers an exceptional delivery date;
   that date becomes eligible for meals and counts toward the contracted total. This is the only
   way a weekend date can hold a meal.
6. **Plan changes from 20 to 25 meals**: applies from the chosen month (default next month); past
   months are never recalculated.
7. **New family member added**: they get their own plan; existing members are unaffected.
8. **"Not picked up" corrected to "Picked up"**: allowed at any time; status-change time and the
   previous status are recorded.
9. **Photo deleted by accident**: deletion requires confirmation; it never changes the meal's
   status; a new photo can be attached at any time.
10. **Connection lost while taking or uploading a photo**: the status is saved first; the photo is
    kept and retried; a "photo pending" indicator is shown until it uploads or the user discards it.
11. **Image too large or unsupported**: the app reduces large photos automatically; a file that
    cannot be processed or is not an image is rejected with a clear message and the status can
    still be saved without a photo.
12. **Same meal recorded twice**: recording the same status again changes nothing; recording a
    different status updates the single existing record (one meal = one current status).
13. **Fewer than contracted delivery days** (e.g., many holidays): shortfall alert; no invalid
    dates are generated; exceptional delivery dates can be added.
14. **More than contracted delivery days**: exactly the contracted number of meals is created
    using the first-N-days rule; the rest are shown as not part of the plan.
15. **Year change**: December and January are calculated independently; history groups by year;
    January 1 is a holiday.
16. **Future meals**: recording an outcome for a future date is not offered by quick-record; it is
    available only by explicitly opening that meal, to avoid accidental entries.
17. **Day boundary**: "today" is always the current date in Bolivia time, even if the device is set
    to another timezone.
18. **Meal nobody recorded**: once its day ends it counts as Not picked up (automatic). If the
    user later records the real outcome (e.g., Picked up with a photo), that status replaces the
    automatic one and the change is logged.

## Requirements *(mandatory)*

### Functional Requirements

**Accounts and access**

- **FR-001**: System MUST require sign-in before showing any meal, person or photo data.
- **FR-002**: System MUST keep meals and photos private to the household; nothing is publicly
  reachable by link or guessable address.
- **FR-003**: System MUST allow one household to hold multiple people (family members); each
  adult family member MUST have their own sign-in with full access to
  everything in the household (meals, photos, people, plans, holidays, invitations), so every
  status change is attributed to the user who made it.

**People and plans**

- **FR-004**: System MUST let any household member create, edit and deactivate people, each with a
  first name, optional last name, active/inactive state and unique identifier.
- **FR-005**: System MUST let each person have a plan with: plan start date/month, number of meals
  per month (default 20, configurable), delivery weekdays (default Monday–Friday), and an optional
  approximate pickup time.
- **FR-006**: System MUST allow at most one plan per person for any given month (RULE-001) and the
  meals-per-month value MUST be configurable per person and effective from a chosen month
  (RULE-002).
- **FR-007**: System MUST keep inactive people and their history readable but exclude them from
  new meal generation and quick recording. The app MUST NOT offer permanent deletion of a person,
  their meals or their photos; deactivation is the only way to remove a person from daily use,
  and it can be undone.

**Delivery calendar and holidays**

- **FR-008**: System MUST only create meals on delivery days: configured weekdays that are not
  holidays (RULE-003, RULE-004, RULE-013).
- **FR-009**: System MUST never create a meal on a Saturday or Sunday, except on a date the
  household explicitly registered as an exceptional delivery date (RULE-005, RULE-014).
- **FR-010**: System MUST know Bolivian official holidays, including movable ones, for any year
  without per-year manual entry.
- **FR-011**: System MUST let any household member add, change or remove holidays and add
  exceptional delivery dates; such changes MUST apply to future meal generation and follow the
  rules in Edge Cases 3–5 for existing meals.
- **FR-012**: System MUST generate a person's monthly meals automatically, numbering them 1..N in
  date order, using the Delivery Calendar Rules.
- **FR-013**: When delivery days exceed the contracted number, System MUST make the first N delivery
  days of the month meals (rule stored as a setting) and show the remaining valid days as not
  part of the plan; when they are fewer, System MUST show a
  shortfall alert and generate only valid days.
- **FR-014**: System MUST prevent two meals for the same person and date within the same plan
  month (RULE-012).

**Recording outcomes**

- **FR-015**: Each meal MUST have exactly one current status from: Scheduled, Picked up,
  Cancelled, Not picked up, Permission (RULE-006); new meals start as Scheduled, and users can
  only change a meal to one of the other four statuses (Scheduled is never selectable).
- **FR-015a**: A meal that is still Scheduled once its date has ended (midnight Bolivia time)
  MUST be treated as Not picked up in every counter, calendar, history, report and export. The
  app MUST mark it as automatic so it can be told apart from one the user recorded, and the user
  MUST be able to change it to any other status. "Pending" therefore only applies to today and
  future meals.
- **FR-016**: Cancelled, Not picked up and Permission MUST be distinct statuses, distinct in
  storage, counters, calendar, history and reports (RULE-010, RULE-011).
- **FR-017**: System MUST allow an optional free-text note on any meal and an optional reason on
  Permission meals.
- **FR-018**: System MUST allow a status to be changed after the fact, recording the time of
  change, the previous and the new status (RULE-016) and who made the change when more than one
  user exists.
- **FR-019**: System MUST provide a quick-record view for today's meals with one-tap actions for
  the four outcomes, per person, usable one-handed on a phone.
- **FR-020**: Selecting Picked up MUST offer a photo step that can be skipped.

**Photos**

- **FR-021**: System MUST allow attaching one photo to a meal, prompting for it on Picked up and
  Permission (RULE-007); other statuses accept a photo but do not prompt for it. A meal MUST NOT
  have more than one photo: taking a new one replaces the existing photo after the user confirms,
  and the replaced image is deleted from storage.
- **FR-022**: System MUST reduce every photo's dimensions and file size and strip unnecessary
  metadata before it leaves the device, targeting roughly 200–500 KB while staying legible (final
  values decided in planning) (RULE-008).
- **FR-023**: System MUST store photos outside the source-code repository and keep only a
  reference on the meal record (RULE-009).
- **FR-024**: System MUST accept only image files, reject other file types and oversized inputs
  with a clear message, and show photos only to authorized users.
- **FR-025**: System MUST show thumbnails in lists and load a full-size photo only on request.
- **FR-026**: System MUST let the user remove a photo (with confirmation) without changing the
  meal's status.

**Counters, calendar and history**

- **FR-027**: System MUST show per person and month: contracted, scheduled, Picked up, Cancelled,
  Not picked up, Permission, Pending (Scheduled), picked-up percentage and number of photos.
- **FR-028**: System MUST ensure the five status counts always sum to the number of scheduled
  meals and MUST display an explicit warning when they do not, or when scheduled differs from
  contracted (RULE-015).
- **FR-029**: System MUST provide a monthly calendar view where meal days, non-delivery days and
  holidays are visually distinct and every status is conveyed by icon or text in addition to color.
- **FR-030**: System MUST provide a history by month and year with totals and drill-down to the
  full month detail, including photo thumbnails and photo detail (date, person, status, note).
- **FR-031**: System MUST provide a person switcher (including "All") and a consolidated Today
  view across all active people.

**Reports, export, backup**

- **FR-032**: System MUST generate a monthly report per person with counts and a day-by-day detail
  of status and photo presence.
- **FR-033**: System MUST let the user export all meal records (including status history) in a
  widely readable tabular format and export stored photos with identifiers linking them to meals.
- **FR-034**: System MUST document how the data store is backed up and restored.

**Time, language and resilience**

- **FR-035**: System MUST treat all meal dates as Bolivia-local calendar dates and determine
  "today" and month boundaries in Bolivia time regardless of device timezone.
- **FR-036**: System MUST keep all user-facing text in translatable resources, with Spanish as the
  default language shown to the user (constitution Principle I).
- **FR-037**: System SHOULD allow viewing already-loaded meals and recording an outcome without a
  connection, syncing the status and photo when the connection returns (limited offline).
- **FR-038**: System MAY offer opt-in reminders (default off) that fire only on delivery days with
  unrecorded meals and MUST work fully without them.

### Key Entities

- **Person (family member)**: someone covered by the catering plan; name, optional last name,
  active state. Owns plans and meals.
- **Plan**: a person's contract terms effective from a month: meals per month, delivery weekdays,
  optional pickup time. A person has at most one plan per month; changes apply from a chosen month.
- **Monthly Plan**: a person's plan instance for one calendar month; holds the contracted count,
  the resulting scheduled count and any shortfall/rebalancing flags.
- **Meal**: one scheduled delivery for a person on a date within a monthly plan; has a sequence
  number, one current status (an unrecorded meal whose day has passed is shown as Not picked up,
  automatic), optional note/reason, change timestamps and at most one photo.
  Unique per person and date.
- **Status Change**: an entry recording when a meal's status changed, from which status to which,
  and by whom.
- **Photo**: the single compressed image linked to a meal; the original is not kept; carries capture time
  and a private reference.
- **Holiday**: a non-delivery date with name and origin (official calculated vs. manually added);
  can be added, edited or removed by the household.
- **Exceptional Delivery Date**: a date outside the regular delivery weekdays that the household
  marks as a delivery date.
- **Household**: the group that owns all of the above; its adult members sign in and share the same access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can record today's outcome for a person without a photo in under 10 seconds
  from opening the app, and with a photo in under 20 seconds, on a typical mid-range phone.
- **SC-002**: For every month tested across at least 10 consecutive years, 100% of generated
  meals fall on a delivery weekday and none on a Bolivian holiday or unregistered weekend.
- **SC-003**: For any person and month, the five status counts sum to the number of scheduled
  meals in 100% of cases, and every mismatch with the contracted number is surfaced as a visible
  alert.
- **SC-004**: 95% of stored photos are at most 500 KB and remain legible enough to identify the
  food or receipt.
- **SC-005**: A user can see all active family members' outcomes for today on a single screen
  without scrolling for up to 4 people.
- **SC-006**: A past month's detail, including thumbnails, appears within 2 seconds on a typical
  mobile connection.
- **SC-007**: At the end of any month the user can state exactly how many meals were picked up,
  cancelled, not picked up, excused and pending directly from the app, with no manual counting.
- **SC-008**: A first-time user completes recording a meal from the Today screen without
  instructions in 9 of 10 attempts.
- **SC-009**: Cancelled, Not picked up and Permission are never confused: in review of a sample
  month, every meal's status in the calendar, history, report and export is identical.
- **SC-010**: The user can export the complete record set and photos, and restore guidance exists
  for a full data loss scenario.
- **SC-011**: The app remains usable for viewing and recording on a poor or absent connection,
  with 100% of offline-recorded statuses present after reconnecting.

## Assumptions

- **Delivery mode**: Delivered as a mobile-first, installable web experience used mainly on
  phones; this satisfies the constitution's lightweight mobile principle. A native store app is
  out of scope.
- **Monthly cycle**: A plan month is a calendar month (1st to last day), not a billing cycle.
- **Holidays**: "Official holidays" means Bolivian national holidays (fixed and movable). Regional
  or departmental holidays are not included by default; the household can add them manually.
- **Mid-month start**: A person who starts mid-month gets meals from the start date up to the
  contracted number; the catering provider's proration, if any, is not modeled.
- **Plan change timing**: Changes to meals per month apply from the next month unless another
  month is chosen; past months are immutable by plan changes.
- **Editing history**: Any past meal can be corrected at any time; there is no lock period.
- **When months are created**: A person's meals are created automatically only for the current
  month and the next one. Earlier months are created only when the user asks for them (for example
  to back-fill history), so browsing never invents meals. A person added with a start date in the
  past can be back-filled this way.
- **Leaving and returning**: Deactivating a person ends their plan the day before (still-scheduled
  later meals are removed, recorded ones are kept). Reactivating someone who had left starts a new
  period from today; their earlier records stay as they are and the gap produces no meals.
- **Photo targets**: The size/dimension/quality numbers in FR-022 are targets validated in
  planning, not final values. Original photos are never retained.
- **Language**: UI text defaults to Spanish; the product is built so other languages can be added
  (constitution Principle I). Specs, code and docs are in English.
- **Reports and export**: First version provides tabular (CSV-style) export and a printable
  report; a formatted PDF is optional and may follow later.
- **Notifications**: Reminders are optional, off by default and use only free mechanisms; they are
  deferred if they require paid infrastructure.
- **Offline scope**: Limited — view already-loaded data, queue statuses and photos, sync on
  reconnect; no offline plan/settings editing in the first version.
- **Access model**: One household, several adult sign-ins, all with equal access to everything
  (meals, photos, people, plans, holidays, invitations); no per-person privacy between adults.
  A sign-in is not linked to a person record, and children do not sign in.
- **Selection rule**: When there are more delivery days than contracted meals, the first N
  delivery days of the month are used.
- **Auditing depth**: Per-meal status change log only; no full system-wide audit trail.
- **Usage scale**: One household, up to roughly 10 people, one to a few simultaneous users;
  performance is not a scaling concern.
- **Open and free**: All technology choices (decided in planning) must satisfy the constitution's
  open/free principle; free service tiers are acceptable only if core functionality never requires
  a paid plan.
