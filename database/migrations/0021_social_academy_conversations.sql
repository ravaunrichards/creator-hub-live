-- Creator Hub Creator Network — 0021 social workflows, messaging and Academy progress.
-- Forward-only. Apply only after the read-only schema preflight confirms the
-- identity/social tables from migrations 0001, 0002 and 0004 exist.
-- Creates no users, posts, messages, course progress, certificates or reports.
begin;

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.follows') is null
     or to_regclass('public.blocks') is null
     or to_regclass('public.posts') is null
     or to_regclass('public.likes') is null
     or to_regclass('public.comments') is null
     or to_regclass('public.conversations') is null
     or to_regclass('public.conversation_members') is null
     or to_regclass('public.messages') is null
     or to_regclass('public.notifications') is null then
    raise exception '0021 prerequisites missing: apply/reconcile identity and social migrations 0001, 0002 and 0004 before 0021.';
  end if;
end $$;

-- Keep a durable user_settings row available before the social notification triggers below.
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
create policy user_settings_read on public.user_settings for select to authenticated using (user_id=auth.uid());
create policy user_settings_insert on public.user_settings for insert to authenticated with check (user_id=auth.uid());
create policy user_settings_update on public.user_settings for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select, insert, update, delete on public.user_settings to authenticated;

-- Durable, per-account learning state. The actual course content is maintained
-- in reviewed source files; this table holds only a user's progress and notes.
create table if not exists public.course_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null check (length(trim(course_id)) between 1 and 100),
  progress jsonb not null default '{}'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  bookmarks jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
create index if not exists course_progress_updated_idx on public.course_progress(user_id, updated_at desc);
alter table public.course_progress enable row level security;
drop policy if exists course_progress_select_own on public.course_progress;
drop policy if exists course_progress_insert_own on public.course_progress;
drop policy if exists course_progress_update_own on public.course_progress;
drop policy if exists course_progress_delete_own on public.course_progress;
create policy course_progress_select_own on public.course_progress for select to authenticated using (user_id = auth.uid());
create policy course_progress_insert_own on public.course_progress for insert to authenticated with check (user_id = auth.uid());
create policy course_progress_update_own on public.course_progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy course_progress_delete_own on public.course_progress for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.course_progress to authenticated;

