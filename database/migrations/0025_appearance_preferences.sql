-- Creator Hub Creator Network — 0025 synced appearance preferences.
-- Forward-only and idempotent. Requires 0021/0023 user_settings, then 0024 account controls.
-- Adds no accounts, user settings rows, or sample data.
begin;

do $$
begin
  if to_regclass('public.user_settings') is null then
    raise exception '0025 prerequisite missing: public.user_settings. Apply/reconcile 0021 and 0023 after preflight first.';
  end if;
end $$;

alter table public.user_settings
  add column if not exists appearance jsonb not null default '{"layout":"balanced","theme":"system"}'::jsonb;
alter table public.user_settings alter column appearance set default '{"layout":"balanced","theme":"system"}'::jsonb;
alter table public.user_settings alter column appearance set not null;

do $$
begin
  if exists (
    select 1 from public.user_settings
    where appearance is null
      or jsonb_typeof(appearance) <> 'object'
      or coalesce(appearance->>'layout','') not in ('compact','balanced','spacious')
      or coalesce(appearance->>'theme','') not in ('dark','light','system')
  ) then
    raise exception '0025 stopped: an existing user_settings.appearance value is not a supported layout/theme. Review those preference values intentionally before retrying.';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='user_settings_appearance_contract'
      and conrelid='public.user_settings'::regclass
  ) then
    alter table public.user_settings add constraint user_settings_appearance_contract check (
      jsonb_typeof(appearance)='object'
      and appearance->>'layout' in ('compact','balanced','spacious')
      and appearance->>'theme' in ('dark','light','system')
    ) not valid;
  end if;
end $$;
alter table public.user_settings validate constraint user_settings_appearance_contract;
-- Preserve existing own-row RLS policies; preferences remain account-owned.
grant select,insert,update on public.user_settings to authenticated;
notify pgrst, 'reload schema';
commit;
