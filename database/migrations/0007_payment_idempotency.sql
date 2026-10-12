-- Creator Hub Live — 0007 payment request idempotency
-- One authenticated checkout request can create at most one PayPal order.
alter table public.payments add column if not exists idempotency_key text;
create unique index if not exists payments_user_idempotency_idx
  on public.payments(user_id, idempotency_key)
  where idempotency_key is not null;
