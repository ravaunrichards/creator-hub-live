-- Creator Hub Live — forward-only LIVE media modes and account appearance settings.
-- Apply only after reviewing the production schema and taking a database backup.
-- This migration is additive except for normalizing the live_guests status CHECK;
-- it does not create/delete sessions, wallets, gifts, transactions or user data.
begin;

do $$
begin
  if to_regclass('public.live_sessions') is null then
    raise exception '0028 prerequisite missing: public.live_sessions must exist.';
  end if;
  if to_regclass('public.live_guests') is null then
    raise exception '0028 prerequisite missing: public.live_guests must exist.';
  end if;
  if to_regclass('public.user_settings') is null then
    raise exception '0028 prerequisite missing: public.user_settings must exist.';
  end if;
end $$;

-- Preserve existing sessions as video sessions unless a row is explicitly set
-- to audio or screen. Old clients therefore remain compatible after migration.
alter table public.live_sessions
  add column if not exists media_mode text not null default 'video';

-- LIVE audience already exists in the current room-schema migration. This
-- idempotent guard keeps the API safe on installations missing that step.
alter table public.live_sessions
  add column if not exists audience text not null default 'public';
update public.live_sessions set audience='public'
  where audience is null or audience not in ('public','followers','private');
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.live_sessions'::regclass and conname='live_sessions_audience_allowed') then
    alter table public.live_sessions add constraint live_sessions_audience_allowed check (audience in ('public','followers','private'));
  end if;
end $$;

update public.live_sessions set media_mode='video'
  where media_mode is null or media_mode not in ('video','audio','screen');

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='live_sessions' and column_name='kind') then
    execute 'update public.live_sessions set media_mode = case when kind=''voice'' then ''audio'' when kind=''screen'' then ''screen'' else ''video'' end where media_mode=''video'' and kind in (''voice'',''screen'')';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.live_sessions'::regclass
      and conname='live_sessions_media_mode_check'
  ) then
    alter table public.live_sessions
      add constraint live_sessions_media_mode_check
      check (media_mode in ('video','audio','screen'));
  end if;
end $$;

-- The live guest workflow writes a 'requested' state. Remove only the existing
-- CHECK constraints that govern status on this table, then recreate one canonical
-- constraint with all states used by the backend. Keep all rows unchanged.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid='public.live_guests'::regclass
      and contype='c'
      and (
        conname in ('live_guests_status_check','live_guets_sttus_check')
        or pg_get_constraintdef(oid) ilike 'CHECK ((status = ANY (%'
        or pg_get_constraintdef(oid) ilike 'CHECK (status = ANY (%'
        or pg_get_constraintdef(oid) ilike 'CHECK ((status IN (%'
        or pg_get_constraintdef(oid) ilike 'CHECK (status IN (%'
      )
  loop
    execute format('alter table public.live_guests drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.live_guests
  add constraint live_guests_status_check
  check (status in ('requested','invited','accepted','rejected','removed','left'));

alter table public.live_guests
  add column if not exists created_at timestamptz not null default now();
alter table public.live_guests
  add column if not exists updated_at timestamptz not null default now();
create index if not exists live_guests_request_queue_idx
  on public.live_guests(live_id, status, created_at);

-- Per-account visual preferences: theme, layout, font, text scale and accent.
-- Existing RLS policies on user_settings continue to restrict a row to its owner.
alter table public.user_settings
  add column if not exists appearance jsonb not null default
    '{"theme":"dark","layout":"classic","font":"system","scale":"1","accent":"violet"}'::jsonb;

comment on column public.live_sessions.audience is
  'Who may view the LIVE: public, followers, or invited guests/moderators for private rooms.';
comment on column public.live_sessions.media_mode is
  'Authoritative LIVE media mode: video (camera+microphone), audio (microphone only), or screen (screen capture only).';
comment on column public.user_settings.appearance is
  'Owner-controlled visual preferences. Values affect presentation only and never pricing, assets or authorization.';

notify pgrst, 'reload schema';
commit;
