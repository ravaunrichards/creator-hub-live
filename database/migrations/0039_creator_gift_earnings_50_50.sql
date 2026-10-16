-- Creator Hub Live — auditable 50/50 gift commission and creator earnings.
-- Manual-install migration; this workflow has not executed it against production.
-- No gift names, coin prices, existing wallet balances, or payout conversion rates are changed.

begin;

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.wallets') is null
     or to_regclass('public.coin_ledger') is null
     or to_regclass('public.diamond_ledger') is null
     or to_regclass('public.gifts') is null
     or to_regclass('public.gift_transactions') is null
     or to_regclass('public.live_sessions') is null
     or to_regclass('public.live_guests') is null
     or to_regclass('public.follows') is null
     or to_regclass('public.blocks') is null
     or to_regclass('public.live_room_moderators') is null then
    raise exception 'CHL 50/50 earnings migration stopped: a required table is missing. No data was changed.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='gift_transactions' and column_name='idempotency_key')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='gift_transactions' and column_name='coin_cost')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='gift_transactions' and column_name='diamond_value') then
    raise exception 'CHL 50/50 earnings migration stopped: gift transaction columns do not match the existing contract. No data was changed.';
  end if;
  if exists (select 1 from public.gift_transactions where coin_cost is null or coin_cost <= 0 or diamond_value is null or diamond_value < 0) then
    raise exception 'CHL 50/50 earnings migration stopped: historical gift transactions include invalid values that need review. No data was changed.';
  end if;
end $$;

-- This table is the immutable accounting record for each charged gift.
-- Coin shares are virtual coin accounting units, not cash or PayPal amounts.
create table if not exists public.gift_earning_ledger (
  gift_transaction_id uuid primary key,
  sender_id uuid not null,
  recipient_id uuid not null,
  live_id uuid,
  gift_name text not null,
  recipient_role text not null check (recipient_role in ('host','guest','creator','unknown')),
  coin_cost bigint not null check (coin_cost > 0),
  creator_share_coins numeric(24,4) not null check (creator_share_coins >= 0),
  platform_commission_coins numeric(24,4) not null check (platform_commission_coins >= 0),
  creator_diamonds bigint not null check (creator_diamonds >= 0),
  catalogue_minimum_extra_diamonds bigint not null default 0 check (catalogue_minimum_extra_diamonds >= 0),
  commission_rate numeric(5,4) not null default 0.5000 check (commission_rate = 0.5000),
  created_at timestamptz not null default now(),
  constraint gift_earning_shares_conserve_coin_cost
    check (creator_share_coins + platform_commission_coins = coin_cost)
);

comment on table public.gift_earning_ledger is
  'Immutable per-gift virtual-coin commission allocation and creator diamond credit. Coin units are not fiat. PayPal cash payout remains separately reviewed.';
comment on column public.gift_earning_ledger.creator_share_coins is
  'Exact 50% virtual coin-equivalent allocation for the creator. Fractional accounting units are recorded for odd-priced gifts; these do not create fractional spendable wallet coins.';
comment on column public.gift_earning_ledger.creator_diamonds is
  'The existing configured gifts.diamond_value actually credited to the recipient; not a cash conversion or a 1:1 coin value.';

-- Keep the accounting table append-only. Refunds/corrections should be explicit future adjustment
-- entries, never silent edits to the original gift allocation.
create or replace function public.prevent_gift_earning_ledger_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception 'GIFT_EARNING_LEDGER_APPEND_ONLY';
end;
$function$;
revoke all on function public.prevent_gift_earning_ledger_mutation() from public, anon, authenticated, service_role;
drop trigger if exists gift_earning_ledger_append_only on public.gift_earning_ledger;
create trigger gift_earning_ledger_append_only
  before update or delete on public.gift_earning_ledger
  for each row execute function public.prevent_gift_earning_ledger_mutation();

create index if not exists gift_earning_recipient_created_idx
  on public.gift_earning_ledger(recipient_id, created_at desc);
create index if not exists gift_earning_live_role_created_idx
  on public.gift_earning_ledger(live_id, recipient_role, created_at desc);
create index if not exists gift_earning_created_idx
  on public.gift_earning_ledger(created_at desc);

