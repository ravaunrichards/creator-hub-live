-- =====================================================================
-- Creator Hub Live — Wallet, PayPal payments, gifts, diamonds correction
-- =====================================================================

alter table public.wallets add column if not exists lifetime_gifts_sent bigint not null default 0 check (lifetime_gifts_sent >= 0);
alter table public.gift_transactions add column if not exists idempotency_key text;
create unique index if not exists gift_transactions_idempotency_idx on public.gift_transactions(idempotency_key) where idempotency_key is not null;

-- Align payments table with backend expectations if package_id / metadata are used
alter table public.payments 
  add column if not exists package_id uuid references public.coin_packages(id),
  add column if not exists metadata jsonb;

create or replace function public.send_gift(
  p_sender uuid, p_recipient uuid, p_gift uuid, p_live uuid, p_idempotency_key text default null)
returns public.gift_transactions language plpgsql security definer set search_path=public as $$ declare g public.gifts; cb bigint; dbal bigint; tx public.gift_transactions; begin   if p_sender = p_recipient then raise exception 'cannot gift yourself'; end if;   if p_idempotency_key is not null then     select * into tx from public.gift_transactions where idempotency_key=p_idempotency_key limit 1;     if tx.id is not null then return tx; end if;   end if;   select * into g from public.gifts where id=p_gift and active=true;   if g is null then raise exception 'gift not available'; end if;   insert into public.wallets(user_id) values(p_sender) on conflict do nothing;   insert into public.wallets(user_id) values(p_recipient) on conflict do nothing;   select coin_balance into cb from public.wallets where user_id=p_sender for update;   if cb < g.coin_price then raise exception 'insufficient coins'; end if;   update public.wallets set coin_balance=cb-g.coin_price, updated_at=now() where user_id=p_sender;   insert into public.coin_ledger(user_id,amount,balance_before,balance_after,source,reference,reason,idempotency_key)     values(p_sender,-g.coin_price,cb,cb-g.coin_price,'gift_sent',g.id::text,g.name,coalesce(p_idempotency_key,'gift:'\vert{}\vert{}gen_random_uuid()::text));   select diamond_balance into dbal from public.wallets where user_id=p_recipient for update;   update public.wallets set diamond_balance=dbal+g.diamond_value, lifetime_gifts_sent=lifetime_gifts_sent+1, updated_at=now() where user_id=p_recipient;   insert into public.gift_transactions(gift_id,sender_id,recipient_id,live_id,coin_cost,diamond_value,idempotency_key)     values(g.id,p_sender,p_recipient,p_live,g.coin_price,g.diamond_value,p_idempotency_key) returning * into tx;   insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference)     values(p_recipient,g.diamond_value,dbal,dbal+g.diamond_value,'gift_received',tx.id::text);   return tx; end; $$;

-- FIXED debit_coins function
create or replace function public.debit_coins(
  p_user uuid, p_amount bigint, p_source text, p_reference text, p_reason text, p_idempotency_key text)
returns public.wallets language plpgsql security definer set search_path=public as $$ declare before_balance bigint; after_balance bigint; w public.wallets; begin   if p_amount <= 0 then raise exception 'amount must be positive'; end if;   if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then raise exception 'idempotency key required'; end if;   if exists(select 1 from public.coin_ledger where idempotency_key=p_idempotency_key) then     select * into w from public.wallets where user_id=p_user; return w;   end if;   insert into public.wallets(user_id) values(p_user) on conflict do nothing;   select coin_balance into before_balance from public.wallets where user_id=p_user for update;   if before_balance < p_amount then raise exception 'insufficient coins'; end if;   after_balance := before_balance - p_amount;   update public.wallets set coin_balance = after_balance, updated_at = now() where user_id = p_user;      -- Corrected ledger insert matching column order & parameters   insert into public.coin_ledger(user_id, amount, balance_before, balance_after, source, provider, reference, reason, idempotency_key)     values(p_user, -p_amount, before_balance, after_balance, p_source, 'system', p_reference, p_reason, p_idempotency_key);        select * into w from public.wallets where user_id=p_user; return w; end; $$;

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

create or replace function public.request_diamond_withdrawal(p_user uuid, p_amount bigint, p_reference text)
returns public.diamond_withdrawals language plpgsql security definer set search_path=public as $$ declare before_balance bigint; row public.diamond_withdrawals; begin   if p_amount <= 0 then raise exception 'amount must be positive'; end if;   if exists(select 1 from public.diamond_withdrawals where reference=p_reference) then     select * into row from public.diamond_withdrawals where reference=p_reference; return row;   end if;   insert into public.wallets(user_id) values(p_user) on conflict do nothing;   select diamond_balance into before_balance from public.wallets where user_id=p_user for update;   if before_balance < p_amount then raise exception 'insufficient diamonds'; end if;   update public.wallets set diamond_balance=before_balance-p_amount, updated_at=now() where user_id=p_user;   insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference)     values(p_user, -p_amount, before_balance, before_balance-p_amount, 'payout', p_reference);   insert into public.diamond_withdrawals(user_id,amount,reference) values(p_user, p_amount, p_reference) returning * into row;   return row; end; $$;

revoke all on function public.credit_coins(uuid,bigint,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.send_gift(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.send_gift(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.debit_coins(uuid,bigint,text,text,text,text) from public,anon,authenticated;
revoke all on function public.request_diamond_withdrawal(uuid,bigint,text) from public,anon,authenticated;
