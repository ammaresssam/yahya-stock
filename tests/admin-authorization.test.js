// Stage 0 — only the store owner (admin) may change the shop.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { attempt, freshDb, sql } from './helpers/db.js'

const OWNER = '00000000-0000-0000-0000-00000000000a'
const CUSTOMER = '00000000-0000-0000-0000-00000000000c'

const visitor = { role: 'anon' }
const customer = { role: 'authenticated', uid: CUSTOMER } // logged in, NOT an admin
const owner = { role: 'authenticated', uid: OWNER }

async function seed(db, { makeOwnerAdmin = true } = {}) {
  await sql(db, `insert into auth.users (id, email) values ($1, 'owner@shop.test'), ($2, 'customer@mail.test')`, [OWNER, CUSTOMER])
  if (makeOwnerAdmin) await sql(db, `insert into public.admin_users (user_id) values ($1)`, [OWNER])
  await sql(db, `
    insert into public.products (id, name_ar, category, price, sizes, active) values
      ('11111111-1111-1111-1111-111111111111', 'قميص', 'men', 300, '{M,L}', true),
      ('22222222-2222-2222-2222-222222222222', 'مخفي', 'men', 100, '{M}', false)`)
}

const SHIRT = '11111111-1111-1111-1111-111111111111'
const priceOf = async (db, id = SHIRT) => (await sql(db, `select price from public.products where id = $1`, [id]))[0]?.price

// ------------------------------------------------------------------
describe('BEFORE the fix (baseline migration only) — documents the vulnerability', () => {
  let db
  before(async () => {
    db = await freshDb({ upTo: '20261020000000_baseline.sql' })
    await seed(db, { makeOwnerAdmin: false })
  })
  after(() => db.close())

  test('any logged-in customer could change a product price', async () => {
    const r = await attempt(db, customer, `update public.products set price = 1 where id = $1`, [SHIRT])
    assert.equal(r.affected, 1, 'expected the old rules to allow this')
    assert.equal(await priceOf(db), 1)
  })
})

