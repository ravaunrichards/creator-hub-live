-- Creator Hub Live Next — CHL Exchange marketplace schema.
begin;

create table if not exists exchange_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  role          text not null check (role in
                  ('creator','influencer','video_editor','designer','photographer',
                   'producer','musician','brand','agency','campaign_manager',
                   'service_provider','admin','dispute_reviewer')),
  headline      text,
  categories    text[] not null default '{}',
  languages     text[] not null default '{}',
  region        text,
  is_verified   boolean not null default false,  -- real verification only
  created_at    timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists exchange_campaigns (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references users(id) on delete cascade,
  title         text not null,
  objective     text,
  brief         text,
  budget_minor  bigint,
  currency      text,
  deliverables  jsonb not null default '[]'::jsonb,
  licensing     text,
  status        text not null default 'draft'
                  check (status in ('draft','open','reviewing','awarded','closed','cancelled')),
  closes_at     timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists exchange_applications (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references exchange_campaigns(id) on delete cascade,
  applicant_id uuid not null references users(id) on delete cascade,
  proposal     text,
  quote_minor  bigint,
  status       text not null default 'submitted'
                 check (status in ('submitted','shortlisted','accepted','rejected','withdrawn')),
  created_at   timestamptz not null default now(),
  unique (campaign_id, applicant_id)
);

create table if not exists exchange_projects (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid references exchange_campaigns(id) on delete set null,
  client_id    uuid not null references users(id),
  creator_id   uuid not null references users(id),
  terms        jsonb not null default '{}'::jsonb,
  fee_minor    bigint,
  platform_fee_minor bigint,
  currency     text,
  status       text not null default 'active'
                 check (status in ('active','in_review','revision','delivered','completed','cancelled','disputed')),
  created_at   timestamptz not null default now()
);

create table if not exists exchange_milestones (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references exchange_projects(id) on delete cascade,
  title       text not null,
  amount_minor bigint,
  due_at      timestamptz,
  status      text not null default 'pending'
                check (status in ('pending','submitted','approved','rejected','paid')),
  created_at  timestamptz not null default now()
);

create table if not exists exchange_deliverables (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references exchange_projects(id) on delete cascade,
  milestone_id uuid references exchange_milestones(id) on delete set null,
  version     int not null default 1,
  file_url    text,
  notes       text,
  status      text not null default 'submitted'
                check (status in ('submitted','revision_requested','approved')),
  created_at  timestamptz not null default now()
);

commit;
