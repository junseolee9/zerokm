-- zerokm schema
-- Run this once in the Supabase dashboard SQL editor on a fresh project.
-- Safe to re-run: every statement is idempotent.
--
-- Isolation model: a "space" is one couple. Every table carries space_id and
-- every policy reduces to the same question — is auth.uid() a member of this
-- space? Table privileges are granted column by column so that the columns a
-- client must never rewrite (space_id, slot, user_id) are simply
-- not grantable, and rows are only ever created through the two SECURITY
-- DEFINER functions at the bottom.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables ---

create table if not exists public.spaces (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'zerokm',
  anniversary date,
  created_at  timestamptz not null default now()
);

-- user_id null = a placeholder seat for a partner who has not signed up yet.
create table if not exists public.members (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  slot         smallint not null check (slot in (1, 2)),
  display_name text not null,
  color        text not null default '#1040C0' check (color ~ '^#[0-9a-fA-F]{6}$'),
  emoji        text not null default '🙂',
  timezone     text not null default 'UTC',
  notify_email text,
  -- Google email the partner seat is reserved for; claim_invite() matches on it
  invited_email text,
  unique (space_id, slot)
);

-- Plain UNIQUE would let a space hold two placeholder rows (nulls are distinct),
-- which is exactly what we want; the partial index still blocks a real user
-- from occupying two seats in one space.
create unique index if not exists members_space_user_uniq
  on public.members (space_id, user_id) where user_id is not null;
create index if not exists members_user_idx on public.members (user_id);

-- One diary cell = (space, date, author). People are rows, never columns.
create table if not exists public.entries (
  space_id   uuid not null references public.spaces(id) on delete cascade,
  date       date not null,
  member_id  uuid not null references public.members(id) on delete cascade,
  text       text not null default '',
  photo_path text,
  primary key (space_id, date, member_id)
);

-- --------------------------------------------------------------- helpers ---

-- SECURITY DEFINER on purpose: policies on members call this, and a policy that
-- queried members directly would recurse.
create or replace function public.is_member(s uuid) returns boolean
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.members m
    where m.space_id = s and m.user_id = auth.uid()
  );
$$;

-- Storage paths look like {space_id}/{date}/{member_id}. Returns null rather
-- than raising when the leading segment is not a uuid, so a malformed path
-- fails the policy instead of erroring out of it.
create or replace function public.space_of_path(p text) returns uuid
  language plpgsql immutable
as $$
begin
  return substring(p from '^([0-9a-fA-F-]{36})/')::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.is_member(uuid)      from public;
revoke execute on function public.space_of_path(text)  from public;
grant  execute on function public.is_member(uuid)      to authenticated;
grant  execute on function public.space_of_path(text)  to authenticated;

-- ------------------------------------------------------------ privileges ---

revoke all on public.spaces  from anon, authenticated;
revoke all on public.members from anon, authenticated;
revoke all on public.entries from anon, authenticated;

-- No insert grant: spaces and members are created only by create_space() /
-- claim_invite(). No update grant on space_id, slot or user_id:
-- rewriting those is how you would escape your own space.
grant select                          on public.spaces  to authenticated;
grant update (title, anniversary)     on public.spaces  to authenticated;

grant select                          on public.members to authenticated;
grant update (display_name, color, emoji, timezone, notify_email, invited_email)
                                      on public.members to authenticated;

grant select, insert, update, delete  on public.entries to authenticated;

-- ----------------------------------------------------------------- rls -----

alter table public.spaces  enable row level security;
alter table public.members enable row level security;
alter table public.entries enable row level security;

drop policy if exists spaces_select  on public.spaces;
drop policy if exists spaces_update  on public.spaces;
drop policy if exists members_select on public.members;
drop policy if exists members_update on public.members;
drop policy if exists entries_all    on public.entries;

create policy spaces_select on public.spaces
  for select to authenticated using (public.is_member(id));

create policy spaces_update on public.spaces
  for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

create policy members_select on public.members
  for select to authenticated using (public.is_member(space_id));

-- You may edit your own profile, and the partner placeholder seat until someone
-- claims it — that covers the common case of one person setting both sides up
-- before the other has signed in.
create policy members_update on public.members
  for update to authenticated
  using      (public.is_member(space_id) and (user_id = auth.uid() or user_id is null))
  with check (public.is_member(space_id) and (user_id = auth.uid() or user_id is null));

-- ponytail: either member may write either side's entry. A shared two-person
-- diary, and the placeholder seat needs someone to write for it. Split into
-- per-author policies if the space ever holds people who are not a couple.
create policy entries_all on public.entries
  for all to authenticated
  using      (public.is_member(space_id))
  with check (public.is_member(space_id));

