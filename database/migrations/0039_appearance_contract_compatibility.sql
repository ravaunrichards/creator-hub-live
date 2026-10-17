-- Creator Hub Live — make account appearance sync compatible across client versions.
-- The Style Switcher writes the canonical mode/theme/typography/surfaces/density/
-- motion/contrast object. Older settings clients may still write the legacy
-- theme/layout/font/scale/accent object. Both are JSON objects, and the database
-- should not reject valid preferences just because a client version differs.
-- Apply this migration once to the intended Supabase project before retrying sync.

begin;

alter table public.user_settings
  add column if not exists appearance jsonb;

-- Preserve all valid object preferences. Clear only malformed non-object JSON
-- values so the new contract can be installed safely without deleting good data.
update public.user_settings
set appearance = null
where appearance is not null
  and jsonb_typeof(appearance) is distinct from 'object';

alter table public.user_settings
  drop constraint if exists user_settings_appearance_contract;

alter table public.user_settings
  add constraint user_settings_appearance_contract
  check (appearance is null or jsonb_typeof(appearance) = 'object');

comment on column public.user_settings.appearance is
  'Account-synced CHL appearance preferences. Accepts object-shaped preferences from supported client versions; clients normalize supported values.';

commit;
