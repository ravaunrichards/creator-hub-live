-- Secure, transaction-backed gift history for the signed-in account.
-- Never accepts a target user ID; only returns unreversed gift rows involving auth.uid().
create or replace function public.chl_list_my_gift_history(p_limit integer default 200)
returns table (
  id uuid, gift_id uuid, sender_id uuid, recipient_id uuid, live_id uuid,
  coin_cost bigint, diamond_value bigint, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
begin
  if v_uid is null then
    raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED';
  end if;
  if not public.chcn_my_account_active() then
    raise exception using errcode='42501', message='ACCOUNT_INACTIVE';
  end if;
  return query
    select g.id, g.gift_id, g.sender_id, g.recipient_id, g.live_id,
           g.coin_cost, g.diamond_value, g.created_at
    from public.gift_transactions g
    left join public.gift_transaction_reversals r on r.transaction_id = g.id
    where (g.sender_id = v_uid or g.recipient_id = v_uid)
      and r.transaction_id is null
    order by g.created_at desc
    limit v_limit;
end;
$$;
revoke all on function public.chl_list_my_gift_history(integer) from public, anon;
grant execute on function public.chl_list_my_gift_history(integer) to authenticated;
