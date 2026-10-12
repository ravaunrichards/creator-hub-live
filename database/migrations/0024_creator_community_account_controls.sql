-- Creator Hub Creator Network — 0024 community features and account controls.
-- Forward-only migration. Inspect the target database and back up before applying.
-- This migration creates no profiles, gift activity, battles, missions, rewards or badges.
begin;

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.follows') is null
     or to_regclass('public.blocks') is null
     or to_regclass('public.gift_transactions') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.user_settings') is null
     or to_regclass('public.posts') is null
     or to_regclass('public.likes') is null
     or to_regclass('public.comments') is null
     or to_regclass('public.reposts') is null
     or to_regclass('public.saves') is null
     or to_regclass('public.conversations') is null
     or to_regclass('public.conversation_members') is null
     or to_regclass('public.messages') is null
     or to_regclass('public.live_sessions') is null
     or to_regclass('public.live_guests') is null then
    raise exception '0024 prerequisites missing: review migrations 0001-0005 and 0011, 0020-0023 before applying.';
  end if;
end $$;

-- Self-service account lifecycle state. This marker is updated only by the trusted
-- backend admin API; users cannot elevate or set their own status through profile edit.
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists deactivated_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_account_status_check' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_account_status_check check (account_status in ('active','deactivated'));
  end if;
end $$;

-- Authenticated users can only edit ordinary profile fields. Older project
-- policies granted row-level self-updates without restricting privileged
-- columns such as is_admin, gifter_level and account_status.
create or replace function public.chcn_my_account_active()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((select p.account_status='active' from public.profiles p where p.id=auth.uid()),false);
$$;
revoke all on function public.chcn_my_account_active() from public,anon;
grant execute on function public.chcn_my_account_active() to anon,authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((select p.is_admin and p.account_status='active' from public.profiles p where p.id=auth.uid()),false);
$$;

-- Small visibility predicate used for public creator-badge display. It reads the
-- canonical profile/privacy row and accepted follow relationship, not caller-supplied data.
create or replace function public.chcn_can_view_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select case
    when p_profile_id is null then false
    when p_profile_id=auth.uid() then true
    when public.is_admin() then true
    else coalesce((
      select p.account_status='active'
        and (auth.uid() is null or public.chcn_my_account_active())
        and (
          coalesce(p.privacy->>'account','public')='public'
          or exists(select 1 from public.follows f where f.followee_id=p.id and f.follower_id=auth.uid() and f.status='accepted')
        )
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id=auth.uid() and b.blocked_id=p.id)
             or (b.blocker_id=p.id and b.blocked_id=auth.uid())
        )
      from public.profiles p where p.id=p_profile_id
    ),false)
  end;
$$;
revoke all on function public.chcn_can_view_profile(uuid) from public,anon;
grant execute on function public.chcn_can_view_profile(uuid) to anon,authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to anon,authenticated
  using (id=auth.uid() or (account_status='active' and public.chcn_can_view_profile(id)));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id=auth.uid() and account_status='active')
  with check (id=auth.uid() and account_status='active');
revoke update on public.profiles from anon,authenticated;
grant update (username,display_name,bio,avatar_url,cover_url,country,language,links,creator_category,updated_at)
  on public.profiles to authenticated;

-- Table-level SELECT on profiles would expose internal privilege flags (and any
-- future internal columns) to every browser client. Grant only the profile
-- fields required by the website. The current user's admin flag is loaded from
-- is_admin(), which evaluates only auth.uid(), rather than reading the column.
revoke select on public.profiles from anon,authenticated;
grant select (id,username,display_name,bio,avatar_url,cover_url,country,language,links,creator_category,is_creator,gifter_level,league,privacy,followers_count,following_count,posts_count,created_at,updated_at,account_status)
  on public.profiles to anon,authenticated;
grant execute on function public.is_admin() to anon,authenticated;

-- The profile column-level UPDATE grant above intentionally prevents browser
-- clients from altering counters/privileges. Existing counter triggers must
-- therefore run as their trusted function owner or every follow/like/comment
-- can fail with a column/RLS permission error. These functions accept no user
-- supplied row identifiers; they operate only on the triggering row.
create or replace function public.sync_follow_counts()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' and new.status='accepted' then
    update public.profiles set followers_count=followers_count+1 where id=new.followee_id;
    update public.profiles set following_count=following_count+1 where id=new.follower_id;
  elsif tg_op='DELETE' and old.status='accepted' then
    update public.profiles set followers_count=greatest(followers_count-1,0) where id=old.followee_id;
    update public.profiles set following_count=greatest(following_count-1,0) where id=old.follower_id;
  elsif tg_op='UPDATE' and old.status is distinct from new.status then
    if old.status<>'accepted' and new.status='accepted' then
      update public.profiles set followers_count=followers_count+1 where id=new.followee_id;
      update public.profiles set following_count=following_count+1 where id=new.follower_id;
    elsif old.status='accepted' and new.status<>'accepted' then
      update public.profiles set followers_count=greatest(followers_count-1,0) where id=old.followee_id;
      update public.profiles set following_count=greatest(following_count-1,0) where id=old.follower_id;
    end if;
  end if;
  return null;
