-- Creator Hub Creator Network — persistent appearance preferences.
-- Existing migration 0025 is the approved gift catalogue pricing migration and
-- 0026 is the LIVE room upgrade; therefore appearance is migration 0027.
-- Safe defaults only; no profiles, settings rows, or activity are fabricated.
-- Back up the target database and apply after migrations 0001–0026.

begin;

do $$
begin
  if to_regclass('public.user_settings') is null then
    raise exception '0027 prerequisites missing: apply migrations through 0023_settings_schedules_analytics.sql first.';
  end if;
end;
$$;

-- Add the account preference field without replacing any existing settings.
alter table public.user_settings
  add column if not exists appearance jsonb;

update public.user_settings
set appearance = '{"layout":"balanced","theme":"system"}'::jsonb
where appearance is null;

alter table public.user_settings
  alter column appearance set default '{"layout":"balanced","theme":"system"}'::jsonb;
alter table public.user_settings
  alter column appearance set not null;

-- Persist only supported values used by the existing Appearance settings page.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_appearance_contract'
      and conrelid = 'public.user_settings'::regclass
  ) then
    alter table public.user_settings
      add constraint user_settings_appearance_contract
      check (
        jsonb_typeof(appearance) = 'object'
        and appearance->>'layout' in ('compact', 'balanced', 'spacious')
        and appearance->>'theme' in ('dark', 'light', 'system')
      );
  end if;
end;
$$;

-- Migration 0023 already defines owner-scoped RLS policies for user_settings.
-- This grant is additive and retains any existing delete permission.
grant select,insert,update on public.user_settings to authenticated;

notify pgrst, 'reload schema';
commit;
