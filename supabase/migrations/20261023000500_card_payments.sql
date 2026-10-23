-- ============================================================
--  Stage 4: card payments through Paymob.
--
--  • An order paid by card starts as 'pending_payment' (stock reserved, 30-minute window).
--  • It becomes paid ONLY through apply_payment_event(), called by the paymob-webhook
--    Edge Function AFTER it verified Paymob's HMAC signature. Browser redirects are ignored.
--  • The amount and currency must match the order exactly; every Paymob transaction is
--    processed at most once (unique transaction_id).
--  • Unpaid orders expire: stock goes back and the order becomes 'payment_failed'.
--  All functions here are server-only (service role), except the admin's read access.
-- ============================================================

-- One row per payment attempt we created at Paymob for an order.
create table if not exists public.payment_intents (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  provider          text not null default 'paymob',
  intention_id      text not null unique,
  provider_order_id text,               -- Paymob's order id (intention_order_id)
  special_reference text not null unique, -- comes back as obj.order.merchant_order_id
  amount_cents      integer not null check (amount_cents > 0),
  currency          text not null default 'EGP',
  created_at        timestamptz not null default now()
);
create index if not exists payment_intents_order_idx on public.payment_intents (order_id);
create index if not exists payment_intents_provider_order_idx on public.payment_intents (provider_order_id);

-- Every verified notification from Paymob, processed at most once.
create table if not exists public.payment_events (
  id                bigint generated always as identity primary key,
  order_id          uuid references public.orders (id) on delete set null,
  provider          text not null default 'paymob',
  transaction_id    text not null unique,
  provider_order_id text,
  merchant_reference text,
  amount_cents      integer,
  currency          text,
  success           boolean,
  pending           boolean,
  is_refunded       boolean,
  is_voided         boolean,
  -- what we did with it: paid | failed_attempt | pending | refunded | voided |
  -- amount_mismatch | unknown_order | paid_after_cancel | ignored
  outcome           text not null,
  raw               jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists payment_events_order_idx on public.payment_events (order_id);

alter table public.payment_intents enable row level security;
alter table public.payment_events  enable row level security;

drop policy if exists "admins read payment intents" on public.payment_intents;
create policy "admins read payment intents" on public.payment_intents for select to authenticated using (public.is_admin());
drop policy if exists "admins read payment events" on public.payment_events;
create policy "admins read payment events" on public.payment_events for select to authenticated using (public.is_admin());

revoke all on public.payment_intents, public.payment_events from anon;
revoke insert, update, delete, truncate on public.payment_intents, public.payment_events from authenticated;

-- ---------- expire unpaid card orders (restock once) ----------
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  n integer := 0;
begin
  for o in
    select id from public.orders
    where status = 'pending_payment' and expires_at is not null and expires_at < now()
    for update skip locked
  loop
    update public.product_variants v
    set stock_qty = v.stock_qty + i.qty
    from public.order_items i, public.orders x
    where i.order_id = o.id and i.variant_id = v.id and x.id = o.id and not x.stock_released;

    update public.orders
    set status = 'payment_failed', payment_status = 'failed', stock_released = true
    where id = o.id;

    insert into public.order_status_history (order_id, from_status, to_status, note)
    values (o.id, 'pending_payment', 'payment_failed', 'payment window expired');
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;
grant execute on function public.expire_unpaid_orders() to service_role;

-- Run expiry whenever orders are placed, so it works even without a scheduler.
-- (supabase/cron.sql additionally schedules it every 5 minutes on the real project.)
create or replace function public.place_order_with_expiry(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.expire_unpaid_orders();
  return public.place_order(p);
end;
$$;
revoke all on function public.place_order_with_expiry(jsonb) from public, anon, authenticated;
grant execute on function public.place_order_with_expiry(jsonb) to service_role;

-- ---------- for the payment step: an order that may still be paid ----------
-- p: { order_id? , token_hash? }  (the checkout uses order_id; "pay again" uses the tracking token)
create or replace function public.get_payable_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
begin
  perform public.expire_unpaid_orders();
  if p ? 'order_id' then
    select * into o from public.orders where id = (p ->> 'order_id')::uuid;
  else
    select * into o from public.orders where tracking_token_hash = p ->> 'token_hash';
  end if;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if o.payment_method <> 'card' or o.status <> 'pending_payment' then
    return jsonb_build_object('ok', false, 'error', 'not_payable', 'status', o.status);
  end if;
  return jsonb_build_object(
    'ok', true, 'order_id', o.id, 'order_number', o.order_number, 'total', o.total,
    'subtotal', o.subtotal, 'shipping_fee', o.shipping_fee, 'expires_at', o.expires_at,
    'customer', jsonb_build_object('name', o.customer_name, 'phone', o.phone, 'email', o.email,
                                   'area', o.area, 'address', o.address, 'zone_id', o.zone_id),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.product_name_ar, 'size', i.size,
                'qty', i.qty, 'unit_price', i.unit_price)), '[]'::jsonb)
              from public.order_items i where i.order_id = o.id));
end;
$$;
revoke all on function public.get_payable_order(jsonb) from public, anon, authenticated;
grant execute on function public.get_payable_order(jsonb) to service_role;