alter table public.gift_earning_ledger enable row level security;
revoke all on table public.gift_earning_ledger from public, anon, authenticated;
grant select on table public.gift_earning_ledger to authenticated;
grant all on table public.gift_earning_ledger to service_role;
drop policy if exists gift_earning_recipient_or_admin_read on public.gift_earning_ledger;
create policy gift_earning_recipient_or_admin_read on public.gift_earning_ledger
  for select to authenticated
  using (recipient_id = auth.uid() or public.is_admin());

-- Backfill a transparent accounting entry for existing gift transactions.
-- Historical non-host live gifts are marked unknown: current live_guests status does not
-- prove the guest's role at the exact time of an old gift, so past guest attribution is not guessed.
insert into public.gift_earning_ledger (
  gift_transaction_id, sender_id, recipient_id, live_id, gift_name, recipient_role,
  coin_cost, creator_share_coins, platform_commission_coins, creator_diamonds,
  catalogue_minimum_extra_diamonds, commission_rate, created_at
)
select
  gt.id, gt.sender_id, gt.recipient_id, gt.live_id, coalesce(g.name, '[Unavailable gift]'),
  case
    when gt.live_id is null then 'creator'
    when ls.host_id = gt.recipient_id then 'host'
    else 'unknown'
  end,
  gt.coin_cost,
  gt.coin_cost::numeric / 2,
  gt.coin_cost::numeric / 2,
  gt.diamond_value,
  greatest(gt.diamond_value - floor(gt.coin_cost::numeric / 2)::bigint, 0),
  0.5000,
  gt.created_at
from public.gift_transactions gt
left join public.gifts g on g.id = gt.gift_id
left join public.live_sessions ls on ls.id = gt.live_id
where not exists (
  select 1 from public.gift_earning_ledger gel where gel.gift_transaction_id = gt.id
);

-- Resolve a viewer-safe recipient list. The caller sees only host/accepted guest identities
-- after the same audience, follow, block, moderator, and guest-access checks used for LIVE access.
create or replace function public.live_gift_recipients(p_live_id uuid)
returns table (user_id uuid, display_name text, username text, avatar_url text, recipient_role text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_viewer uuid := auth.uid();
  v_room public.live_sessions;
  v_privacy text := 'public';
  v_following boolean := false;
  v_guest_access boolean := false;
  v_moderator boolean := false;
begin
  if v_viewer is null then raise exception 'AUTHENTICATED_USER_REQUIRED'; end if;
  if p_live_id is null then raise exception 'LIVE_ROOM_REQUIRED'; end if;
  select * into v_room from public.live_sessions where id = p_live_id and status = 'live';
  if not found then raise exception 'LIVE_SESSION_NOT_ACTIVE'; end if;

  if v_viewer <> v_room.host_id then
    if exists (
      select 1 from public.blocks b
      where (b.blocker_id = v_viewer and b.blocked_id = v_room.host_id)
         or (b.blocker_id = v_room.host_id and b.blocked_id = v_viewer)
    ) then raise exception 'LIVE_ROOM_UNAVAILABLE'; end if;

    select coalesce(p.privacy ->> 'account', 'public') into v_privacy
    from public.profiles p where p.id = v_room.host_id;
    v_privacy := coalesce(v_privacy, 'public');
    select exists (
      select 1 from public.follows f
      where f.follower_id = v_viewer and f.followee_id = v_room.host_id and f.status = 'accepted'
    ) into v_following;
    select exists (
      select 1 from public.live_guests lg
      where lg.live_id = v_room.id and lg.user_id = v_viewer and lg.status in ('invited','accepted')
    ) into v_guest_access;
    select exists (
      select 1 from public.live_room_moderators m
      where m.live_id = v_room.id and m.user_id = v_viewer
    ) into v_moderator;

    if not v_guest_access and not v_moderator then
      if coalesce(v_room.audience, 'public') = 'private' then raise exception 'LIVE_ROOM_UNAVAILABLE'; end if;
      if (coalesce(v_room.audience, 'public') = 'followers' or v_privacy in ('followers','private')) and not v_following then
        raise exception 'LIVE_ROOM_UNAVAILABLE';
      end if;
    end if;
  end if;

  return query
    select p.id, p.display_name::text, p.username::text, p.avatar_url::text, 'host'::text
    from public.profiles p
    where p.id = v_room.host_id
      and p.account_status = 'active'
      and public.chcn_can_view_profile(p.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v_viewer and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = v_viewer)
      );

  return query
    select p.id, p.display_name::text, p.username::text, p.avatar_url::text, 'guest'::text
    from public.live_guests lg
    join public.profiles p on p.id = lg.user_id
    where lg.live_id = v_room.id
      and lg.user_id <> v_room.host_id
      and lg.status = 'accepted'
      and p.account_status = 'active'
      and public.chcn_can_view_profile(p.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v_viewer and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = v_viewer)
      )
    order by coalesce(lg.slot, 999), lg.joined_at nulls last, lg.created_at;
