-- Creator Hub Creator Network — persistent account-level settings.
-- One row per authenticated user; no fabricated defaults beyond safe platform defaults.
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  privacy jsonb not null default '{"account":"public","messages":"everyone","comments":"everyone"}'::jsonb,
  notifications jsonb not null default '{"follows":true,"gifts":true,"live":true,"mentions":true,"messages":true}'::jsonb,
  live jsonb not null default '{"audience":"public","guest_permissions":"allowed"}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists user_settings_read on public.user_settings;
create policy user_settings_read on public.user_settings
  for select using (user_id = auth.uid());

drop policy if exists user_settings_insert on public.user_settings;
create policy user_settings_insert on public.user_settings
  for insert with check (user_id = auth.uid());

drop policy if exists user_settings_update on public.user_settings;
create policy user_settings_update on public.user_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
