-- Creator Hub Live — repair wallet/payout/team schema contracts used by the API.
-- Safe, forward-only, idempotent DDL. No balances or historical transactions are reset.

begin;

-- Existing installations may have the original schema without these API-required fields.
alter table public.wallets
  add column if not exists lifetime_gifts_sent bigint not null default 0;
update public.wallets set lifetime_gifts_sent = 0 where lifetime_gifts_sent is null;
alter table public.wallets alter column lifetime_gifts_sent set default 0;
alter table public.wallets alter column lifetime_gifts_sent set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.wallets'::regclass and conname = 'wallets_lifetime_gifts_sent_nonnegative') then
    alter table public.wallets add constraint wallets_lifetime_gifts_sent_nonnegative check (lifetime_gifts_sent >= 0) not valid;
    alter table public.wallets validate constraint wallets_lifetime_gifts_sent_nonnegative;
  end if;
end $$;
do $$ begin
  -- Avoid a second unique index when the standard user_id primary key exists.
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.wallets'::regclass and i.indisunique and i.indisvalid
      and i.indnkeyatts = 1 and pg_get_indexdef(i.indexrelid, 1, true) = 'user_id'
  ) then
    create unique index wallets_user_id_unique_idx on public.wallets(user_id);
  end if;
end $$;

alter table public.payments add column if not exists idempotency_key text;
do $$ begin
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.payments'::regclass and i.indisunique and i.indisvalid
      and i.indnkeyatts = 1 and pg_get_indexdef(i.indexrelid, 1, true) = 'idempotency_key'
  ) then
    create unique index payments_idempotency_key_unique_idx on public.payments(idempotency_key) where idempotency_key is not null;
  end if;
end $$;

alter table public.gift_transactions add column if not exists idempotency_key text;
do $$ begin
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.gift_transactions'::regclass and i.indisunique and i.indisvalid
      and i.indnkeyatts = 1 and pg_get_indexdef(i.indexrelid, 1, true) = 'idempotency_key'
  ) then
    create unique index gift_transactions_idempotency_key_unique_idx on public.gift_transactions(idempotency_key) where idempotency_key is not null;
  end if;
end $$;

-- PayPal email is a creator-owned setting. The API, not the browser, writes it.
create table if not exists public.paypal_payout_info (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  paypal_email text not null,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paypal_payout_info_email_nonempty check (length(trim(paypal_email)) > 0)
);
alter table public.paypal_payout_info add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.paypal_payout_info add column if not exists paypal_email text;
alter table public.paypal_payout_info add column if not exists is_verified boolean not null default false;
alter table public.paypal_payout_info add column if not exists created_at timestamptz not null default now();
alter table public.paypal_payout_info add column if not exists updated_at timestamptz not null default now();
do $$ begin
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.paypal_payout_info'::regclass and i.indisunique and i.indisvalid
      and i.indnkeyatts = 1 and pg_get_indexdef(i.indexrelid, 1, true) = 'user_id'
  ) then
    create unique index paypal_payout_info_user_id_unique_idx on public.paypal_payout_info(user_id);
  end if;
end $$;
alter table public.paypal_payout_info enable row level security;
revoke all on table public.paypal_payout_info from anon, authenticated;
grant all on table public.paypal_payout_info to service_role;

-- Payout requests reserve diamonds until paid or rejected. Fiat values are set by
-- an authorized administrator; the app never invents an exchange rate.
create table if not exists public.diamond_payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  diamond_amount bigint not null check (diamond_amount > 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  paypal_email text not null,
  fiat_amount numeric(18,2),
  fiat_currency text,
  admin_note text,
  payment_reference text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  rejected_at timestamptz,
  check ((fiat_amount is null) or fiat_amount > 0),
  check ((fiat_currency is null) or fiat_currency ~ '^[A-Z]{3}$')
);
alter table public.diamond_payout_requests add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.diamond_payout_requests add column if not exists diamond_amount bigint;
alter table public.diamond_payout_requests add column if not exists status text not null default 'pending';
alter table public.diamond_payout_requests add column if not exists paypal_email text;
alter table public.diamond_payout_requests add column if not exists fiat_amount numeric(18,2);
alter table public.diamond_payout_requests add column if not exists fiat_currency text;
alter table public.diamond_payout_requests add column if not exists admin_note text;
alter table public.diamond_payout_requests add column if not exists payment_reference text;
alter table public.diamond_payout_requests add column if not exists idempotency_key text;
alter table public.diamond_payout_requests add column if not exists created_at timestamptz not null default now();
alter table public.diamond_payout_requests add column if not exists updated_at timestamptz not null default now();
alter table public.diamond_payout_requests add column if not exists paid_at timestamptz;
alter table public.diamond_payout_requests add column if not exists rejected_at timestamptz;
do $$ begin
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.diamond_payout_requests'::regclass and i.indisunique and i.indisvalid
      and i.indnkeyatts = 1 and pg_get_indexdef(i.indexrelid, 1, true) = 'idempotency_key'
  ) then
    create unique index diamond_payout_idempotency_unique_idx on public.diamond_payout_requests(idempotency_key) where idempotency_key is not null;
  end if;
