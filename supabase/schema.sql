-- zerokm schema
-- Run this once in the Supabase dashboard SQL editor on a fresh project.
-- Safe to re-run: every statement is idempotent.
--
-- Isolation model: a "space" is one couple. Every table carries space_id and
-- every policy reduces to the same question — is auth.uid() a member of this
-- space? Table privileges are granted column by column so that the columns a
-- client must never rewrite (space_id, slot, user_id, invite_code) are simply
-- not grantable, and rows are only ever created through the two SECURITY
-- DEFINER functions at the bottom.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables ---

create table if not exists public.spaces (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'zerokm',
  anniversary date,
  invite_code text not null unique default encode(gen_random_bytes(4), 'hex'),
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
-- join_space(). No update grant on invite_code, space_id, slot or user_id:
-- rewriting those is how you would escape your own space.
grant select                          on public.spaces  to authenticated;
grant update (title, anniversary)     on public.spaces  to authenticated;

grant select                          on public.members to authenticated;
grant update (display_name, color, emoji, timezone, notify_email)
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
  p_title        text,
  p_anniversary  date,
  p_display_name text,
  p_timezone     text
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

  -- The partner's seat, waiting for join_space() to claim it.
  insert into public.members (space_id, user_id, slot, display_name, color, emoji, timezone)
  values (v_space, null, 2, 'Partner', '#D02020', '💛', 'UTC');

  return v_space;
end;
$$;

create or replace function public.join_space(
  p_code         text,
  p_display_name text,
  p_timezone     text
) returns uuid
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_space  uuid;
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    raise exception 'already in a space';
  end if;

  select id into v_space from public.spaces
  where invite_code = lower(btrim(p_code));
  if v_space is null then
    raise exception 'invalid invite code';
  end if;

  -- FOR UPDATE so two people redeeming the same code at once cannot both win.
  select id into v_member from public.members
  where space_id = v_space and user_id is null
  order by slot limit 1
  for update;
  if v_member is null then
    raise exception 'space is full';
  end if;

  update public.members set
    user_id      = v_uid,
    display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
    timezone     = coalesce(nullif(btrim(p_timezone), ''), timezone),
    notify_email = (select email from auth.users where id = v_uid)
  where id = v_member;

  return v_space;
end;
$$;

revoke execute on function public.create_space(text, date, text, text) from public;
revoke execute on function public.join_space(text, text, text)         from public;
grant  execute on function public.create_space(text, date, text, text) to authenticated;
grant  execute on function public.join_space(text, text, text)         to authenticated;
