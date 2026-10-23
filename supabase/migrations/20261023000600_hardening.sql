-- ============================================================
--  Stage 5 hardening (found by tests/security-audit.test.js).
--  Defence in depth: Row Level Security already returned nothing here,
--  but the underlying privileges shouldn't exist at all.
-- ============================================================

-- Visitors never need to see the admin list (logged-in admins read their own row via RLS).
revoke all on public.admin_users from anon;

-- REFERENCES / TRIGGER are never needed by the website's API roles.
revoke references, trigger on all tables in schema public from anon, authenticated;

-- …and future tables don't get them by default either.
alter default privileges in schema public revoke references, trigger on tables from anon, authenticated;
