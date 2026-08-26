# zerokm

A shared space for two people living far apart: live clocks in each other's
timezone, the distance between you on a world map, and a two-person photo
diary. *Far apart, but 0 km in our hearts.*

Multi-tenant: one deployment serves any number of couples. Each couple gets an
isolated "space"; isolation is enforced by Postgres row-level security, not by
application code.

**Stack:** Next.js 14 (App Router) · TypeScript · Supabase (Auth, Postgres, Storage) · Tailwind-era hand-rolled Bauhaus CSS · Plotly

## Self-hosting

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Run the schema.** Dashboard → SQL Editor → paste the whole of
   [`supabase/schema.sql`](supabase/schema.sql) → Run. This creates the
   tables, RLS policies, the private `photos` bucket, and the
   `create_space` / `join_space` functions. Safe to re-run.

3. **Enable email sign-in.** Dashboard → Authentication → Providers → Email.
   Magic links are the only sign-in method the app uses; no passwords.
   Optionally plug your own SMTP (Authentication → SMTP) to lift the default
   send-rate limits — the same Gmail app password used for notifications works.

4. **Configure env.** Copy `.env.local.example` to `.env.local` and fill in
   the Supabase URL + anon key. `GMAIL_*` is optional (photo notification
   emails); leave blank to disable.

5. **Run.**

   ```bash
   npm install
   npm run dev
   ```

6. **Deploy** to Vercel (or anywhere Next.js runs). Set the same env vars,
   plus `NEXT_PUBLIC_SITE_URL=https://your-domain` — it's used in magic-link
   redirects and notification emails. Add your domain to Supabase →
   Authentication → URL Configuration → Redirect URLs
   (`https://your-domain/auth/callback`).

## Using it

- Sign in with your email → create a space (title, anniversary, your name).
- Your partner signs in and enters the **invite code** shown in Settings.
- Each person sets their own timezone, name, color and emoji in Settings.
  Until your partner joins, you can edit their placeholder seat too.
- The diary is shared: either of you can write on either side — it's one
  diary for two people, not two private ones.

## Security model

- Every table carries `space_id`; every RLS policy reduces to
  `is_member(space_id)`. The browser talks to Supabase directly with the
  anon key + user session — there is no service-role key anywhere in the app.
- Photos live in a **private** bucket keyed by `{space_id}/{date}/{member_id}`
  and are served through short-lived signed URLs.
- Spaces and memberships are only created via `security definer` RPCs, so
  clients can never insert membership rows or rewrite `space_id` / `slot` /
  `invite_code` (those columns have no update grant at all).

Verify all of it against a live project:

```bash
# create the two test users listed in .env.local.example first
npm run check:rls
```

## Repo layout

```
app/            routes: / (clocks+map+diary), /login, /onboarding, /settings,
                /auth/callback, /api/notify (partner email ping)
components/     ClockCard, ClocksSection, TimeDiffBanner, DistanceMap,
                CalendarGrid, DiarySection, DiaryEntry
lib/            queries.ts (all data access), supabase/ (client factories),
                types.ts, email.ts, haversine.ts, tz-coords.json
supabase/       schema.sql — the entire database, idempotent
scripts/        check-rls.ts — isolation test
```
