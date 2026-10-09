-- Creator Hub Creator Network
-- Reconcile LIVE session and wallet columns with server requirements.

alter table public.live_sessions
  drop constraint if exists live_sessions_status_check;

alter table public.live_sessions
  add constraint live_sessions_status_check
  check (status in ('pending', 'live', 'ended'));

alter table public.live_sessions
  add column if not exists updated_at timestamptz not null default now();

alter table public.wallets
  add column if not exists lifetime_gifts_sent bigint not null default 0
  check (lifetime_gifts_sent >= 0);
