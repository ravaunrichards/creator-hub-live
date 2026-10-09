-- =====================================================================
-- Creator Hub Live \u2014 0002 content, interactions, messaging, notifications
-- =====================================================================

-- ---------------------------------------------------------------------
-- posts: real content. media_url points to Supabase Storage objects.
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('photo','video','slideshow','text','short')),
  caption     text not null default '',
  media       jsonb not null default '[]'::jsonb, -- [{url,type,width,height,duration}]
  cover_url   text,
  hashtags    text[] not null default '{}',
  sound_id    uuid,
  audience    text not null default 'public' check (audience in ('public','followers','private')),
  allow_comments boolean not null default true,
  allow_download boolean not null default false,
  allow_repost   boolean not null default true,
  is_draft    boolean not null default false,
  is_test     boolean not null default false, -- EXCLUDE from production feeds
  like_count  int not null default 0,
  comment_count int not null default 0,
  view_count  bigint not null default 0,
  search_doc  tsvector,
  created_at  timestamptz not null default now()
);
create index if not exists posts_author_idx on public.posts(author_id, created_at desc);
create index if not exists posts_hashtags_idx on public.posts using gin(hashtags);
create index if not exists posts_search_idx on public.posts using gin(search_doc);

create or replace function public.posts_search_doc()
returns trigger language plpgsql as $$
begin
  new.search_doc := setweight(to_tsvector('simple', coalesce(new.caption,'')), 'A')
    || setweight(to_tsvector('simple', array_to_string(new.hashtags, ' ')), 'B');
  return new;
end; $$;
drop trigger if exists trg_posts_search on public.posts;
create trigger trg_posts_search before insert or update on public.posts
  for each row execute function public.posts_search_doc();

-- Interactions ---------------------------------------------------------
create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments(post_id, created_at);
create table if not exists public.reposts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quote text,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  collection text not null default 'default',
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, collection)
);

create or replace function public.sync_like_count()
returns trigger language plpgsql as $$
begin
  if tg_op='INSERT' then update public.posts set like_count=like_count+1 where id=new.post_id;
  elsif tg_op='DELETE' then update public.posts set like_count=greatest(like_count-1,0) where id=old.post_id; end if;
  return null; end; $$;
drop trigger if exists trg_like_count on public.likes;
create trigger trg_like_count after insert or delete on public.likes
  for each row execute function public.sync_like_count();

create or replace function public.sync_comment_count()
returns trigger language plpgsql as $$
begin
  if tg_op='INSERT' then update public.posts set comment_count=comment_count+1 where id=new.post_id;
  elsif tg_op='DELETE' then update public.posts set comment_count=greatest(comment_count-1,0) where id=old.post_id; end if;
  return null; end; $$;
drop trigger if exists trg_comment_count on public.comments;
create trigger trg_comment_count after insert or delete on public.comments
  for each row execute function public.sync_comment_count();

-- Messaging ------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  media jsonb,
  kind text not null default 'text' check (kind in ('text','image','video','voice')),
  reply_to uuid references public.messages(id) on delete set null,
  unsent boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);

-- Notifications --------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
