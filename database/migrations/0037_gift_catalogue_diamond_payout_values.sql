-- Creator Hub Live: make the active gift payout rule reproducible in migration history.
-- Coin prices are never changed. Active gifts earn at least one diamond and use the
-- existing 2-coins-to-1-diamond payout rule used by the gift transaction contract.

begin;

do $$
begin
  if to_regclass('public.gifts') is null then
    raise exception 'Gift payout configuration stopped: public.gifts does not exist.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gifts' and column_name = 'coin_price'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gifts' and column_name = 'diamond_value'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gifts' and column_name = 'active'
  ) then
    raise exception 'Gift payout configuration stopped: required gift catalogue columns are missing.';
  end if;
end $$;

update public.gifts
set diamond_value = greatest(1, floor(coin_price::numeric / 2)::bigint)
where active = true
  and diamond_value is distinct from greatest(1, floor(coin_price::numeric / 2)::bigint);

do $$
begin
  if exists (
    select 1 from public.gifts
    where active = true
      and (diamond_value is null or diamond_value <= 0
        or diamond_value is distinct from greatest(1, floor(coin_price::numeric / 2)::bigint))
  ) then
    raise exception 'Gift payout configuration incomplete: active gift payouts do not match the configured rule.';
  end if;
end $$;

commit;
