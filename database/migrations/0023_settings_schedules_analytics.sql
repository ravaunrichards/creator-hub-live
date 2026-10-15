-- Creator Hub Creator Network — 0023 settings, scheduling, privacy and metrics.
-- Forward-only, idempotent where practical, and creates no accounts or activity.
-- Back up production and run the release preflight before applying.
begin;

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.follows') is null
     or to_regclass('public.posts') is null
     or to_regclass('public.live_sessions') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.subscription_tiers') is null
     or to_regclass('public.subscriptions') is null
     or to_regclass('public.gift_transactions') is null
     or to_regclass('public.reports') is null then
    raise exception '0023 prerequisites missing: reconcile identity, live, subscription, gift and report tables before applying this migration.';
  end if;
end $$;

-- A single account-owned settings row. The canonical privacy choices are also
-- mirrored onto profiles.privacy because older policies and routes read it there.
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  privacy jsonb not null default '{"account":"public","messages":"everyone","comments":"everyone"}'::jsonb,
  notifications jsonb not null default '{"follows":true,"gifts":true,"live":true,"mentions":true,"messages":true,"likes":true,"comments":true}'::jsonb,
  live jsonb not null default '{"audience":"public","guest_permissions":"allowed"}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
drop policy if exists user_settings_read on public.user_settings;
drop policy if exists user_settings_insert on public.user_settings;
drop policy if exists user_settings_update on public.user_settings;
drop policy if exists user_settings_delete on public.user_settings;
create policy user_settings_read on public.user_settings for select to authenticated using (user_id=auth.uid());
create policy user_settings_insert on public.user_settings for insert to authenticated with check (user_id=auth.uid());
create policy user_settings_update on public.user_settings for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy user_settings_delete on public.user_settings for delete to authenticated using (user_id=auth.uid());
grant select, insert, update, delete on public.user_settings to authenticated;

