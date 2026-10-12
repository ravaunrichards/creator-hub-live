-- =====================================================================
-- Creator Hub Live \u2014 0005 Row Level Security
-- Default-deny. The browser only ever uses the ANON key, so these policies
-- are the real authorization boundary. Service-role (server) bypasses RLS.
-- =====================================================================

alter table public.profiles              enable row level security;
alter table public.follows               enable row level security;
alter table public.blocks                enable row level security;
alter table public.mutes                 enable row level security;
alter table public.posts                 enable row level security;
alter table public.likes                 enable row level security;
alter table public.comments              enable row level security;
alter table public.reposts               enable row level security;
alter table public.saves                 enable row level security;
alter table public.conversations         enable row level security;
alter table public.conversation_members  enable row level security;
alter table public.messages              enable row level security;
alter table public.notifications         enable row level security;
alter table public.wallets               enable row level security;
alter table public.coin_ledger           enable row level security;
alter table public.diamond_ledger        enable row level security;
alter table public.payments              enable row level security;
alter table public.gift_transactions     enable row level security;
alter table public.live_sessions         enable row level security;
alter table public.live_guests           enable row level security;
alter table public.subscriptions         enable row level security;

-- Helper: is current user an admin?
create or replace function public.is_admin() returns boolean language sql stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- profiles: world-readable, self-writable.
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- follows: anyone can read; you manage only your own follow edges.
create policy follows_read on public.follows for select using (true);
create policy follows_write on public.follows for insert with check (follower_id = auth.uid());
create policy follows_del  on public.follows for delete using (follower_id = auth.uid());
create policy follows_upd  on public.follows for update using (followee_id = auth.uid() or follower_id = auth.uid());

-- blocks / mutes: owner-only.
create policy blocks_all on public.blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy mutes_all  on public.mutes  for all using (muter_id = auth.uid())   with check (muter_id = auth.uid());

-- posts: readable if public (and not a test/draft), or you are the author,
-- or (followers audience) you follow the author.
create policy posts_read on public.posts for select using (
  (audience = 'public' and is_draft = false and is_test = false)
  or author_id = auth.uid()
  or (audience = 'followers' and exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.followee_id = posts.author_id and f.status = 'accepted'))
);
create policy posts_write on public.posts for insert with check (author_id = auth.uid());
create policy posts_update on public.posts for update using (author_id = auth.uid());
create policy posts_delete on public.posts for delete using (author_id = auth.uid());

-- likes / comments / reposts / saves
create policy likes_read on public.likes for select using (true);
create policy likes_write on public.likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy comments_read on public.comments for select using (true);
create policy comments_write on public.comments for insert with check (author_id = auth.uid());
create policy comments_del on public.comments for delete using (author_id = auth.uid());
create policy reposts_read on public.reposts for select using (true);
create policy reposts_write on public.reposts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saves_all on public.saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messaging: only members of a conversation can read/write it.
create policy conv_read on public.conversations for select using (
  exists (select 1 from public.conversation_members m where m.conversation_id = id and m.user_id = auth.uid()));
create policy convmem_read on public.conversation_members for select using (user_id = auth.uid());
create policy messages_read on public.messages for select using (
  exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()));
create policy messages_write on public.messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()));
create policy messages_update on public.messages for update using (sender_id = auth.uid());

-- notifications: owner-only read/update.
create policy notif_read on public.notifications for select using (user_id = auth.uid());
create policy notif_update on public.notifications for update using (user_id = auth.uid());

-- wallets + ledgers: READ-ONLY to owner. All writes happen through
-- SECURITY DEFINER functions / service role only. No direct client writes.
create policy wallets_read on public.wallets for select using (user_id = auth.uid());
create policy coin_ledger_read on public.coin_ledger for select using (user_id = auth.uid());
create policy diamond_ledger_read on public.diamond_ledger for select using (user_id = auth.uid());
create policy payments_read on public.payments for select using (user_id = auth.uid());
create policy gifts_tx_read on public.gift_transactions for select using (
  sender_id = auth.uid() or recipient_id = auth.uid());

-- live sessions: live ones are public; host manages own.
create policy live_read on public.live_sessions for select using (true);
create policy live_write on public.live_sessions for insert with check (host_id = auth.uid());
create policy live_update on public.live_sessions for update using (host_id = auth.uid());
create policy guests_read on public.live_guests for select using (true);
create policy guests_self on public.live_guests for update using (
  user_id = auth.uid() or exists (select 1 from public.live_sessions s where s.id = live_id and s.host_id = auth.uid()));

-- subscriptions: subscriber or creator can read.
create policy subs_read on public.subscriptions for select using (
  subscriber_id = auth.uid() or exists (
    select 1 from public.subscription_tiers t where t.id = tier_id and t.creator_id = auth.uid()));
