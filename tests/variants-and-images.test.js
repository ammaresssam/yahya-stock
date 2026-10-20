// Stage 1 — sizes with their own price and stock, and several photos per product.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { applyMigration, as, attempt, freshDb, sql } from './helpers/db.js'

const OWNER = '00000000-0000-0000-0000-00000000000a'
const CUSTOMER = '00000000-0000-0000-0000-00000000000c'
const visitor = { role: 'anon' }
const customer = { role: 'authenticated', uid: CUSTOMER }
const owner = { role: 'authenticated', uid: OWNER }

const P_VISIBLE = '11111111-1111-1111-1111-111111111111'
const P_HIDDEN = '22222222-2222-2222-2222-222222222222'

async function seedUsers(db) {
  await sql(db, `insert into auth.users (id, email) values ($1, 'owner@shop.test'), ($2, 'c@mail.test')`, [OWNER, CUSTOMER])
  await sql(db, `insert into public.admin_users (user_id) values ($1)`, [OWNER])
}

const save = (db, who, payload) =>
  as(db, who, (tx) => tx.query(`select public.admin_save_product($1::jsonb) as id`, [JSON.stringify(payload)])).then((r) => r.rows[0].id)

const saveAttempt = async (db, who, payload) => {
  try {
    return { ok: true, id: await save(db, who, payload) }
  } catch (e) {
    return { ok: false, error: e.message, code: e.code }
  }
}

const variantsOf = (db, pid) =>
  sql(db, `select id, size, price, compare_at_price, stock_qty, position from public.product_variants where product_id = $1 order by position`, [pid])

const baseProduct = (over = {}) => ({
  name_ar: 'بنطلون',
  category: 'men',
  variants: [
    { size: '32', price: 400, stock_qty: 3 },
    { size: '34', price: 420, compare_at_price: 600, stock_qty: 0 },
  ],
  images: [{ url: 'https://cdn.test/a.webp', storage_path: 'a.webp' }],
  ...over,
})

// ------------------------------------------------------------------
describe('migrating existing products (data made before this stage)', () => {
  let db
  before(async () => {
    db = await freshDb({ upTo: '20261020000100_admin_authorization.sql' })
    await sql(db, `
      insert into public.products (id, name_ar, category, price, old_price, sizes, stock, image_url) values
        ('${P_VISIBLE}', 'قميص', 'men', 300, 400, '{M,L,M}', 'low', 'https://x.supabase.co/storage/v1/object/public/product-images/abc.webp'),
        ('${P_HIDDEN}', 'شنطة', 'men', 150, 100, '{}', 'out', null)`)
    await applyMigration(db, '20261020000200_variants_and_images.sql')
  })
  after(() => db.close())

  test('each old size becomes a variant with the old price, duplicates dropped', async () => {
    const v = await variantsOf(db, P_VISIBLE)
    assert.deepEqual(v.map((x) => [x.size, x.price, x.compare_at_price, x.stock_qty]), [
      ['M', 300, 400, 1],
      ['L', 300, 400, 1],
    ])
  })
  test('a product without sizes gets "Free Size"; an invalid old discount is dropped', async () => {
    const v = await variantsOf(db, P_HIDDEN)
    assert.deepEqual(v.map((x) => [x.size, x.price, x.compare_at_price, x.stock_qty]), [['Free Size', 150, null, 0]])
  })
  test('the old photo moves to the photo list with its storage path', async () => {
    const imgs = await sql(db, `select url, storage_path, position from public.product_images where product_id = $1`, [P_VISIBLE])
    assert.equal(imgs.length, 1)
    assert.equal(imgs[0].storage_path, 'abc.webp')
  })
  test('old columns are removed (one source of truth)', async () => {
    const cols = (await sql(db, `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'products'`)).map((c) => c.column_name)
    for (const gone of ['price', 'old_price', 'sizes', 'stock', 'image_url']) assert.ok(!cols.includes(gone), gone)
  })
})

