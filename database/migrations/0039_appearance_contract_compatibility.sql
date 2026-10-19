-- Creator Hub Live — make account appearance sync compatible across client versions.
-- The live user_settings.appearance column is NOT NULL. Preserve all existing JSON
-- objects and relax only the obsolete value-specific theme/layout contract.
-- This migration has already been applied to the active Creator Hub Live Supabase
-- project. Apply it only to another environment where the old constraint remains.

alter table public.user_settings
  drop constraint if exists user_settings_appearance_contract;

alter table public.user_settings
  add constraint user_settings_appearance_contract
  check (jsonb_typeof(appearance) = 'object');

comment on column public.user_settings.appearance is
  'Account-synced CHL appearance preferences. Accepts object-shaped preferences from supported client versions; clients normalize supported values.';
