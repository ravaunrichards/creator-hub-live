-- Atomic, ledger-backed conversion between a user's existing coin and diamond balances.
-- The ratio is supplied by the trusted backend after validating CHL_COINS_PER_DIAMOND.
-- Never grant this SECURITY DEFINER function to browser roles.
create or replace function public.convert_wallet_currency(
  p_user_id uuid,
  p_direction text,
  p_amount bigint,
  p_coins_per_diamond bigint,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_coin_before bigint;
  v_diamond_before bigint;
  v_coin_after bigint;
  v_diamond_after bigint;
  v_coin_delta bigint;
  v_diamond_delta bigint;
  v_output bigint;
  v_coin_key text;
  v_diamond_key text;
begin
  if p_user_id is null then raise exception 'WALLET_USER_REQUIRED'; end if;
  if p_direction is null or p_direction not in ('coins_to_diamonds','diamonds_to_coins') then raise exception 'INVALID_CONVERSION_DIRECTION'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000000 then raise exception 'INVALID_CONVERSION_AMOUNT'; end if;
  if p_coins_per_diamond is null or p_coins_per_diamond < 1 or p_coins_per_diamond > 1000000 then raise exception 'INVALID_CONVERSION_RATE'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(p_idempotency_key) > 200 then raise exception 'CONVERSION_IDEMPOTENCY_REQUIRED'; end if;
  if p_direction = 'coins_to_diamonds' and mod(p_amount,p_coins_per_diamond) <> 0 then raise exception 'CONVERSION_AMOUNT_MULTIPLE_REQUIRED'; end if;

  v_coin_key := 'wallet-convert:coin:' || p_direction || ':' || p_idempotency_key;
  v_diamond_key := 'wallet-convert:diamond:' || p_direction || ':' || p_idempotency_key;
  insert into public.wallets(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select coin_balance, diamond_balance into v_coin_before, v_diamond_before
    from public.wallets where user_id = p_user_id for update;

  -- A previous successful call is replay-safe: it must not change balances a second time.
  if exists (select 1 from public.coin_ledger where user_id=p_user_id and idempotency_key=v_coin_key)
     or exists (select 1 from public.diamond_ledger where user_id=p_user_id and idempotency_key=v_diamond_key) then
    return jsonb_build_object('coinBalance',v_coin_before,'diamondBalance',v_diamond_before,
      'direction',p_direction,'inputAmount',p_amount,'replayed',true);
  end if;

  if p_direction = 'coins_to_diamonds' then
    v_output := p_amount / p_coins_per_diamond;
    v_coin_delta := -p_amount;
    v_diamond_delta := v_output;
    if v_coin_before < p_amount then raise exception 'INSUFFICIENT_COINS'; end if;
    if v_diamond_before > 9223372036854775807 - v_output then raise exception 'DIAMOND_BALANCE_LIMIT'; end if;
  else
    if p_amount::numeric * p_coins_per_diamond::numeric > 9223372036854775807::numeric then raise exception 'COIN_BALANCE_LIMIT'; end if;
    v_output := p_amount * p_coins_per_diamond;
    v_coin_delta := v_output;
    v_diamond_delta := -p_amount;
    if v_diamond_before < p_amount then raise exception 'INSUFFICIENT_DIAMONDS'; end if;
    if v_coin_before > 9223372036854775807 - v_output then raise exception 'COIN_BALANCE_LIMIT'; end if;
  end if;

  v_coin_after := v_coin_before + v_coin_delta;
  v_diamond_after := v_diamond_before + v_diamond_delta;
  update public.wallets set coin_balance=v_coin_after, diamond_balance=v_diamond_after, updated_at=now()
    where user_id=p_user_id;

  insert into public.coin_ledger(user_id,amount,balance_before,balance_after,source,provider,reference,reason,idempotency_key)
    values (p_user_id,v_coin_delta,v_coin_before,v_coin_after,'currency_conversion','internal',p_idempotency_key,
      case when p_direction='coins_to_diamonds' then 'Coins converted to diamonds' else 'Diamonds converted to coins' end,v_coin_key);
  insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference,exchange_rate,idempotency_key)
    values (p_user_id,v_diamond_delta,v_diamond_before,v_diamond_after,'currency_conversion',p_idempotency_key,
      case when p_direction='coins_to_diamonds' then 1::numeric/p_coins_per_diamond else p_coins_per_diamond::numeric end,v_diamond_key);

  return jsonb_build_object('coinBalance',v_coin_after,'diamondBalance',v_diamond_after,
    'direction',p_direction,'inputAmount',p_amount,'outputAmount',v_output,'replayed',false);
end;
$function$;

revoke all on function public.convert_wallet_currency(uuid,text,bigint,bigint,text) from public;
revoke all on function public.convert_wallet_currency(uuid,text,bigint,bigint,text) from anon;
revoke all on function public.convert_wallet_currency(uuid,text,bigint,bigint,text) from authenticated;
grant execute on function public.convert_wallet_currency(uuid,text,bigint,bigint,text) to service_role;