create or replace function public.save_my_user_settings(p_privacy jsonb, p_notifications jsonb, p_live jsonb)
returns public.user_settings
language plpgsql security definer set search_path=public as $$
declare
  v_user uuid := auth.uid();
  v_privacy jsonb;
  v_notifications jsonb;
  v_live jsonb;
  v_row public.user_settings;
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if coalesce(p_privacy->>'account','public') not in ('public','followers','private') then raise exception 'INVALID_ACCOUNT_VISIBILITY'; end if;
  if coalesce(p_privacy->>'messages','everyone') not in ('everyone','followers','nobody') then raise exception 'INVALID_MESSAGE_PRIVACY'; end if;
  if coalesce(p_privacy->>'comments','everyone') not in ('everyone','followers','nobody') then raise exception 'INVALID_COMMENT_PRIVACY'; end if;
  if coalesce(p_live->>'audience','public') not in ('public','followers','private') then raise exception 'INVALID_LIVE_AUDIENCE'; end if;
  if coalesce(p_live->>'guest_permissions','allowed') not in ('allowed','host_only') then raise exception 'INVALID_GUEST_PERMISSION'; end if;

  v_privacy := jsonb_build_object(
    'account',coalesce(p_privacy->>'account','public'),
    'messages',coalesce(p_privacy->>'messages','everyone'),
    'comments',coalesce(p_privacy->>'comments','everyone')
  );
  v_notifications := jsonb_build_object(
    'follows',coalesce((p_notifications->>'follows')::boolean,true),
    'gifts',coalesce((p_notifications->>'gifts')::boolean,true),
    'live',coalesce((p_notifications->>'live')::boolean,true),
    'mentions',coalesce((p_notifications->>'mentions')::boolean,true),
    'messages',coalesce((p_notifications->>'messages')::boolean,true),
    'likes',coalesce((p_notifications->>'likes')::boolean,true),
    'comments',coalesce((p_notifications->>'comments')::boolean,true)
  );
  v_live := jsonb_build_object(
    'audience',coalesce(p_live->>'audience','public'),
    'guest_permissions',coalesce(p_live->>'guest_permissions','allowed')
  );

  update public.profiles set privacy=v_privacy, updated_at=now() where id=v_user;
  insert into public.user_settings(user_id,privacy,notifications,live,updated_at)
    values(v_user,v_privacy,v_notifications,v_live,now())
    on conflict(user_id) do update set privacy=excluded.privacy,
      notifications=excluded.notifications, live=excluded.live, updated_at=excluded.updated_at
    returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.save_my_user_settings(jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.save_my_user_settings(jsonb,jsonb,jsonb) to authenticated;

-- Private-account rules apply at the database boundary, not only in the UI.
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to anon, authenticated using (
  author_id=auth.uid()
  or (
    audience='public' and is_draft=false and is_test=false
    and (
      coalesce((select p.privacy->>'account' from public.profiles p where p.id=posts.author_id),'public')='public'
      or exists (select 1 from public.follows f where f.follower_id=auth.uid() and f.followee_id=posts.author_id and f.status='accepted')
    )
    and not exists (select 1 from public.blocks b where b.blocker_id=auth.uid() and b.blocked_id=posts.author_id)
    and not exists (select 1 from public.blocks b where b.blocker_id=posts.author_id and b.blocked_id=auth.uid())
  )
  or (
    audience='followers' and is_draft=false and is_test=false
    and exists (select 1 from public.follows f where f.follower_id=auth.uid() and f.followee_id=posts.author_id and f.status='accepted')
    and not exists (select 1 from public.blocks b where b.blocker_id=auth.uid() and b.blocked_id=posts.author_id)
    and not exists (select 1 from public.blocks b where b.blocker_id=posts.author_id and b.blocked_id=auth.uid())
  )
);

-- Respect post and profile comment controls and only expose interactions for
-- posts the current viewer is actually allowed to read.
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to anon, authenticated using (
  exists (select 1 from public.posts p where p.id=comments.post_id)
);
drop policy if exists comments_write on public.comments;
create policy comments_write on public.comments for insert to authenticated with check (
  author_id=auth.uid() and exists (
    select 1 from public.posts p
    join public.profiles owner_profile on owner_profile.id=p.author_id
    where p.id=comments.post_id and p.allow_comments=true
      and coalesce(owner_profile.privacy->>'comments','everyone') <> 'nobody'
      and (coalesce(owner_profile.privacy->>'comments','everyone') <> 'followers'
        or exists (select 1 from public.follows f where f.follower_id=auth.uid() and f.followee_id=p.author_id and f.status='accepted'))
      and not exists (select 1 from public.blocks b where b.blocker_id=auth.uid() and b.blocked_id=p.author_id)
      and not exists (select 1 from public.blocks b where b.blocker_id=p.author_id and b.blocked_id=auth.uid())
  )
);
drop policy if exists likes_read on public.likes;
create policy likes_read on public.likes for select to anon, authenticated using (
  exists (select 1 from public.posts p where p.id=likes.post_id)
);
drop policy if exists reposts_read on public.reposts;
create policy reposts_read on public.reposts for select to anon, authenticated using (
  exists (select 1 from public.posts p where p.id=reposts.post_id)
);

-- Creator LIVE schedule. Scheduling never automatically starts a stream and
-- no browser push notification is claimed. Followers receive real in-app records.
create table if not exists public.live_schedules (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 1200),
  category text not null default 'Just Chatting' check (length(category) between 1 and 60),
  starts_at timestamptz not null,
  audience text not null default 'public' check (audience in ('public','followers','private')),
  notify_followers boolean not null default true,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','started','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_schedules_public_time_idx on public.live_schedules(status,starts_at asc) where status='scheduled';
create index if not exists live_schedules_creator_time_idx on public.live_schedules(creator_id,starts_at desc);
alter table public.live_schedules enable row level security;
drop policy if exists live_schedules_read on public.live_schedules;
drop policy if exists live_schedules_insert_own on public.live_schedules;
drop policy if exists live_schedules_update_own on public.live_schedules;
drop policy if exists live_schedules_delete_own on public.live_schedules;
create policy live_schedules_read on public.live_schedules for select to anon, authenticated using (
  creator_id=auth.uid()
  or (status='scheduled' and audience='public'
    and (coalesce((select p.privacy->>'account' from public.profiles p where p.id=creator_id),'public')='public'
      or exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.followee_id=creator_id and f.status='accepted')))
  or (status='scheduled' and audience='followers'
    and exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.followee_id=creator_id and f.status='accepted'))
);
create policy live_schedules_insert_own on public.live_schedules for insert to authenticated with check (creator_id=auth.uid());
create policy live_schedules_update_own on public.live_schedules for update to authenticated using (creator_id=auth.uid()) with check (creator_id=auth.uid());
create policy live_schedules_delete_own on public.live_schedules for delete to authenticated using (creator_id=auth.uid());
grant select on public.live_schedules to anon, authenticated;
grant insert, update, delete on public.live_schedules to authenticated;