end;
$function$;
revoke all on function public.live_gift_recipients(uuid) from public, anon;
grant execute on function public.live_gift_recipients(uuid) to authenticated;

-- Replace the active idempotent RPC. Database-side eligibility is authoritative: a manipulated
-- recipient ID cannot divert a LIVE gift to an unaccepted viewer.
create or replace function public.send_gift(
  p_sender uuid,
  p_recipient uuid,
  p_gift uuid,
  p_live uuid,
  p_idempotency_key text default null
) returns public.gift_transactions
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  g public.gifts;
  tx public.gift_transactions;
  sender_balance bigint;
  recipient_diamonds bigint;
  live_host uuid;
  live_audience text := 'public';
  host_privacy text := 'public';
  sender_following boolean := false;
  sender_guest_or_invited boolean := false;
  sender_moderator boolean := false;
  recipient_role_value text := 'creator';
  creator_share_value numeric(24,4);
  platform_share_value numeric(24,4);
  minimum_extra_diamonds bigint;
begin
  if p_sender is null or p_recipient is null or p_gift is null then raise exception 'INVALID_GIFT'; end if;
  if p_sender = p_recipient then raise exception 'CANNOT_GIFT_SELF'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(p_idempotency_key) > 200 then
    raise exception 'GIFT_IDEMPOTENCY_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gift:' || trim(p_idempotency_key), 0));
  select * into tx from public.gift_transactions where idempotency_key = trim(p_idempotency_key) limit 1;
  if tx.id is not null then
    if tx.sender_id <> p_sender or tx.recipient_id <> p_recipient or tx.gift_id <> p_gift or tx.live_id is distinct from p_live then
      raise exception 'GIFT_IDEMPOTENCY_CONFLICT';
    end if;
    return tx;
  end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_sender and b.blocked_id = p_recipient)
       or (b.blocker_id = p_recipient and b.blocked_id = p_sender)
  ) then raise exception 'GIFT_RECIPIENT_BLOCKED'; end if;

  select * into g from public.gifts where id = p_gift and active = true for share;
  if g.id is null then raise exception 'GIFT_NOT_AVAILABLE'; end if;
  if g.coin_price is null or g.coin_price <= 0 or g.diamond_value is null or g.diamond_value <= 0 then
    raise exception 'GIFT_CATALOG_INVALID';
  end if;

  if p_live is not null then
    select s.host_id, coalesce(s.audience, 'public') into live_host, live_audience
    from public.live_sessions s where s.id = p_live and s.status = 'live' for share;
    if not found then raise exception 'LIVE_SESSION_NOT_ACTIVE'; end if;

    -- Enforce viewer access here too; calling the gift endpoint directly must not bypass
    -- a private/follower-only LIVE or send gifts into a room whose host blocked the sender.
    if p_sender <> live_host then
      if exists (select 1 from public.blocks b
        where (b.blocker_id = p_sender and b.blocked_id = live_host)
           or (b.blocker_id = live_host and b.blocked_id = p_sender)) then
        raise exception 'LIVE_ROOM_UNAVAILABLE';
      end if;
      select coalesce(p.privacy ->> 'account', 'public') into host_privacy
      from public.profiles p where p.id = live_host;
      host_privacy := coalesce(host_privacy, 'public');
      select exists (select 1 from public.follows f
        where f.follower_id = p_sender and f.followee_id = live_host and f.status = 'accepted')
      into sender_following;
      select exists (select 1 from public.live_guests lg
        where lg.live_id = p_live and lg.user_id = p_sender and lg.status in ('invited','accepted'))
      into sender_guest_or_invited;
      select exists (select 1 from public.live_room_moderators m
        where m.live_id = p_live and m.user_id = p_sender)
      into sender_moderator;
      if not sender_guest_or_invited and not sender_moderator then
        if live_audience = 'private' then raise exception 'LIVE_ROOM_UNAVAILABLE'; end if;
        if (live_audience = 'followers' or host_privacy in ('followers','private')) and not sender_following then
          raise exception 'LIVE_ROOM_UNAVAILABLE';
        end if;
      end if;
    end if;

    if p_recipient = live_host then
      recipient_role_value := 'host';
    else
      perform 1 from public.live_guests lg
      where lg.live_id = p_live and lg.user_id = p_recipient and lg.status = 'accepted'
      for share;
      if not found then raise exception 'GIFT_RECIPIENT_NOT_ACTIVE_IN_LIVE'; end if;
      recipient_role_value := 'guest';
    end if;
  end if;

  insert into public.wallets(user_id) values (p_sender) on conflict (user_id) do nothing;
  insert into public.wallets(user_id) values (p_recipient) on conflict (user_id) do nothing;
  perform 1 from public.wallets where user_id in (p_sender, p_recipient) order by user_id for update;
  select coin_balance into sender_balance from public.wallets where user_id = p_sender;
  select diamond_balance into recipient_diamonds from public.wallets where user_id = p_recipient;
  if sender_balance < g.coin_price then raise exception 'INSUFFICIENT_COINS'; end if;
  if recipient_diamonds > 9223372036854775807 - g.diamond_value then raise exception 'DIAMOND_BALANCE_LIMIT'; end if;

  creator_share_value := g.coin_price::numeric / 2;
  platform_share_value := g.coin_price::numeric / 2;
  minimum_extra_diamonds := greatest(g.diamond_value - floor(g.coin_price::numeric / 2)::bigint, 0);

  insert into public.gift_transactions(gift_id, sender_id, recipient_id, live_id, coin_cost, diamond_value, idempotency_key)
  values (g.id, p_sender, p_recipient, p_live, g.coin_price, g.diamond_value, trim(p_idempotency_key))
  returning * into tx;

  update public.wallets
  set coin_balance = coin_balance - g.coin_price,
      lifetime_gifts_sent = lifetime_gifts_sent + 1,
      updated_at = now()
  where user_id = p_sender;
  update public.wallets
  set diamond_balance = diamond_balance + g.diamond_value,
      updated_at = now()
  where user_id = p_recipient;

  insert into public.coin_ledger(user_id, amount, balance_before, balance_after, source, provider, reference, reason, idempotency_key)
  values (p_sender, -g.coin_price, sender_balance, sender_balance - g.coin_price,
    'gift_sent', null, tx.id::text, g.name, 'gift-sent:' || trim(p_idempotency_key));
  insert into public.diamond_ledger(user_id, amount, balance_before, balance_after, source, reference, idempotency_key)
  values (p_recipient, g.diamond_value, recipient_diamonds, recipient_diamonds + g.diamond_value,
    'gift_received', tx.id::text, 'gift-received:' || tx.id::text);

  insert into public.gift_earning_ledger(
    gift_transaction_id, sender_id, recipient_id, live_id, gift_name, recipient_role,
    coin_cost, creator_share_coins, platform_commission_coins, creator_diamonds,
    catalogue_minimum_extra_diamonds, commission_rate
  ) values (
    tx.id, p_sender, p_recipient, p_live, g.name, recipient_role_value,
    g.coin_price, creator_share_value, platform_share_value, g.diamond_value,
    minimum_extra_diamonds, 0.5000
  );
  return tx;
