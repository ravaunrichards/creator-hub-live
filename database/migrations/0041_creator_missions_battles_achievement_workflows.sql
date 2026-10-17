-- Creator Hub Live coordinated creator features and transaction-backed achievement history.
-- No synthetic missions, accounts, activity, wallet balances, or ranking rows are created.

create index if not exists creator_mission_claims_user_status_idx
  on public.creator_mission_claims(user_id, status, requested_at desc);
create index if not exists creator_battles_challenger_created_idx
  on public.creator_battles(challenger_id, created_at desc);
create index if not exists creator_battles_opponent_created_idx
  on public.creator_battles(opponent_id, created_at desc);
create index if not exists live_schedules_creator_start_idx
  on public.live_schedules(creator_id, starts_at desc);

create table if not exists public.creator_achievement_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_code text not null references public.gifter_achievement_definitions(code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  source_gift_transaction_id uuid references public.gift_transactions(id) on delete set null,
  primary key (user_id, achievement_code)
);
alter table public.creator_achievement_unlocks enable row level security;
drop policy if exists creator_achievement_unlocks_read_own on public.creator_achievement_unlocks;
create policy creator_achievement_unlocks_read_own
  on public.creator_achievement_unlocks for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists creator_achievement_unlocks_read_admin on public.creator_achievement_unlocks;
create policy creator_achievement_unlocks_read_admin
  on public.creator_achievement_unlocks for select to authenticated
  using (public.is_admin());

create or replace function public.chl_creator_metric_value(p_user_id uuid, p_metric_key text)
returns bigint
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case lower(coalesce(p_metric_key, ''))
    when 'followers' then (select count(*)::bigint from public.follows f where f.followee_id=p_user_id and f.status='accepted')
    when 'posts' then (select count(*)::bigint from public.posts p where p.author_id=p_user_id and p.is_draft=false and p.is_test=false)
    when 'views' then (select coalesce(sum(p.view_count),0)::bigint from public.posts p where p.author_id=p_user_id and p.is_draft=false and p.is_test=false)
    when 'streams' then (select count(*)::bigint from public.live_sessions s where s.host_id=p_user_id and s.ended_at is not null)
    when 'gifts_received' then (select count(*)::bigint from public.gift_transactions g left join public.gift_transaction_reversals r on r.transaction_id=g.id where g.recipient_id=p_user_id and r.transaction_id is null)
    when 'diamonds_from_gifts' then (select coalesce(sum(g.diamond_value),0)::bigint from public.gift_transactions g left join public.gift_transaction_reversals r on r.transaction_id=g.id where g.recipient_id=p_user_id and r.transaction_id is null)
    when 'coins_spent_gifting' then (select coalesce(sum(g.coin_cost),0)::bigint from public.gift_transactions g left join public.gift_transaction_reversals r on r.transaction_id=g.id where g.sender_id=p_user_id and r.transaction_id is null)
    else 0::bigint
  end;
$$;
revoke all on function public.chl_creator_metric_value(uuid, text) from public, anon, authenticated;