create or replace function public.chcn_notify_scheduled_live_followers()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='scheduled' and new.notify_followers then
    insert into public.notifications(user_id,type,actor_id,data)
    select f.follower_id,'live_schedule',new.creator_id,
      jsonb_build_object('schedule_id',new.id,'title',new.title,'starts_at',new.starts_at)
    from public.follows f
    left join public.user_settings us on us.user_id=f.follower_id
    where f.followee_id=new.creator_id and f.status='accepted'
      and f.follower_id<>new.creator_id
      and coalesce((us.notifications->>'live')::boolean,true)=true;
  end if;
  return new;
end;
$$;
drop trigger if exists chcn_live_schedule_notification on public.live_schedules;
create trigger chcn_live_schedule_notification after insert on public.live_schedules
for each row execute function public.chcn_notify_scheduled_live_followers();

-- Gift and mention notification events honour each recipient's preferences.
create or replace function public.chcn_notify_gift_received()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce((select (s.notifications->>'gifts')::boolean from public.user_settings s where s.user_id=new.recipient_id),true) then
    insert into public.notifications(user_id,type,actor_id,data)
      values(new.recipient_id,'gift',new.sender_id,jsonb_build_object('gift_transaction_id',new.id,'gift_id',new.gift_id,'live_id',new.live_id,'diamond_value',new.diamond_value));
  end if;
  return new;
end;
$$;
drop trigger if exists chcn_gift_received_notification on public.gift_transactions;
create trigger chcn_gift_received_notification after insert on public.gift_transactions
for each row execute function public.chcn_notify_gift_received();

create or replace function public.chcn_notify_mentions()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_text text; v_author uuid; v_target record;
begin
  if tg_table_name='posts' then v_text:=new.caption; v_author:=new.author_id;
  else v_text:=new.body; v_author:=new.author_id; end if;
  if coalesce(v_text,'')='' then return new; end if;
  for v_target in
    select distinct p.id,p.username
    from public.profiles p
    cross join lateral regexp_matches(v_text,'@([A-Za-z0-9_.]{3,30})','g') as m
    where lower(p.username::text)=lower(m[1]) and p.id<>v_author
      and coalesce((select (s.notifications->>'mentions')::boolean from public.user_settings s where s.user_id=p.id),true)
  loop
    insert into public.notifications(user_id,type,actor_id,data)
      values(v_target.id,'mention',v_author,jsonb_build_object('username',v_target.username,'source_type',tg_table_name,'source_id',new.id));
  end loop;
  return new;
end;
$$;
drop trigger if exists chcn_post_mention_notification on public.posts;
create trigger chcn_post_mention_notification after insert on public.posts
for each row when (new.is_draft=false and new.is_test=false)
execute function public.chcn_notify_mentions();
drop trigger if exists chcn_comment_mention_notification on public.comments;
create trigger chcn_comment_mention_notification after insert on public.comments
for each row execute function public.chcn_notify_mentions();