end $$;
create index if not exists diamond_payout_user_created_idx
  on public.diamond_payout_requests(user_id, created_at desc);
create index if not exists diamond_payout_status_created_idx
  on public.diamond_payout_requests(status, created_at desc);
alter table public.diamond_payout_requests enable row level security;
revoke all on table public.diamond_payout_requests from anon, authenticated;
grant all on table public.diamond_payout_requests to service_role;

-- Auditable currency exchanges with a global idempotency key.
create table if not exists public.wallet_conversion_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null unique,
  direction text not null check (direction in ('coins_to_diamonds','diamonds_to_coins')),
  amount_in bigint not null check (amount_in > 0),
  amount_out bigint not null check (amount_out > 0),
  created_at timestamptz not null default now()
);
create index if not exists wallet_conversion_user_created_idx
  on public.wallet_conversion_transactions(user_id, created_at desc);
alter table public.wallet_conversion_transactions enable row level security;
revoke all on table public.wallet_conversion_transactions from anon, authenticated;
grant all on table public.wallet_conversion_transactions to service_role;

-- SECURITY DEFINER RPCs are callable by the API service role only. The API derives
-- user IDs from a verified Supabase session and never accepts a caller-supplied owner.
create or replace function public.create_team(p_owner_id uuid, p_name text)
returns public.teams
language plpgsql security definer set search_path = public as $$
declare v_name text; v_team public.teams;
begin
  if p_owner_id is null or not exists (select 1 from public.profiles where id = p_owner_id) then
    raise exception using message = 'TEAM_OWNER_INVALID', errcode = '22023';
  end if;
  v_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(v_name) < 3 or char_length(v_name) > 40 then
    raise exception using message = 'TEAM_NAME_INVALID', errcode = '22023';
  end if;
  insert into public.teams(name, owner_id, level, points)
    values (v_name, p_owner_id, 1, 0) returning * into v_team;
  insert into public.team_members(team_id, user_id, role)
    values (v_team.id, p_owner_id, 'owner');
  return v_team;
exception when unique_violation then
  raise exception using message = 'TEAM_NAME_TAKEN', errcode = '23505';
end;
$$;

create or replace function public.join_team(p_user_id uuid, p_team_id uuid)
returns public.team_members
language plpgsql security definer set search_path = public as $$
declare v_member public.team_members;
begin
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception using message = 'TEAM_MEMBER_INVALID', errcode = '22023';
  end if;
  perform 1 from public.teams where id = p_team_id;
  if not found then raise exception using message = 'TEAM_NOT_FOUND', errcode = 'P0002'; end if;
  insert into public.team_members(team_id, user_id, role)
    values (p_team_id, p_user_id, 'member') on conflict (team_id, user_id) do nothing;
  select * into v_member from public.team_members where team_id = p_team_id and user_id = p_user_id;
  return v_member;
end;
$$;

