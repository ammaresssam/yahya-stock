// Colours — each variant is one colour + one size, with its own price and stock.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { as, attempt, freshDb, sql } from './helpers/db.js'
import { goodCustomer, owner, placeOrder, seedShop, visitor } from './helpers/shop.js'

const save = (db, payload) =>
  as(db, owner, (tx) => tx.query(`select public.admin_save_product($1::jsonb) as id`, [JSON.stringify(payload)])).then((r) => r.rows[0].id)

const saveAttempt = async (db, payload) => {
  try {
    return { ok: true, id: await save(db, payload) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

const hoodie = (variants) => ({ name_ar: 'هودي', category: 'men', variants })

describe('colours on products', () => {
  let db
  before(async () => {
    db = await freshDb()
    await seedShop(db)
  })
  after(() => db.close())

  test('the same size can be saved once per colour', async () => {
    const id = await save(db, hoodie([
      { size: 'M', color_ar: 'أحمر', color_en: 'Red', color_hex: '#c0392b', price: 400, stock_qty: 2 },
      { size: 'M', color_ar: 'أزرق', color_en: 'Blue', color_hex: '#2c3e70', price: 400, stock_qty: 0 },
      { size: 'L', color_ar: 'أحمر', color_en: 'Red', color_hex: '#c0392b', price: 420, stock_qty: 1 },
    ]))
    const rows = await sql(db, `select size, color_ar, color_en, color_hex, stock_qty from public.product_variants where product_id = $1 order by position`, [id])
    assert.deepEqual(rows.map((r) => `${r.color_en}/${r.size}/${r.stock_qty}`), ['Red/M/2', 'Blue/M/0', 'Red/L/1'])
    assert.equal(rows[0].color_hex, '#c0392b')
  })

  test('a colour + size pair can’t be listed twice', async () => {
    const r = await saveAttempt(db, hoodie([
      { size: 'M', color_ar: 'أحمر', price: 400, stock_qty: 1 },
      { size: 'm', color_ar: 'أحمر', price: 400, stock_qty: 1 },
    ]))
    assert.equal(r.ok, false)
    assert.match(r.error, /duplicate_size/)
  })

  test('a swatch or English name without an Arabic colour name is refused', async () => {
    const r = await saveAttempt(db, hoodie([{ size: 'M', color_en: 'Red', price: 400, stock_qty: 1 }]))
    assert.equal(r.ok, false)
    assert.match(r.error, /color_name_required/)
  })

  test('a swatch must be a #rrggbb colour', async () => {
    const r = await saveAttempt(db, hoodie([{ size: 'M', color_ar: 'أحمر', color_hex: 'red;}', price: 400, stock_qty: 1 }]))
    assert.equal(r.ok, false)
  })

  test('products without colours still work as before', async () => {
    const id = await save(db, hoodie([{ size: 'S', price: 300, stock_qty: 3 }]))
    const rows = await sql(db, `select color_ar, color_hex from public.product_variants where product_id = $1`, [id])
    assert.deepEqual(rows[0], { color_ar: '', color_hex: null })
  })

  test('an order line keeps the colour, and the tracking page shows it', async () => {
    const id = await save(db, hoodie([{ size: 'XL', color_ar: 'أخضر', color_en: 'Green', color_hex: '#2e7d4f', price: 500, stock_qty: 4 }]))
    const [v] = await sql(db, `select id from public.product_variants where product_id = $1`, [id])
    const token = 'C'.repeat(43)
    const hash = (await sql(db, `select encode(sha256(convert_to($1, 'UTF8')), 'hex') h`, [token]))[0].h
    const r = await placeOrder(db, { items: [{ variant_id: v.id, qty: 1 }], customer: goodCustomer(), payment_method: 'cod', token_hash: hash })
    assert.equal(r.ok, true)

    const [line] = await sql(db, `select color_ar, color_en, color_hex, size from public.order_items where variant_id = $1`, [v.id])
    assert.deepEqual(line, { color_ar: 'أخضر', color_en: 'Green', color_hex: '#2e7d4f', size: 'XL' })

    // renaming the colour later doesn't change the past order
    await sql(db, `update public.product_variants set color_ar = 'زيتي' where id = $1`, [v.id])
    const t = await attempt(db, visitor, `select public.get_order_by_token($1) as o`, [token])
    assert.equal(t.rows[0].o.items[0].color_ar, 'أخضر')
    assert.equal(t.rows[0].o.items[0].color_en, 'Green')
  })
})
