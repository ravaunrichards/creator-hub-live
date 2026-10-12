-- Creator Hub Creator Network — 0019 league operations + PayPal payout workflow.
-- Forward-only migration. Run the read-only preflight and confirm all prerequisites
-- before applying. This does NOT create users, teams, seasons, fixtures, results,
-- balances, conversion rates or payment outcomes.

begin;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception '0019 prerequisite missing: public.profiles; review migration 0001_identity_social.sql.';
  end if;
  if to_regclass('public.teams') is null or to_regclass('public.leagues') is null
     or to_regclass('public.league_seasons') is null or to_regclass('public.league_standings') is null
     or to_regclass('public.league_matches') is null then
    raise exception '0019 league prerequisites missing; review migrations 0004, 0006, 0008, 0015, 0016, 0017 and 0018 after running the schema preflight.';
  end if;
  if to_regclass('public.wallets') is null or to_regclass('public.diamond_ledger') is null
     or to_regclass('public.diamond_withdrawals') is null then
    raise exception '0019 payout prerequisites missing: review migration 0003_wallet_payments.sql.';
  end if;
  if to_regclass('public.league_events') is null then
    raise exception '0019 prerequisite missing: public.league_events; review migration 0008_server_authoritative_leagues.sql.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='league_matches' and column_name='home_team_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='league_matches' and column_name='away_team_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='league_matches' and column_name='season_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='league_matches' and column_name='status') then
    raise exception '0019 cannot safely operate on public.league_matches: required core columns are missing. Restore/reconcile migration 0008 before this migration.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='diamond_withdrawals' and column_name='id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='diamond_withdrawals' and column_name='user_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='diamond_withdrawals' and column_name='amount')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='diamond_withdrawals' and column_name='status')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='diamond_withdrawals' and column_name='reference') then
    raise exception '0019 cannot safely operate on public.diamond_withdrawals: required core columns are missing. Restore/reconcile migration 0003 before this migration.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='wallets' and column_name='diamond_balance')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='wallets' and column_name='updated_at')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='diamond_ledger' and column_name='user_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='diamond_ledger' and column_name='amount')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='diamond_ledger' and column_name='balance_before')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='diamond_ledger' and column_name='balance_after')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='diamond_ledger' and column_name='source')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='diamond_ledger' and column_name='idempotency_key') then
    raise exception '0019 payout prerequisites are incompatible: wallet balance and full diamond-ledger contract from migration 0003 are required.';
  end if;
  if to_regprocedure('public.initialize_league_season(uuid)') is null
     or to_regprocedure('public.rebuild_league_positions(uuid)') is null
     or to_regprocedure('public.rebuild_league_standings(uuid)') is null
     or to_regprocedure('public.record_league_match_result(uuid,integer,integer,uuid)') is null
     or to_regprocedure('public.correct_league_match_result(uuid,integer,integer,uuid)') is null then
    raise exception '0019 required league authority functions are absent; review migration 0008_server_authoritative_leagues.sql before continuing.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='league_events' and column_name='season_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='league_events' and column_name='match_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='league_events' and column_name='event_type')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='league_events' and column_name='actor_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='league_events' and column_name='payload') then
    raise exception '0019 cannot safely audit league operations because public.league_events is missing required columns; review migration 0008.';
  end if;
  if not exists (select 1 from public.leagues where code='D5') then
    raise exception '0019 prerequisite missing: public.leagues must contain D5; review migration 0016_official_division_tiers.sql.';
  end if;
end $$;

-- Fixture round numbers permit stable round-robin generation. Existing matches are
-- preserved; null round numbers remain valid. Do not silently delete or merge records
-- if an earlier release created duplicate identities in the numbered fixture set.
alter table public.league_matches add column if not exists round_number integer;
do $$
begin
  if exists (
    select 1 from public.league_matches
    where round_number is not null
    group by season_id, division_code, round_number, home_team_id, away_team_id
    having count(*) > 1
  ) then
    raise exception '0019 stopped: duplicate numbered fixture identities exist in public.league_matches. Review those rows manually before retrying; migration will not delete results or fixtures.';
  end if;
end $$;
create index if not exists league_matches_season_round_idx
  on public.league_matches(season_id, division_code, round_number, created_at);
