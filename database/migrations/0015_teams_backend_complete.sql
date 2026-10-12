-- Creator Hub Creator Network — 0015 complete Teams backend support.
-- Apply only after migrations 0004, 0008 and 0010 are installed.
-- Additive migration: preserves existing teams, members, points, levels and divisions.

alter table public.teams
  add column if not exists description text not null default '',
  add column if not exists parish text,
  add column if not exists recruiting boolean not null default true,
  add column if not exists max_members integer not null default 20,
  add column if not exists updated_at timestamptz not null default now();

alter table public.team_members
  add column if not exists joined_at timestamptz not null default now();

-- Backfill only the membership relationship implied by existing owner_id values;
-- no teams or user accounts are created.
insert into public.team_members(team_id, user_id, role, joined_at)
select t.id, t.owner_id, 'owner', coalesce(t.created_at, now())
from public.teams t
where t.owner_id is not null
on conflict (team_id, user_id) do update set role = 'owner';

-- Validate member limits without rewriting existing team values.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'teams_max_members_range_check'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_max_members_range_check
      check (max_members between 2 and 500) not valid;
  end if;
end $$;

create index if not exists team_members_user_idx on public.team_members(user_id, team_id);
create index if not exists team_members_joined_idx on public.team_members(team_id, joined_at);
create index if not exists teams_points_division_idx on public.teams(division_code, points desc);

-- Create team and owner membership atomically. The backend authenticates the user
-- before calling this service-role-only function; never expose service-role credentials.
create or replace function public.create_team_for_user(
  p_user_id uuid,
  p_name text,
  p_description text default '',
  p_parish text default null,
  p_logo_url text default null,
  p_badge_url text default null,
  p_max_members integer default 20
) returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  created_team public.teams;
  clean_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if p_user_id is null then raise exception using errcode = 'P0001', message = 'Authenticated user required'; end if;
  if length(clean_name) < 3 or length(clean_name) > 48 then
    raise exception using errcode = 'P0001', message = 'Team name must be 3-48 characters';
  end if;
  if p_max_members is null or p_max_members < 2 or p_max_members > 500 then
    raise exception using errcode = 'P0001', message = 'Member limit must be between 2 and 500';
  end if;
  perform pg_advisory_xact_lock(hashtext(lower(clean_name)));
  if exists (select 1 from public.teams t where lower(t.name) = lower(clean_name)) then
    raise exception using errcode = '23505', message = 'Team name already exists';
  end if;

  insert into public.teams (
    name, description, parish, logo_url, badge_url, max_members,
    owner_id, division_code, level, points, recruiting, updated_at
  ) values (
    clean_name, coalesce(p_description, ''), nullif(trim(p_parish), ''),
    nullif(trim(p_logo_url), ''), nullif(trim(p_badge_url), ''), p_max_members,
    p_user_id, 'D5', 1, 0, true, now()
  ) returning * into created_team;

  insert into public.team_members(team_id, user_id, role, joined_at)
  values (created_team.id, p_user_id, 'owner', now());

  return created_team;
end;
$$;

-- Lock the team row before counting members, so concurrent join requests cannot
-- exceed the configured membership limit.
create or replace function public.join_team_for_user(
  p_team_id uuid,
  p_user_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team public.teams;
  member_total integer;
begin
  if p_user_id is null then raise exception using errcode = 'P0001', message = 'Authenticated user required'; end if;
  select * into target_team from public.teams where id = p_team_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'Team not found'; end if;
  if exists (select 1 from public.team_members tm where tm.team_id = p_team_id and tm.user_id = p_user_id) then
    raise exception using errcode = 'P0001', message = 'Already a member';
  end if;
  if not target_team.recruiting then raise exception using errcode = 'P0001', message = 'Team is not recruiting'; end if;
  select count(*) into member_total from public.team_members where team_id = p_team_id;
  if member_total >= target_team.max_members then raise exception using errcode = 'P0001', message = 'Team is full'; end if;
  insert into public.team_members(team_id, user_id, role, joined_at)
  values (p_team_id, p_user_id, 'member', now());
  return 'joined';
end;
$$;


-- Owner edits and member-limit validation run under the same team-row lock used
-- by join_team_for_user, preventing a concurrent join from exceeding the limit.
create or replace function public.update_team_for_user(
  p_team_id uuid,
  p_user_id uuid,
  p_name text,
  p_description text,
  p_parish text,
  p_logo_url text,
  p_badge_url text,
  p_max_members integer,
  p_recruiting boolean
) returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team public.teams;
  updated_team public.teams;
  clean_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  member_total integer;
begin
  select * into target_team from public.teams where id = p_team_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'Team not found'; end if;
  if p_user_id is null or target_team.owner_id <> p_user_id then
    raise exception using errcode = '42501', message = 'Team owner required';
  end if;
  if length(clean_name) < 3 or length(clean_name) > 48 then
    raise exception using errcode = 'P0001', message = 'Team name must be 3-48 characters';
  end if;
  if p_max_members is null or p_max_members < 2 or p_max_members > 500 then
    raise exception using errcode = 'P0001', message = 'Member limit must be between 2 and 500';
  end if;
  perform pg_advisory_xact_lock(hashtext(lower(clean_name)));
  if exists (select 1 from public.teams t where t.id <> p_team_id and lower(t.name) = lower(clean_name)) then
    raise exception using errcode = '23505', message = 'Team name already exists';
  end if;
  select count(*) into member_total from public.team_members where team_id = p_team_id;
  if p_max_members < member_total then
    raise exception using errcode = 'P0001', message = 'Member limit below current membership count';
  end if;
  update public.teams set
    name = clean_name,
    description = coalesce(p_description, ''),
    parish = nullif(trim(p_parish), ''),
    logo_url = nullif(trim(p_logo_url), ''),
    badge_url = nullif(trim(p_badge_url), ''),
    max_members = p_max_members,
    recruiting = coalesce(p_recruiting, true),
    updated_at = now()
  where id = p_team_id returning * into updated_team;
  return updated_team;
end;
$$;

revoke all on function public.create_team_for_user(uuid,text,text,text,text,text,integer) from public;
revoke all on function public.join_team_for_user(uuid,uuid) from public;
revoke all on function public.update_team_for_user(uuid,uuid,text,text,text,text,text,integer,boolean) from public;
-- These functions are only called by the authenticated backend using its service role.
revoke all on function public.create_team_for_user(uuid,text,text,text,text,text,integer) from anon, authenticated;
revoke all on function public.join_team_for_user(uuid,uuid) from anon, authenticated;
revoke all on function public.update_team_for_user(uuid,uuid,text,text,text,text,text,integer,boolean) from anon, authenticated;
grant execute on function public.create_team_for_user(uuid,text,text,text,text,text,integer) to service_role;
grant execute on function public.join_team_for_user(uuid,uuid) to service_role;
grant execute on function public.update_team_for_user(uuid,uuid,text,text,text,text,text,integer,boolean) to service_role;

comment on column public.teams.level is 'Legacy numeric level retained for compatibility; league placement is determined by division_code and server-managed league standings.';
comment on column public.teams.division_code is 'Authoritative competition division; managed by the league system, not by team profile edits.';