end;
$$;
create or replace function public.sync_like_count()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then update public.posts set like_count=like_count+1 where id=new.post_id;
  elsif tg_op='DELETE' then update public.posts set like_count=greatest(like_count-1,0) where id=old.post_id; end if;
  return null;
end;
$$;
create or replace function public.sync_comment_count()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then update public.posts set comment_count=comment_count+1 where id=new.post_id;
  elsif tg_op='DELETE' then update public.posts set comment_count=greatest(comment_count-1,0) where id=old.post_id; end if;
  return null;
end;
$$;
-- Trigger functions are not browser-callable APIs. Existing triggers remain
-- installed; only their secured definitions are replaced.
revoke all on function public.sync_follow_counts() from public,anon,authenticated;
revoke all on function public.sync_like_count() from public,anon,authenticated;
revoke all on function public.sync_comment_count() from public,anon,authenticated;
-- Harden search_path on pre-existing SECURITY DEFINER trigger/helper routines.
alter function public.handle_new_user() set search_path=public,pg_temp;
alter function public.chcn_notify_follow() set search_path=public,pg_temp;
alter function public.chcn_notify_like() set search_path=public,pg_temp;
alter function public.chcn_notify_comment() set search_path=public,pg_temp;
alter function public.chcn_notify_message() set search_path=public,pg_temp;
alter function public.chcn_notify_scheduled_live_followers() set search_path=public,pg_temp;
alter function public.chcn_notify_gift_received() set search_path=public,pg_temp;
alter function public.chcn_notify_mentions() set search_path=public,pg_temp;
alter function public.get_my_creator_metrics() set search_path=public,pg_temp;

