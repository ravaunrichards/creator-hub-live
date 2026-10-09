-- Creator Hub Creator Network
-- 0009: Support pending LIVE session lifecycle

begin;

alter table public.live_sessions
  drop constraint if exists live_sessions_status_check;

alter table public.live_sessions
  add constraint live_sessions_status_check
  check (status in ('pending', 'live', 'ended'));

alter table public.live_sessions
  add column if not exists updated_at
  timestamptz not null default now();

commit;
