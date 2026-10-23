// Security audit of the whole database, read from Postgres's own catalog after all migrations.
// It doesn't test one feature — it checks rules that every table and function must follow,
// so a future migration that forgets one fails here.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, sql } from './helpers/db.js'

// Functions visitors and customers are allowed to call. Everything else that is
// SECURITY DEFINER must be server-only or check is_admin() itself.
const PUBLIC_FUNCTIONS = new Set(['is_admin', 'get_order_by_token', 'order_next_statuses'])
const ADMIN_FUNCTIONS = new Set(['admin_save_product', 'admin_set_order_status']) // check is_admin() inside
const SERVER_ONLY = new Set([
  'place_order', 'place_order_with_expiry', 'expire_unpaid_orders', 'get_payable_order',
  'record_payment_intent', 'apply_payment_event',
])

// Tables visitors may read (filtered by RLS); every other table must be invisible to them.
const PUBLIC_READ_TABLES = new Set(['categories', 'products', 'product_variants', 'product_images', 'shipping_zones'])

describe('database security audit', () => {
  let db
  before(async () => { db = await freshDb() })
  after(() => db.close())

  test('every table in the public schema has Row Level Security on', async () => {
    const rows = await sql(db, `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`)
    assert.ok(rows.length >= 11, `expected all shop tables, found ${rows.length}`)
    const off = rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)
    assert.deepEqual(off, [], `RLS is off on: ${off.join(', ')}`)
  })

  test('no policy lets visitors (anon) write anything', async () => {
    const rows = await sql(db, `select tablename, policyname, cmd, roles::text from pg_policies where schemaname in ('public', 'storage')`)
    const bad = rows.filter((p) => p.cmd !== 'SELECT' && (p.roles.includes('anon') || p.roles.includes('public')))
    assert.deepEqual(bad.map((p) => `${p.tablename}.${p.policyname}`), [])
  })

  test('every write policy requires is_admin()', async () => {
    const rows = await sql(db, `select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname in ('public', 'storage') and cmd <> 'SELECT'`)
    for (const p of rows) {
      const text = `${p.qual ?? ''} ${p.with_check ?? ''}`
      assert.match(text, /is_admin\(\)/, `${p.tablename}.${p.policyname} (${p.cmd}) doesn't check is_admin()`)
    }
  })

  test('read policies on private tables are admin-only', async () => {
    const rows = await sql(db, `select tablename, policyname, qual, roles::text from pg_policies where schemaname = 'public' and cmd in ('SELECT', 'ALL')`)
    for (const p of rows.filter((r) => !PUBLIC_READ_TABLES.has(r.tablename))) {
      const ownAdminRow = p.tablename === 'admin_users' && /auth\.uid\(\)/.test(p.qual)
      assert.ok(ownAdminRow || /is_admin\(\)/.test(p.qual ?? ''), `${p.tablename}.${p.policyname} lets non-admins read`)
    }
  })

  test('visitors have no table privileges on private tables at all', async () => {
    const rows = await sql(db, `select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'`)
    const leaks = rows.filter((r) => !PUBLIC_READ_TABLES.has(r.table_name))
    assert.deepEqual(leaks.map((r) => `${r.table_name}:${r.privilege_type}`), [])
    const notRead = rows.filter((r) => r.privilege_type !== 'SELECT')
    assert.deepEqual(notRead.map((r) => `${r.table_name}:${r.privilege_type}`), [], 'visitors may only read the public catalogue')
  })

  test('orders and payment tables can’t be written by logged-in users either', async () => {
    const rows = await sql(db, `select table_name, privilege_type from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name in ('orders','order_items','order_status_history','payment_intents','payment_events','admin_users') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')`)
    assert.deepEqual(rows.map((r) => `${r.table_name}:${r.privilege_type}`), [])
  })

  test('every SECURITY DEFINER function pins its search_path', async () => {
    const rows = await sql(db, `select p.proname, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef`)
    for (const f of rows) assert.ok((f.proconfig ?? []).some((c) => c.startsWith('search_path=')), `${f.proname} has no fixed search_path`)
  })

  test('every SECURITY DEFINER function is classified, and execute rights match', async () => {
    const rows = await sql(db, `
      select p.proname,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authed,
             has_function_privilege('service_role', p.oid, 'execute') as server
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef`)
    for (const f of rows) {
      const known = PUBLIC_FUNCTIONS.has(f.proname) || ADMIN_FUNCTIONS.has(f.proname) || SERVER_ONLY.has(f.proname)
      assert.ok(known, `new SECURITY DEFINER function ${f.proname} must be added to this audit with a decision`)
      if (SERVER_ONLY.has(f.proname)) {
        assert.deepEqual([f.anon, f.authed, f.server], [false, false, true], `${f.proname} must be server-only`)
      }
      if (ADMIN_FUNCTIONS.has(f.proname)) {
        assert.equal(f.anon, false, `${f.proname}: visitors must not even call it`)
        const [{ src }] = await sql(db, `select prosrc as src from pg_proc where proname = $1`, [f.proname])
        assert.match(src, /if not public\.is_admin\(\) then/, `${f.proname} must check is_admin() first`)
      }
    }
  })

  test('money and stock columns can’t go negative', async () => {
    const rows = await sql(db, `select conrelid::regclass::text as t, pg_get_constraintdef(oid) as def from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace`)
    const has = (t, re) => rows.some((r) => r.t === t && re.test(r.def))
    assert.ok(has('product_variants', /stock_qty >= 0/), 'stock')
    assert.ok(has('product_variants', /price > 0/), 'price')
    assert.ok(has('orders', /total = \(subtotal \+ shipping_fee\)/), 'order total')
    assert.ok(has('order_items', /line_total = \(unit_price \* qty\)/), 'line total')
    assert.ok(has('shipping_zones', /fee >= 0/), 'fee')
  })

  test('each Paymob transaction can be stored only once', async () => {
    const rows = await sql(db, `select indexdef from pg_indexes where schemaname = 'public' and tablename = 'payment_events'`)
    assert.ok(rows.some((r) => /UNIQUE/.test(r.indexdef) && /transaction_id/.test(r.indexdef)))
  })
})
