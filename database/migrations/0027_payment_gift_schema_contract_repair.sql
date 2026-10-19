-- Creator Hub Live: additive repair for payment and gift schema-cache errors.
-- Intended for the current main branch after migration 0026.
-- This file is a standalone repair package; it does NOT modify GitHub or production.
-- It does not change existing balances, payment amounts, transaction statuses, or gift prices.

begin;

do $$
begin
  if to_regclass('public.payments') is null then
    raise exception 'Schema repair stopped: public.payments does not exist. Apply the earlier wallet/payment migrations first.';
  end if;

  if to_regclass('public.coin_packages') is null then
    raise exception 'Schema repair stopped: public.coin_packages does not exist. Apply the earlier wallet/payment migrations first.';
  end if;

  if to_regclass('public.gifts') is null then
    raise exception 'Schema repair stopped: public.gifts does not exist. Apply the earlier gift migrations first.';
  end if;
end
$$;

-- These columns are part of the repository's payment contract (migration 0003).
-- Add only when missing; do not overwrite existing values or data.
alter table public.payments
  add column if not exists metadata jsonb;

alter table public.payments
  add column if not exists package_id uuid references public.coin_packages(id);

-- These columns are part of the current gift asset/audio contract (migration 0026).
alter table public.gifts
  add column if not exists asset_key text;

alter table public.gifts
  add column if not exists sound_url text;

-- Ask PostgREST/Supabase to refresh its schema cache after the DDL commits.
notify pgrst, 'reload schema';

commit;