create unique index if not exists league_matches_fixture_identity_uq
  on public.league_matches(season_id, division_code, round_number, home_team_id, away_team_id);

-- Existing withdrawal ledger is retained. Extra columns store the actual payout
-- destination at request time and an admin-confirmed external PayPal payment record.
alter table public.diamond_withdrawals
  add column if not exists payout_email_snapshot text,
  add column if not exists fiat_amount numeric(12,2),
  add column if not exists fiat_currency text not null default 'USD',
  add column if not exists admin_note text,
  add column if not exists processed_by uuid references public.profiles(id) on delete set null,
  add column if not exists processed_at timestamptz,
  add column if not exists paypal_transaction_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='diamond_withdrawals_fiat_amount_positive' and conrelid='public.diamond_withdrawals'::regclass) then
    alter table public.diamond_withdrawals add constraint diamond_withdrawals_fiat_amount_positive
      check (fiat_amount is null or fiat_amount > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='diamond_withdrawals_fiat_currency_format' and conrelid='public.diamond_withdrawals'::regclass) then
    alter table public.diamond_withdrawals add constraint diamond_withdrawals_fiat_currency_format
      check (fiat_currency ~ '^[A-Z]{3}$') not valid;
  end if;
end $$;
do $$
begin
  if exists (select paypal_transaction_id from public.diamond_withdrawals where paypal_transaction_id is not null group by paypal_transaction_id having count(*) > 1) then
    raise exception '0019 stopped: duplicate non-empty PayPal transaction IDs already exist in public.diamond_withdrawals. Review the records before enabling unique transfer references.';
  end if;
end $$;
create unique index if not exists diamond_withdrawals_paypal_transaction_uq
  on public.diamond_withdrawals(paypal_transaction_id) where paypal_transaction_id is not null;
create index if not exists diamond_withdrawals_admin_queue_idx
  on public.diamond_withdrawals(status, created_at desc);
create index if not exists diamond_withdrawals_user_history_idx
  on public.diamond_withdrawals(user_id, created_at desc);

-- PayPal is the first enabled payout destination. No bank/card payout method is
-- advertised or accepted until it has its own secure, implemented provider flow.
create table if not exists public.paypal_payout_info (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  paypal_email text not null,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paypal_payout_info_email_nonempty check (length(trim(paypal_email)) > 3)
);
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='paypal_payout_info' and column_name='user_id') then
    raise exception '0019 stopped: existing public.paypal_payout_info lacks user_id. Reconcile ownership explicitly before this migration; no account owners will be guessed.';
  end if;
  if exists (select 1 from public.paypal_payout_info where user_id is null)
     or exists (select user_id from public.paypal_payout_info group by user_id having count(*) > 1) then
    raise exception '0019 stopped: existing public.paypal_payout_info has null or duplicate user_id values. Reconcile each row before retrying.';
  end if;
  if exists (select 1 from public.paypal_payout_info p left join public.profiles u on u.id=p.user_id where u.id is null) then
    raise exception '0019 stopped: existing PayPal payout rows do not match public.profiles. Reconcile ownership before retrying.';
  end if;
end $$;
alter table public.paypal_payout_info
  add column if not exists paypal_email text,
  add column if not exists is_verified boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
do $$
begin
  if exists (select 1 from public.paypal_payout_info where paypal_email is null or paypal_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then
    raise exception '0019 stopped: public.paypal_payout_info has rows without a valid-looking PayPal email. Correct those existing rows intentionally, then retry; no email will be invented.';
  end if;
end $$;
update public.paypal_payout_info set paypal_email=lower(trim(paypal_email));
alter table public.paypal_payout_info alter column paypal_email set not null;
create unique index if not exists paypal_payout_info_user_id_uq on public.paypal_payout_info(user_id);
do $$
begin
  if not exists (select 1 from pg_constraint where conname='paypal_payout_info_user_id_fkey' and conrelid='public.paypal_payout_info'::regclass) then
    alter table public.paypal_payout_info add constraint paypal_payout_info_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='paypal_payout_info_email_format' and conrelid='public.paypal_payout_info'::regclass) then
    alter table public.paypal_payout_info add constraint paypal_payout_info_email_format
      check (paypal_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') not valid;
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_constraint where conname='paypal_payout_info_email_nonempty' and conrelid='public.paypal_payout_info'::regclass) then
    alter table public.paypal_payout_info add constraint paypal_payout_info_email_nonempty
      check (length(trim(paypal_email)) > 3) not valid;
  end if;
