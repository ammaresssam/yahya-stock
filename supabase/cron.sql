-- ============================================================
--  Optional, real Supabase project only (not a migration: needs the pg_cron extension).
--  Expires unpaid card orders every 5 minutes and returns their stock.
--  Expiry also runs whenever an order is placed or a tracking page is opened,
--  so the shop works without this — it just keeps stock accurate on quiet days.
--
--  Supabase → Database → Extensions → enable "pg_cron", then run this in the SQL Editor.
-- ============================================================
select cron.schedule(
  'expire-unpaid-orders',
  '*/5 * * * *',
  $$ select public.expire_unpaid_orders(); $$
);
