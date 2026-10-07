-- =====================================================================
-- Creator Hub Live \u2014 0001 identity + profiles + social graph
-- Run in Supabase SQL editor (or supabase db push). Order matters: 0001..0005
-- =====================================================================
set check_function_bodies = off;
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- profiles: one row per auth.users row. The permanent user identity.
-- id == auth.uid(). Sign out / sign in returns to the SAME row.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      citext unique not null,
  display_name  text not null default '',
  bio           text not null default '',
  avatar_url    text,
  cover_url     text,
  country       text,
  language      text default 'en',
  links         jsonb not null default '[]'::jsonb,
  creator_category text,
  is_creator    boolean not null default false,
  is_admin      boolean not null default false,
  gifter_level  int not null default 0,
  league        text default 'D5',
  privacy       jsonb not null default '{"account":"public","messages":"everyone","comments":"everyone"}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-zA-Z0-9_.]{3,30}$')
);

-- Auto-create a profile when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  final_username text;
  n int := 0;
begin
  base_username := regexp_replace(split_part(coalesce(new.email, 'user'), '@', 1), '[^a-zA-Z0-9_.]', '', 'g');
  if length(base_username) < 3 then base_username := 'user' || substr(new.id::text, 1, 6); end if;
  base_username := substr(base_username, 1, 24);
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    n := n + 1; final_username := base_username || n::text;
  end loop;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, final_username,
          coalesce(new.raw_user_meta_data->>'full_name', final_username),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- social graph: follows, friends, blocks, mutes. Constraints prevent dupes.
-- ---------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'accepted' check (status in ('pending','accepted')),
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows(followee_id);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create table if not exists public.mutes (
  muter_id  uuid not null references public.profiles(id) on delete cascade,
  muted_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id)
);

-- Denormalized counts kept correct by triggers (reads stay cheap).
alter table public.profiles
  add column if not exists followers_count int not null default 0,
  add column if not exists following_count int not null default 0,
  add column if not exists posts_count int not null default 0;

create or replace function public.sync_follow_counts()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.status = 'accepted' then
    update public.profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif tg_op = 'DELETE' and old.status = 'accepted' then
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  elsif tg_op = 'UPDATE' and old.status <> 'accepted' and new.status = 'accepted' then
    update public.profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_follow_counts on public.follows;
create trigger trg_follow_counts
  after insert or update or delete on public.follows
  for each row execute function public.sync_follow_counts();
