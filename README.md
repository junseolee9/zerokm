# zerokm

![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth%20%2B%20Storage-3ECF8E?logo=supabase&logoColor=white)
![RLS](https://img.shields.io/badge/Security-Row--Level%20Security%20only-D02020)

**[Live demo →](https://zerokm.vercel.app)** — sign in with Google, create a
space, invite a second Google account by email. It's a real multi-tenant
deployment, not a mock: your data lands in an isolated space exactly the way
a real couple's would.

A shared space for two people living far apart: live clocks in each other's
timezone, the distance between you on a world map, and a two-person photo
diary. *Far apart, but 0 km in our hearts.*

Multi-tenant — one deployment serves any number of couples. Each couple gets
an isolated "space," and isolation is enforced entirely by Postgres row-level
security, not by application code. There is no service-role key anywhere in
the app; the browser talks to Supabase directly with the anon key and the
signed-in user's session.

## Highlights

A few decisions this codebase makes on purpose, worth a closer look if you're
skimming for engineering signal:

- **RLS is the only security boundary.** Every table carries `space_id`;
  every policy reduces to one predicate, `is_member(space_id)`. No API route
  stands between the browser and the database re-checking permissions — there's
  nothing to keep in sync because there's only one place the rule lives.
- **People are rows, not columns.** The diary table is
  `entries(space_id, date, member_id, text, photo_path)` — not
  `diary(date, person_a_text, person_b_text)`. Every per-person `if` branch
  this would otherwise force through the codebase simply doesn't exist.
- **Self-service account deletion without a service-role key.** Deleting a
  Supabase Auth user normally requires the admin API. `delete_my_account()`
  is a `SECURITY DEFINER` function owned by the schema's creator, so it can
  reach `auth.users` — but it only ever acts on `auth.uid()`, so a client can
  never delete anyone but itself.
- **Private photos, signed URLs, no stored public links.** The storage
  bucket is private; the database stores a `photo_path`, never a URL. Every
  page load re-signs a short-lived URL through a storage policy that runs the
  same `is_member()` check.
- **An actual isolation test, not just a promise.** `scripts/check-rls.ts`
  signs in as two separate real users against a live Supabase project and
  asserts neither can read, write, or sign a storage URL for the other's
  space — including membership-row tampering and invite-matching edge cases.

## Stack

Next.js 14 (App Router) · TypeScript · Supabase (Auth, Postgres, Row-Level
Security, Storage) · Plotly (distance map) · hand-rolled Bauhaus-styled CSS

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
  automatically (an invitation email is sent too, if Gmail is configured) —
  they just pick their own name, emoji, and timezone first.
- Each person sets their own timezone, name, color and emoji in Settings.
  Until your partner joins, you can edit their placeholder seat too — the
  invited email can be set or changed there any time.
- The diary is shared: either of you can write on either side — it's one
  diary for two people, not two private ones.
- Deleting your account frees your seat (a fresh, unclaimed placeholder) and
  wipes your own diary entries. If your partner never signed up either, the
  whole space goes with it.

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
                CalendarGrid, DiarySection, DiaryEntry, DateField, TimezoneField
lib/            queries.ts (all data access), supabase/ (client factories),
                types.ts, timezones.ts, email.ts, haversine.ts, tz-coords.json
supabase/       schema.sql — the entire database, idempotent
scripts/        check-rls.ts — isolation test
```

## License

[MIT](LICENSE)
