-- Creator Hub Creator Network — 0025 LIVE guest request workflow.
-- Forward-only. Adds a distinct pending-request state without changing existing guest records.
begin;
do $$
begin
  if to_regclass('public.live_sessions') is null or to_regclass('public.live_guests') is null then
    raise exception '0025 prerequisites missing: apply migrations 0004_live_social_systems.sql and earlier first.';
  end if;
end $$;
alter table public.live_guests drop constraint if exists live_guests_status_check;
alter table public.live_guests add constraint live_guests_status_check
  check (status in ('requested','invited','accepted','rejected','removed','left'));
create index if not exists live_guests_live_status_idx on public.live_guests(live_id,status);
commit;