create or replace function public.chl_list_creator_missions()
returns table (
  mission_id uuid, title text, description text, metric_key text,
  target_value bigint, reward_label text, reward_details text,
  starts_at timestamptz, ends_at timestamptz, current_value bigint,
  claim_status text, claim_id uuid, requested_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  if not public.chcn_my_account_active() then raise exception using errcode='42501', message='ACCOUNT_INACTIVE'; end if;
  return query
    select m.id, m.title, m.description, m.metric_key, m.target_value,
           m.reward_label, m.reward_details, m.starts_at, m.ends_at,
           public.chl_creator_metric_value(v_uid, m.metric_key),
           c.status, c.id, c.requested_at
    from public.creator_missions m
    left join public.creator_mission_claims c
      on c.mission_id=m.id and c.user_id=v_uid
    where (((m.active=true) and (m.starts_at is null or m.starts_at<=now())
            and (m.ends_at is null or m.ends_at>now()))
           or c.id is not null)
    order by (c.id is not null) desc, m.starts_at nulls first, m.created_at desc;
end;
$$;
revoke all on function public.chl_list_creator_missions() from public, anon;
grant execute on function public.chl_list_creator_missions() to authenticated;

create or replace function public.chl_claim_creator_mission(p_mission_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_mission public.creator_missions%rowtype;
  v_claim public.creator_mission_claims%rowtype;
  v_value bigint;
begin
  if v_uid is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  if not public.chcn_my_account_active() then raise exception using errcode='42501', message='ACCOUNT_INACTIVE'; end if;
  select * into v_mission from public.creator_missions m
    where m.id=p_mission_id and m.active=true
      and (m.starts_at is null or m.starts_at<=now())
      and (m.ends_at is null or m.ends_at>now())
    for share;
  if not found then raise exception using errcode='P0001', message='MISSION_UNAVAILABLE'; end if;
  v_value := public.chl_creator_metric_value(v_uid, v_mission.metric_key);
  if v_value < v_mission.target_value then
    raise exception using errcode='P0001', message='MISSION_NOT_COMPLETE';
  end if;
  select * into v_claim from public.creator_mission_claims c
    where c.mission_id=v_mission.id and c.user_id=v_uid for update;
  if found and v_claim.status <> 'rejected' then
    return jsonb_build_object('mission_id',v_mission.id,'status',v_claim.status,
      'achieved_value',v_claim.achieved_value,'target_value',v_mission.target_value,
      'already_claimed',true,'reward_credited',false);
  end if;
  if found and v_claim.status='rejected' then
    update public.creator_mission_claims
      set status='pending', achieved_value=v_value, reviewer_note='', reviewed_by=null,
          reviewed_at=null, requested_at=now()
      where id=v_claim.id returning * into v_claim;
  else
    insert into public.creator_mission_claims(mission_id,user_id,achieved_value,status)
      values(v_mission.id,v_uid,v_value,'pending')
      on conflict(mission_id,user_id) do nothing
      returning * into v_claim;
    if v_claim.id is null then
      select * into v_claim from public.creator_mission_claims c
        where c.mission_id=v_mission.id and c.user_id=v_uid for update;
    end if;
    if v_claim.status='rejected' then
      update public.creator_mission_claims
        set status='pending', achieved_value=v_value, reviewer_note='', reviewed_by=null,
            reviewed_at=null, requested_at=now()
        where id=v_claim.id returning * into v_claim;
    end if;
  end if;
  return jsonb_build_object('mission_id',v_mission.id,'status',v_claim.status,
    'achieved_value',v_claim.achieved_value,'target_value',v_mission.target_value,
    'already_claimed',false,'reward_credited',false);
end;
$$;
revoke all on function public.chl_claim_creator_mission(uuid) from public, anon;
grant execute on function public.chl_claim_creator_mission(uuid) to authenticated;

create or replace function public.chl_create_creator_battle(
  p_opponent_id uuid, p_title text, p_message text default '', p_scheduled_at timestamptz default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title,''));
  v_message text := btrim(coalesce(p_message,''));
  v_battle public.creator_battles%rowtype;
begin
  if v_uid is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  if not public.chcn_my_account_active() then raise exception using errcode='42501', message='ACCOUNT_INACTIVE'; end if;
  if p_opponent_id is null or p_opponent_id=v_uid then raise exception using errcode='22023', message='INVALID_BATTLE_OPPONENT'; end if;
  if length(v_title)<1 or length(v_title)>120 then raise exception using errcode='22023', message='INVALID_BATTLE_TITLE'; end if;
  if length(v_message)>1000 then raise exception using errcode='22023', message='BATTLE_MESSAGE_TOO_LONG'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_opponent_id and p.account_status='active') then
    raise exception using errcode='P0001', message='BATTLE_OPPONENT_NOT_FOUND';
  end if;
  if exists(select 1 from public.blocks b where (b.blocker_id=v_uid and b.blocked_id=p_opponent_id) or (b.blocker_id=p_opponent_id and b.blocked_id=v_uid)) then
    raise exception using errcode='42501', message='BATTLE_BLOCKED';
  end if;
  if p_scheduled_at is not null and p_scheduled_at < now()-interval '5 minutes' then
    raise exception using errcode='22023', message='BATTLE_TIME_IN_PAST';
  end if;
  if exists(select 1 from public.creator_battles b
            where b.status='pending' and
              ((b.challenger_id=v_uid and b.opponent_id=p_opponent_id)
                or (b.challenger_id=p_opponent_id and b.opponent_id=v_uid))) then
    raise exception using errcode='23505', message='BATTLE_INVITATION_ALREADY_PENDING';
  end if;
  insert into public.creator_battles(challenger_id,opponent_id,title,message,scheduled_at,status)
    values(v_uid,p_opponent_id,v_title,v_message,p_scheduled_at,'pending')
    returning * into v_battle;
  insert into public.notifications(user_id,type,actor_id,data,read)
    values(p_opponent_id,'creator_battle_invite',v_uid,
      jsonb_build_object('battle_id',v_battle.id,'title',v_battle.title),false);
  return jsonb_build_object('battle_id',v_battle.id,'status',v_battle.status,'title',v_battle.title,'scheduled_at',v_battle.scheduled_at);
