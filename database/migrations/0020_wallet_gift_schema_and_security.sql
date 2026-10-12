-- Creator Hub Creator Network — 0020 wallet/gift schema and RPC security convergence.
-- Forward-only; apply after reviewing the full schema audit and migration history.
-- Does not seed accounts, balances, gifts, transactions or ledger entries.
-- This migration corrects a legacy wallet/gift contract used by existing server routes.

begin;

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.wallets') is null
     or to_regclass('public.coin_ledger') is null
     or to_regclass('public.diamond_ledger') is null
     or to_regclass('public.gifts') is null
     or to_regclass('public.gift_transactions') is null then
    raise exception '0020 prerequisites missing: profiles, wallets, coin_ledger, diamond_ledger, gifts and gift_transactions must exist. Review migrations 0001 and 0003.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='wallets' and column_name='user_id') then
    raise exception '0020 stopped: public.wallets.user_id is absent; wallet ownership cannot be inferred safely.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='gift_transactions' and column_name='sender_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='gift_transactions' and column_name='recipient_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='gift_transactions' and column_name='gift_id') then
    raise exception '0020 stopped: the core identity columns on public.gift_transactions do not match migration 0003. Reconcile schema before retrying.';
  end if;
end $$;

-- Missing legacy wallet fields receive defaults only when the columns are absent.
-- Existing NULL balances are ambiguous and intentionally stop the migration below;
-- the migration never overwrites an existing unknown balance with zero.
alter table public.wallets
  add column if not exists coin_balance bigint not null default 0,
  add column if not exists diamond_balance bigint not null default 0,
  add column if not exists lifetime_gifts_sent bigint not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.coin_ledger add column if not exists idempotency_key text;
alter table public.diamond_ledger add column if not exists idempotency_key text;
alter table public.gift_transactions add column if not exists idempotency_key text;

-- Never guess how to repair ambiguous financial records.
do $$
begin
  if exists (select 1 from public.wallets where user_id is null)
     or exists (select user_id from public.wallets group by user_id having count(*) > 1) then
    raise exception '0020 stopped: public.wallets has null or duplicate user_id rows. Reconcile account ownership before retrying.';
  end if;
  if exists (select 1 from public.wallets where coin_balance is null or diamond_balance is null or lifetime_gifts_sent is null)
     or exists (select 1 from public.wallets where coin_balance < 0 or diamond_balance < 0 or lifetime_gifts_sent < 0) then
    raise exception '0020 stopped: wallet balances or lifetime counts contain NULL/negative values. Review financial records explicitly; no balances were altered.';
  end if;
  if exists (select idempotency_key from public.gift_transactions where idempotency_key is not null group by idempotency_key having count(*) > 1) then
    raise exception '0020 stopped: duplicate non-null gift idempotency keys exist. Review transactions before enabling a uniqueness constraint.';
  end if;
  if exists (select idempotency_key from public.coin_ledger where idempotency_key is not null group by idempotency_key having count(*) > 1)
     or exists (select idempotency_key from public.diamond_ledger where idempotency_key is not null group by idempotency_key having count(*) > 1) then
    raise exception '0020 stopped: duplicate ledger idempotency keys exist. Reconcile them before retrying.';
  end if;
end $$;

alter table public.wallets alter column user_id set not null;
alter table public.wallets alter column coin_balance set default 0;
alter table public.wallets alter column coin_balance set not null;
alter table public.wallets alter column diamond_balance set default 0;
alter table public.wallets alter column diamond_balance set not null;
alter table public.wallets alter column lifetime_gifts_sent set default 0;
alter table public.wallets alter column lifetime_gifts_sent set not null;
alter table public.wallets alter column updated_at set default now();
alter table public.wallets alter column updated_at set not null;

create unique index if not exists wallets_user_id_uq on public.wallets(user_id);
create unique index if not exists coin_ledger_idempotency_key_uq on public.coin_ledger(idempotency_key) where idempotency_key is not null;
create unique index if not exists diamond_ledger_idempotency_key_uq on public.diamond_ledger(idempotency_key) where idempotency_key is not null;
create unique index if not exists gift_transactions_idempotency_key_uq on public.gift_transactions(idempotency_key) where idempotency_key is not null;

