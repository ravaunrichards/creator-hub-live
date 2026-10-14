-- Creator Hub Creator Network — 0013 repair wallet/package schema contracts.
-- Safe to apply after the earlier migrations; does not create fake users or balances.

-- Correct the wallet fields expected by the server-side wallet/gift RPCs.
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coin_balance bigint not null default 0 check (coin_balance >= 0),
  diamond_balance bigint not null default 0 check (diamond_balance >= 0),
  lifetime_gifts_sent bigint not null default 0 check (lifetime_gifts_sent >= 0),
  updated_at timestamptz not null default now()
);
alter table public.wallets
  add column if not exists lifetime_gifts_sent bigint not null default 0;

-- Keep one active package per coin count and currency. Before adding the unique
-- index, repoint historical payments to a retained package and remove duplicates.
with ranked as (
  select cp.id,
         first_value(cp.id) over (
           partition by cp.coins, cp.currency
           order by
             (select count(*) from public.payments p where p.package_id = cp.id) desc,
             cp.id
         ) as keep_id,
         row_number() over (
           partition by cp.coins, cp.currency
           order by
             (select count(*) from public.payments p where p.package_id = cp.id) desc,
             cp.id
         ) as rn
  from public.coin_packages cp
  where cp.active = true
)
update public.payments p
set package_id = ranked.keep_id
from ranked
where p.package_id = ranked.id
  and ranked.rn > 1
  and ranked.keep_id is not null;

with ranked as (
  select cp.id,
         row_number() over (
           partition by cp.coins, cp.currency
           order by
             (select count(*) from public.payments p where p.package_id = cp.id) desc,
             cp.id
         ) as rn
  from public.coin_packages cp
  where cp.active = true
)
delete from public.coin_packages cp
using ranked
where cp.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists coin_packages_one_active_price
  on public.coin_packages(coins, currency)
  where active = true;

-- Ensure wallet ledger and payment tables have the columns used by the backend.
alter table public.payments
  add column if not exists idempotency_key text;
create unique index if not exists payments_idempotency_key_unique
  on public.payments(idempotency_key)
  where idempotency_key is not null;