create or replace function public.leave_team(p_user_id uuid, p_team_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_team public.teams;
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception using message = 'TEAM_NOT_FOUND', errcode = 'P0002'; end if;
  if v_team.owner_id = p_user_id then
    raise exception using message = 'TEAM_OWNER_CANNOT_LEAVE', errcode = '55000';
  end if;
  delete from public.team_members where team_id = p_team_id and user_id = p_user_id;
  if not found then raise exception using message = 'TEAM_MEMBERSHIP_NOT_FOUND', errcode = 'P0002'; end if;
end;
$$;

create or replace function public.convert_wallet_currency(
  p_user_id uuid,
  p_direction text,
  p_amount bigint,
  p_coins_per_diamond bigint,
  p_diamonds_per_coin bigint,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_wallet public.wallets;
  v_existing public.wallet_conversion_transactions;
  v_out bigint;
  v_coin_after bigint;
  v_diamond_after bigint;
  v_coin_key text;
  v_diamond_key text;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 or p_amount > 1000000000 then
    raise exception using message = 'INVALID_CONVERSION_AMOUNT', errcode = '22023';
  end if;
  if p_direction not in ('coins_to_diamonds','diamonds_to_coins') then
    raise exception using message = 'INVALID_CONVERSION_DIRECTION', errcode = '22023';
  end if;
  if p_coins_per_diamond is null or p_diamonds_per_coin is null
     or p_coins_per_diamond < 1 or p_diamonds_per_coin < 1
     or p_coins_per_diamond > 1000000 or p_diamonds_per_coin > 1000000 then
    raise exception using message = 'WALLET_CONVERSION_RATE_NOT_CONFIGURED', errcode = '22023';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(p_idempotency_key) > 200 then
    raise exception using message = 'CONVERSION_IDEMPOTENCY_REQUIRED', errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 19));
  select * into v_existing from public.wallet_conversion_transactions where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.user_id <> p_user_id or v_existing.direction <> p_direction or v_existing.amount_in <> p_amount then
      raise exception using message = 'IDEMPOTENCY_CONFLICT', errcode = '23505';
    end if;
    select * into v_wallet from public.wallets where user_id = p_user_id;
    return jsonb_build_object('replayed', true, 'coinBalance', coalesce(v_wallet.coin_balance, 0), 'diamondBalance', coalesce(v_wallet.diamond_balance, 0), 'direction', v_existing.direction, 'amountIn', v_existing.amount_in, 'amountOut', v_existing.amount_out);
  end if;
  insert into public.wallets(user_id) values(p_user_id) on conflict (user_id) do nothing;
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if p_direction = 'coins_to_diamonds' then
    if mod(p_amount, p_coins_per_diamond) <> 0 then
      raise exception using message = 'CONVERSION_AMOUNT_MULTIPLE_REQUIRED', errcode = '22023';
    end if;
    v_out := p_amount / p_coins_per_diamond;
    if v_wallet.coin_balance < p_amount then raise exception using message = 'insufficient coins', errcode = '22023'; end if;
    v_coin_after := v_wallet.coin_balance - p_amount;
    v_diamond_after := v_wallet.diamond_balance + v_out;
    v_coin_key := 'conversion:c2d:debit:' || p_idempotency_key;
    v_diamond_key := 'conversion:c2d:credit:' || p_idempotency_key;
    update public.wallets set coin_balance = v_coin_after, diamond_balance = v_diamond_after, updated_at = now() where user_id = p_user_id;
    insert into public.coin_ledger(user_id,amount,balance_before,balance_after,source,reference,reason,idempotency_key)
      values(p_user_id,-p_amount,v_wallet.coin_balance,v_coin_after,'conversion',p_idempotency_key,'Coins converted to diamonds',v_coin_key);
    insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference,exchange_rate,idempotency_key)
      values(p_user_id,v_out,v_wallet.diamond_balance,v_diamond_after,'conversion',p_idempotency_key,1.0 / p_coins_per_diamond,v_diamond_key);
  else
    if mod(p_amount, p_diamonds_per_coin) <> 0 then
      raise exception using message = 'CONVERSION_AMOUNT_MULTIPLE_REQUIRED', errcode = '22023';
    end if;
    v_out := p_amount / p_diamonds_per_coin;
    if v_wallet.diamond_balance < p_amount then raise exception using message = 'insufficient diamonds', errcode = '22023'; end if;
    v_coin_after := v_wallet.coin_balance + v_out;
    v_diamond_after := v_wallet.diamond_balance - p_amount;
    v_coin_key := 'conversion:d2c:credit:' || p_idempotency_key;
    v_diamond_key := 'conversion:d2c:debit:' || p_idempotency_key;
    update public.wallets set coin_balance = v_coin_after, diamond_balance = v_diamond_after, updated_at = now() where user_id = p_user_id;
    insert into public.coin_ledger(user_id,amount,balance_before,balance_after,source,reference,reason,idempotency_key)
      values(p_user_id,v_out,v_wallet.coin_balance,v_coin_after,'conversion',p_idempotency_key,'Diamonds converted to coins',v_coin_key);
    insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference,exchange_rate,idempotency_key)
      values(p_user_id,-p_amount,v_wallet.diamond_balance,v_diamond_after,'conversion',p_idempotency_key,p_diamonds_per_coin,v_diamond_key);
  end if;
  insert into public.wallet_conversion_transactions(user_id,idempotency_key,direction,amount_in,amount_out)
    values(p_user_id,p_idempotency_key,p_direction,p_amount,v_out);
  return jsonb_build_object('replayed', false, 'coinBalance', v_coin_after, 'diamondBalance', v_diamond_after, 'direction', p_direction, 'amountIn', p_amount, 'amountOut', v_out);
