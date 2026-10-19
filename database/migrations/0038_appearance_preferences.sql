-- Creator Hub Live — canonical per-account appearance preferences.
-- The Style Switcher persists an owner-controlled visual preference object on
-- public.user_settings.appearance. This migration is idempotent and may run on
-- a fresh database (where the column does not yet exist) or on an environment
-- where migration 0028 already added the column as NOT NULL with a default.
--
-- Design decision: appearance is NULLABLE here. A NULL value is meaningful —
-- NULL means the account has not saved an appearance yet, so the client should
-- fall back to its on-device default instead of overwriting a never-saved
-- server row. Supported client versions normalize object-shaped values; the
-- obsolete value-specific contract is relaxed by 0039 (compatibility).
--
-- Manual-install migration. No existing saved appearance JSON is deleted or
-- rewritten; see the explicit assertion in 0039 that no row is set to NULL.

begin;

do $$
begin
  if to_regclass('public.user_settings') is null then
    raise exception '0038 prerequisite missing: public.user_settings must exist (apply 0011/0023 first).';
  end if;
end $$;

-- Create the column when absent. On a fresh database this is nullable from the
-- start; existing databases keep their current data untouched.
alter table public.user_settings
  add column if not exists appearance jsonb;

-- Relax the legacy NOT NULL / default so an unsaved account is represented by
-- NULL rather than a server-injected default. This does NOT change any row that
-- already stores an appearance object.
alter table public.user_settings
  alter column appearance drop not null;

alter table public.user_settings
  alter column appearance drop default;

comment on column public.user_settings.appearance is
  'Owner-controlled visual preferences (theme, layout, font, text scale, accent). NULL means the account has not saved an appearance yet, so clients keep their on-device default. Values affect presentation only and never pricing, assets or authorization.';

notify pgrst, 'reload schema';
commit;
