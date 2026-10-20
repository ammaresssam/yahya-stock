-- ============================================================
--  Yahya Stock — database setup
--  Paste this whole file into Supabase → SQL Editor → Run (once).
-- ============================================================

-- ---------- Tables ----------
create table if not exists public.categories (
  id         text primary key,
  name_ar    text not null,
  name_en    text not null default '',
  art_type   text not null default 'tee',
  art_color  text not null default '#2b2a2f',
  art_bg     text not null default '#e9e7e3',
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id         uuid primary key default gen_random_uuid(),
  name_ar    text not null,
  name_en    text not null default '',
  category   text not null references public.categories(id) on update cascade on delete restrict,
  price      integer not null check (price >= 0),
  old_price  integer check (old_price is null or old_price > 0),
  sizes      text[] not null default '{}',
  stock      text not null default 'in' check (stock in ('in', 'low', 'out')),
  is_new     boolean not null default false,
  featured   boolean not null default false,
  active     boolean not null default true,          -- false = hidden from the public site
  image_url  text,
  art_type   text not null default 'tee',            -- drawing used when there is no photo
  art_color  text not null default '#2b2a2f',
  art_bg     text not null default '#e9e7e3',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ---------- Security (Row Level Security) ----------
-- Visitors (anon) can only READ visible products and categories.
-- Only a logged-in owner (authenticated) can add / change / delete.
alter table public.categories enable row level security;
alter table public.products   enable row level security;

drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories for select using (true);

drop policy if exists "owner manages categories" on public.categories;
create policy "owner manages categories" on public.categories for all to authenticated using (true) with check (true);

drop policy if exists "public read visible products" on public.products;
create policy "public read visible products" on public.products for select using (active);

drop policy if exists "owner manages products" on public.products;
create policy "owner manages products" on public.products for all to authenticated using (true) with check (true);

-- ---------- Photo storage ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public read product images" on storage.objects;
create policy "public read product images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "owner uploads product images" on storage.objects;
create policy "owner uploads product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists "owner updates product images" on storage.objects;
create policy "owner updates product images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

drop policy if exists "owner deletes product images" on storage.objects;
create policy "owner deletes product images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

-- ---------- Starting categories (owner can change them in the admin panel) ----------
insert into public.categories (id, name_ar, name_en, art_type, art_color, art_bg) values
  ('men',   'رجالي',  'Men',   'shirt', '#2b2a2f', '#e9e7e3'),
  ('women', 'حريمي',  'Women', 'dress', '#e3262d', '#f6e4e2'),
  ('kids',  'أطفال',  'Kids',  'tee',   '#f2b705', '#fbf1cf')
on conflict (id) do nothing;