// ------------------------------------------------------------------
describe('who can see and change sizes and photos', () => {
  let db
  before(async () => {
    db = await freshDb()
    await seedUsers(db)
    await sql(db, `insert into public.products (id, name_ar, category, active) values ('${P_VISIBLE}', 'قميص', 'men', true), ('${P_HIDDEN}', 'مخفي', 'men', false)`)
    await sql(db, `
      insert into public.product_variants (product_id, size, price, stock_qty, active) values
        ('${P_VISIBLE}', 'M', 300, 5, true),
        ('${P_VISIBLE}', 'L', 300, 5, false),
        ('${P_HIDDEN}', 'M', 100, 5, true)`)
    await sql(db, `
      insert into public.product_images (product_id, url) values
        ('${P_VISIBLE}', 'https://cdn.test/1.webp'), ('${P_HIDDEN}', 'https://cdn.test/2.webp')`)
  })
  after(() => db.close())

  test('visitors see active sizes of visible products only', async () => {
    const r = await attempt(db, visitor, `select size, product_id from public.product_variants`)
    assert.deepEqual(r.rows.map((x) => x.size), ['M'])
    assert.equal(r.rows[0].product_id, P_VISIBLE)
  })
  test('visitors see photos of visible products only', async () => {
    const r = await attempt(db, visitor, `select url from public.product_images`)
    assert.deepEqual(r.rows.map((x) => x.url), ['https://cdn.test/1.webp'])
  })
  for (const [label, who] of [['visitor', visitor], ['customer', customer]]) {
    test(`${label} cannot change price or stock of a size`, async () => {
      const u = await attempt(db, who, `update public.product_variants set price = 1, stock_qty = 9999`)
      assert.equal(u.affected, 0)
      const rows = await sql(db, `select price, stock_qty from public.product_variants where product_id = $1 and size = 'M'`, [P_VISIBLE])
      assert.deepEqual(rows[0], { price: 300, stock_qty: 5 })
    })
    test(`${label} cannot add or delete sizes or photos`, async () => {
      const iv = await attempt(db, who, `insert into public.product_variants (product_id, size, price) values ($1, 'XL', 1)`, [P_VISIBLE])
      const dv = await attempt(db, who, `delete from public.product_variants`)
      const ii = await attempt(db, who, `insert into public.product_images (product_id, url) values ($1, 'https://evil.test/x.png')`, [P_VISIBLE])
      const di = await attempt(db, who, `delete from public.product_images`)
      assert.equal(iv.ok, false)
      assert.equal(dv.affected, 0)
      assert.equal(ii.ok, false)
      assert.equal(di.affected, 0)
    })
    test(`${label} cannot use the admin save function`, async () => {
      const r = await saveAttempt(db, who, baseProduct())
      assert.equal(r.ok, false)
      assert.match(r.error, /not authorized|permission denied/)
    })
  }
  test('admin can change stock directly (inventory screen)', async () => {
    const u = await attempt(db, owner, `update public.product_variants set stock_qty = 12 where product_id = $1 and size = 'M'`, [P_VISIBLE])
    assert.equal(u.affected, 1)
  })
})

// ------------------------------------------------------------------
describe('database rules for sizes and photos', () => {
  let db, pid
  before(async () => {
    db = await freshDb()
    await seedUsers(db)
    pid = (await sql(db, `insert into public.products (name_ar, category) values ('x', 'men') returning id`))[0].id
  })
  after(() => db.close())

  const insertVariant = (cols) => attempt(db, owner, `insert into public.product_variants (product_id, size, price, compare_at_price, stock_qty) values ($1, $2, $3, $4, $5)`, [pid, ...cols])

  test('negative stock is rejected', async () => assert.equal((await insertVariant(['A', 100, null, -1])).ok, false))
  test('zero or negative price is rejected', async () => {
    assert.equal((await insertVariant(['B', 0, null, 1])).ok, false)
    assert.equal((await insertVariant(['C', -5, null, 1])).ok, false)
  })
  test('a "before discount" price must be higher than the price', async () => {
    assert.equal((await insertVariant(['D', 100, 100, 1])).ok, false)
    assert.equal((await insertVariant(['E', 100, 90, 1])).ok, false)
    assert.equal((await insertVariant(['F', 100, 150, 1])).ok, true)
  })
  test('the same size twice on one product is rejected', async () => {
    assert.equal((await insertVariant(['G', 100, null, 1])).ok, true)
    assert.equal((await insertVariant(['G', 100, null, 1])).ok, false)
  })
  test('at most 8 photos per product', async () => {
    for (let i = 0; i < 8; i++) await sql(db, `insert into public.product_images (product_id, url) values ($1, $2)`, [pid, `https://cdn.test/${i}.webp`])
    const r = await attempt(db, owner, `insert into public.product_images (product_id, url) values ($1, 'https://cdn.test/9.webp')`, [pid])
    assert.equal(r.ok, false)
  })
  test('photo URLs must be web links', async () => {
    const other = (await sql(db, `insert into public.products (name_ar, category) values ('y', 'men') returning id`))[0].id
    const r = await attempt(db, owner, `insert into public.product_images (product_id, url) values ($1, 'javascript:alert(1)')`, [other])
    assert.equal(r.ok, false)
  })
  test('deleting a product deletes its sizes and photos', async () => {
    await sql(db, `delete from public.products where id = $1`, [pid])
    assert.equal((await sql(db, `select count(*)::int n from public.product_variants where product_id = $1`, [pid]))[0].n, 0)
    assert.equal((await sql(db, `select count(*)::int n from public.product_images where product_id = $1`, [pid]))[0].n, 0)
  })
})