end $$;
alter table public.paypal_payout_info enable row level security;
drop policy if exists paypal_payout_info_read on public.paypal_payout_info;
create policy paypal_payout_info_read on public.paypal_payout_info
  for select using (user_id=auth.uid());
-- All writes and all admin reads pass through the authenticated backend service role.
revoke all on public.paypal_payout_info from anon, authenticated;
grant select, insert, update, delete on public.paypal_payout_info to service_role;
grant select, insert, update on public.diamond_withdrawals to service_role;

-- Server-only, idempotent creator payout request. This verifies that the supplied
-- destination still matches the account saved by that creator, then debits diamonds
-- and records the immutable payout destination in one database transaction.
create or replace function public.request_creator_payout(
  p_user uuid,
  p_amount bigint,
  p_reference text,
  p_paypal_email text
) returns public.diamond_withdrawals
language plpgsql security definer set search_path=public as $$
declare
  before_balance bigint;
  after_balance bigint;
  saved_email text;
  existing public.diamond_withdrawals;
  created public.diamond_withdrawals;
begin
  if p_user is null then raise exception 'AUTHENTICATED_USER_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_PAYOUT_AMOUNT'; end if;
  if p_reference is null or length(trim(p_reference)) < 16 then raise exception 'PAYOUT_IDEMPOTENCY_REQUIRED'; end if;
  -- Serialize retries with the same idempotency reference before checking for a row.
  perform pg_advisory_xact_lock(hashtextextended(p_reference, 0));
  select paypal_email into saved_email from public.paypal_payout_info where user_id=p_user for share;
  if saved_email is null or lower(trim(saved_email)) <> lower(trim(coalesce(p_paypal_email,''))) then
    raise exception 'PAYPAL_PAYOUT_ACCOUNT_MISMATCH';
  end if;
  select * into existing from public.diamond_withdrawals where reference=p_reference;
  if existing.id is not null then
    if existing.user_id <> p_user or existing.amount <> p_amount then raise exception 'PAYOUT_IDEMPOTENCY_CONFLICT'; end if;
    return existing;
  end if;
  insert into public.wallets(user_id) values(p_user) on conflict(user_id) do nothing;
  select diamond_balance into before_balance from public.wallets where user_id=p_user for update;
  if before_balance < p_amount then raise exception 'INSUFFICIENT_DIAMONDS'; end if;
  after_balance := before_balance - p_amount;
  update public.wallets set diamond_balance=after_balance, updated_at=now() where user_id=p_user;
  insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference,idempotency_key)
    values(p_user,-p_amount,before_balance,after_balance,'payout',p_reference,'payout-debit:'||p_reference);
  insert into public.diamond_withdrawals(user_id,amount,status,reference,payout_email_snapshot,fiat_currency)
    values(p_user,p_amount,'pending',p_reference,lower(trim(saved_email)),'USD') returning * into created;
  return created;
end;
$$;

-- Admin-mediated payout status changes. This records a manually completed PayPal
-- transfer; it does NOT submit a transfer to PayPal's Payouts API on its own.
-- Rejection refunds diamonds exactly once through an idempotent ledger entry.
create or replace function public.admin_update_creator_payout(
  p_withdrawal uuid,
  p_status text,
  p_fiat_amount numeric,
  p_fiat_currency text,
  p_admin_note text,
  p_paypal_transaction_id text,
  p_actor uuid
) returns public.diamond_withdrawals
language plpgsql security definer set search_path=public as $$
declare
  w public.diamond_withdrawals;
  before_balance bigint;
  after_balance bigint;
  refund_ledger_id uuid;
  next_status text := lower(trim(coalesce(p_status,'')));
  currency_code text := upper(trim(coalesce(p_fiat_currency,'USD')));