-- One gift key can only cause one coin debit and one recipient credit, including
-- concurrent retries. Wallet rows are locked in stable user-id order to reduce deadlocks.
create or replace function public.send_gift(
  p_sender uuid,
  p_recipient uuid,
  p_gift uuid,
  p_live uuid,
  p_idempotency_key text default null
) returns public.gift_transactions
language plpgsql security definer set search_path=public as $$
declare
  g public.gifts;
  sender_coin_balance bigint;
  sender_coin_after bigint;
  recipient_diamond_balance bigint;
  recipient_diamond_after bigint;
  tx public.gift_transactions;
  ledger_key text;
begin
  if p_sender is null or p_recipient is null then raise exception 'GIFT_USER_REQUIRED'; end if;
  if p_sender = p_recipient then raise exception 'CANNOT_GIFT_YOURSELF'; end if;
  if p_idempotency_key is not null then
    p_idempotency_key := trim(p_idempotency_key);
    if length(p_idempotency_key) < 8 then raise exception 'GIFT_IDEMPOTENCY_KEY_REQUIRED'; end if;
    perform pg_advisory_xact_lock(hashtextextended('gift:'||p_idempotency_key, 0));
    select * into tx from public.gift_transactions where idempotency_key=p_idempotency_key;
    if tx.id is not null then
      if tx.sender_id <> p_sender or tx.recipient_id <> p_recipient or tx.gift_id <> p_gift
         or tx.live_id is distinct from p_live then
        raise exception 'GIFT_IDEMPOTENCY_CONFLICT';
      end if;
      return tx;
    end if;
  end if;

  select * into g from public.gifts where id=p_gift and active=true for share;
  if g.id is null then raise exception 'GIFT_NOT_AVAILABLE'; end if;
  if g.coin_price is null or g.coin_price <= 0 or g.diamond_value is null or g.diamond_value < 0 then
    raise exception 'GIFT_CATALOG_INVALID';
  end if;

  insert into public.wallets(user_id) values(p_sender) on conflict(user_id) do nothing;
  insert into public.wallets(user_id) values(p_recipient) on conflict(user_id) do nothing;
  perform 1 from public.wallets
    where user_id in (p_sender,p_recipient)
    order by user_id
    for update;

  select coin_balance into sender_coin_balance from public.wallets where user_id=p_sender;
  select diamond_balance into recipient_diamond_balance from public.wallets where user_id=p_recipient;
  if sender_coin_balance < g.coin_price then raise exception 'INSUFFICIENT_COINS'; end if;
  sender_coin_after := sender_coin_balance-g.coin_price;
  recipient_diamond_after := recipient_diamond_balance+g.diamond_value;

  insert into public.gift_transactions(gift_id,sender_id,recipient_id,live_id,coin_cost,diamond_value,idempotency_key)
    values(g.id,p_sender,p_recipient,p_live,g.coin_price,g.diamond_value,p_idempotency_key)
    returning * into tx;

  update public.wallets set coin_balance=sender_coin_after,
    lifetime_gifts_sent=lifetime_gifts_sent+1, updated_at=now()
    where user_id=p_sender;
  update public.wallets set diamond_balance=recipient_diamond_after, updated_at=now()
    where user_id=p_recipient;

  ledger_key := 'gift-sent:'||coalesce(p_idempotency_key,gen_random_uuid()::text);
  insert into public.coin_ledger(user_id,amount,balance_before,balance_after,source,reference,reason,idempotency_key)
    values(p_sender,-g.coin_price,sender_coin_balance,sender_coin_after,'gift_sent',tx.id::text,g.name,ledger_key);
  insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference,idempotency_key)
    values(p_recipient,g.diamond_value,recipient_diamond_balance,recipient_diamond_after,'gift_received',tx.id::text,'gift-received:'||tx.id::text);
  return tx;
end;
$$;

-- Ledger/RPC functions accept user IDs as arguments and use SECURITY DEFINER. They
-- must only be invokable by the trusted backend service role, never by browser roles.
revoke all on function public.credit_coins(uuid,bigint,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.debit_coins(uuid,bigint,text,text,text,text) from public, anon, authenticated;
revoke all on function public.send_gift(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.request_diamond_withdrawal(uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.credit_coins(uuid,bigint,text,text,text,text,text) to service_role;
grant execute on function public.debit_coins(uuid,bigint,text,text,text,text) to service_role;
grant execute on function public.send_gift(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.request_diamond_withdrawal(uuid,bigint,text) to service_role;

notify pgrst, 'reload schema';
commit;