-- conversation_members is deliberately not directly insertable by browser roles.
-- Create/reuse direct conversations in a transaction after checking blocks and
-- the recipient's message privacy setting. No service-role key enters the browser.
create or replace function public.create_or_get_direct_conversation(p_other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_conversation uuid;
  v_message_privacy text;
begin
  if v_me is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_other_user is null or p_other_user = v_me then raise exception 'INVALID_RECIPIENT'; end if;
  if not exists (select 1 from public.profiles where id = p_other_user) then raise exception 'RECIPIENT_NOT_FOUND'; end if;
  if exists (select 1 from public.blocks b where (b.blocker_id=v_me and b.blocked_id=p_other_user) or (b.blocker_id=p_other_user and b.blocked_id=v_me)) then
    raise exception 'MESSAGING_BLOCKED';
  end if;
  select coalesce(p.privacy->>'messages','everyone') into v_message_privacy from public.profiles p where p.id=p_other_user;
  if v_message_privacy = 'nobody' then raise exception 'RECIPIENT_DOES_NOT_ACCEPT_MESSAGES'; end if;
  if v_message_privacy = 'followers' and not exists (
    select 1 from public.follows f where f.follower_id=v_me and f.followee_id=p_other_user and f.status='accepted'
  ) then raise exception 'FOLLOW_REQUIRED_TO_MESSAGE'; end if;

  perform pg_advisory_xact_lock(hashtextextended('direct-message:'||least(v_me::text,p_other_user::text)||':'||greatest(v_me::text,p_other_user::text),0));
  select c.id into v_conversation
  from public.conversations c
  join public.conversation_members a on a.conversation_id=c.id and a.user_id=v_me
  join public.conversation_members b on b.conversation_id=c.id and b.user_id=p_other_user
  where c.is_group=false
    and (select count(*) from public.conversation_members m where m.conversation_id=c.id)=2
  order by c.created_at asc
  limit 1;
  if v_conversation is not null then return v_conversation; end if;

  insert into public.conversations(is_group,title) values(false,null) returning id into v_conversation;
  insert into public.conversation_members(conversation_id,user_id) values(v_conversation,v_me),(v_conversation,p_other_user);
  return v_conversation;
end;
$$;
revoke all on function public.create_or_get_direct_conversation(uuid) from public, anon;
grant execute on function public.create_or_get_direct_conversation(uuid) to authenticated;

-- The current user may update only their own read cursor; no membership changes
-- are allowed from the browser except through the checked function above.
drop policy if exists convmem_update_own on public.conversation_members;
create policy convmem_update_own on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update on public.conversation_members to authenticated;
grant select, insert, update on public.messages to authenticated;

-- Real activity notifications. These triggers only notify on a real inserted
-- interaction and never synthesize engagement counts or balances.
create or replace function public.chcn_notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status='accepted' and new.follower_id <> new.followee_id
     and coalesce((select (s.notifications->>'follows')::boolean from public.user_settings s where s.user_id=new.followee_id),true) then
    if tg_op='INSERT' then
      insert into public.notifications(user_id,type,actor_id,data)
        values(new.followee_id,'follow',new.follower_id,jsonb_build_object('follower_id',new.follower_id));
    elsif old.status is distinct from new.status then
      insert into public.notifications(user_id,type,actor_id,data)
        values(new.followee_id,'follow',new.follower_id,jsonb_build_object('follower_id',new.follower_id));
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists chcn_follow_notification_insert on public.follows;
drop trigger if exists chcn_follow_notification_update on public.follows;
create trigger chcn_follow_notification_insert after insert on public.follows for each row execute function public.chcn_notify_follow();
create trigger chcn_follow_notification_update after update of status on public.follows for each row execute function public.chcn_notify_follow();

create or replace function public.chcn_notify_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  select author_id into v_author from public.posts where id=new.post_id;
  if v_author is not null and v_author <> new.user_id
     and coalesce((select (s.notifications->>'likes')::boolean from public.user_settings s where s.user_id=v_author),true) then
    insert into public.notifications(user_id,type,actor_id,data)
      values(v_author,'like',new.user_id,jsonb_build_object('post_id',new.post_id));
  end if;
  return new;
end; $$;
drop trigger if exists chcn_like_notification on public.likes;
create trigger chcn_like_notification after insert on public.likes for each row execute function public.chcn_notify_like();

create or replace function public.chcn_notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  select author_id into v_author from public.posts where id=new.post_id;
  if v_author is not null and v_author <> new.author_id
     and coalesce((select (s.notifications->>'comments')::boolean from public.user_settings s where s.user_id=v_author),true) then
    insert into public.notifications(user_id,type,actor_id,data)
      values(v_author,'comment',new.author_id,jsonb_build_object('post_id',new.post_id,'comment_id',new.id));
  end if;
  return new;
end; $$;
drop trigger if exists chcn_comment_notification on public.comments;
create trigger chcn_comment_notification after insert on public.comments for each row execute function public.chcn_notify_comment();

create or replace function public.chcn_notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(user_id,type,actor_id,data)
  select m.user_id,'message',new.sender_id,jsonb_build_object('conversation_id',new.conversation_id,'message_id',new.id)
  from public.conversation_members m
  left join public.user_settings s on s.user_id=m.user_id
  where m.conversation_id=new.conversation_id and m.user_id<>new.sender_id
    and coalesce((s.notifications->>'messages')::boolean,true);
  return new;
end; $$;
drop trigger if exists chcn_message_notification on public.messages;
create trigger chcn_message_notification after insert on public.messages for each row execute function public.chcn_notify_message();

notify pgrst, 'reload schema';
commit;