-- ------------------------------------------------------------- storage -----

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists photos_select on storage.objects;
drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_update on storage.objects;
drop policy if exists photos_delete on storage.objects;

create policy photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.is_member(public.space_of_path(name)));

create policy photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member(public.space_of_path(name)));

create policy photos_update on storage.objects
  for update to authenticated
  using      (bucket_id = 'photos' and public.is_member(public.space_of_path(name)))
  with check (bucket_id = 'photos' and public.is_member(public.space_of_path(name)));

create policy photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.is_member(public.space_of_path(name)));

-- ------------------------------------------------------------- onboarding --

-- ponytail: one space per user, enforced here. Keeps every route free of a
-- space picker. Drop the "already in a space" guard and add one if people ever
-- need several.

create or replace function public.create_space(
  p_title         text,
  p_anniversary   date,
  p_display_name  text,
  p_timezone      text,
  p_partner_email text default null
) returns uuid
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_space uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    raise exception 'already in a space';
  end if;

  insert into public.spaces (title, anniversary)
  values (coalesce(nullif(btrim(p_title), ''), 'zerokm'), p_anniversary)
  returning id into v_space;

  insert into public.members (space_id, user_id, slot, display_name, color, emoji, timezone, notify_email)
  values (
    v_space, v_uid, 1,
    coalesce(nullif(btrim(p_display_name), ''), 'Me'),
    '#1040C0', '🙂',
    coalesce(nullif(btrim(p_timezone), ''), 'UTC'),
    (select email from auth.users where id = v_uid)
  );

  -- The partner's seat; claim_invite() hands it to whoever signs in with
  -- the invited Google email.
  insert into public.members (space_id, user_id, slot, display_name, color, emoji, timezone, invited_email)
  values (v_space, null, 2, 'Partner', '#D02020', '💛', 'UTC',
          lower(nullif(btrim(p_partner_email), '')));

  return v_space;
end;
$$;

create or replace function public.claim_invite() returns uuid
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  -- auth.jwt() reads straight from the request's JWT claims; more version-proof
  -- than the auth.email() helper, which has moved between Supabase releases.
  v_email  text := lower(btrim(coalesce(auth.jwt() ->> 'email', auth.email(), '')));
  v_member uuid;
  v_space  uuid;
begin
  if v_uid is null or v_email = '' then
    return null;
  end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    return null; -- already seated somewhere
  end if;

  -- FOR UPDATE so two sessions claiming at once cannot both win the seat.
  select id, space_id into v_member, v_space from public.members
  where user_id is null and lower(invited_email) = v_email
  order by id limit 1
  for update;
  if v_member is null then
    return null; -- no invitation for this email
  end if;

  update public.members set
    user_id      = v_uid,
    notify_email = coalesce(notify_email, v_email)
  where id = v_member;

  return v_space;
end;
$$;

drop function if exists public.join_space(text, text, text);
drop function if exists public.create_space(text, date, text, text); -- pre-Google-auth signature
revoke execute on function public.create_space(text, date, text, text, text) from public;
revoke execute on function public.claim_invite()                             from public;
grant  execute on function public.create_space(text, date, text, text, text) to authenticated;
grant  execute on function public.claim_invite()                             to authenticated;

-- ------------------------------------------------------------- account -----

-- Anon-key clients can never delete from auth.users (no grant, and it isn't
-- exposed through PostgREST). This function is owned by the role that ran
-- this script — normally `postgres`, via the dashboard SQL editor — which
-- has real table ownership and so bypasses that restriction; the caller only
-- gets to run it as themselves, via auth.uid(). Deleting from storage.objects
-- must happen client-side first (see lib/queries.ts deleteMyAccount) since
-- this function's owner does not carry the storage-object owner check.
create or replace function public.delete_my_account() returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_space uuid;
  v_left  int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select space_id into v_space from public.members where user_id = v_uid;

  -- Cascades to this member's own entries (entries.member_id on delete cascade).
  delete from public.members where user_id = v_uid;

  if v_space is not null then
    select count(*) into v_left from public.members
      where space_id = v_space and user_id is not null;
    -- Nobody left with a real account: the space was only ever the two of
    -- you, so it has no reason to keep existing. Cascades the placeholder
    -- seat and any remaining entries with it.
    if v_left = 0 then
      delete from public.spaces where id = v_space;
    end if;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public;
grant  execute on function public.delete_my_account() to authenticated;