-- ---------- remember the payment we created at Paymob ----------
create or replace function public.record_payment_intent(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = (p ->> 'order_id')::uuid;
  if not found or o.status <> 'pending_payment' then
    return jsonb_build_object('ok', false, 'error', 'not_payable');
  end if;
  -- the amount sent to Paymob must be exactly the order's server-side total
  if (p ->> 'amount_cents')::int <> o.total * 100 then
    return jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  end if;
  insert into public.payment_intents (order_id, intention_id, provider_order_id, special_reference, amount_cents, currency)
  values (o.id, p ->> 'intention_id', p ->> 'provider_order_id', p ->> 'special_reference', (p ->> 'amount_cents')::int, 'EGP');
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.record_payment_intent(jsonb) from public, anon, authenticated;
grant execute on function public.record_payment_intent(jsonb) to service_role;

-- ---------- a VERIFIED Paymob transaction ----------
-- Only call this after the HMAC signature was checked. p:
--   { transaction_id, provider_order_id, merchant_reference, amount_cents, currency,
--     success, pending, is_refunded, is_voided, raw }
create or replace function public.apply_payment_event(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent   public.payment_intents%rowtype;
  o        public.orders%rowtype;
  outcome  text;
  ok_amount boolean;
begin
  if coalesce(p ->> 'transaction_id', '') = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_event');
  end if;

  -- each Paymob transaction is handled once; repeats (retries, replays) change nothing
  if exists (select 1 from public.payment_events e where e.transaction_id = p ->> 'transaction_id' and e.provider = 'paymob') then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  select * into intent from public.payment_intents i
  where (p ->> 'merchant_reference') is not null and i.special_reference = p ->> 'merchant_reference'
  limit 1;
  if not found then
    select * into intent from public.payment_intents i
    where (p ->> 'provider_order_id') is not null and i.provider_order_id = p ->> 'provider_order_id'
    limit 1;
  end if;

  if not found then
    outcome := 'unknown_order';
  else
    select * into o from public.orders where id = intent.order_id for update;
    ok_amount := (p ->> 'amount_cents')::int = o.total * 100 and upper(coalesce(p ->> 'currency', '')) = 'EGP';

    if coalesce((p ->> 'is_refunded')::boolean, false) then
      outcome := 'refunded';
      update public.orders set payment_status = 'refunded' where id = o.id and payment_status = 'paid';
    elsif coalesce((p ->> 'is_voided')::boolean, false) then
      outcome := 'voided';
    elsif not ok_amount then
      outcome := 'amount_mismatch';           -- never mark paid; the owner must review
    elsif coalesce((p ->> 'pending')::boolean, false) then
      outcome := 'pending';
    elsif coalesce((p ->> 'success')::boolean, false) then
      if o.status = 'pending_payment' then
        outcome := 'paid';
        update public.orders
        set status = 'placed', payment_status = 'paid', expires_at = null
        where id = o.id;
        insert into public.order_status_history (order_id, from_status, to_status, note)
        values (o.id, 'pending_payment', 'placed', 'card payment confirmed by Paymob (transaction ' || (p ->> 'transaction_id') || ')');
      elsif o.payment_status = 'paid' then
        outcome := 'ignored';                 -- already paid by another transaction
      else
        -- paid after the order expired/was cancelled: stock may be gone → owner must refund or fulfil
        outcome := 'paid_after_cancel';
        update public.orders set payment_status = 'paid' where id = o.id;
        insert into public.order_status_history (order_id, from_status, to_status, note)
        values (o.id, o.status, o.status, 'payment received after cancellation — review and refund (transaction ' || (p ->> 'transaction_id') || ')');
      end if;
    else
      -- a declined attempt: keep the order open so the customer can try again until it expires
      outcome := 'failed_attempt';
    end if;
  end if;

  insert into public.payment_events (order_id, transaction_id, provider_order_id, merchant_reference, amount_cents,
                                     currency, success, pending, is_refunded, is_voided, outcome, raw)
  values (o.id, p ->> 'transaction_id', p ->> 'provider_order_id', p ->> 'merchant_reference',
          (p ->> 'amount_cents')::int, p ->> 'currency', (p ->> 'success')::boolean, (p ->> 'pending')::boolean,
          (p ->> 'is_refunded')::boolean, (p ->> 'is_voided')::boolean, outcome, p -> 'raw');

  return jsonb_build_object('ok', true, 'outcome', outcome, 'order_id', o.id);
end;
$$;
revoke all on function public.apply_payment_event(jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(jsonb) to service_role;

-- ---------- the tracking page: say whether the customer can still pay ----------
create or replace function public.get_order_by_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
begin
  if p_token is null or length(p_token) not between 32 and 128 then
    return null;
  end if;
  perform public.expire_unpaid_orders();
  select * into o from public.orders
  where tracking_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'order_number', 'YS-' || o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'expires_at', o.expires_at,
    'can_pay', o.payment_method = 'card' and o.status = 'pending_payment',
    'created_at', o.created_at,
    'customer_first_name', split_part(o.customer_name, ' ', 1),
    'phone_masked', left(o.phone, 3) || '******' || right(o.phone, 2),
    'zone', (select jsonb_build_object('ar', z.name_ar, 'en', z.name_en) from public.shipping_zones z where z.id = o.zone_id),
    'area', o.area,
    'subtotal', o.subtotal,
    'shipping_fee', o.shipping_fee,
    'total', o.total,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name_ar', i.product_name_ar, 'name_en', i.product_name_en, 'size', i.size,
        'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.product_name_ar, i.size), '[]'::jsonb)
      from public.order_items i where i.order_id = o.id),
    'history', (
      select coalesce(jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at) order by h.created_at, h.id), '[]'::jsonb)
      from public.order_status_history h where h.order_id = o.id)
  );
end;
$$;
revoke all on function public.get_order_by_token(text) from public;
grant execute on function public.get_order_by_token(text) to anon, authenticated, service_role;
