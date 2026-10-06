# Backup and restore

Free Supabase projects have **no automatic backups**, and a database dump does **not** include the
photos (it only holds their paths). Nutrilara therefore protects your data in three layers.

## 1. Export from the app (any time)

**More → Export data**

| File | Content |
|------|---------|
| Meals (CSV) | Every meal: person, date, status, note, photo file, last change time |
| Change log (CSV) | Every status change: from → to, when and by whom |
| Photos (ZIP) | Every photo organized by person, plus `photos.csv` and `meals.csv` that link each photo to its meal |

CSV files open in any spreadsheet. These exports are enough to prove what happened on a given day.

## 2. Weekly database dump (automatic)

`.github/workflows/backup.yml` dumps the schema and the data every Monday and keeps the result as a
workflow artifact for 90 days. The same job keeps a free project from pausing after a week of
inactivity.

Setup:

1. Keep the repository **private** (the dump contains personal data).
2. In Supabase: *Project Settings → Database → Connection string* (use the **session pooler**).
3. In GitHub: *Settings → Secrets and variables → Actions → New repository secret*
   `SUPABASE_DB_URL` = that connection string with your password.
4. Run the workflow once by hand (*Actions → Weekly database backup → Run workflow*) and download
   the artifact to confirm it works.

You can also run it locally: `SUPABASE_DB_URL=... ./scripts/backup.sh`.

## 3. Restore into a new project

1. Create a new Supabase project and link it: `supabase link --project-ref <ref>`.
2. Create the schema from the migrations: `supabase db push`. This also creates the private
   `meal-photos` bucket with its policies and loads the Bolivian holidays.
3. Load the data from the dump:
   ```bash
   psql "$NEW_DB_URL" -f backups/data-YYYYMMDD-HHMMSS.sql
   ```
   Load the data before anyone signs in. User accounts (Supabase Auth) are not in the `public`
   dump: ask each adult to sign up again, create the household with the first account and invite
   the others (**More → Household and invitations**). Meals and people keep their ids, so history is
   preserved; the change log keeps the names it was recorded with.
4. Re-import the photos from the ZIP: upload each file to the bucket `meal-photos` under
   `{household_id}/{person_id}/{yyyy-mm}/{meal_id}/` using the same names as in the dump's
   `meal_photos` table (`storage_path`). The ZIP's `photos.csv` tells you which file belongs to which
   meal.
5. Point the app at the new project (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) and redeploy.

## A project that paused

If you did not open the app for more than a week and the weekly job is not set up, Supabase pauses
the project. Open the dashboard and press **Restore project**; no data is lost.
