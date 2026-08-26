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
   `create_space` / `claim_invite` functions. Safe to re-run.

3. **Enable Google sign-in.** Dashboard → Authentication → Providers →
   Google. Create an OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (type: Web application), add the callback URL Supabase shows you
   (`https://<project>.supabase.co/auth/v1/callback`), and paste the client
   ID + secret into Supabase. Google is the only sign-in method — invitations
   match on the partner's Google email.

4. **Configure env.** Copy `.env.local.example` to `.env.local` and fill in
   the Supabase URL + anon key. `GMAIL_*` is optional (invitation + photo
   notification emails); leave blank to disable.

5. **Run.**

   ```bash
   npm install
   npm run dev
   ```

6. **Deploy** to Vercel (or anywhere Next.js runs). Set the same env vars,
   plus `NEXT_PUBLIC_SITE_URL=https://your-domain` — it's used in OAuth
   redirects and notification emails. Add your domain to Supabase →
   Authentication → URL Configuration → Redirect URLs
   (`https://your-domain/auth/callback`).

## Using it

- Sign in with Google → create a space (title, anniversary, your name) and
  enter your **partner's Google email**.
- Your partner signs in with that Google account and lands in your space
  automatically (an invitation email is sent too, if Gmail is configured).
- Each person sets their own timezone, name, color and emoji in Settings.
  Until your partner joins, you can edit their placeholder seat too — the
  invited email can be set or changed there any time.
- The diary is shared: either of you can write on either side — it's one
  diary for two people, not two private ones.

## Security model

- Every table carries `space_id`; every RLS policy reduces to
  `is_member(space_id)`. The browser talks to Supabase directly with the
  anon key + user session — there is no service-role key anywhere in the app.
- Photos live in a **private** bucket keyed by `{space_id}/{date}/{member_id}`
  and are served through short-lived signed URLs.
- Spaces and memberships are only created via `security definer` RPCs
  (`create_space`, `claim_invite`), so clients can never insert membership
  rows or rewrite `space_id` / `slot` / `user_id` (no update grant at all).
  Seat matching compares the signed-in Google email against `invited_email`
  inside the RPC — nothing client-supplied is trusted.
- Account deletion (`delete_my_account`) removes the caller's own `auth.users`
  row — normally an admin-only operation — without a service-role key in the
  app. The function is owned by the role that ran `schema.sql`, so it can
  touch `auth.users`, but it only ever acts on `auth.uid()`, so a client can
  only ever delete itself.

Verify the isolation guarantees against a live project:

```bash
# 1. In the Supabase dashboard, enable Authentication > Providers > Email
#    (password) — just for these two throwaway test accounts; the app
#    itself only ever offers Google sign-in.
# 2. Create the two users listed in .env.local.example with that provider.
npm run check:rls
```

## Repo layout

```
app/            routes: / (clocks+map+diary), /login, /onboarding, /settings,
                /auth/callback, /api/notify + /api/invite (partner emails)
components/     ClockCard, ClocksSection, TimeDiffBanner, DistanceMap,
                CalendarGrid, DiarySection, DiaryEntry
lib/            queries.ts (all data access), supabase/ (client factories),
                types.ts, email.ts, haversine.ts, tz-coords.json
supabase/       schema.sql — the entire database, idempotent
scripts/        check-rls.ts — isolation test
```