end;
$$;

create or replace function public.request_diamond_payout(
  p_user_id uuid,
  p_diamond_amount bigint,
  p_paypal_email text,
  p_idempotency_key text
) returns public.diamond_payout_requests
language plpgsql security definer set search_path = public as $$
declare
  v_wallet public.wallets;
  v_existing public.diamond_payout_requests;
  v_request public.diamond_payout_requests;
  v_email text;
  v_after bigint;
begin
  if p_user_id is null or p_diamond_amount is null or p_diamond_amount <= 0 or p_diamond_amount > 1000000000 then
    raise exception using message = 'INVALID_DIAMOND_AMOUNT', errcode = '22023';
  end if;
  v_email := lower(trim(coalesce(p_paypal_email, '')));
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using message = 'PAYPAL_PAYOUT_NOT_CONFIGURED', errcode = '22023';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(p_idempotency_key) > 200 then
    raise exception using message = 'PAYOUT_IDEMPOTENCY_REQUIRED', errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 31));
  select * into v_existing from public.diamond_payout_requests where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.user_id <> p_user_id or v_existing.diamond_amount <> p_diamond_amount or v_existing.paypal_email <> v_email then
      raise exception using message = 'IDEMPOTENCY_CONFLICT', errcode = '23505';
    end if;
    return v_existing;
  end if;
  insert into public.wallets(user_id) values(p_user_id) on conflict (user_id) do nothing;
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if v_wallet.diamond_balance < p_diamond_amount then
    raise exception using message = 'insufficient diamonds', errcode = '22023';
  end if;
  v_after := v_wallet.diamond_balance - p_diamond_amount;
  update public.wallets set diamond_balance = v_after, updated_at = now() where user_id = p_user_id;
  insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference,idempotency_key)
    values(p_user_id,-p_diamond_amount,v_wallet.diamond_balance,v_after,'payout',p_idempotency_key,'payout:' || p_idempotency_key);
  insert into public.diamond_payout_requests(user_id,diamond_amount,status,paypal_email,idempotency_key)
    values(p_user_id,p_diamond_amount,'pending',v_email,p_idempotency_key) returning * into v_request;
  return v_request;
end;
$$;

create or replace function public.admin_review_diamond_payout(
  p_request_id uuid,
  p_admin_id uuid,
  p_action text,
  p_fiat_amount numeric,
  p_fiat_currency text,
  p_admin_note text,
  p_payment_reference text
) returns public.diamond_payout_requests
language plpgsql security definer set search_path = public as $$
declare
  v_request public.diamond_payout_requests;
  v_wallet public.wallets;
  v_after bigint;
  v_currency text;
  v_reference text;
