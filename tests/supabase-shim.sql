-- ============================================================
--  Minimal stand-in for the parts of Supabase our migrations rely on,
--  so they can run on plain Postgres (PGlite) in tests.
--
--  It mirrors Supabase's real defaults where they matter for security:
--  • roles anon / authenticated / service_role (service_role bypasses RLS)
--  • auth.uid() read from the request's JWT claims
--  • the API roles get ALL privileges on public tables by default,
--    so Row Level Security is the only thing standing in the way — just like production.
--
--  This is NOT Supabase. Passing tests here does not prove the real project is
--  configured correctly; see tests/README.md for the checks to run there.
-- ============================================================

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ---------- auth ----------
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), ''
  )::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

-- ---------- storage ----------
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean default false
);

create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text,
  owner     uuid
);

alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
