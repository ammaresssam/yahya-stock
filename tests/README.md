# Database security tests

```bash
npm test
```

These run every migration in `supabase/migrations/` on a fresh in-memory Postgres (PGlite). Then they act as a visitor, a logged-in customer and the store owner, and check what each one can and cannot do.

## What these tests prove, and what they don't

They **do** prove that our migrations, on real Postgres, enforce the rules:
- Row Level Security policies
- grants and revokes
- `security definer` functions
- the logic of every SQL function

The setup copies Supabase's risky default on purpose: visitors get full table privileges, so the policies are the only protection. A policy mistake therefore shows up as a failing test.

They **do not** prove the real Supabase project is secure. `tests/supabase-shim.sql` is a stand-in for Supabase's `auth` and `storage` schemas and roles. It is not the real thing, and settings made in the Supabase dashboard are outside these tests.

## Manual checks on the real project (do these before going live)

Run them in the Supabase SQL Editor, or with the anon key from a browser console.

1. **RLS is on everywhere:**
   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public';
   ```
   Every row must show `true`.
2. **Policies are the expected ones:**
   ```sql
   select tablename, policyname, roles, cmd, qual, with_check from pg_policies where schemaname in ('public', 'storage') order by 1, 2;
   ```
   No write policy may use `true` without `is_admin()`.
3. **The admin list holds only the owner:**
   ```sql
   select a.user_id, u.email from public.admin_users a join auth.users u on u.id = a.user_id;
   ```
4. **A non-admin really is blocked.** Create a throwaway user, log in to `/#/admin` with it, and confirm you see "الحساب ده مش مسموح له". Then, using that user's session in the browser console, try `supabase.from('product_variants').update({ price: 1 }).eq('id', '<some size id>')` and `supabase.rpc('admin_save_product', { payload: {} })`. Confirm 0 rows changed and "not authorized". Delete the throwaway user afterwards.
5. **Orders are private.** With only the anon key (browser console on the live site), `fetch(SUPABASE_URL + '/rest/v1/orders?select=*', { headers: { apikey: ANON_KEY } })` must return an empty list or a permission error, and calling `place_order` through `/rest/v1/rpc/place_order` must be refused.
6. **The service_role key isn't in the frontend.** Search the built `dist/` folder for `service_role`: there must be no match. The only key in `.env.local` is the anon/publishable one.

## Test files

| File | What it covers |
|---|---|
| `admin-authorization.test.js` | Stage 0. Only admins can change products, categories and photos. It includes a test showing the old rules were vulnerable. |
| `variants-and-images.test.js` | Stage 1. Sizes with their own price and stock, and photos. Covers who can see and change them, the database rules (no negative stock or zero price, valid discount, no repeated size, at most 8 photos), moving existing data into the new layout, and the owner's all-or-nothing save. |
| `orders.test.js` | Stage 2. Placing orders: prices come only from the database, browser-sent prices are ignored, a changed total aborts the order, overselling is blocked, hidden or switched-off sizes can't be bought, input is validated, and there's a rate limit. Privacy: visitors and customers can't call `place_order`, can't read, create or change orders, and can't change delivery fees. A tracking link shows only its own order, without the full address or phone. |
| `checkout-core.test.js` | Stage 2. The checkout Edge Function's logic, run against the real database functions. Covers phone normalising (Arabic digits, +20), input validation, the secret-link format, which HTTP errors reach the customer, and that internal errors are never shown. |
| `catalog.test.js` | Storefront search, filters and sorting. Covers Arabic and English search and letter variants, size together with in-stock, price ranges, on-sale counting only real in-stock discounts, sorting with sold-out items always last, and the discount numbers. |
| `admin-orders.test.js` | Stage 3. The owner changing order status: only valid steps are allowed, cancelling returns stock exactly once, cash on delivery counts as paid only on delivery, a card order can't be confirmed or paid by hand, and every change is recorded with who made it. Also covers a concurrent change being refused, visitors and customers being blocked, and delivery fees. |

What these can't prove: two customers buying the last piece at the very same millisecond. PGlite has a single connection, so the row lock in `place_order` is tested only one order after another. On real Postgres that lock (`select … for update`) is what serialises them.

