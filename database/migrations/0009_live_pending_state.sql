-- Creator Hub Live — 0009 server-authoritative LIVE state fields
-- The backend creates sessions as pending and records authoritative update times.
-- Preserve prior migration history; this migration extends the existing table.

alter table public.live_sessions
  add column if not exists updated_at timestamptz not null default now();

alter table public.live_sessions
  drop constraint if exists live_sessions_status_check;

alter table public.live_sessions
  add constraint live_sessions_status_check
  check (status in ('pending', 'live', 'ended'));