-- Account deactivation must also be enforced by Supabase RLS, not only by
-- website navigation/backend routes: old signed access tokens may still exist.
-- Follow request security: public creators can be followed immediately, while
-- followers/private accounts only receive a pending request. The helper uses
-- canonical database records to avoid RLS recursion and prevents blocked follows.
create or replace function public.chcn_can_create_follow(p_follower_id uuid,p_followee_id uuid,p_status text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(
    p_follower_id=auth.uid()
    and p_follower_id is not null and p_followee_id is not null and p_follower_id<>p_followee_id
    and public.chcn_my_account_active()
    and exists(select 1 from public.profiles target where target.id=p_followee_id and target.account_status='active'
      and ((coalesce(target.privacy->>'account','public')='public' and p_status='accepted')
        or (coalesce(target.privacy->>'account','public')<>'public' and p_status='pending')))
    and not exists(select 1 from public.blocks b where (b.blocker_id=p_follower_id and b.blocked_id=p_followee_id)
      or (b.blocker_id=p_followee_id and b.blocked_id=p_follower_id)),false);
$$;
revoke all on function public.chcn_can_create_follow(uuid,uuid,text) from public,anon;
grant execute on function public.chcn_can_create_follow(uuid,uuid,text) to authenticated;

drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select to anon,authenticated using (
  (public.chcn_my_account_active() and (follower_id=auth.uid() or followee_id=auth.uid()))
  or (status='accepted'
    and exists(select 1 from public.profiles a where a.id=follower_id and a.account_status='active')
    and exists(select 1 from public.profiles b where b.id=followee_id and b.account_status='active'
      and coalesce(b.privacy->>'account','public')='public'))
);
drop policy if exists follows_write on public.follows;
create policy follows_write on public.follows for insert to authenticated
  with check (public.chcn_can_create_follow(follower_id,followee_id,status));
drop policy if exists follows_del on public.follows;
create policy follows_del on public.follows for delete to authenticated
  using ((follower_id=auth.uid() or followee_id=auth.uid()) and public.chcn_my_account_active());
drop policy if exists follows_upd on public.follows;
create policy follows_upd on public.follows for update to authenticated
  using (followee_id=auth.uid() and status='pending' and public.chcn_my_account_active())
  with check (followee_id=auth.uid() and status='accepted' and public.chcn_my_account_active());
revoke update on public.follows from anon,authenticated;
grant update(status) on public.follows to authenticated;

drop policy if exists blocks_all on public.blocks;
create policy blocks_all on public.blocks for all to authenticated
  using (blocker_id=auth.uid() and public.chcn_my_account_active())
  with check (blocker_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists mutes_all on public.mutes;
create policy mutes_all on public.mutes for all to authenticated
  using (muter_id=auth.uid() and public.chcn_my_account_active())
  with check (muter_id=auth.uid() and public.chcn_my_account_active());

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to anon,authenticated using (
  (author_id=auth.uid() and public.chcn_my_account_active())
  or (audience='public' and is_draft=false and is_test=false
      and exists(select 1 from public.profiles p where p.id=posts.author_id and p.account_status='active'
        and coalesce(p.privacy->>'account','public')='public')
      and not exists(select 1 from public.blocks b where b.blocker_id=auth.uid() and b.blocked_id=posts.author_id)
      and not exists(select 1 from public.blocks b where b.blocker_id=posts.author_id and b.blocked_id=auth.uid()))
  or (audience='followers' and is_draft=false and is_test=false
      and exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.followee_id=posts.author_id and f.status='accepted')
      and exists(select 1 from public.profiles p where p.id=posts.author_id and p.account_status='active')
      and not exists(select 1 from public.blocks b where b.blocker_id=auth.uid() and b.blocked_id=posts.author_id)
      and not exists(select 1 from public.blocks b where b.blocker_id=posts.author_id and b.blocked_id=auth.uid()))
);
drop policy if exists posts_write on public.posts;
create policy posts_write on public.posts for insert to authenticated with check (author_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated using (author_id=auth.uid() and public.chcn_my_account_active()) with check (author_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated using (author_id=auth.uid() and public.chcn_my_account_active());

drop policy if exists likes_write on public.likes;
create policy likes_write on public.likes for all to authenticated
  using (user_id=auth.uid() and public.chcn_my_account_active())
  with check (user_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists comments_write on public.comments;
create policy comments_write on public.comments for insert to authenticated with check (
  author_id=auth.uid() and public.chcn_my_account_active() and exists (
    select 1 from public.posts p join public.profiles owner_profile on owner_profile.id=p.author_id
    where p.id=comments.post_id and p.allow_comments=true
      and owner_profile.account_status='active'
      and coalesce(owner_profile.privacy->>'comments','everyone') <> 'nobody'
      and (coalesce(owner_profile.privacy->>'comments','everyone') <> 'followers'
        or exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.followee_id=p.author_id and f.status='accepted'))
      and not exists(select 1 from public.blocks b where b.blocker_id=auth.uid() and b.blocked_id=p.author_id)
      and not exists(select 1 from public.blocks b where b.blocker_id=p.author_id and b.blocked_id=auth.uid())
  )
);
drop policy if exists comments_del on public.comments;
create policy comments_del on public.comments for delete to authenticated
  using (author_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists reposts_write on public.reposts;
create policy reposts_write on public.reposts for all to authenticated
  using (user_id=auth.uid() and public.chcn_my_account_active())
  with check (user_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists saves_all on public.saves;
create policy saves_all on public.saves for all to authenticated
  using (user_id=auth.uid() and public.chcn_my_account_active())
  with check (user_id=auth.uid() and public.chcn_my_account_active());

-- Stop old signed JWTs for deactivated accounts from reading private threads.
drop policy if exists conv_read on public.conversations;
create policy conv_read on public.conversations for select to authenticated using (
  public.chcn_my_account_active()
  and exists(select 1 from public.conversation_members m where m.conversation_id=conversations.id and m.user_id=auth.uid())
);
drop policy if exists convmem_read on public.conversation_members;
create policy convmem_read on public.conversation_members for select to authenticated
  using (user_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (
  public.chcn_my_account_active()
  and exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid())
);
drop policy if exists messages_write on public.messages;
create policy messages_write on public.messages for insert to authenticated with check (
  sender_id=auth.uid() and public.chcn_my_account_active()
  and exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid())
);
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
  using (sender_id=auth.uid() and public.chcn_my_account_active()
    and exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()))
  with check (sender_id=auth.uid() and public.chcn_my_account_active()
    and exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()));
revoke update on public.messages from anon,authenticated;
drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications for select to authenticated
  using (user_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using (user_id=auth.uid() and public.chcn_my_account_active())
  with check (user_id=auth.uid() and public.chcn_my_account_active());
revoke update on public.notifications from anon,authenticated;
grant update(read) on public.notifications to authenticated;
drop policy if exists user_settings_read on public.user_settings;
create policy user_settings_read on public.user_settings for select to authenticated
  using (user_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists user_settings_insert on public.user_settings;
create policy user_settings_insert on public.user_settings for insert to authenticated
  with check (user_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists user_settings_update on public.user_settings;
create policy user_settings_update on public.user_settings for update to authenticated
  using (user_id=auth.uid() and public.chcn_my_account_active())
  with check (user_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists user_settings_delete on public.user_settings;
create policy user_settings_delete on public.user_settings for delete to authenticated
  using (user_id=auth.uid() and public.chcn_my_account_active());

-- If Storage exists on this project, deactivate client-side media mutations too.
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists chcn_creator_content_upload_own on storage.objects';
    execute 'create policy chcn_creator_content_upload_own on storage.objects for insert to authenticated with check (bucket_id = ''creator-content'' and (storage.foldername(name))[1] = auth.uid()::text and public.chcn_my_account_active())';
    execute 'drop policy if exists chcn_creator_content_update_own on storage.objects';
    execute 'create policy chcn_creator_content_update_own on storage.objects for update to authenticated using (bucket_id = ''creator-content'' and (storage.foldername(name))[1] = auth.uid()::text and public.chcn_my_account_active()) with check (bucket_id = ''creator-content'' and (storage.foldername(name))[1] = auth.uid()::text and public.chcn_my_account_active())';
    execute 'drop policy if exists chcn_creator_content_delete_own on storage.objects';
    execute 'create policy chcn_creator_content_delete_own on storage.objects for delete to authenticated using (bucket_id = ''creator-content'' and (storage.foldername(name))[1] = auth.uid()::text and public.chcn_my_account_active())';
  end if;
end $$;

-- Server-issued LIVE and messaging records cannot be created or changed
-- through a still-valid JWT after a profile has been deactivated.
drop policy if exists live_write on public.live_sessions;
create policy live_write on public.live_sessions for insert to authenticated
  with check (host_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists live_update on public.live_sessions;
create policy live_update on public.live_sessions for update to authenticated
  using (host_id=auth.uid() and public.chcn_my_account_active())
  with check (host_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists guests_self on public.live_guests;
create policy guests_self on public.live_guests for update to authenticated using (
  (user_id=auth.uid() or exists(select 1 from public.live_sessions s where s.id=live_id and s.host_id=auth.uid()))
  and public.chcn_my_account_active()
) with check (
  (user_id=auth.uid() or exists(select 1 from public.live_sessions s where s.id=live_id and s.host_id=auth.uid()))
  and public.chcn_my_account_active()
);
drop policy if exists convmem_update_own on public.conversation_members;
create policy convmem_update_own on public.conversation_members for update to authenticated
  using (user_id=auth.uid() and public.chcn_my_account_active())
  with check (user_id=auth.uid() and public.chcn_my_account_active());
revoke update on public.conversation_members from anon,authenticated;
grant update(last_read_at) on public.conversation_members to authenticated;

-- Replace the direct-conversation RPC so recipients must be active accounts and
-- an old JWT from a deactivated sender cannot reopen or create conversations.
create or replace function public.create_or_get_direct_conversation(p_other_user uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_me uuid := auth.uid();
  v_conversation uuid;
  v_message_privacy text;
begin
  if v_me is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.chcn_my_account_active() then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  if p_other_user is null or p_other_user=v_me then raise exception 'INVALID_RECIPIENT'; end if;
  if not exists(select 1 from public.profiles where id=p_other_user and account_status='active') then raise exception 'RECIPIENT_NOT_FOUND'; end if;
  if exists(select 1 from public.blocks b where (b.blocker_id=v_me and b.blocked_id=p_other_user) or (b.blocker_id=p_other_user and b.blocked_id=v_me)) then raise exception 'MESSAGING_BLOCKED'; end if;
  select coalesce(p.privacy->>'messages','everyone') into v_message_privacy from public.profiles p where p.id=p_other_user;
  if v_message_privacy='nobody' then raise exception 'RECIPIENT_DOES_NOT_ACCEPT_MESSAGES'; end if;
  if v_message_privacy='followers' and not exists(select 1 from public.follows f where f.follower_id=v_me and f.followee_id=p_other_user and f.status='accepted') then raise exception 'FOLLOW_REQUIRED_TO_MESSAGE'; end if;
  perform pg_advisory_xact_lock(hashtextextended('direct-message:'||least(v_me::text,p_other_user::text)||':'||greatest(v_me::text,p_other_user::text),0));
  select c.id into v_conversation from public.conversations c
    join public.conversation_members a on a.conversation_id=c.id and a.user_id=v_me
    join public.conversation_members b on b.conversation_id=c.id and b.user_id=p_other_user
    where c.is_group=false and (select count(*) from public.conversation_members m where m.conversation_id=c.id)=2
    order by c.created_at asc limit 1;
  if v_conversation is not null then return v_conversation; end if;
  insert into public.conversations(is_group,title) values(false,null) returning id into v_conversation;
  insert into public.conversation_members(conversation_id,user_id) values(v_conversation,v_me),(v_conversation,p_other_user);
  return v_conversation;
end;
$$;
revoke all on function public.create_or_get_direct_conversation(uuid) from public,anon;
grant execute on function public.create_or_get_direct_conversation(uuid) to authenticated;

-- Persist the extra notification category without discarding older settings.
alter table public.user_settings alter column notifications set default
  '{"follows":true,"gifts":true,"live":true,"mentions":true,"messages":true,"likes":true,"comments":true,"battles":true}'::jsonb;

-- Honour a requested registration username rather than silently deriving a
-- different handle from the email prefix. Collisions are resolved safely.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  requested_username text;
  base_username text;
  final_username text;
  suffix text;
  n integer := 0;
begin
  requested_username := coalesce(new.raw_user_meta_data->>'username','');
  if requested_username ~ '^[A-Za-z0-9_.]{3,30}$' then
    base_username := requested_username;
  else
    base_username := regexp_replace(split_part(coalesce(new.email,'user'),'@',1),'[^A-Za-z0-9_.]','','g');
    if length(base_username) < 3 then base_username := 'user_' || substr(replace(new.id::text,'-',''),1,8); end if;
    base_username := substr(base_username,1,30);
  end if;
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    n := n + 1;
    suffix := n::text;
    final_username := substr(base_username,1,30-length(suffix)) || suffix;
  end loop;
  insert into public.profiles(id,username,display_name,avatar_url)
  values (
    new.id,
    final_username,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''), final_username),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict(id) do nothing;
  return new;
end;
$$;

-- Extend the canonical settings saver to preserve the battle-notification toggle.
create or replace function public.save_my_user_settings(p_privacy jsonb, p_notifications jsonb, p_live jsonb)
returns public.user_settings
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_privacy jsonb;
  v_notifications jsonb;
  v_live jsonb;
  v_row public.user_settings;
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.chcn_my_account_active() then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  if coalesce(p_privacy->>'account','public') not in ('public','followers','private') then raise exception 'INVALID_ACCOUNT_VISIBILITY'; end if;
  if coalesce(p_privacy->>'messages','everyone') not in ('everyone','followers','nobody') then raise exception 'INVALID_MESSAGE_PRIVACY'; end if;
  if coalesce(p_privacy->>'comments','everyone') not in ('everyone','followers','nobody') then raise exception 'INVALID_COMMENT_PRIVACY'; end if;
  if coalesce(p_live->>'audience','public') not in ('public','followers','private') then raise exception 'INVALID_LIVE_AUDIENCE'; end if;
  if coalesce(p_live->>'guest_permissions','allowed') not in ('allowed','host_only') then raise exception 'INVALID_GUEST_PERMISSION'; end if;
  v_privacy := jsonb_build_object('account',coalesce(p_privacy->>'account','public'),'messages',coalesce(p_privacy->>'messages','everyone'),'comments',coalesce(p_privacy->>'comments','everyone'));
  v_notifications := jsonb_build_object(
    'follows',coalesce((p_notifications->>'follows')::boolean,true),
    'gifts',coalesce((p_notifications->>'gifts')::boolean,true),
    'live',coalesce((p_notifications->>'live')::boolean,true),
    'mentions',coalesce((p_notifications->>'mentions')::boolean,true),
    'messages',coalesce((p_notifications->>'messages')::boolean,true),
    'likes',coalesce((p_notifications->>'likes')::boolean,true),
    'comments',coalesce((p_notifications->>'comments')::boolean,true),
    'battles',coalesce((p_notifications->>'battles')::boolean,true)
  );
  v_live := jsonb_build_object('audience',coalesce(p_live->>'audience','public'),'guest_permissions',coalesce(p_live->>'guest_permissions','allowed'));
  update public.profiles set privacy=v_privacy,updated_at=now() where id=v_user;
  insert into public.user_settings(user_id,privacy,notifications,live,updated_at) values(v_user,v_privacy,v_notifications,v_live,now())
    on conflict(user_id) do update set privacy=excluded.privacy,notifications=excluded.notifications,live=excluded.live,updated_at=excluded.updated_at
    returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.save_my_user_settings(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_my_user_settings(jsonb,jsonb,jsonb) to authenticated;
revoke insert,update,delete on public.user_settings from anon,authenticated;
grant select on public.user_settings to authenticated;

-- Battle invitations: status-only workflow. Scores, winners, coins and gifts are
-- deliberately not fabricated or auto-awarded.
create table if not exists public.creator_battles (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  message text not null default '' check (length(message) <= 1000),
  scheduled_at timestamptz,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint creator_battles_no_self check (challenger_id <> opponent_id)
);
create index if not exists creator_battles_challenger_idx on public.creator_battles(challenger_id,created_at desc);
create index if not exists creator_battles_opponent_idx on public.creator_battles(opponent_id,status,created_at desc);
alter table public.creator_battles enable row level security;
drop policy if exists creator_battles_read_participants on public.creator_battles;
create policy creator_battles_read_participants on public.creator_battles
  for select to authenticated using ((challenger_id=auth.uid() or opponent_id=auth.uid()) and public.chcn_my_account_active() or public.is_admin());
drop policy if exists creator_battles_insert_none on public.creator_battles;
create policy creator_battles_insert_none on public.creator_battles
  for insert to authenticated with check (false);
drop policy if exists creator_battles_update_none on public.creator_battles;
create policy creator_battles_update_none on public.creator_battles
  for update to authenticated using (false) with check (false);
drop policy if exists creator_battles_delete_none on public.creator_battles;
create policy creator_battles_delete_none on public.creator_battles
  for delete to authenticated using (false);
grant select on public.creator_battles to authenticated;
revoke insert,update,delete on public.creator_battles from anon,authenticated;
grant all on public.creator_battles to service_role;

create or replace function public.create_creator_battle(
  p_opponent_id uuid, p_title text, p_message text default '', p_scheduled_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_me uuid := auth.uid();
  v_title text := trim(coalesce(p_title,''));
  v_message text := trim(coalesce(p_message,''));
  v_opponent public.profiles;
  v_id uuid;
begin
  if v_me is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.chcn_my_account_active() then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  if p_opponent_id is null or p_opponent_id=v_me then raise exception 'INVALID_BATTLE_OPPONENT'; end if;
  if length(v_title)<1 or length(v_title)>120 or length(v_message)>1000 then raise exception 'INVALID_BATTLE_DETAILS'; end if;
  select * into v_opponent from public.profiles where id=p_opponent_id;
  if v_opponent.id is null or v_opponent.account_status <> 'active' then raise exception 'BATTLE_OPPONENT_NOT_FOUND'; end if;
  if exists(select 1 from public.blocks where (blocker_id=v_me and blocked_id=p_opponent_id) or (blocker_id=p_opponent_id and blocked_id=v_me)) then raise exception 'BATTLE_BLOCKED'; end if;
  if coalesce(v_opponent.privacy->>'messages','everyone')='nobody' then raise exception 'OPPONENT_DOES_NOT_ACCEPT_INVITATIONS'; end if;
  if coalesce(v_opponent.privacy->>'messages','everyone')='followers'
    and not exists(select 1 from public.follows where follower_id=v_me and followee_id=p_opponent_id and status='accepted') then
    raise exception 'OPPONENT_DOES_NOT_ACCEPT_INVITATIONS';
  end if;
  if p_scheduled_at is not null and p_scheduled_at < now() - interval '5 minutes' then raise exception 'BATTLE_TIME_IN_PAST'; end if;
  insert into public.creator_battles(challenger_id,opponent_id,title,message,scheduled_at)
  values(v_me,p_opponent_id,v_title,v_message,p_scheduled_at) returning id into v_id;
  if coalesce((select (notifications->>'battles')::boolean from public.user_settings where user_id=p_opponent_id),true) then
    insert into public.notifications(user_id,type,actor_id,data)
    values(p_opponent_id,'battle_invitation',v_me,jsonb_build_object('battle_id',v_id,'title',v_title));
  end if;
  return v_id;
end;
$$;
revoke all on function public.create_creator_battle(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.create_creator_battle(uuid,text,text,timestamptz) to authenticated;

create or replace function public.respond_creator_battle(p_battle_id uuid,p_action text)
returns public.creator_battles
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_me uuid := auth.uid();
  v_battle public.creator_battles;
  v_next text := lower(trim(coalesce(p_action,'')));
  v_other uuid;
begin
  if v_me is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.chcn_my_account_active() then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  select * into v_battle from public.creator_battles where id=p_battle_id for update;
  if v_battle.id is null then raise exception 'BATTLE_NOT_FOUND'; end if;
  if v_next not in ('accept','decline','cancel','complete') then raise exception 'INVALID_BATTLE_ACTION'; end if;
  if v_next in ('accept','decline') then
    if v_battle.opponent_id<>v_me or v_battle.status<>'pending' then raise exception 'BATTLE_ACTION_NOT_ALLOWED'; end if;
    v_battle.status := case when v_next='accept' then 'accepted' else 'declined' end;
    v_other := v_battle.challenger_id;
  elsif v_next='cancel' then
    if v_battle.challenger_id<>v_me or v_battle.status not in ('pending','accepted') then raise exception 'BATTLE_ACTION_NOT_ALLOWED'; end if;
    v_battle.status := 'cancelled'; v_other := v_battle.opponent_id;
  else
    if v_me not in (v_battle.challenger_id,v_battle.opponent_id) or v_battle.status<>'accepted' then raise exception 'BATTLE_ACTION_NOT_ALLOWED'; end if;
    v_battle.status := 'completed'; v_battle.completed_at := now();
    v_other := case when v_battle.challenger_id=v_me then v_battle.opponent_id else v_battle.challenger_id end;
  end if;
  update public.creator_battles set status=v_battle.status,updated_at=now(),completed_at=v_battle.completed_at where id=p_battle_id returning * into v_battle;
  if coalesce((select (notifications->>'battles')::boolean from public.user_settings where user_id=v_other),true) then
    insert into public.notifications(user_id,type,actor_id,data)
    values(v_other,'battle_status',v_me,jsonb_build_object('battle_id',v_battle.id,'status',v_battle.status,'title',v_battle.title));
  end if;
  return v_battle;
end;
$$;
revoke all on function public.respond_creator_battle(uuid,text) from public,anon;
grant execute on function public.respond_creator_battle(uuid,text) to authenticated;

-- Admin-configured challenges/missions. Rewards are claims for manual review;
-- no automatic coin, diamond, cash or prize credit is performed.
create table if not exists public.creator_missions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null default '' check (length(description)<=1500),
  metric_key text not null check (metric_key in ('followers','posts','views','streams','gifts_received','diamonds_from_gifts','coins_spent_gifting')),
  target_value bigint not null check (target_value>0),
  reward_label text not null check (length(trim(reward_label)) between 1 and 120),
  reward_details text not null default '' check (length(reward_details)<=1500),
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_mission_dates check (ends_at is null or starts_at is null or ends_at>starts_at)
);
create index if not exists creator_missions_active_idx on public.creator_missions(active,starts_at,ends_at);
alter table public.creator_missions enable row level security;
drop policy if exists creator_missions_read_active on public.creator_missions;
create policy creator_missions_read_active on public.creator_missions for select to anon,authenticated
  using (active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) or public.is_admin());
drop policy if exists creator_missions_admin_insert on public.creator_missions;
create policy creator_missions_admin_insert on public.creator_missions for insert to authenticated with check (public.is_admin() and created_by=auth.uid());
drop policy if exists creator_missions_admin_update on public.creator_missions;
create policy creator_missions_admin_update on public.creator_missions for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists creator_missions_admin_delete on public.creator_missions;
create policy creator_missions_admin_delete on public.creator_missions for delete to authenticated using (public.is_admin());
grant select on public.creator_missions to anon,authenticated;
grant insert,update,delete on public.creator_missions to authenticated;

create table if not exists public.creator_mission_claims (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.creator_missions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  achieved_value bigint not null check (achieved_value>=0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','fulfilled')),
  reviewer_note text not null default '' check (length(reviewer_note)<=1500),
  reviewed_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(mission_id,user_id)
);
alter table public.creator_mission_claims enable row level security;
drop policy if exists creator_mission_claims_read_own_admin on public.creator_mission_claims;
create policy creator_mission_claims_read_own_admin on public.creator_mission_claims for select to authenticated using ((user_id=auth.uid() and public.chcn_my_account_active()) or public.is_admin());
drop policy if exists creator_mission_claims_no_client_insert on public.creator_mission_claims;
create policy creator_mission_claims_no_client_insert on public.creator_mission_claims for insert to authenticated with check (false);
drop policy if exists creator_mission_claims_admin_update on public.creator_mission_claims;
create policy creator_mission_claims_admin_update on public.creator_mission_claims for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists creator_mission_claims_no_delete on public.creator_mission_claims;
create policy creator_mission_claims_no_delete on public.creator_mission_claims for delete to authenticated using (false);
grant select on public.creator_mission_claims to authenticated;
grant update on public.creator_mission_claims to authenticated;

create or replace function public.claim_creator_mission(p_mission_id uuid)
returns public.creator_mission_claims
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_me uuid := auth.uid();
  v_mission public.creator_missions;
  v_metrics jsonb;
  v_actual bigint;
  v_claim public.creator_mission_claims;
begin
  if v_me is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.chcn_my_account_active() then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  select * into v_mission from public.creator_missions where id=p_mission_id and active=true
    and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());
  if v_mission.id is null then raise exception 'MISSION_NOT_AVAILABLE'; end if;
  v_metrics := public.get_my_creator_metrics();
  v_actual := coalesce((v_metrics->>v_mission.metric_key)::bigint,0);
  if v_actual < v_mission.target_value then raise exception 'MISSION_NOT_COMPLETE'; end if;
  select * into v_claim from public.creator_mission_claims where mission_id=p_mission_id and user_id=v_me;
  if v_claim.id is not null then return v_claim; end if;
  insert into public.creator_mission_claims(mission_id,user_id,achieved_value)
    values(p_mission_id,v_me,v_actual) on conflict(mission_id,user_id) do nothing returning * into v_claim;
  if v_claim.id is null then
    select * into v_claim from public.creator_mission_claims where mission_id=p_mission_id and user_id=v_me;
  end if;
  return v_claim;
end;
$$;
revoke all on function public.claim_creator_mission(uuid) from public,anon;
grant execute on function public.claim_creator_mission(uuid) to authenticated;

-- Verification applications are private. Only a separate, minimal badge table
-- exposes actual admin-approved verification publicly.
create table if not exists public.creator_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  reason text not null check (length(trim(reason)) between 20 and 2000),
  evidence_url text not null default '' check (length(evidence_url)<=2000),
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  reviewer_note text not null default '' check (length(reviewer_note)<=1500),
  reviewed_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.creator_verification_requests enable row level security;
drop policy if exists creator_verification_requests_read_own_admin on public.creator_verification_requests;
create policy creator_verification_requests_read_own_admin on public.creator_verification_requests for select to authenticated using ((user_id=auth.uid() and public.chcn_my_account_active()) or public.is_admin());
drop policy if exists creator_verification_requests_insert_own on public.creator_verification_requests;
create policy creator_verification_requests_insert_own on public.creator_verification_requests for insert to authenticated with check (user_id=auth.uid() and public.chcn_my_account_active() and status='pending');
drop policy if exists creator_verification_requests_update_own_pending on public.creator_verification_requests;
create policy creator_verification_requests_update_own_pending on public.creator_verification_requests for update to authenticated using (user_id=auth.uid() and public.chcn_my_account_active() and status in ('pending','rejected')) with check (user_id=auth.uid() and public.chcn_my_account_active() and status='pending');
drop policy if exists creator_verification_requests_admin_update on public.creator_verification_requests;
create policy creator_verification_requests_admin_update on public.creator_verification_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select,insert,update on public.creator_verification_requests to authenticated;

create table if not exists public.public_creator_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_type text not null check (badge_type in ('verified_creator')),
  created_at timestamptz not null default now(),
  primary key(user_id,badge_type)
);
alter table public.public_creator_badges enable row level security;
drop policy if exists public_creator_badges_read_verified on public.public_creator_badges;
create policy public_creator_badges_read_verified on public.public_creator_badges for select to anon,authenticated using (public.chcn_can_view_profile(user_id));
drop policy if exists public_creator_badges_admin_insert on public.public_creator_badges;
create policy public_creator_badges_admin_insert on public.public_creator_badges for insert to authenticated with check (public.is_admin());
drop policy if exists public_creator_badges_admin_update on public.public_creator_badges;
create policy public_creator_badges_admin_update on public.public_creator_badges for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists public_creator_badges_admin_delete on public.public_creator_badges;
create policy public_creator_badges_admin_delete on public.public_creator_badges for delete to authenticated using (public.is_admin());
grant select on public.public_creator_badges to anon,authenticated;
grant insert,update,delete on public.public_creator_badges to authenticated;

-- Real daily/weekly/monthly (rolling-window) gift rankings. Only public creator
-- identities are exposed; no transactions are created by this read-only function.
create or replace function public.get_public_gift_rankings(
  p_period text default 'weekly', p_metric text default 'received', p_limit integer default 20
)
returns table(user_id uuid,username text,display_name text,avatar_url text,score bigint,gift_count bigint,metric text,period text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
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
    from public.profiles p join public.gift_transactions g on g.recipient_id=p.id and g.created_at>=v_since
    where p.account_status='active' and coalesce(p.privacy->>'account','public')='public'
    group by p.id,p.username,p.display_name,p.avatar_url
    order by 5 desc,6 desc,p.username asc limit v_limit;
  else
    return query select p.id,p.username::text,p.display_name,p.avatar_url,
      coalesce(sum(g.coin_cost),0)::bigint,count(g.id)::bigint,v_metric,v_period
    from public.profiles p join public.gift_transactions g on g.sender_id=p.id and g.created_at>=v_since
    where p.account_status='active' and coalesce(p.privacy->>'account','public')='public'
    group by p.id,p.username,p.display_name,p.avatar_url
    order by 5 desc,6 desc,p.username asc limit v_limit;
  end if;
end;
$$;
revoke all on function public.get_public_gift_rankings(text,text,integer) from public;
grant execute on function public.get_public_gift_rankings(text,text,integer) to anon,authenticated;

-- Update public creator rankings to exclude deactivated/private profiles.
create or replace function public.get_public_creator_rankings(p_metric text default 'followers', p_limit integer default 20)
returns table(user_id uuid, username text, display_name text, avatar_url text, score bigint, metric text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
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
    where p.account_status='active' and coalesce(p.privacy->>'account','public')='public'
    order by 5 desc,p.username asc limit v_limit;
end;
$$;
revoke all on function public.get_public_creator_rankings(text,integer) from public;
grant execute on function public.get_public_creator_rankings(text,integer) to anon,authenticated;

-- Metrics are returned from the existing canonical, owner-scoped function.
-- Explicitly restore grants to the intended audience after schema changes.
revoke all on function public.get_my_creator_metrics() from public,anon;
grant execute on function public.get_my_creator_metrics() to authenticated;
notify pgrst,'reload schema';
commit;
