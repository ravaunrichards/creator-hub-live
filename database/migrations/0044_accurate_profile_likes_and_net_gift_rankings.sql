-- Accurate profile like totals and net (non-reversed) gift analytics/rankings.
-- Profile likes are counted from actual likes rows, under caller RLS; no cached estimate.
create or replace function public.chl_total_profile_likes(p_profile_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select count(*)::bigint
  from public.likes l
  join public.posts p on p.id=l.post_id
  where p.author_id=p_profile_id
    and p.is_draft=false
    and p.is_test=false;
$$;
grant execute on function public.chl_total_profile_likes(uuid) to anon, authenticated;

create or replace function public.get_my_creator_metrics()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'followers',(select count(*) from public.follows f where f.followee_id=auth.uid() and f.status='accepted'),
    'following',(select count(*) from public.follows f where f.follower_id=auth.uid() and f.status='accepted'),
    'posts',(select count(*) from public.posts p where p.author_id=auth.uid() and p.is_draft=false and p.is_test=false),
    'views',(select coalesce(sum(p.view_count),0) from public.posts p where p.author_id=auth.uid() and p.is_draft=false and p.is_test=false),
    'likes',(select count(*) from public.likes l join public.posts p on p.id=l.post_id where p.author_id=auth.uid() and p.is_draft=false and p.is_test=false),
    'comments',(select coalesce(sum(p.comment_count),0) from public.posts p where p.author_id=auth.uid() and p.is_draft=false and p.is_test=false),
    'streams',(select count(*) from public.live_sessions s where s.host_id=auth.uid()),
    'live_now',(select count(*) from public.live_sessions s where s.host_id=auth.uid() and s.status='live' and s.ended_at is null),
    'viewer_events',(select coalesce(sum(s.viewer_count),0) from public.live_sessions s where s.host_id=auth.uid()),
    'gifts_received',(select count(*) from public.gift_transactions g where g.recipient_id=auth.uid() and not exists(select 1 from public.gift_transaction_reversals r where r.transaction_id=g.id)),
    'diamonds_from_gifts',(select coalesce(sum(g.diamond_value),0) from public.gift_transactions g where g.recipient_id=auth.uid() and not exists(select 1 from public.gift_transaction_reversals r where r.transaction_id=g.id)),
    'coins_spent_gifting',(select coalesce(sum(g.coin_cost),0) from public.gift_transactions g where g.sender_id=auth.uid() and not exists(select 1 from public.gift_transaction_reversals r where r.transaction_id=g.id))
  );
$$;

create or replace function public.get_public_creator_rankings(p_metric text default 'followers', p_limit integer default 20)
returns table(user_id uuid, username text, display_name text, avatar_url text, score bigint, metric text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_metric text := lower(coalesce(p_metric,'followers'));
  v_limit integer := greatest(1,least(coalesce(p_limit,20),50));
begin
  if v_metric not in ('followers','views','gifts_sent','diamonds_received','live_viewers') then
    raise exception 'INVALID_RANKING_METRIC';
  end if;
  return query
    select p.id,p.username::text,p.display_name,p.avatar_url,
      case v_metric
        when 'followers' then (select count(*)::bigint from public.follows f where f.followee_id=p.id and f.status='accepted')
        when 'views' then (select coalesce(sum(x.view_count),0)::bigint from public.posts x where x.author_id=p.id and x.audience='public' and x.is_draft=false and x.is_test=false)
        when 'gifts_sent' then (select coalesce(sum(g.coin_cost),0)::bigint from public.gift_transactions g where g.sender_id=p.id and not exists(select 1 from public.gift_transaction_reversals r where r.transaction_id=g.id))
        when 'diamonds_received' then (select coalesce(sum(g.diamond_value),0)::bigint from public.gift_transactions g where g.recipient_id=p.id and not exists(select 1 from public.gift_transaction_reversals r where r.transaction_id=g.id))
        when 'live_viewers' then (select coalesce(sum(s.viewer_count),0)::bigint from public.live_sessions s where s.host_id=p.id and s.status='live' and s.ended_at is null)
        else 0::bigint
      end as score,
      v_metric as metric
    from public.profiles p
    where p.account_status='active' and coalesce(p.privacy->>'account','public')='public'
    order by 5 desc,p.username asc
    limit v_limit;
end;
$$;

create or replace function public.get_public_gift_rankings(p_period text default 'weekly', p_metric text default 'received', p_limit integer default 20)
returns table(user_id uuid, username text, display_name text, avatar_url text, score bigint, gift_count bigint, metric text, period text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_period text := lower(coalesce(p_period,'weekly'));
  v_metric text := lower(coalesce(p_metric,'received'));
  v_since timestamptz;
  v_limit integer := greatest(1,least(coalesce(p_limit,20),50));
begin
  if v_period not in ('daily','weekly','monthly') then raise exception 'INVALID_GIFT_RANKING_PERIOD'; end if;
  if v_metric not in ('received','sent') then raise exception 'INVALID_GIFT_RANKING_METRIC'; end if;
  v_since := case v_period when 'daily' then now()-interval '1 day' when 'weekly' then now()-interval '7 days' else now()-interval '30 days' end;
  if v_metric='received' then
    return query select p.id,p.username::text,p.display_name,p.avatar_url,
      coalesce(sum(g.diamond_value),0)::bigint,count(g.id)::bigint,v_metric,v_period
    from public.profiles p
    join public.gift_transactions g on g.recipient_id=p.id and g.created_at>=v_since
    where p.account_status='active'
      and coalesce(p.privacy->>'account','public')='public'
      and not exists(select 1 from public.gift_transaction_reversals r where r.transaction_id=g.id)
    group by p.id,p.username,p.display_name,p.avatar_url
    order by 5 desc,6 desc,p.username asc limit v_limit;
  else
    return query select p.id,p.username::text,p.display_name,p.avatar_url,
      coalesce(sum(g.coin_cost),0)::bigint,count(g.id)::bigint,v_metric,v_period
    from public.profiles p
    join public.gift_transactions g on g.sender_id=p.id and g.created_at>=v_since
    where p.account_status='active'
      and coalesce(p.privacy->>'account','public')='public'
      and not exists(select 1 from public.gift_transaction_reversals r where r.transaction_id=g.id)
    group by p.id,p.username,p.display_name,p.avatar_url
    order by 5 desc,6 desc,p.username asc limit v_limit;
  end if;
end;
$$;
