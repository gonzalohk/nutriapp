# Deployment (free tiers)

Nutrilara is a static site plus a Supabase project. Nothing needs a server of your own.

## 1. Supabase project

1. Create a free project at https://supabase.com (region close to you).
2. **Authentication → Providers → Email**: keep sign-up enabled and turn **Confirm email OFF**.
   Reason: the built-in email sender is heavily rate limited, so the app never depends on email.
   Access is protected by the household and its invitation codes, not by email confirmation.
3. Link and create everything from the migrations:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This creates the tables, the delivery rules, the Bolivian holidays (2024-2045), the security
   policies and the **private** `meal-photos` bucket.
4. **Storage**: open the bucket `meal-photos` and confirm it is **not public** (limit 2 MB; only
   WebP and JPEG).
5. Copy **Project URL** and the **anon public key** (Project Settings → API). Do not use the
   service-role key anywhere in the app.

Free-plan facts to know: 500 MB database, 1 GB file storage, projects **pause after one week
without activity** (the weekly backup job in [restore.md](restore.md) keeps it awake), and there
are no automatic backups.

## 2. Hosting the app

Any static host works. Recommended: **Cloudflare Pages** (free, no usage clause).

Cloudflare Pages:
1. Connect the Git repository.
2. Build command `pnpm build`, output directory `dist`.
3. Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Single-page-app routing: Pages serves `index.html` for unknown paths automatically when there is
   no `404.html`; nothing else to configure.

Vercel Hobby also works (framework preset *Vite*, same two variables). Its free plan is limited to
non-commercial personal use, which fits a family app.

Open the site on your phone and install it (see [pwa.md](pwa.md)).

## 3. First use

1. Sign up in the app and create the household (only the first household can be created).
2. **More → People**: add each person with their plan start date and meals per month.
3. **More → Household and invitations**: create a code for each adult. They sign up, choose
   *I have an invite code* and enter it. Everyone has the same access.
4. The current and next month are generated automatically. Earlier months are created only when you
   open them and press **Generate this month** (to back-fill history).

## 4. Keeping the holiday data current

The Bolivian public holidays are calculated by rule with the `date-holidays` library and stored in a
migration (2024-2045). Extraordinary or regional holidays are added in **More → Holidays and
deliveries**. Before 2045 generate the next years and push them:

```bash
pnpm holidays:generate --from 2046 --to 2060 --out supabase/migrations/0100_official_holidays_2046_2060.sql
supabase db push
```

The app refuses to generate a month outside the covered years instead of guessing, and the
Holidays screen warns when fewer than two years remain.

## 5. Backups

Follow [restore.md](restore.md): configure the weekly dump (private repository only) and learn how
to export data and photos from the app.

## Updating the app

Push to the connected branch; the host rebuilds. Installed phones show an **Update** bar when the new
version is ready. New migrations are applied with `supabase db push` **before** deploying a version
that needs them.

## Troubleshooting

| Symptom | Cause |
|---------|-------|
| "The Supabase connection is not configured" | The two `VITE_` variables are missing in the host or `.env.local` |
| Everything fails after a week away | The free project paused: press **Restore project** in the dashboard |
| A new user sees no data | Expected: it must create the household or join with an invite code |
| "No holiday data for that year" | Generate the missing years (section 4) |