begin
  if not coalesce((select is_admin from public.profiles where id = p_admin_id), false) then
    raise exception using message = 'ADMIN_REQUIRED', errcode = '42501';
  end if;
  if p_action is null or p_action not in ('approve','reject','mark_paid') then
    raise exception using message = 'INVALID_PAYOUT_ACTION', errcode = '22023';
  end if;
  select * into v_request from public.diamond_payout_requests where id = p_request_id for update;
  if not found then raise exception using message = 'PAYOUT_NOT_FOUND', errcode = 'P0002'; end if;
  if p_action = 'approve' then
    v_currency := upper(trim(coalesce(p_fiat_currency,'')));
    if p_fiat_amount is null or p_fiat_amount <= 0 or round(p_fiat_amount,2) <> p_fiat_amount then
      raise exception using message = 'FIAT_AMOUNT_REQUIRED', errcode = '22023';
    end if;
    if v_currency !~ '^[A-Z]{3}$' then raise exception using message = 'FIAT_CURRENCY_REQUIRED', errcode = '22023'; end if;
    if v_request.status = 'approved' and v_request.fiat_amount = p_fiat_amount and v_request.fiat_currency = v_currency then return v_request; end if;
    if v_request.status <> 'pending' then raise exception using message = 'PAYOUT_STATE_CONFLICT', errcode = '55000'; end if;
    update public.diamond_payout_requests set status='approved',fiat_amount=p_fiat_amount,fiat_currency=v_currency,
      admin_note=nullif(left(trim(coalesce(p_admin_note,'')),1000),''),updated_at=now()
      where id=p_request_id returning * into v_request;
  elsif p_action = 'reject' then
    if v_request.status = 'rejected' then return v_request; end if;
    if v_request.status <> 'pending' then raise exception using message = 'PAYOUT_STATE_CONFLICT', errcode = '55000'; end if;
    insert into public.wallets(user_id) values(v_request.user_id) on conflict (user_id) do nothing;
    select * into v_wallet from public.wallets where user_id = v_request.user_id for update;
    v_after := v_wallet.diamond_balance + v_request.diamond_amount;
    update public.wallets set diamond_balance=v_after,updated_at=now() where user_id=v_request.user_id;
    insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference,idempotency_key)
      values(v_request.user_id,v_request.diamond_amount,v_wallet.diamond_balance,v_after,'payout_refund',v_request.id::text,'payout-refund:' || v_request.id::text)
      on conflict (idempotency_key) do nothing;
    update public.diamond_payout_requests set status='rejected',admin_note=nullif(left(trim(coalesce(p_admin_note,'')),1000),''),rejected_at=now(),updated_at=now()
      where id=p_request_id returning * into v_request;
  else
    v_reference := trim(coalesce(p_payment_reference,''));
    if length(v_reference) < 3 or length(v_reference) > 200 then
      raise exception using message = 'PAYMENT_REFERENCE_REQUIRED', errcode = '22023';
    end if;
    if v_request.status = 'paid' and v_request.payment_reference = v_reference then return v_request; end if;
    if v_request.status <> 'approved' then raise exception using message = 'PAYOUT_STATE_CONFLICT', errcode = '55000'; end if;
    if exists (select 1 from public.diamond_payout_requests where payment_reference = v_reference and id <> p_request_id) then
      raise exception using message = 'PAYMENT_REFERENCE_ALREADY_USED', errcode = '23505';
    end if;
    update public.diamond_payout_requests set status='paid',payment_reference=v_reference,
      admin_note=coalesce(nullif(left(trim(coalesce(p_admin_note,'')),1000),''),admin_note),paid_at=now(),updated_at=now()
      where id=p_request_id returning * into v_request;
  end if;
  return v_request;
end;
$$;

-- Correct the active gifts function for schema/idempotency consistency. The
-- sender's lifetime counter increments on sending, never on receiving.
create or replace function public.send_gift(
  p_sender uuid, p_recipient uuid, p_gift uuid, p_live uuid, p_idempotency_key text default null
) returns public.gift_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_gift public.gifts;
  v_sender_wallet public.wallets;
  v_recipient_wallet public.wallets;
  v_tx public.gift_transactions;
  v_sender_after bigint;
  v_recipient_after bigint;