// ------------------------------------------------------------------
describe('AFTER the fix (all migrations)', () => {
  let db
  before(async () => {
    db = await freshDb()
    await seed(db)
  })
  after(() => db.close())

  describe('visitors (not logged in)', () => {
    test('can see visible products only', async () => {
      const r = await attempt(db, visitor, `select name_ar from public.products order by name_ar`)
      assert.ok(r.ok, r.error)
      assert.deepEqual(r.rows.map((x) => x.name_ar), ['قميص'])
    })
    test('cannot change a price', async () => {
      const r = await attempt(db, visitor, `update public.products set price = 1 where id = $1`, [SHIRT])
      assert.equal(r.affected, 0)
      assert.equal(await priceOf(db), 300)
    })
    test('cannot add a product', async () => {
      const r = await attempt(db, visitor, `insert into public.products (name_ar, category, price) values ('x', 'men', 1)`)
      assert.equal(r.ok, false)
    })
    test('cannot delete a product', async () => {
      await attempt(db, visitor, `delete from public.products where id = $1`, [SHIRT])
      assert.equal(await priceOf(db), 300)
    })
    test('cannot change or add categories', async () => {
      const u = await attempt(db, visitor, `update public.categories set name_ar = 'x' where id = 'men'`)
      const i = await attempt(db, visitor, `insert into public.categories (id, name_ar) values ('x', 'x')`)
      assert.equal(u.affected, 0)
      assert.equal(i.ok, false)
    })
    test('is_admin() is false', async () => {
      const r = await attempt(db, visitor, `select public.is_admin() as a`)
      assert.equal(r.rows[0].a, false)
    })
  })

  describe('logged-in customer (not an admin)', () => {
    test('cannot change a price', async () => {
      const r = await attempt(db, customer, `update public.products set price = 1 where id = $1`, [SHIRT])
      assert.equal(r.affected, 0)
      assert.equal(await priceOf(db), 300)
    })
    test('cannot change stock status', async () => {
      await attempt(db, customer, `update public.products set stock = 'out' where id = $1`, [SHIRT])
      assert.equal((await sql(db, `select stock from public.products where id = $1`, [SHIRT]))[0].stock, 'in')
    })
    test('cannot add, delete or see hidden products', async () => {
      const i = await attempt(db, customer, `insert into public.products (name_ar, category, price) values ('x', 'men', 1)`)
      const d = await attempt(db, customer, `delete from public.products where id = $1`, [SHIRT])
      const s = await attempt(db, customer, `select count(*)::int as n from public.products where active = false`)
      assert.equal(i.ok, false)
      assert.equal(d.affected, 0)
      assert.equal(s.rows[0].n, 0)
    })
    test('cannot change or delete categories', async () => {
      const u = await attempt(db, customer, `update public.categories set name_ar = 'x' where id = 'men'`)
      const d = await attempt(db, customer, `delete from public.categories where id = 'kids'`)
      assert.equal(u.affected, 0)
      assert.equal(d.affected, 0)
      assert.equal((await sql(db, `select count(*)::int as n from public.categories`))[0].n, 3)
    })
    test('cannot make themselves an admin', async () => {
      const r = await attempt(db, customer, `insert into public.admin_users (user_id) values ($1)`, [CUSTOMER])
      assert.equal(r.ok, false)
      assert.equal((await sql(db, `select count(*)::int as n from public.admin_users where user_id = $1`, [CUSTOMER]))[0].n, 0)
    })
    test('cannot see who the admins are', async () => {
      const r = await attempt(db, customer, `select user_id from public.admin_users`)
      assert.deepEqual(r.rows, [])
    })
    test('cannot upload, replace or delete product photos', async () => {
      await sql(db, `insert into storage.objects (bucket_id, name) values ('product-images', 'existing.webp')`)
      const up = await attempt(db, customer, `insert into storage.objects (bucket_id, name) values ('product-images', 'evil.webp')`)
      const del = await attempt(db, customer, `delete from storage.objects where name = 'existing.webp'`)
      assert.equal(up.ok, false)
      assert.equal(del.affected, 0)
    })
    test('is_admin() is false', async () => {
      const r = await attempt(db, customer, `select public.is_admin() as a`)
      assert.equal(r.rows[0].a, false)
    })
  })

  describe('store owner (admin)', () => {
    test('is_admin() is true', async () => {
      const r = await attempt(db, owner, `select public.is_admin() as a`)
      assert.equal(r.rows[0].a, true)
    })
    test('can change a price', async () => {
      const r = await attempt(db, owner, `update public.products set price = 350 where id = $1`, [SHIRT])
      assert.equal(r.affected, 1)
      assert.equal(await priceOf(db), 350)
    })
    test('can add, see hidden, and delete products', async () => {
      const i = await attempt(db, owner, `insert into public.products (name_ar, category, price) values ('جديد', 'kids', 99) returning id`)
      assert.ok(i.ok, i.error)
      const s = await attempt(db, owner, `select count(*)::int as n from public.products where active = false`)
      assert.equal(s.rows[0].n, 1)
      const d = await attempt(db, owner, `delete from public.products where id = $1`, [i.rows[0].id])
      assert.equal(d.affected, 1)
    })
    test('can manage categories', async () => {
      const i = await attempt(db, owner, `insert into public.categories (id, name_ar) values ('shoes', 'أحذية')`)
      const u = await attempt(db, owner, `update public.categories set name_en = 'Shoes' where id = 'shoes'`)
      const d = await attempt(db, owner, `delete from public.categories where id = 'shoes'`)
      assert.ok(i.ok, i.error)
      assert.equal(u.affected, 1)
      assert.equal(d.affected, 1)
    })
    test('can upload and delete product photos (only in the product bucket)', async () => {
      const up = await attempt(db, owner, `insert into storage.objects (bucket_id, name) values ('product-images', 'new.webp')`)
      assert.ok(up.ok, up.error)
      const del = await attempt(db, owner, `delete from storage.objects where name = 'new.webp'`)
      assert.equal(del.affected, 1)
      await sql(db, `insert into storage.buckets (id, name) values ('other', 'other')`)
      const elsewhere = await attempt(db, owner, `insert into storage.objects (bucket_id, name) values ('other', 'x.webp')`)
      assert.equal(elsewhere.ok, false)
    })
    test('cannot add another admin from the browser either', async () => {
      const r = await attempt(db, owner, `insert into public.admin_users (user_id) values ($1)`, [CUSTOMER])
      assert.equal(r.ok, false)
    })
  })

  test('removing someone from admin_users removes their access immediately', async () => {
    await sql(db, `delete from public.admin_users where user_id = $1`, [OWNER])
    const r = await attempt(db, owner, `update public.products set price = 1 where id = $1`, [SHIRT])
    assert.equal(r.affected, 0)
    await sql(db, `insert into public.admin_users (user_id) values ($1)`, [OWNER])
  })
})
