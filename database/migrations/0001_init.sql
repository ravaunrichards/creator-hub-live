-- Creator Hub Live Next — initial schema (PostgreSQL / Supabase compatible)
-- Versioned, additive. Does NOT touch or reference the reference project's DB.
-- Apply with: psql "$DATABASE_URL" -f database/migrations/0001_init.sql

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Identity & social
-- ---------------------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  display_name  text,
  avatar_url    text,
  bio           text,
  is_verified   boolean not null default false,  -- set ONLY by a real review
  account_type  text not null default 'personal' check (account_type in ('personal','professional','business')),
  created_at    timestamptz not null default now()
);

create table if not exists follows (
  follower_id uuid not null references users(id) on delete cascade,
  followee_id uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id)
);

-- ---------------------------------------------------------------------------
-- Wallet: append-only double-entry ledger (balances are DERIVED, never stored)
-- ---------------------------------------------------------------------------
create table if not exists ledger_entries (
  id              bigserial primary key,
  idempotency_key text not null,
  kind            text not null,
  account_id      text not null,            -- 'user:<uuid>' | 'system:mint:coins' ...
  unit            text not null check (unit in ('coins','diamonds','league_points','ad_credits','cash')),
  delta           bigint not null check (delta <> 0),
  metadata        jsonb not null default '{}'::jsonb,
  seq             int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ledger_account_unit on ledger_entries(account_id, unit);

-- Idempotency guard: one committed result per key.
create table if not exists ledger_idempotency (
  idempotency_key text primary key,
  result          jsonb not null,
  created_at      timestamptz not null default now()
);

-- Convenience view for current balances.
create or replace view v_balances as
  select account_id, unit, sum(delta)::bigint as balance
  from ledger_entries group by account_id, unit;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table if not exists coin_packages (
  id          text primary key,
  coins       int not null check (coins > 0),
  price_minor int not null check (price_minor >= 0),
  currency    text not null default 'USD',
  enabled     boolean not null default true
);

insert into coin_packages(id,coins,price_minor,currency) values
  ('pkg_100',100,99,'USD'),('pkg_500',500,499,'USD'),('pkg_1000',1000,999,'USD'),
  ('pkg_2500',2500,2499,'USD'),('pkg_5000',5000,4999,'USD'),('pkg_10000',10000,9999,'USD')
  on conflict (id) do nothing;

create table if not exists payment_intents (
  id              uuid primary key default gen_random_uuid(),
  idempotency_key text unique not null,
  user_id         uuid references users(id) on delete set null,
  provider_id     text not null,
  provider_ref    text,                      -- order/session id from provider
  capture_id      text,
  tx_type         text not null,             -- 'coin_purchase' | 'subscription' | 'exchange_project' ...
  amount_minor    bigint not null,
  currency        text not null,
  environment     text not null check (environment in ('sandbox','production')),
  status          text not null default 'created'
                    check (status in ('created','requires_action','pending','authorized','captured','failed','cancelled','refunded')),
  requires_manual boolean not null default false,
  reviewer_id     uuid,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- Idempotency on provider capture id prevents duplicate-webhook double credit.
create unique index if not exists uq_intent_capture on payment_intents(capture_id) where capture_id is not null;

create table if not exists webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider_id   text not null,
  provider_evt  text unique not null,        -- provider's event id (idempotent)
  verified      boolean not null default false,
  payload       jsonb not null,
  processed_at  timestamptz
);

-- ---------------------------------------------------------------------------
-- Gifts
-- ---------------------------------------------------------------------------
create table if not exists gifts (
  id        text primary key,
  name      text not null,
  coins     int not null check (coins > 0),
  diamonds  int not null check (diamonds >= 0),
  asset_url text
);

create table if not exists gift_events (
  id           uuid primary key default gen_random_uuid(),
  idempotency_key text unique not null,
  sender_id    uuid not null references users(id),
  recipient_id uuid not null references users(id),
  gift_id      text not null references gifts(id),
  quantity     int not null check (quantity > 0),
  live_session_id uuid,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- LIVE sessions
-- ---------------------------------------------------------------------------
create table if not exists live_sessions (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references users(id) on delete cascade,
  mode        text not null check (mode in ('video','audio','screen')),
  title       text,
  category    text,
  status      text not null default 'scheduled'
                check (status in ('scheduled','live','reconnecting','ended')),
  started_at  timestamptz,
  ended_at    timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists live_participants (
  session_id uuid not null references live_sessions(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null check (role in ('host','cohost','speaker','guest','moderator','listener')),
  state      text not null default 'invited'
               check (state in ('invited','requested','active','removed','left')),
  joined_at  timestamptz,
  primary key (session_id, user_id)
);

commit;