-- Read-only metric views through bounded functions; there is no client-supplied
-- owner id, and private creator identities are excluded from public rankings.
create or replace function public.get_my_creator_metrics()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'followers',(select count(*) from public.follows f where f.followee_id=auth.uid() and f.status='accepted'),
    'following',(select count(*) from public.follows f where f.follower_id=auth.uid() and f.status='accepted'),
    'posts',(select count(*) from public.posts p where p.author_id=auth.uid() and p.is_draft=false and p.is_test=false),
    'views',(select coalesce(sum(p.view_count),0) from public.posts p where p.author_id=auth.uid() and p.is_draft=false and p.is_test=false),
    'likes',(select coalesce(sum(p.like_count),0) from public.posts p where p.author_id=auth.uid() and p.is_draft=false and p.is_test=false),
    'comments',(select coalesce(sum(p.comment_count),0) from public.posts p where p.author_id=auth.uid() and p.is_draft=false and p.is_test=false),
    'streams',(select count(*) from public.live_sessions s where s.host_id=auth.uid()),
    'live_now',(select count(*) from public.live_sessions s where s.host_id=auth.uid() and s.status='live'),
    'viewer_events',(select coalesce(sum(s.viewer_count),0) from public.live_sessions s where s.host_id=auth.uid()),
    'gifts_received',(select count(*) from public.gift_transactions g where g.recipient_id=auth.uid()),
    'diamonds_from_gifts',(select coalesce(sum(g.diamond_value),0) from public.gift_transactions g where g.recipient_id=auth.uid()),
    'coins_spent_gifting',(select coalesce(sum(g.coin_cost),0) from public.gift_transactions g where g.sender_id=auth.uid())
  );
$$;
revoke all on function public.get_my_creator_metrics() from public, anon;
grant execute on function public.get_my_creator_metrics() to authenticated;

create or replace function public.get_public_creator_rankings(p_metric text default 'followers', p_limit integer default 20)
returns table(user_id uuid, username text, display_name text, avatar_url text, score bigint, metric text)
language plpgsql stable security definer set search_path=public as $$
declare v_metric text := lower(coalesce(p_metric,'followers'));
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
        when 'gifts_sent' then (select coalesce(sum(g.coin_cost),0)::bigint from public.gift_transactions g where g.sender_id=p.id)
        when 'diamonds_received' then (select coalesce(sum(g.diamond_value),0)::bigint from public.gift_transactions g where g.recipient_id=p.id)
        when 'live_viewers' then (select coalesce(sum(s.viewer_count),0)::bigint from public.live_sessions s where s.host_id=p.id and s.status='live')
        else 0::bigint
      end as score,
      v_metric as metric
    from public.profiles p
    where coalesce(p.privacy->>'account','public')='public'
    order by 5 desc,p.username asc
    limit v_limit;
end;
$$;
revoke all on function public.get_public_creator_rankings(text,integer) from public;
grant execute on function public.get_public_creator_rankings(text,integer) to anon, authenticated;

-- Tier metadata is public only while active; only the creator may manage their
-- own offers. Actual subscription charges are intentionally not emulated here.
alter table public.subscription_tiers enable row level security;
drop policy if exists subscription_tiers_read on public.subscription_tiers;
drop policy if exists subscription_tiers_insert_own on public.subscription_tiers;
drop policy if exists subscription_tiers_update_own on public.subscription_tiers;
drop policy if exists subscription_tiers_delete_own on public.subscription_tiers;
create policy subscription_tiers_read on public.subscription_tiers for select to anon, authenticated using (active=true or creator_id=auth.uid());
create policy subscription_tiers_insert_own on public.subscription_tiers for insert to authenticated with check (creator_id=auth.uid());
create policy subscription_tiers_update_own on public.subscription_tiers for update to authenticated using (creator_id=auth.uid()) with check (creator_id=auth.uid());
create policy subscription_tiers_delete_own on public.subscription_tiers for delete to authenticated using (creator_id=auth.uid());
grant select on public.subscription_tiers to anon, authenticated;
grant insert, update, delete on public.subscription_tiers to authenticated;

-- User-submitted reports enter a moderation queue; only actual administrators
-- may read/update queue rows. Do not expose report contents to other users.
alter table public.reports enable row level security;
drop policy if exists reports_insert_own on public.reports;
drop policy if exists reports_admin_read on public.reports;
drop policy if exists reports_admin_update on public.reports;
create policy reports_insert_own on public.reports for insert to authenticated with check (
  reporter_id=auth.uid() and length(trim(coalesce(reason,''))) between 10 and 3000 and status='open'
  and target_type in ('platform','post','user','live','team','comment','message')
);
create policy reports_admin_read on public.reports for select to authenticated using (public.is_admin());
create policy reports_admin_update on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert on public.reports to authenticated;
grant select, update on public.reports to authenticated;

notify pgrst, 'reload schema';
commit;