begin
  if p_actor is null then raise exception 'ADMIN_ACTOR_REQUIRED'; end if;
  select * into w from public.diamond_withdrawals where id=p_withdrawal for update;
  if w.id is null then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if w.status in ('paid','rejected') then
    if w.status=next_status then return w; end if;
    raise exception 'PAYOUT_TERMINAL_STATE';
  end if;
  if next_status not in ('approved','paid','rejected') then raise exception 'INVALID_PAYOUT_STATUS'; end if;
  if next_status='approved' and w.status <> 'pending' then raise exception 'INVALID_PAYOUT_TRANSITION'; end if;
  if next_status='paid' and w.status <> 'approved' then raise exception 'PAYOUT_MUST_BE_APPROVED_FIRST'; end if;
  if next_status='rejected' and w.status not in ('pending','approved') then raise exception 'INVALID_PAYOUT_TRANSITION'; end if;
  if next_status in ('approved','paid') then
    if p_fiat_amount is null or p_fiat_amount <= 0 then raise exception 'VALID_FIAT_AMOUNT_REQUIRED'; end if;
    if currency_code !~ '^[A-Z]{3}$' then raise exception 'INVALID_FIAT_CURRENCY'; end if;
    if w.payout_email_snapshot is null or length(trim(w.payout_email_snapshot)) < 4 then raise exception 'PAYOUT_DESTINATION_MISSING'; end if;
  end if;
  if next_status='paid' and length(trim(coalesce(p_paypal_transaction_id,''))) < 3 then
    raise exception 'PAYPAL_TRANSACTION_REFERENCE_REQUIRED';
  end if;
  if next_status='rejected' then
    insert into public.wallets(user_id) values(w.user_id) on conflict(user_id) do nothing;
    select diamond_balance into before_balance from public.wallets where user_id=w.user_id for update;
    after_balance := before_balance + w.amount;
    insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference,idempotency_key)
      values(w.user_id,w.amount,before_balance,after_balance,'payout_refund',w.reference,'payout-refund:'||w.id::text)
      on conflict(idempotency_key) do nothing returning id into refund_ledger_id;
    if refund_ledger_id is not null then
      update public.wallets set diamond_balance=after_balance, updated_at=now() where user_id=w.user_id;
    end if;
  end if;
  update public.diamond_withdrawals set
    status=next_status,
    fiat_amount=case when next_status in ('approved','paid') then p_fiat_amount else fiat_amount end,
    fiat_currency=case when next_status in ('approved','paid') then currency_code else fiat_currency end,
    admin_note=nullif(left(trim(coalesce(p_admin_note,'')),1000),''),
    paypal_transaction_id=case when next_status='paid' then nullif(left(trim(coalesce(p_paypal_transaction_id,'')),200), '') else paypal_transaction_id end,
    processed_by=p_actor,
    processed_at=case when next_status in ('paid','rejected') then now() else processed_at end,
    updated_at=now()
    where id=p_withdrawal returning * into w;
  return w;
end;
$$;

-- Cancellation is an audited server operation; client roles cannot write fixtures.
create or replace function public.cancel_league_match(p_match uuid, p_actor uuid)
returns public.league_matches
language plpgsql security definer set search_path=public as $$
declare m public.league_matches;
begin
  if p_actor is null then raise exception 'ADMIN_ACTOR_REQUIRED'; end if;
  select * into m from public.league_matches where id=p_match for update;
  if not found then raise exception 'INVALID_MATCH'; end if;
  if m.status <> 'scheduled' then raise exception 'MATCH_NOT_CANCELLABLE'; end if;
  update public.league_matches set status='cancelled' where id=p_match returning * into m;
  insert into public.league_events(season_id,match_id,event_type,actor_id,payload)
    values(m.season_id,m.id,'match_cancelled',p_actor,jsonb_build_object('reason','administrator_cancelled'));
  return m;
end;
$$;

