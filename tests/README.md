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
4. **A non-admin really is blocked.** Create a throwaway user, log in to `/#/admin` with it, and confirm you see "الحساب ده مش مسموح له". Then, using that user's session in the browser console, try `supabase.from('products').update({ price: 1 }).eq('id', '<some id>')` and confirm 0 rows changed. Delete the throwaway user afterwards.
5. **The service_role key isn't in the frontend.** Search the built `dist/` folder for `service_role`: there must be no match. The only key in `.env.local` is the anon/publishable one.

## Test files

| File | What it covers |
|---|---|
| `admin-authorization.test.js` | Stage 0. Only admins can change products, categories and photos. It includes a test showing the old rules were vulnerable. |
