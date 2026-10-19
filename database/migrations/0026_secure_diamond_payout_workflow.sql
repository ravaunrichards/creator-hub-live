-- Creator Hub Live — secure diamond payout workflow.
-- Apply only after reviewing the live migration ledger; this file is additive.
-- Fiat conversion is deliberately NOT configured: an authorized admin enters
-- the exact payable fiat amount and currency before approval.
begin;

create table if not exists public.paypal_payout_info (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  paypal_email text not null,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paypal_payout_email_format check (paypal_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
alter table public.paypal_payout_info enable row level security;
drop policy if exists paypal_payout_info_owner_read on public.paypal_payout_info;
create policy paypal_payout_info_owner_read on public.paypal_payout_info
  for select using (user_id = auth.uid() or public.is_admin());
-- All payout-account mutations go through the authenticated backend API.
-- No browser INSERT/UPDATE policy is granted, so a client cannot self-assert is_verified.
create or replace function public.reset_paypal_payout_verification_on_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(trim(old.paypal_email)) <> lower(trim(new.paypal_email)) then
    new.is_verified := false;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists paypal_payout_email_changed on public.paypal_payout_info;
create trigger paypal_payout_email_changed before update on public.paypal_payout_info
  for each row execute function public.reset_paypal_payout_verification_on_change();

create table if not exists public.diamond_payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  diamond_amount bigint not null check (diamond_amount > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  paypal_email text not null check (paypal_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  idempotency_key text not null unique,
  fiat_amount numeric(18,2) check (fiat_amount is null or fiat_amount > 0),
  fiat_currency text check (fiat_currency is null or fiat_currency ~ '^[A-Z]{3}$'),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejected_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_review_fields check (
    (status = 'pending' and fiat_amount is null and fiat_currency is null and paid_at is null and rejected_at is null)
    or (status = 'approved' and fiat_amount > 0 and fiat_currency ~ '^[A-Z]{3}$' and paid_at is null and rejected_at is null)
    or (status = 'rejected' and rejected_at is not null and paid_at is null)
    or (status = 'paid' and fiat_amount > 0 and fiat_currency ~ '^[A-Z]{3}$' and paid_at is not null and payment_reference is not null)
  )
);
create index if not exists diamond_payout_requests_user_created_idx
  on public.diamond_payout_requests(user_id, created_at desc);
create index if not exists diamond_payout_requests_queue_idx
  on public.diamond_payout_requests(status, created_at asc);
create unique index if not exists diamond_payout_payment_reference_unique
  on public.diamond_payout_requests(payment_reference) where payment_reference is not null;
alter table public.diamond_payout_requests enable row level security;
drop policy if exists diamond_payout_requests_owner_read on public.diamond_payout_requests;
create policy diamond_payout_requests_owner_read on public.diamond_payout_requests
  for select using (user_id = auth.uid() or public.is_admin());
-- Intentionally no client insert/update/delete policies. All mutations are server RPCs.

create or replace function public.request_diamond_payout(
  p_user_id uuid,
  p_diamond_amount bigint,
  p_paypal_email text,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_balance bigint;
  v_request public.diamond_payout_requests;
begin
  if p_user_id is null or p_diamond_amount is null or p_diamond_amount <= 0 then
    raise exception 'invalid payout request';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(p_idempotency_key) > 200 then
    raise exception 'valid idempotency key required';
  end if;
  if p_paypal_email is null or p_paypal_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'valid PayPal email required';
  end if;
  insert into public.wallets(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select diamond_balance into v_balance from public.wallets where user_id = p_user_id for update;
  select * into v_request from public.diamond_payout_requests where idempotency_key = p_idempotency_key;
  if found then
    if v_request.user_id <> p_user_id then raise exception 'idempotency key already belongs to another user'; end if;
    return to_jsonb(v_request);
  end if;
  if v_balance < p_diamond_amount then raise exception 'insufficient diamonds'; end if;
  update public.wallets set diamond_balance = v_balance - p_diamond_amount, updated_at = now()
    where user_id = p_user_id;
  insert into public.diamond_payout_requests(user_id, diamond_amount, paypal_email, idempotency_key)
    values (p_user_id, p_diamond_amount, lower(trim(p_paypal_email)), p_idempotency_key)
    returning * into v_request;
  insert into public.diamond_ledger(user_id, amount, balance_before, balance_after, source, reference, idempotency_key)
    values (p_user_id, -p_diamond_amount, v_balance, v_balance - p_diamond_amount,
      'payout_reserved', v_request.id::text, 'payout:reserve:' || v_request.id::text);
  insert into public.audit_log(actor_id, action, target, detail)
    values (p_user_id, 'payout.requested', v_request.id::text,
      jsonb_build_object('diamondAmount', p_diamond_amount, 'paypalDestinationSaved', true, 'status', 'pending'));
  return to_jsonb(v_request);
end;
$$;

create or replace function public.admin_review_diamond_payout(
  p_request_id uuid,
  p_admin_id uuid,
  p_action text,
  p_fiat_amount numeric,
  p_fiat_currency text,
  p_admin_note text,
  p_payment_reference text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_request public.diamond_payout_requests;
  v_balance bigint;
  v_currency text;
  v_reference text;
begin
  if p_action not in ('approve','reject','mark_paid') then raise exception 'invalid payout action'; end if;
  if not exists (select 1 from public.profiles where id = p_admin_id and is_admin = true) then
    raise exception 'administrator authorization required';
  end if;
  select * into v_request from public.diamond_payout_requests where id = p_request_id for update;
  if not found then raise exception 'payout request not found'; end if;

  if p_action = 'approve' then
    if v_request.status <> 'pending' then raise exception 'invalid status transition: only pending requests can be approved'; end if;
    v_currency := upper(trim(coalesce(p_fiat_currency, '')));
    if p_fiat_amount is null or p_fiat_amount <= 0 or round(p_fiat_amount, 2) <> p_fiat_amount
      or v_currency !~ '^[A-Z]{3}$' then raise exception 'valid admin-confirmed fiat amount and currency required'; end if;
    update public.diamond_payout_requests set status = 'approved', fiat_amount = p_fiat_amount,
      fiat_currency = v_currency, admin_note = nullif(left(trim(coalesce(p_admin_note,'')),1000),''),
      reviewed_by = p_admin_id, reviewed_at = now(), updated_at = now()
      where id = p_request_id returning * into v_request;
    insert into public.audit_log(actor_id, action, target, detail) values
      (p_admin_id, 'payout.approved_amount_confirmed', p_request_id::text,
       jsonb_build_object('fiatAmount', p_fiat_amount, 'fiatCurrency', v_currency, 'diamondAmount', v_request.diamond_amount));
  elsif p_action = 'reject' then
    if v_request.status <> 'pending' then raise exception 'invalid status transition: only pending requests can be rejected'; end if;
    insert into public.wallets(user_id) values (v_request.user_id) on conflict (user_id) do nothing;
    select diamond_balance into v_balance from public.wallets where user_id = v_request.user_id for update;
    update public.wallets set diamond_balance = v_balance + v_request.diamond_amount, updated_at = now()
      where user_id = v_request.user_id;
    insert into public.diamond_ledger(user_id, amount, balance_before, balance_after, source, reference, idempotency_key)
      values (v_request.user_id, v_request.diamond_amount, v_balance, v_balance + v_request.diamond_amount,
        'payout_rejected_refund', v_request.id::text, 'payout:refund:' || v_request.id::text);
    update public.diamond_payout_requests set status = 'rejected', rejected_at = now(), reviewed_by = p_admin_id,
      reviewed_at = now(), admin_note = nullif(left(trim(coalesce(p_admin_note,'')),1000),''), updated_at = now()
      where id = p_request_id returning * into v_request;
    insert into public.audit_log(actor_id, action, target, detail) values
      (p_admin_id, 'payout.rejected_refunded', p_request_id::text,
       jsonb_build_object('diamondAmountRefunded', v_request.diamond_amount, 'userId', v_request.user_id, 'note', v_request.admin_note));
  else
    if v_request.status <> 'approved' then raise exception 'invalid status transition: only approved requests can be marked paid'; end if;
    v_reference := trim(coalesce(p_payment_reference, ''));
    if length(v_reference) < 3 or length(v_reference) > 200 then raise exception 'PayPal payment reference required'; end if;
    if exists (select 1 from public.diamond_payout_requests where payment_reference = v_reference and id <> p_request_id) then
      raise exception 'payment reference already used';
    end if;
    update public.diamond_payout_requests set status = 'paid', payment_reference = v_reference,
      paid_at = now(), reviewed_by = p_admin_id,
      admin_note = coalesce(nullif(left(trim(coalesce(p_admin_note,'')),1000),''), admin_note), updated_at = now()
      where id = p_request_id returning * into v_request;
    insert into public.audit_log(actor_id, action, target, detail) values
      (p_admin_id, 'payout.marked_paid', p_request_id::text,
       jsonb_build_object('fiatAmount', v_request.fiat_amount, 'fiatCurrency', v_request.fiat_currency, 'paymentReference', v_reference));
  end if;
  return to_jsonb(v_request);
end;
$$;

revoke all on function public.request_diamond_payout(uuid,bigint,text,text) from public, anon, authenticated;
revoke all on function public.admin_review_diamond_payout(uuid,uuid,text,numeric,text,text,text) from public, anon, authenticated;
grant execute on function public.request_diamond_payout(uuid,bigint,text,text) to service_role;
grant execute on function public.admin_review_diamond_payout(uuid,uuid,text,numeric,text,text,text) to service_role;

commit;
