-- Creator Hub Live: message edit state and server-authoritative recurring creator tasks.
-- Existing username uniqueness is already enforced by profiles.username (CITEXT UNIQUE).

alter table public.messages
  add column if not exists edited_at timestamptz;

create table if not exists public.creator_task_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cycle_no bigint not null check (cycle_no > 0),
  task_key text not null,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  progress integer not null default 0 check (progress >= 0),
  target integer not null check (target > 0),
  created_at timestamptz not null default now(),
  unique (user_id, cycle_no)
);
create unique index if not exists creator_task_one_active_per_user
  on public.creator_task_cycles(user_id) where completed_at is null;
create index if not exists creator_task_history_idx
  on public.creator_task_cycles(user_id, completed_at desc);

alter table public.creator_task_cycles enable row level security;
revoke all on table public.creator_task_cycles from anon, authenticated;
grant all on table public.creator_task_cycles to service_role;


-- Keep the publicly readable profile privacy projection in sync with settings,
-- so feed policies can enforce account visibility without exposing settings rows.
update public.profiles p
set privacy = us.privacy
from public.user_settings us
where us.user_id = p.id and us.privacy is not null;

-- Public feeds must respect account privacy in addition to each post's audience.
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (
  author_id = auth.uid()
  or (
    is_draft = false and is_test = false and audience <> 'private'
    and (
      (
        coalesce((select p.privacy ->> 'account' from public.profiles p where p.id = posts.author_id), 'public') = 'public'
        and audience = 'public'
      )
      or (
        (
          audience = 'followers'
          or coalesce((select p.privacy ->> 'account' from public.profiles p where p.id = posts.author_id), 'public') in ('followers', 'private')
        )
        and exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid()
            and f.followee_id = posts.author_id
            and f.status = 'accepted'
        )
      )
    )
  )
);
