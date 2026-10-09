-- =====================================================================
-- Creator Hub Live — Multi-Currency Wallet, Payments, Gifts & Diamonds
-- Authoritative server-side ledger. NEVER mutate balances in the frontend.
-- =====================================================================

-- Wallets: one coin wallet + one diamond wallet per user.
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coin_balance   bigint not null default 0 check (coin_balance >= 0),
  diamond_balance bigint not null default 0 check (diamond_balance >= 0),
  updated_at timestamptz not null default now()
);

-- Coin ledger: every coin movement is auditable. Append-only.
create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null,             
  balance_before bigint not null,
  balance_after bigint not null,
  source text not null,              
  status text not null default 'completed',
  provider text,                     
  reference text,                    
  reason text,
  idempotency_key text unique,       
  created_at timestamptz not null default now()
);
create index if not exists coin_ledger_user_idx on public.coin_ledger(user_id, created_at desc);

-- Diamond ledger: creator earnings. Append-only.
create table if not exists public.diamond_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null,
  balance_before bigint not null,
  balance_after bigint not null,
  source text not null,              
  reference text,
  exchange_rate numeric(18,8),       
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create index if not exists diamond_ledger_user_idx on public.diamond_ledger(user_id, created_at desc);

-- Coin packages: admin-configurable with multi-currency support (Created first so payments FK resolves).
create table if not exists public.coin_packages (
  id uuid primary key default gen_random_uuid(),
  coins bigint not null,
  price numeric(18,2) not null,
  currency text not null default 'USD',
  active boolean not null default true,
  sort int not null default 0
);
create index if not exists coin_packages_lookup_idx on public.coin_packages(coins, currency, active);

-- PayPal orders: track lifecycle; one credit per capture (idempotent).
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'paypal',
  provider_order_id text unique not null,
  provider_capture_id text unique,
  package_id uuid references public.coin_packages(id),
  package_coins bigint not null,
  amount numeric(18,2) not null,
  currency text not null,
  exchange_rate numeric(18,8),
  status text not null default 'created' check (status in ('created','approved','completed','failed','cancelled','pending','refunded')),
  credited boolean not null default false,
  metadata jsonb,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Gifts catalog
create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,     
  graphic_url text,
  animation_url text,
  coin_price bigint not null check (coin_price > 0),
  diamond_value bigint not null check (diamond_value >= 0),
  rarity text not null default 'regular',
  active boolean not null default true
);

-- Gift transactions
create table if not exists public.gift_transactions (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gifts(id),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  live_id uuid,
  coin_cost bigint not null,
  diamond_value bigint not null,
  idempotency_key text,
  created_at timestamptz not null default now()
);
create unique index if not exists gift_transactions_idempotency_idx on public.gift_transactions(idempotency_key) where idempotency_key is not null;

-- Diamond withdrawals
create table if not exists public.diamond_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  reference text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.diamond_withdrawals enable row level security;
drop policy if exists diamond_withdrawals_read on public.diamond_withdrawals;
create policy diamond_withdrawals_read on public.diamond_withdrawals for select using (user_id=auth.uid());

-- =====================================================================
-- FUNCTIONS (Security Definer Ledger & Wallets)
-- =====================================================================

create or replace function public.credit_coins(
  p_user uuid, p_amount bigint, p_source text, p_provider text,
  p_reference text, p_reason text, p_idempotency_key text)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare before bigint; after bigint; w public.wallets;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if exists (select 1 from public.coin_ledger where idempotency_key = p_idempotency_key) then
    select * into w from public.wallets where user_id = p_user; return w;
  end if;
  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  select coin_balance into before from public.wallets where user_id = p_user for update;
  after := before + p_amount;
  update public.wallets set coin_balance = after, updated_at = now() where user_id = p_user;
  insert into public.coin_ledger(user_id,amount,balance_before,balance_after,source,provider,reference,reason,idempotency_key)
    values (p_user,p_amount,before,after,p_source,p_provider,p_reference,p_reason,p_idempotency_key);
  select * into w from public.wallets where user_id = p_user; return w;
end; $$;

create or replace function public.debit_coins(
  p_user uuid, p_amount bigint, p_source text, p_reference text, p_reason text, p_idempotency_key text)
