-- ============================================================
--  Security fix: only the store owner (admins) may change the shop.
--
--  Before: every write policy said "to authenticated using (true)", so ANY
--  logged-in account (including future customer accounts, or anyone who signs
--  up while public sign-up is on) could change prices, stock and photos.
--
--  After: writes require the user to be listed in public.admin_users.
--  Nobody can add themselves to that list from the browser — only the
--  database owner (SQL editor / service role) can.
-- ============================================================

-- ---------- Who is an admin ----------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- An admin may see their own admin row (used by the panel to confirm access).
-- There are deliberately NO insert/update/delete policies: from the browser
-- this table is read-only, for everyone.
drop policy if exists "admin reads own row" on public.admin_users;
create policy "admin reads own row" on public.admin_users
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete, truncate on public.admin_users from anon, authenticated;

-- security definer so it can read admin_users regardless of the caller's
-- permissions; empty search_path so it can't be hijacked by a same-named object.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------- Categories ----------
drop policy if exists "owner manages categories" on public.categories;
drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- Products ----------
drop policy if exists "owner manages products" on public.products;
drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Visitors can never write, even if a policy is added by mistake later.
revoke insert, update, delete, truncate on public.categories, public.products from anon;

-- ---------- Product photos ----------
drop policy if exists "owner uploads product images" on storage.objects;
drop policy if exists "owner updates product images" on storage.objects;
drop policy if exists "owner deletes product images" on storage.objects;
drop policy if exists "admins upload product images" on storage.objects;
drop policy if exists "admins update product images" on storage.objects;
drop policy if exists "admins delete product images" on storage.objects;

create policy "admins upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "admins update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "admins delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------- How to make the owner an admin (run once, in the SQL editor) ----------
--   insert into public.admin_users (user_id, note)
--   select id, 'store owner' from auth.users where email = 'OWNER-EMAIL@example.com';
