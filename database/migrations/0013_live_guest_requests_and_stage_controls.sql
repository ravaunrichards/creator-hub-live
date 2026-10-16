-- Creator Hub Live — guest requests and stage controls.
-- Apply after 0001..0012. This migration is additive and does not touch LIVE sessions.
begin;
alter table public.live_guests
  drop constraint if exists live_guests_status_check;
alter table public.live_guests
  add constraint live_guests_status_check
  check (status in ('requested','invited','accepted','rejected','removed','left'));
alter table public.live_guests
  add column if not exists created_at timestamptz not null default now();
alter table public.live_guests
  add column if not exists updated_at timestamptz not null default now();
create index if not exists live_guests_request_queue_idx
  on public.live_guests(live_id, status, created_at);
commit;
