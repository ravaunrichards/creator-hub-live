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
  
  -- Corrected parameter mapping to match ledger columns cleanly
  insert into public.coin_ledger(user_id, amount, balance_before, balance_after, source, reference, reason, idempotency_key)
    values(p_user, -p_amount, before_balance, after_balance, p_source, p_reference, p_reason, p_idempotency_key);
    
  select * into w from public.wallets where user_id=p_user; return w;
end; $$;