end;
$$;
revoke all on function public.chl_create_creator_battle(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.chl_create_creator_battle(uuid, text, text, timestamptz) to authenticated;

create or replace function public.chl_respond_creator_battle(p_battle_id uuid, p_accept boolean)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_battle public.creator_battles%rowtype;
  v_next text;
begin
  if v_uid is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  if not public.chcn_my_account_active() then raise exception using errcode='42501', message='ACCOUNT_INACTIVE'; end if;
  select * into v_battle from public.creator_battles where id=p_battle_id for update;
  if not found or v_battle.opponent_id<>v_uid then raise exception using errcode='42501', message='BATTLE_INVITATION_NOT_FOUND'; end if;
  if v_battle.status<>'pending' then raise exception using errcode='P0001', message='BATTLE_INVITATION_ALREADY_RESOLVED'; end if;
  v_next := case when p_accept then 'accepted' else 'declined' end;
  update public.creator_battles set status=v_next,updated_at=now() where id=v_battle.id;
  insert into public.notifications(user_id,type,actor_id,data,read)
    values(v_battle.challenger_id,case when p_accept then 'creator_battle_accepted' else 'creator_battle_declined' end,
      v_uid,jsonb_build_object('battle_id',v_battle.id,'title',v_battle.title),false);
  return jsonb_build_object('battle_id',v_battle.id,'status',v_next);
end;
$$;
revoke all on function public.chl_respond_creator_battle(uuid, boolean) from public, anon;
grant execute on function public.chl_respond_creator_battle(uuid, boolean) to authenticated;

create or replace function public.chl_cancel_creator_battle(p_battle_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_battle public.creator_battles%rowtype;
begin
  if v_uid is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  if not public.chcn_my_account_active() then raise exception using errcode='42501', message='ACCOUNT_INACTIVE'; end if;
  select * into v_battle from public.creator_battles where id=p_battle_id for update;
  if not found or v_battle.challenger_id<>v_uid then raise exception using errcode='42501', message='BATTLE_NOT_FOUND'; end if;
  if v_battle.status not in ('pending','accepted') then raise exception using errcode='P0001', message='BATTLE_CANNOT_BE_CANCELLED'; end if;
  update public.creator_battles set status='cancelled',updated_at=now() where id=v_battle.id;
  insert into public.notifications(user_id,type,actor_id,data,read)
    values(v_battle.opponent_id,'creator_battle_cancelled',v_uid,
      jsonb_build_object('battle_id',v_battle.id,'title',v_battle.title),false);
  return jsonb_build_object('battle_id',v_battle.id,'status','cancelled');
end;
$$;
revoke all on function public.chl_cancel_creator_battle(uuid) from public, anon;
grant execute on function public.chl_cancel_creator_battle(uuid) to authenticated;

create or replace function public.chl_record_gifter_achievements()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := new.sender_id;
  v_gift_count bigint;
  v_variety bigint;
  v_yard_gifts bigint;
  v_yard_variety bigint;
begin
  if v_user is null then return new; end if;
  select count(*)::bigint, count(distinct g.gift_id)::bigint,
         count(*) filter (where lower(coalesce(cat.category,'')) like '%yard%')::bigint,
         count(distinct g.gift_id) filter (where lower(coalesce(cat.category,'')) like '%yard%')::bigint
    into v_gift_count,v_variety,v_yard_gifts,v_yard_variety
  from public.gift_transactions g
  left join public.gift_transaction_reversals r on r.transaction_id=g.id
  left join public.gifts cat on cat.id=g.gift_id
  where g.sender_id=v_user and r.transaction_id is null;
  insert into public.creator_achievement_unlocks(user_id,achievement_code,unlocked_at,source_gift_transaction_id)
  select v_user,d.code,now(),new.id
  from public.gifter_achievement_definitions d
  where (not (d.criteria ? 'giftCount') or v_gift_count >= coalesce((d.criteria->>'giftCount')::bigint,0))
    and (not (d.criteria ? 'variety') or v_variety >= coalesce((d.criteria->>'variety')::bigint,0))
    and (not (d.criteria ? 'yardGiftCount') or v_yard_gifts >= coalesce((d.criteria->>'yardGiftCount')::bigint,0))
    and (not (d.criteria ? 'yardVariety') or v_yard_variety >= coalesce((d.criteria->>'yardVariety')::bigint,0))
  on conflict(user_id,achievement_code) do nothing;
  return new;
end;
$$;
revoke all on function public.chl_record_gifter_achievements() from public, anon, authenticated;
drop trigger if exists chl_record_gifter_achievements_after_gift on public.gift_transactions;
create trigger chl_record_gifter_achievements_after_gift
after insert on public.gift_transactions
for each row execute function public.chl_record_gifter_achievements();

-- RLS limits this grant to the owner and administrators.
grant select on table public.creator_achievement_unlocks to authenticated;
