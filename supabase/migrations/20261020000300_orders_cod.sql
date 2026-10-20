-- ============================================================
--  Stage 2: orders, delivery zones, cash on delivery.
--
--  Nobody can read or write orders directly from the browser.
--  • Placing an order  → public.place_order(), callable ONLY by the server
--                        (the "checkout" Edge Function, with the service role).
--  • Following an order → public.get_order_by_token(), which returns ONE order
--                        for a secret link, with limited fields.
--  • The owner reads orders through the admin policy (is_admin()).
-- ============================================================

-- ---------- Delivery zones ----------
create table if not exists public.shipping_zones (
  id         text primary key check (id ~ '^[a-z0-9_-]{1,40}$'),
  name_ar    text not null,
  name_en    text not null default '',
  fee        integer not null check (fee >= 0 and fee <= 10000),
  active     boolean not null default true,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- ⚠️ PLACEHOLDER FEES — the owner must set the real ones (admin panel or SQL editor).
insert into public.shipping_zones (id, name_ar, name_en, fee, position) values
  ('alexandria', 'الإسكندرية', 'Alexandria', 50, 0),
  ('cairo', 'القاهرة والجيزة', 'Cairo and Giza', 75, 1),
  ('delta', 'الدلتا والقناة', 'Delta and Canal', 75, 2),
  ('upper', 'الصعيد', 'Upper Egypt', 90, 3),
  ('other', 'محافظات أخرى', 'Other governorates', 100, 4)
on conflict (id) do nothing;

alter table public.shipping_zones enable row level security;

drop policy if exists "public read active zones" on public.shipping_zones;
create policy "public read active zones" on public.shipping_zones for select using (active);

drop policy if exists "admins manage zones" on public.shipping_zones;
create policy "admins manage zones" on public.shipping_zones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete, truncate on public.shipping_zones from anon;

-- ---------- Orders ----------
create sequence if not exists public.order_number_seq start 10001;

create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        bigint not null unique default nextval('public.order_number_seq'),
  tracking_token_hash text not null unique check (tracking_token_hash ~ '^[0-9a-f]{64}$'),
  customer_name       text not null check (length(customer_name) between 2 and 80),
  phone               text not null check (phone ~ '^01[0125][0-9]{8}$'),
  email               text check (email is null or (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  zone_id             text not null references public.shipping_zones (id),
  area                text not null check (length(area) between 2 and 80),
  address             text not null check (length(address) between 5 and 300),
  notes               text check (notes is null or length(notes) <= 500),
  payment_method      text not null check (payment_method in ('cod', 'card')),
  status              text not null check (status in ('pending_payment', 'placed', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'payment_failed')),
  payment_status      text not null check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  subtotal            integer not null check (subtotal > 0),
  shipping_fee        integer not null check (shipping_fee >= 0),
  total               integer not null,
  currency            text not null default 'EGP',
  stock_released      boolean not null default false,
  expires_at          timestamptz,
  client_ip_hash      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint orders_total_is_sum check (total = subtotal + shipping_fee)
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_phone_idx on public.orders (phone, created_at);
create index if not exists orders_ip_idx on public.orders (client_ip_hash, created_at);

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- Snapshot of what was bought, so later price edits or deletions never change past orders.
create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  variant_id      uuid references public.product_variants (id) on delete set null,
  product_id      uuid references public.products (id) on delete set null,
  product_name_ar text not null,
  product_name_en text not null default '',
  size            text not null,
  unit_price      integer not null check (unit_price > 0),
  qty             integer not null check (qty between 1 and 10),
  line_total      integer not null,
  constraint order_items_line_total check (line_total = unit_price * qty)
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status   text not null,
  note        text,
  changed_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists order_history_order_idx on public.order_status_history (order_id, created_at);

-- ---------- Security: orders are private ----------
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;

drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders" on public.orders for select to authenticated using (public.is_admin());
drop policy if exists "admins read order items" on public.order_items;
create policy "admins read order items" on public.order_items for select to authenticated using (public.is_admin());
drop policy if exists "admins read order history" on public.order_status_history;
create policy "admins read order history" on public.order_status_history for select to authenticated using (public.is_admin());

-- No direct writes from the browser at all — not even by the admin (status changes
-- come in Stage 3 through a checked function). Visitors get no table access whatsoever.
revoke all on public.orders, public.order_items, public.order_status_history from anon;
revoke insert, update, delete, truncate on public.orders, public.order_items, public.order_status_history from authenticated;
revoke all on sequence public.order_number_seq from anon, authenticated;

-- ---------- Placing an order (server only) ----------
-- p: {
--   items: [{ variant_id, qty }, …]            1–20 lines, qty 1–10 (duplicates are merged)
--   customer: { name, phone, email?, zone_id, area, address, notes? }
--   payment_method: 'cod' | 'card'
--   expected_total?: integer                   what the customer saw; a mismatch aborts
--   token_hash: sha256 hex of the tracking token
--   ip_hash?: hashed client IP (rate limiting)
-- }
-- Prices ALWAYS come from product_variants. Nothing price-related from the caller is used.
create or replace function public.place_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c        jsonb := coalesce(p -> 'customer', '{}'::jsonb);
  method   text := p ->> 'payment_method';
  zone     public.shipping_zones%rowtype;
  it       record;
  vids     uuid[];
  lines    jsonb := '[]'::jsonb;
  problems jsonb := '[]'::jsonb;
  v_sub    integer := 0;
  v_total  integer;
  v_id     uuid;
  v_num    bigint;
  v_status text;
  v_email  text := nullif(trim(coalesce(c ->> 'email', '')), '');
  v_notes  text := nullif(trim(coalesce(c ->> 'notes', '')), '');
begin
  -- ----- shape checks -----
  if method is null or method not in ('cod', 'card') then
    return jsonb_build_object('ok', false, 'error', 'invalid_payment_method');
  end if;
  if coalesce(p ->> 'token_hash', '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;
  if jsonb_typeof(p -> 'items') is distinct from 'array'
     or jsonb_array_length(p -> 'items') not between 1 and 20 then
    return jsonb_build_object('ok', false, 'error', 'invalid_items');
  end if;
  for it in select e ->> 'variant_id' as vid, e -> 'qty' as q from jsonb_array_elements(p -> 'items') e loop
    if coalesce(it.vid, '') !~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
       or jsonb_typeof(it.q) is distinct from 'number'
       or it.q::text !~ '^[0-9]{1,2}$'
       or it.q::text::int not between 1 and 10 then
      return jsonb_build_object('ok', false, 'error', 'invalid_items');
    end if;
  end loop;

  -- ----- customer checks (the Edge Function normalises first; this is the last line) -----
  select * into zone from public.shipping_zones z where z.id = c ->> 'zone_id' and z.active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_customer', 'field', 'zone_id');
  end if;
  if length(trim(coalesce(c ->> 'name', ''))) not between 2 and 80 then
    return jsonb_build_object('ok', false, 'error', 'invalid_customer', 'field', 'name');
  end if;
  if coalesce(c ->> 'phone', '') !~ '^01[0125][0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_customer', 'field', 'phone');
  end if;
  if length(trim(coalesce(c ->> 'area', ''))) not between 2 and 80 then
    return jsonb_build_object('ok', false, 'error', 'invalid_customer', 'field', 'area');
  end if;
  if length(trim(coalesce(c ->> 'address', ''))) not between 5 and 300 then
    return jsonb_build_object('ok', false, 'error', 'invalid_customer', 'field', 'address');
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    return jsonb_build_object('ok', false, 'error', 'invalid_customer', 'field', 'email');
  end if;
  if v_notes is not null and length(v_notes) > 500 then
    return jsonb_build_object('ok', false, 'error', 'invalid_customer', 'field', 'notes');
  end if;

  -- ----- simple abuse limit: at most 5 orders per hour per device/IP and per phone -----
  if (p ->> 'ip_hash') is not null and (
       select count(*) from public.orders o
       where o.client_ip_hash = p ->> 'ip_hash' and o.created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if (select count(*) from public.orders o where o.phone = c ->> 'phone' and o.created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  -- ----- lock the sizes (same order every time → no deadlocks), then price from the DB -----
  select array_agg(distinct (e ->> 'variant_id')::uuid order by (e ->> 'variant_id')::uuid)
    into vids from jsonb_array_elements(p -> 'items') e;
  perform 1 from public.product_variants v where v.id = any (vids) order by v.id for update;

  for it in
    select m.vid, m.qty, v.price, v.stock_qty, v.size, v.active as v_active,
           pr.id as pid, pr.name_ar, pr.name_en, pr.active as p_active
    from (
      select (e ->> 'variant_id')::uuid as vid, sum((e ->> 'qty')::int) as qty
      from jsonb_array_elements(p -> 'items') e group by 1
    ) m
    left join public.product_variants v on v.id = m.vid
    left join public.products pr on pr.id = v.product_id
    order by m.vid
  loop
    if it.qty > 10 then
      return jsonb_build_object('ok', false, 'error', 'invalid_items');
    elsif it.price is null or not it.v_active or not it.p_active then
      problems := problems || jsonb_build_object('variant_id', it.vid, 'problem', 'unavailable', 'available', 0);
    elsif it.stock_qty < it.qty then
      problems := problems || jsonb_build_object('variant_id', it.vid, 'problem', 'out_of_stock', 'available', it.stock_qty);
    else
      lines := lines || jsonb_build_object(
        'variant_id', it.vid, 'product_id', it.pid, 'name_ar', it.name_ar, 'name_en', it.name_en,
        'size', it.size, 'unit_price', it.price, 'qty', it.qty, 'line_total', it.price * it.qty);
      v_sub := v_sub + it.price * it.qty;
    end if;
  end loop;

  if jsonb_array_length(problems) > 0 then
    return jsonb_build_object('ok', false, 'error', 'items_unavailable', 'items', problems);
  end if;

  v_total := v_sub + zone.fee;

  -- The customer must have seen this exact total. If a price or fee changed meanwhile, stop and show the new one.
  if p ? 'expected_total' and (p ->> 'expected_total') is distinct from v_total::text then
    return jsonb_build_object('ok', false, 'error', 'price_changed',
      'quote', jsonb_build_object('subtotal', v_sub, 'shipping_fee', zone.fee, 'total', v_total, 'items', lines));
  end if;

  -- ----- reserve stock and save the order -----
  update public.product_variants v
  set stock_qty = v.stock_qty - (l ->> 'qty')::int
  from jsonb_array_elements(lines) l
  where v.id = (l ->> 'variant_id')::uuid;

  v_status := case method when 'cod' then 'placed' else 'pending_payment' end;

  insert into public.orders (
    tracking_token_hash, customer_name, phone, email, zone_id, area, address, notes,
    payment_method, status, payment_status, subtotal, shipping_fee, total, expires_at, client_ip_hash)
  values (
    p ->> 'token_hash',
    regexp_replace(trim(c ->> 'name'), '\s+', ' ', 'g'),
    c ->> 'phone', v_email, zone.id,
    trim(c ->> 'area'), trim(c ->> 'address'), v_notes,
    method, v_status,
    case method when 'cod' then 'unpaid' else 'pending' end,
    v_sub, zone.fee, v_total,
    case method when 'card' then now() + interval '30 minutes' end,
    p ->> 'ip_hash')
  returning id, order_number into v_id, v_num;

  insert into public.order_items (order_id, variant_id, product_id, product_name_ar, product_name_en, size, unit_price, qty, line_total)
  select v_id, (l ->> 'variant_id')::uuid, (l ->> 'product_id')::uuid, l ->> 'name_ar', coalesce(l ->> 'name_en', ''),
         l ->> 'size', (l ->> 'unit_price')::int, (l ->> 'qty')::int, (l ->> 'line_total')::int
  from jsonb_array_elements(lines) l;

  insert into public.order_status_history (order_id, from_status, to_status, note)
  values (v_id, null, v_status, 'order placed');

  return jsonb_build_object('ok', true, 'order_id', v_id, 'order_number', v_num, 'status', v_status,
    'subtotal', v_sub, 'shipping_fee', zone.fee, 'total', v_total);
end;
$$;

revoke all on function public.place_order(jsonb) from public, anon, authenticated;
grant execute on function public.place_order(jsonb) to service_role;

-- ---------- Following an order (anyone holding the secret link) ----------
-- Returns one order's public view, or null. Full address and full phone are never returned.
create or replace function public.get_order_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
begin
  if p_token is null or length(p_token) not between 32 and 128 then
    return null;
  end if;
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