returns public.wallets language plpgsql security definer set search_path=public as $$
declare before_balance bigint; after_balance bigint; w public.wallets;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then raise exception 'idempotency key required'; end if;
  if exists(select 1 from public.coin_ledger where idempotency_key=p_idempotency_key) then
    select * into w from public.wallets where user_id=p_user; return w;
  end if;
  insert into public.wallets(user_id) values(p_user) on conflict do nothing;
  select coin_balance into before_balance from public.wallets where user_id=p_user for update;
  if before_balance < p_amount then raise exception 'insufficient coins'; end if;
  after_balance := before_balance - p_amount;
  update public.wallets set coin_balance = after_balance, updated_at = now() where user_id = p_user;
  insert into public.coin_ledger(user_id,amount,balance_before,balance_after,source,reference,reason,idempotency_key)
    values(p_user,-p_amount,before_balance,after_balance,p_source,p_reference,p_reason,p_idempotency_key);
  select * into w from public.wallets where user_id=p_user; return w;
end; $$;

create or replace function public.send_gift(
  p_sender uuid, p_recipient uuid, p_gift uuid, p_live uuid, p_idempotency_key text default null)
returns public.gift_transactions language plpgsql security definer set search_path=public as $$
declare g public.gifts; cb bigint; dbal bigint; tx public.gift_transactions;
begin
  if p_sender = p_recipient then raise exception 'cannot gift yourself'; end if;
  if p_idempotency_key is not null then
    select * into tx from public.gift_transactions where idempotency_key=p_idempotency_key limit 1;
    if tx.id is not null then return tx; end if;
  end if;
  select * into g from public.gifts where id=p_gift and active=true;
  if g is null then raise exception 'gift not available'; end if;
  insert into public.wallets(user_id) values(p_sender) on conflict do nothing;
  insert into public.wallets(user_id) values(p_recipient) on conflict do nothing;
  select coin_balance into cb from public.wallets where user_id=p_sender for update;
  if cb < g.coin_price then raise exception 'insufficient coins'; end if;
  update public.wallets set coin_balance=cb-g.coin_price, updated_at=now() where user_id=p_sender;
  insert into public.coin_ledger(user_id,amount,balance_before,balance_after,source,reference,reason,idempotency_key)
    values(p_sender,-g.coin_price,cb,cb-g.coin_price,'gift_sent',g.id::text,g.name,coalesce(p_idempotency_key,'gift:'||gen_random_uuid()::text));
  select diamond_balance into dbal from public.wallets where user_id=p_recipient for update;
  update public.wallets set diamond_balance=dbal+g.diamond_value, lifetime_gifts_sent=lifetime_gifts_sent+1, updated_at=now() where user_id=p_recipient;
  insert into public.gift_transactions(gift_id,sender_id,recipient_id,live_id,coin_cost,diamond_value,idempotency_key)
    values(g.id,p_sender,p_recipient,p_live,g.coin_price,g.diamond_value,p_idempotency_key) returning * into tx;
  insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference)
    values(p_recipient,g.diamond_value,dbal,dbal+g.diamond_value,'gift_received',tx.id::text);
  return tx;
end; $$;

create or replace function public.request_diamond_withdrawal(p_user uuid, p_amount bigint, p_reference text)
returns public.diamond_withdrawals language plpgsql security definer set search_path=public as $$
declare before_balance bigint; row public.diamond_withdrawals;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if exists(select 1 from public.diamond_withdrawals where reference=p_reference) then
    select * into row from public.diamond_withdrawals where reference=p_reference; return row;
  end if;
  insert into public.wallets(user_id) values(p_user) on conflict do nothing;
  select diamond_balance into before_balance from public.wallets where user_id=p_user for update;
  if before_balance < p_amount then raise exception 'insufficient diamonds'; end if;
  update public.wallets set diamond_balance=before_balance-p_amount, updated_at=now() where user_id=p_user;
  insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference)
    values(p_user, -p_amount, before_balance, before_balance-p_amount, 'payout', p_reference);
  insert into public.diamond_withdrawals(user_id,amount,reference) values(p_user, p_amount, p_reference) returning * into row;
  return row;
end; $$;

-- Security revokes
revoke all on function public.credit_coins(uuid,bigint,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.send_gift(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.debit_coins(uuid,bigint,text,text,text,text) from public,anon,authenticated;
revoke all on function public.request_diamond_withdrawal(uuid,bigint,text) from public,anon,authenticated;