-- Correct season-finalization access and prevent promotion/relegation overlap when
-- a division contains fewer than four teams. Teams in the top two are not also
-- relegated; the number eligible to relegate naturally shrinks for small divisions.
create or replace function public.finalize_league_season(p_season uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  season_end timestamptz;
  s record;
  target text;
begin
  select ends_at into season_end from public.league_seasons
   where id=p_season and status='active' for update;
  if not found then raise exception 'SEASON_NOT_ACTIVE'; end if;
  if season_end > now() then raise exception 'SEASON_NOT_ENDED'; end if;
  update public.league_seasons set status='finalizing' where id=p_season;
  perform public.rebuild_league_standings(p_season);
  update public.league_standings set promoted=false,relegated=false where season_id=p_season;

  for s in select * from public.league_standings where season_id=p_season and position <= 2 and division_code <> 'A1' order by division_code,position loop
    target := case s.division_code
      when 'A2' then 'A1' when 'A3' then 'A2' when 'B1' then 'A3'
      when 'B2' then 'B1' when 'B3' then 'B2' when 'B4' then 'B3' when 'B5' then 'B4'
      when 'C1' then 'B5' when 'C2' then 'C1' when 'C3' then 'C2' when 'C4' then 'C3' when 'C5' then 'C4'
      when 'D1' then 'C5' when 'D2' then 'D1' when 'D3' then 'D2' when 'D4' then 'D3' when 'D5' then 'D4'
      else null end;
    if target is not null then
      update public.league_standings set promoted=true where season_id=p_season and team_id=s.team_id;
      update public.teams set division_code=target,updated_at=now() where id=s.team_id;
    end if;
  end loop;

  for s in
    select ls.* from public.league_standings ls
    where ls.season_id=p_season and ls.position > 2 and ls.position is not null
      and ls.position >= (
        select greatest(count(*)::integer-1, 3)
        from public.league_standings all_rows
        where all_rows.season_id=ls.season_id and all_rows.division_code=ls.division_code
      )
    order by ls.division_code,ls.position desc
  loop
    target := case s.division_code
      when 'A1' then 'A2' when 'A2' then 'A3' when 'A3' then 'B1'
      when 'B1' then 'B2' when 'B2' then 'B3' when 'B3' then 'B4' when 'B4' then 'B5'
      when 'B5' then 'C1' when 'C1' then 'C2' when 'C2' then 'C3' when 'C3' then 'C4' when 'C4' then 'C5'
      when 'C5' then 'D1' when 'D1' then 'D2' when 'D2' then 'D3' when 'D3' then 'D4' when 'D4' then 'D5'
      else null end;
    if target is not null then
      update public.league_standings set relegated=true where season_id=p_season and team_id=s.team_id;
      update public.teams set division_code=target,updated_at=now() where id=s.team_id;
    end if;
  end loop;

  update public.league_seasons set status='completed' where id=p_season;
end;
$$;

-- Functions are called only by the backend using the Supabase service-role key;
-- browser roles cannot call the SECURITY DEFINER procedures directly.
revoke all on function public.initialize_league_season(uuid) from public, anon, authenticated;
revoke all on function public.rebuild_league_positions(uuid) from public, anon, authenticated;
revoke all on function public.rebuild_league_standings(uuid) from public, anon, authenticated;
revoke all on function public.record_league_match_result(uuid,integer,integer,uuid) from public, anon, authenticated;
revoke all on function public.correct_league_match_result(uuid,integer,integer,uuid) from public, anon, authenticated;
revoke all on function public.finalize_league_season(uuid) from public, anon, authenticated;
revoke all on function public.cancel_league_match(uuid,uuid) from public, anon, authenticated;
revoke all on function public.request_creator_payout(uuid,bigint,text,text) from public, anon, authenticated;
revoke all on function public.admin_update_creator_payout(uuid,text,numeric,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.initialize_league_season(uuid) to service_role;
grant execute on function public.rebuild_league_positions(uuid) to service_role;
grant execute on function public.rebuild_league_standings(uuid) to service_role;
grant execute on function public.record_league_match_result(uuid,integer,integer,uuid) to service_role;
grant execute on function public.correct_league_match_result(uuid,integer,integer,uuid) to service_role;
grant execute on function public.finalize_league_season(uuid) to service_role;
grant execute on function public.cancel_league_match(uuid,uuid) to service_role;
grant execute on function public.request_creator_payout(uuid,bigint,text,text) to service_role;
grant execute on function public.admin_update_creator_payout(uuid,text,numeric,text,text,text,uuid) to service_role;

notify pgrst, 'reload schema';
commit;
