-- ============================================================
--  Stage 1: sizes with their own price and stock quantity,
--  and several photos per product.
--
--  products            → what the item is (name, category, flags)
--  product_variants    → one row per size: price, before-discount price, quantity
--  product_images      → up to 8 photos, in display order
-- ============================================================

-- ---------- Sizes / variants ----------
create table if not exists public.product_variants (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products (id) on delete cascade,
  size             text not null check (length(trim(size)) between 1 and 30),
  price            integer not null check (price > 0 and price <= 1000000),
  compare_at_price integer check (compare_at_price is null or compare_at_price > price),
  stock_qty        integer not null default 0 check (stock_qty >= 0 and stock_qty <= 100000),
  sku              text check (sku is null or length(sku) <= 60),
  active           boolean not null default true,
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- deferred so the owner can swap/rename sizes within one save
  constraint product_variants_unique_size unique (product_id, size) deferrable initially deferred
);
create index if not exists product_variants_product_idx on public.product_variants (product_id);

drop trigger if exists product_variants_touch on public.product_variants;
create trigger product_variants_touch before update on public.product_variants
  for each row execute function public.touch_updated_at();

-- ---------- Photos ----------
create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  url          text not null check (url ~ '^https?://'),
  storage_path text,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id);

create or replace function public.enforce_image_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.product_images where product_id = new.product_id) >= 8 then
    raise exception 'max 8 images per product' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists product_images_limit on public.product_images;
create trigger product_images_limit before insert on public.product_images
  for each row execute function public.enforce_image_limit();

-- ---------- Move existing data into the new tables ----------
-- Each size in products.sizes becomes a variant with the product's price.
-- The old stock status becomes a starting quantity (in → 5, low → 1, out → 0):
-- the owner should review quantities after this migration.
-- (distinct on drops a size listed twice; on conflict can't be used with a deferred unique rule)
insert into public.product_variants (product_id, size, price, compare_at_price, stock_qty, position)
select distinct on (p.id, trim(s.size))
       p.id,
       trim(s.size),
       greatest(p.price, 1),
       case when p.old_price > p.price then p.old_price end,
       case p.stock when 'out' then 0 when 'low' then 1 else 5 end,
       (s.ord - 1)::int
from public.products p
cross join lateral unnest(p.sizes) with ordinality as s(size, ord)
where trim(s.size) <> ''
order by p.id, trim(s.size), s.ord;

insert into public.product_variants (product_id, size, price, compare_at_price, stock_qty)
select p.id, 'Free Size', greatest(p.price, 1),
       case when p.old_price > p.price then p.old_price end,
       case p.stock when 'out' then 0 when 'low' then 1 else 5 end
from public.products p
where not exists (select 1 from public.product_variants v where v.product_id = p.id);

insert into public.product_images (product_id, url, storage_path, position)
select id, image_url, nullif(split_part(image_url, '/product-images/', 2), ''), 0
from public.products
where image_url is not null;

-- One source of truth: price, sizes, stock and photo now live in the new tables.
alter table public.products
  drop column if exists price,
  drop column if exists old_price,
  drop column if exists sizes,
  drop column if exists stock,
  drop column if exists image_url;

-- ---------- Security ----------
alter table public.product_variants enable row level security;
alter table public.product_images   enable row level security;

-- Visitors see active sizes/photos of visible products only.
drop policy if exists "public read active variants" on public.product_variants;
create policy "public read active variants" on public.product_variants
  for select using (
    active and exists (select 1 from public.products p where p.id = product_id and p.active)
  );

drop policy if exists "public read images of visible products" on public.product_images;
create policy "public read images of visible products" on public.product_images
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.active)
  );

-- Only admins change anything.
drop policy if exists "admins manage variants" on public.product_variants;
create policy "admins manage variants" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage images" on public.product_images;
create policy "admins manage images" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete, truncate on public.product_variants, public.product_images from anon;

-- ---------- Save a whole product in one checked, all-or-nothing step ----------
-- payload: {
--   id?, name_ar, name_en, category, is_new, featured, active, art_type, art_color, art_bg,
--   variants: [{ id?, size, price, compare_at_price?, stock_qty, sku?, active? }, …]   (≥ 1)
--   images:   [{ url, storage_path? }, …]                                         (≤ 8, in order)
-- }
-- Variants missing from the list are deleted; the image list replaces the old one.
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
    if sz = '' then
      raise exception 'size_required' using errcode = '22023';
    end if;
    if lower(sz) = any (seen) then
      raise exception 'duplicate_size' using errcode = '22023', detail = sz;
    end if;
    seen := seen || lower(sz);

    if nullif(v ->> 'id', '') is not null then
      update public.product_variants set
        size             = sz,
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
      insert into public.product_variants (product_id, size, price, compare_at_price, stock_qty, sku, active, position)
      values (
        pid, sz,
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
