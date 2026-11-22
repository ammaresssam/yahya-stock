-- ============================================================
--  Colours: a product option next to the size.
--
--  Each row of product_variants is now one colour + one size, with its own
--  price and stock (e.g. "Red / XL"). Products without colours keep
--  color_ar = '' and work exactly as before.
--
--  order_items keep a snapshot of the colour, like they already do for size.
-- ============================================================

alter table public.product_variants
  add column if not exists color_ar  text not null default '' check (length(color_ar) <= 40),
  add column if not exists color_en  text not null default '' check (length(color_en) <= 40),
  add column if not exists color_hex text check (color_hex is null or color_hex ~ '^#[0-9a-fA-F]{6}$');

-- the same size can now exist once per colour
alter table public.product_variants drop constraint if exists product_variants_unique_size;
alter table public.product_variants drop constraint if exists product_variants_unique_color_size;
alter table public.product_variants
  add constraint product_variants_unique_color_size unique (product_id, color_ar, size) deferrable initially deferred;

alter table public.order_items
  add column if not exists color_ar  text not null default '',
  add column if not exists color_en  text not null default '',
  add column if not exists color_hex text;

-- Copy the colour of the bought variant onto the order line when it is created.
-- (place_order already inserts variant_id; this keeps that function unchanged.)
create or replace function public.order_item_copy_color() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.variant_id is not null then
    select v.color_ar, v.color_en, v.color_hex
      into new.color_ar, new.color_en, new.color_hex
    from public.product_variants v where v.id = new.variant_id;
    new.color_ar := coalesce(new.color_ar, '');
    new.color_en := coalesce(new.color_en, '');
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_copy_color on public.order_items;
create trigger order_items_copy_color before insert on public.order_items
  for each row execute function public.order_item_copy_color();

