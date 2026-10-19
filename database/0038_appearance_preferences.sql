-- Creator Hub Live — optional account-synced appearance preference.
-- NULL means the account has not saved an appearance yet; this lets a guest
-- preference migrate on first sign-in without overwriting an existing choice.
alter table public.user_settings
  add column if not exists appearance jsonb;

comment on column public.user_settings.appearance is
  'CHL Style Switcher preference: mode, theme, typography, surfaces, density, motion and contrast.';