begin
  if p_sender is null or p_recipient is null or p_sender = p_recipient then
    raise exception using message = 'cannot gift yourself', errcode = '22023';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(p_idempotency_key) > 200 then
    raise exception using message = 'GIFT_IDEMPOTENCY_REQUIRED', errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 47));
  select * into v_tx from public.gift_transactions where idempotency_key = p_idempotency_key;
  if found then
    if v_tx.sender_id <> p_sender or v_tx.recipient_id <> p_recipient or v_tx.gift_id <> p_gift or v_tx.live_id is distinct from p_live then
      raise exception using message = 'IDEMPOTENCY_CONFLICT', errcode = '23505';
    end if;
    return v_tx;
  end if;
  select * into v_gift from public.gifts where id = p_gift and active = true;
  if not found then raise exception using message = 'gift not available', errcode = 'P0002'; end if;
  if p_live is not null and not exists (select 1 from public.live_sessions where id=p_live) then
    raise exception using message = 'LIVE_ROOM_NOT_FOUND', errcode = 'P0002';
  end if;
  insert into public.wallets(user_id)
    select ids.user_id from unnest(array[p_sender,p_recipient]) as ids(user_id)
    order by ids.user_id on conflict (user_id) do nothing;
  perform 1 from public.wallets where user_id in (p_sender,p_recipient) order by user_id for update;
  select * into v_sender_wallet from public.wallets where user_id=p_sender;
  select * into v_recipient_wallet from public.wallets where user_id=p_recipient;
  if v_sender_wallet.coin_balance < v_gift.coin_price then raise exception using message = 'insufficient coins', errcode = '22023'; end if;
  v_sender_after := v_sender_wallet.coin_balance - v_gift.coin_price;
  v_recipient_after := v_recipient_wallet.diamond_balance + v_gift.diamond_value;
  update public.wallets set coin_balance=v_sender_after,lifetime_gifts_sent=lifetime_gifts_sent+1,updated_at=now() where user_id=p_sender;
  update public.wallets set diamond_balance=v_recipient_after,updated_at=now() where user_id=p_recipient;
  insert into public.coin_ledger(user_id,amount,balance_before,balance_after,source,provider,reference,reason,idempotency_key)
    values(p_sender,-v_gift.coin_price,v_sender_wallet.coin_balance,v_sender_after,'gift_sent',null,v_gift.id::text,v_gift.name,'gift:' || p_idempotency_key);
  insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference,idempotency_key)
    values(p_recipient,v_gift.diamond_value,v_recipient_wallet.diamond_balance,v_recipient_after,'gift_received',null,'gift-diamond:' || p_idempotency_key);
  insert into public.gift_transactions(gift_id,sender_id,recipient_id,live_id,coin_cost,diamond_value,idempotency_key)
    values(v_gift.id,p_sender,p_recipient,p_live,v_gift.coin_price,v_gift.diamond_value,p_idempotency_key) returning * into v_tx;
  return v_tx;
end;
$$;

-- Forward-fix the comment deletion policy here as well so installations that
-- already recorded an earlier 0038 version receive the corrected CHL policy.
drop policy if exists comments_del on public.comments;
create policy comments_del
  on public.comments
  for delete
  to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.posts as p
      where p.id = comments.post_id and p.author_id = auth.uid()
    )
  );

-- Public read remains permitted for teams; writes are performed through the
-- authenticated backend and restricted SECURITY DEFINER RPCs.
revoke all on function public.create_team(uuid,text) from public, anon, authenticated;
revoke all on function public.join_team(uuid,uuid) from public, anon, authenticated;
revoke all on function public.leave_team(uuid,uuid) from public, anon, authenticated;
revoke all on function public.convert_wallet_currency(uuid,text,bigint,bigint,bigint,text) from public, anon, authenticated;
revoke all on function public.request_diamond_payout(uuid,bigint,text,text) from public, anon, authenticated;
revoke all on function public.admin_review_diamond_payout(uuid,uuid,text,numeric,text,text,text) from public, anon, authenticated;
revoke all on function public.send_gift(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.create_team(uuid,text) to service_role;
grant execute on function public.join_team(uuid,uuid) to service_role;
grant execute on function public.leave_team(uuid,uuid) to service_role;
grant execute on function public.convert_wallet_currency(uuid,text,bigint,bigint,bigint,text) to service_role;
grant execute on function public.request_diamond_payout(uuid,bigint,text,text) to service_role;
grant execute on function public.admin_review_diamond_payout(uuid,uuid,text,numeric,text,text,text) to service_role;
grant execute on function public.send_gift(uuid,uuid,uuid,uuid,text) to service_role;

notify pgrst, 'reload schema';
commit;