end;
$function$;
revoke all on function public.send_gift(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.send_gift(uuid,uuid,uuid,uuid,text) to service_role;

-- Disable the older non-idempotent overload so there is only one supported gift-write path.
do $$
begin
  if to_regprocedure('public.send_gift(uuid,uuid,uuid,uuid)') is not null then
    execute 'revoke all on function public.send_gift(uuid,uuid,uuid,uuid) from public, anon, authenticated, service_role';
  end if;
end;
$$;

-- Creator summary is bound to auth.uid(); callers cannot ask for another user's earnings.
create or replace function public.creator_gift_earnings_summary(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user uuid := auth.uid();
  v_total_gifts bigint;
  v_total_diamonds bigint;
  v_host_diamonds bigint;
  v_guest_diamonds bigint;
  v_other_diamonds bigint;
  v_creator_coin_units numeric(24,4);
  v_platform_coin_units numeric(24,4);
  v_recent jsonb;
begin
  if v_user is null then raise exception 'AUTHENTICATED_USER_REQUIRED'; end if;
  select count(*), coalesce(sum(gel.creator_diamonds),0),
    coalesce(sum(gel.creator_diamonds) filter (where gel.recipient_role='host'),0),
    coalesce(sum(gel.creator_diamonds) filter (where gel.recipient_role='guest'),0),
    coalesce(sum(gel.creator_diamonds) filter (where gel.recipient_role in ('creator','unknown')),0),
    coalesce(sum(gel.creator_share_coins),0),
    coalesce(sum(gel.platform_commission_coins),0)
  into v_total_gifts, v_total_diamonds, v_host_diamonds, v_guest_diamonds, v_other_diamonds,
       v_creator_coin_units, v_platform_coin_units
  from public.gift_earning_ledger gel where gel.recipient_id = v_user;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
  into v_recent
  from (
    select gel.gift_transaction_id, gel.gift_name, gel.recipient_role, gel.coin_cost,
      gel.creator_share_coins, gel.platform_commission_coins, gel.creator_diamonds,
      gel.catalogue_minimum_extra_diamonds, gel.created_at, gel.live_id
    from public.gift_earning_ledger gel where gel.recipient_id = v_user
    order by gel.created_at desc limit greatest(1, least(coalesce(p_limit,20),100))
  ) r;

  return jsonb_build_object(
    'totalGiftsReceived', v_total_gifts,
    'diamondsEarned', v_total_diamonds,
    'hostDiamondsEarned', v_host_diamonds,
    'guestDiamondsEarned', v_guest_diamonds,
    'otherCreatorDiamondsEarned', v_other_diamonds,
    'creatorShareCoinUnits', v_creator_coin_units,
    'platformCommissionCoinUnits', v_platform_coin_units,
    'commissionRate', 0.5,
    'recent', v_recent,
    'financialNote', 'Coin shares are virtual accounting units. Diamond credits use each gift’s existing configured diamond_value; diamonds are not cash or a 1:1 coin conversion.'
  );
end;
$function$;
revoke all on function public.creator_gift_earnings_summary(integer) from public, anon;
grant execute on function public.creator_gift_earnings_summary(integer) to authenticated;

-- Platform overview is permission-checked inside the function, regardless of client UI.
create or replace function public.admin_gift_commission_summary(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_admin uuid := auth.uid();
  v_gift_summary jsonb;
  v_by_role jsonb;
  v_recent jsonb;
begin
  if v_admin is null or not exists (select 1 from public.profiles p where p.id=v_admin and p.is_admin=true) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select jsonb_build_object(
    'giftCount', count(*),
    'coinsSpent', coalesce(sum(gel.coin_cost),0),
    'creatorShareCoins', coalesce(sum(gel.creator_share_coins),0),
    'platformCommissionCoins', coalesce(sum(gel.platform_commission_coins),0),
    'creatorDiamondsCredited', coalesce(sum(gel.creator_diamonds),0),
    'catalogueMinimumExtraDiamonds', coalesce(sum(gel.catalogue_minimum_extra_diamonds),0),
    'commissionRate', 0.5
  ) into v_gift_summary from public.gift_earning_ledger gel;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.recipient_role), '[]'::jsonb)
  into v_by_role
  from (
    select gel.recipient_role, count(*) as gift_count,
      coalesce(sum(gel.coin_cost),0) as coins_spent,
      coalesce(sum(gel.platform_commission_coins),0) as platform_commission_coins,
      coalesce(sum(gel.creator_diamonds),0) as creator_diamonds_credited
    from public.gift_earning_ledger gel group by gel.recipient_role
  ) r;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
  into v_recent
  from (
    select gel.gift_transaction_id, gel.gift_name, gel.recipient_role, gel.coin_cost,
      gel.creator_share_coins, gel.platform_commission_coins, gel.creator_diamonds,
      gel.catalogue_minimum_extra_diamonds, gel.created_at, gel.live_id
    from public.gift_earning_ledger gel
    order by gel.created_at desc limit greatest(1, least(coalesce(p_limit,20),100))
  ) r;

  return jsonb_build_object(
    'commissionRate',0.5,
    'giftCommission',v_gift_summary,
    'byRecipientRole',v_by_role,
    'recentGiftCommissions',v_recent,
    'financialNote','Platform commission is recorded in virtual coin units, not fiat revenue. PayPal gross receipts, provider fees, taxes, refunds, chargebacks and operating costs require separate real-money accounting.'
  );
end;
$function$;
revoke all on function public.admin_gift_commission_summary(integer) from public, anon;
grant execute on function public.admin_gift_commission_summary(integer) to authenticated;

notify pgrst, 'reload schema';
commit;
