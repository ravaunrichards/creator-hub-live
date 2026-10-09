-- Creator Hub Live — 0010 RLS hardening for tables added after the original RLS migration.
-- No data is fabricated; policies are default-deny except for explicit public reads.

alter table public.coin_packages enable row level security;
alter table public.gifts enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.taps enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.leagues enable row level security;
alter table public.subscription_tiers enable row level security;
alter table public.referrals enable row level security;
alter table public.sounds enable row level security;
alter table public.audit_log enable row level security;
alter table public.reports enable row level security;
alter table public.league_seasons enable row level security;
alter table public.league_standings enable row level security;
alter table public.league_matches enable row level security;
alter table public.league_events enable row level security;

-- Public/read-only catalog and competition data.
drop policy if exists coin_packages_public_read on public.coin_packages;
create policy coin_packages_public_read on public.coin_packages for select using (active = true);

drop policy if exists gifts_public_read on public.gifts;
create policy gifts_public_read on public.gifts for select using (active = true);

drop policy if exists teams_public_read on public.teams;
create policy teams_public_read on public.teams for select using (true);

drop policy if exists team_members_public_read on public.team_members;
create policy team_members_public_read on public.team_members for select using (true);

drop policy if exists leagues_public_read on public.leagues;
create policy leagues_public_read on public.leagues for select using (true);

drop policy if exists subscription_tiers_public_read on public.subscription_tiers;
create policy subscription_tiers_public_read on public.subscription_tiers for select using (active = true);

drop policy if exists sounds_public_read on public.sounds;
create policy sounds_public_read on public.sounds for select using (true);

drop policy if exists league_seasons_public_read on public.league_seasons;
create policy league_seasons_public_read on public.league_seasons for select using (true);
drop policy if exists league_standings_public_read on public.league_standings;
create policy league_standings_public_read on public.league_standings for select using (true);
drop policy if exists league_matches_public_read on public.league_matches;
create policy league_matches_public_read on public.league_matches for select using (true);
drop policy if exists league_events_public_read on public.league_events;
create policy league_events_public_read on public.league_events for select using (true);

-- Match state is readable, but score/tap mutation remains server/RPC-only.
drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select using (true);
drop policy if exists match_participants_read on public.match_participants;
create policy match_participants_read on public.match_participants for select using (true);

-- User-owned referral/report records.
drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals for select using (referrer_id = auth.uid() or referred_id = auth.uid());
drop policy if exists referrals_insert on public.referrals;
create policy referrals_insert on public.referrals for insert with check (referrer_id = auth.uid());

drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select using (reporter_id = auth.uid() or public.is_admin());
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());

-- Administrative/audit records are never writable by browser clients.
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select using (public.is_admin());