-- ---------- admin_save_product: variants may carry a colour ----------
-- variants: [{ id?, size, color_ar?, color_en?, color_hex?, price, compare_at_price?, stock_qty, sku?, active? }, …]
create or replace function public.admin_save_product(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid      uuid := nullif(payload ->> 'id', '')::uuid;
  v        jsonb;
  vid      uuid;
  sz       text;
  col_ar   text;
  col_en   text;
  col_hex  text;
  seen     text[] := '{}';
  keep_ids uuid[] := '{}';
  pos      int := 0;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if coalesce(trim(payload ->> 'name_ar'), '') = '' then
    raise exception 'name_ar_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories c where c.id = payload ->> 'category') then
    raise exception 'unknown_category' using errcode = '22023';
  end if;
  if jsonb_typeof(payload -> 'variants') is distinct from 'array' or jsonb_array_length(payload -> 'variants') = 0 then
    raise exception 'variants_required' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(payload -> 'images', '[]'::jsonb)) > 8 then
    raise exception 'too_many_images' using errcode = '22023';
  end if;

  if pid is null then
    insert into public.products (name_ar, name_en, category, is_new, featured, active, art_type, art_color, art_bg)
    values (
      trim(payload ->> 'name_ar'),
      coalesce(trim(payload ->> 'name_en'), ''),
      payload ->> 'category',
      coalesce((payload ->> 'is_new')::boolean, false),
      coalesce((payload ->> 'featured')::boolean, false),
      coalesce((payload ->> 'active')::boolean, true),
      coalesce(payload ->> 'art_type', 'tee'),
      coalesce(payload ->> 'art_color', '#2b2a2f'),
      coalesce(payload ->> 'art_bg', '#e9e7e3')
    )
    returning id into pid;
  else
    update public.products set
      name_ar   = trim(payload ->> 'name_ar'),
      name_en   = coalesce(trim(payload ->> 'name_en'), ''),
      category  = payload ->> 'category',
      is_new    = coalesce((payload ->> 'is_new')::boolean, false),
      featured  = coalesce((payload ->> 'featured')::boolean, false),
      active    = coalesce((payload ->> 'active')::boolean, true),
      art_type  = coalesce(payload ->> 'art_type', art_type),
      art_color = coalesce(payload ->> 'art_color', art_color),
      art_bg    = coalesce(payload ->> 'art_bg', art_bg)
    where id = pid;
    if not found then
      raise exception 'product_not_found' using errcode = 'P0002';
    end if;
  end if;

  -- Sizes removed by the owner are deleted first, so their names can be reused.
  delete from public.product_variants
  where product_id = pid
    and id not in (
      select (e ->> 'id')::uuid from jsonb_array_elements(payload -> 'variants') e
      where nullif(e ->> 'id', '') is not null
    );

  for v in select * from jsonb_array_elements(payload -> 'variants') loop
    sz := trim(coalesce(v ->> 'size', ''));
    col_ar := trim(coalesce(v ->> 'color_ar', ''));
    col_en := trim(coalesce(v ->> 'color_en', ''));
    col_hex := nullif(trim(coalesce(v ->> 'color_hex', '')), '');
    if sz = '' then
      raise exception 'size_required' using errcode = '22023';
    end if;
    if col_ar = '' and (col_en <> '' or col_hex is not null) then
      raise exception 'color_name_required' using errcode = '22023';
    end if;
    -- the same size may appear once per colour
    if lower(col_ar) || '|' || lower(sz) = any (seen) then
      raise exception 'duplicate_size' using errcode = '22023', detail = sz;
    end if;
    seen := seen || (lower(col_ar) || '|' || lower(sz));

    if nullif(v ->> 'id', '') is not null then
      update public.product_variants set
        size             = sz,
        color_ar         = col_ar,
        color_en         = col_en,
        color_hex        = col_hex,
        price            = (v ->> 'price')::int,
        compare_at_price = nullif(v ->> 'compare_at_price', '')::int,
        stock_qty        = (v ->> 'stock_qty')::int,
        sku              = nullif(trim(coalesce(v ->> 'sku', '')), ''),
        active           = coalesce((v ->> 'active')::boolean, true),
        position         = pos
      where id = (v ->> 'id')::uuid and product_id = pid
      returning id into vid;
      if vid is null then
        raise exception 'variant_not_found' using errcode = 'P0002';
      end if;
    else
      insert into public.product_variants (product_id, size, color_ar, color_en, color_hex, price, compare_at_price, stock_qty, sku, active, position)
      values (
        pid, sz, col_ar, col_en, col_hex,
        (v ->> 'price')::int,
        nullif(v ->> 'compare_at_price', '')::int,
        coalesce((v ->> 'stock_qty')::int, 0),
        nullif(trim(coalesce(v ->> 'sku', '')), ''),
        coalesce((v ->> 'active')::boolean, true),
        pos
      )
      returning id into vid;
    end if;
    keep_ids := keep_ids || vid;
    vid := null;
    pos := pos + 1;
  end loop;

  delete from public.product_images where product_id = pid;
  insert into public.product_images (product_id, url, storage_path, position)
  select pid, e ->> 'url', nullif(e ->> 'storage_path', ''), (o - 1)::int
  from jsonb_array_elements(coalesce(payload -> 'images', '[]'::jsonb)) with ordinality as t(e, o);

  return pid;
end;
$$;

revoke all on function public.admin_save_product(jsonb) from public, anon;
grant execute on function public.admin_save_product(jsonb) to authenticated;

-- ---------- the tracking page shows the colour of each line ----------
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
        'color_ar', i.color_ar, 'color_en', i.color_en, 'color_hex', i.color_hex,
        'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.product_name_ar, i.color_ar, i.size), '[]'::jsonb)
      from public.order_items i where i.order_id = o.id),
    'history', (
      select coalesce(jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at) order by h.created_at, h.id), '[]'::jsonb)
      from public.order_status_history h where h.order_id = o.id)
  );
end;
$$;
revoke all on function public.get_order_by_token(text) from public;
grant execute on function public.get_order_by_token(text) to anon, authenticated, service_role;