// ------------------------------------------------------------------
describe('admin_save_product (the owner saving a product)', () => {
  let db
  before(async () => {
    db = await freshDb()
    await seedUsers(db)
  })
  after(() => db.close())

  test('creates a product with its sizes and photos in one step', async () => {
    const id = await save(db, owner, baseProduct())
    const v = await variantsOf(db, id)
    assert.deepEqual(v.map((x) => [x.size, x.price, x.stock_qty, x.position]), [['32', 400, 3, 0], ['34', 420, 0, 1]])
    assert.equal((await sql(db, `select count(*)::int n from public.product_images where product_id = $1`, [id]))[0].n, 1)
  })

  test('edits: change a price, remove a size, add a size, reorder photos', async () => {
    const id = await save(db, owner, baseProduct())
    const [s32] = await variantsOf(db, id)
    await save(db, owner, baseProduct({
      id,
      variants: [{ id: s32.id, size: '32', price: 450, stock_qty: 7 }, { size: '36', price: 450, stock_qty: 2 }],
      images: [{ url: 'https://cdn.test/b.webp' }, { url: 'https://cdn.test/a.webp' }],
    }))
    const v = await variantsOf(db, id)
    assert.deepEqual(v.map((x) => [x.size, x.price, x.stock_qty]), [['32', 450, 7], ['36', 450, 2]])
    assert.equal(v[0].id, s32.id, 'existing size keeps its id')
    const imgs = await sql(db, `select url from public.product_images where product_id = $1 order by position`, [id])
    assert.deepEqual(imgs.map((x) => x.url), ['https://cdn.test/b.webp', 'https://cdn.test/a.webp'])
  })

  test('swapping two size names in one save works', async () => {
    const id = await save(db, owner, baseProduct())
    const [a, b] = await variantsOf(db, id)
    await save(db, owner, baseProduct({ id, variants: [{ id: a.id, size: '34', price: 400, stock_qty: 1 }, { id: b.id, size: '32', price: 400, stock_qty: 1 }] }))
    assert.deepEqual((await variantsOf(db, id)).map((x) => x.size), ['34', '32'])
  })

  test('rejects bad input and changes nothing', async () => {
    const id = await save(db, owner, baseProduct())
    const before = JSON.stringify(await variantsOf(db, id))
    const cases = [
      [{ name_ar: '  ' }, 'name_ar_required'],
      [{ category: 'nope' }, 'unknown_category'],
      [{ variants: [] }, 'variants_required'],
      [{ variants: [{ size: 'M', price: 1, stock_qty: 1 }, { size: 'm', price: 1, stock_qty: 1 }] }, 'duplicate_size'],
      [{ variants: [{ size: ' ', price: 1, stock_qty: 1 }] }, 'size_required'],
      [{ variants: [{ size: 'M', price: 0, stock_qty: 1 }] }, 'check'],
      [{ variants: [{ size: 'M', price: 100, stock_qty: -2 }] }, 'check'],
      [{ variants: [{ size: 'M', price: 100, compare_at_price: 50, stock_qty: 1 }] }, 'check'],
      [{ images: Array.from({ length: 9 }, (_, i) => ({ url: `https://cdn.test/${i}.webp` })) }, 'too_many_images'],
    ]
    for (const [over, expected] of cases) {
      const r = await saveAttempt(db, owner, baseProduct({ id, ...over }))
      assert.equal(r.ok, false, `expected rejection for ${JSON.stringify(over)}`)
      assert.match(r.error, new RegExp(expected), `wrong error for ${JSON.stringify(over)}: ${r.error}`)
    }
    assert.equal(JSON.stringify(await variantsOf(db, id)), before, 'a failed save must not change anything')
  })

  test('cannot move a size belonging to another product', async () => {
    const a = await save(db, owner, baseProduct())
    const b = await save(db, owner, baseProduct())
    const [foreign] = await variantsOf(db, b)
    const r = await saveAttempt(db, owner, baseProduct({ id: a, variants: [{ id: foreign.id, size: 'X', price: 1, stock_qty: 1 }] }))
    assert.equal(r.ok, false)
    assert.equal((await variantsOf(db, b)).length, 2, 'the other product is untouched')
  })
})
