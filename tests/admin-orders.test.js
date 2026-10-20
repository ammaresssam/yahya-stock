// Stage 3 — the owner changing order status; stock returned on cancel; history.
import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { as, attempt, freshDb, sql } from './helpers/db.js'
import { OWNER, V, customer, fakeTokenHash, goodCustomer, owner, placeOrder, seedShop, stockOf, visitor } from './helpers/shop.js'

const setStatus = (db, who, id, status, expected = null, note = null) =>
  as(db, who, (tx) => tx.query(`select public.admin_set_order_status($1, $2, $3, $4) as r`, [id, status, expected, note])).then((r) => r.rows[0].r)

const orderRow = async (db, id) => (await sql(db, `select status, payment_status, stock_released from public.orders where id = $1`, [id]))[0]

describe('admin_set_order_status', () => {
  let db, orderId
  beforeEach(async () => {
    db = await freshDb()
    await seedShop(db)
    const r = await placeOrder(db, { items: [{ variant_id: V.shirtM, qty: 2 }, { variant_id: V.shirtL, qty: 1 }], customer: goodCustomer(), payment_method: 'cod', token_hash: fakeTokenHash() })
    assert.equal(r.ok, true)
    orderId = r.order_id
    assert.equal(await stockOf(db, V.shirtM), 3)
    assert.equal(await stockOf(db, V.shirtL), 0)
  })
  afterEach(() => db?.close())

  test('the normal journey: placed → confirmed → preparing → shipped → delivered', async () => {
    for (const s of ['confirmed', 'preparing', 'shipped', 'delivered']) {
      const r = await setStatus(db, owner, orderId, s)
      assert.equal(r.ok, true, `${s}: ${JSON.stringify(r)}`)
    }
    const o = await orderRow(db, orderId)
    assert.equal(o.status, 'delivered')
    assert.equal(o.payment_status, 'paid', 'cash on delivery is recorded as collected on delivery')
    const hist = await sql(db, `select from_status, to_status, changed_by, note from public.order_status_history where order_id = $1 order by id`, [orderId])
    assert.deepEqual(hist.map((h) => h.to_status), ['placed', 'confirmed', 'preparing', 'shipped', 'delivered'])
    assert.equal(hist[1].changed_by, OWNER, 'records who changed it')
    assert.equal(hist.at(-1).note, 'cash collected')
  })

  test('steps can’t be skipped or reversed, and final states stay final', async () => {
    assert.equal((await setStatus(db, owner, orderId, 'shipped')).error, 'invalid_transition')
    assert.equal((await setStatus(db, owner, orderId, 'delivered')).error, 'invalid_transition')
    assert.equal((await setStatus(db, owner, orderId, 'pending_payment')).error, 'invalid_transition')
    await setStatus(db, owner, orderId, 'confirmed')
    assert.equal((await setStatus(db, owner, orderId, 'placed')).error, 'invalid_transition')
    await setStatus(db, owner, orderId, 'cancelled')
    for (const s of ['placed', 'confirmed', 'delivered', 'cancelled']) {
      assert.equal((await setStatus(db, owner, orderId, s)).error, 'invalid_transition', `from cancelled to ${s}`)
    }
  })

  test('the owner can’t mark an order paid by hand', async () => {
    assert.equal((await setStatus(db, owner, orderId, 'paid')).error, 'invalid_transition')
    const u = await attempt(db, owner, `update public.orders set payment_status = 'paid' where id = $1`, [orderId])
    assert.equal(u.ok, false)
    assert.equal((await orderRow(db, orderId)).payment_status, 'unpaid')
  })

  test('cancelling returns the pieces to stock — exactly once', async () => {
    const r = await setStatus(db, owner, orderId, 'cancelled', 'placed', 'customer called to cancel')
    assert.equal(r.ok, true)
    assert.equal(r.stock_returned, true)
    assert.equal(await stockOf(db, V.shirtM), 5)
    assert.equal(await stockOf(db, V.shirtL), 1)
    assert.equal((await orderRow(db, orderId)).stock_released, true)
    // a second cancel is refused and returns nothing more
    assert.equal((await setStatus(db, owner, orderId, 'cancelled')).ok, false)
    assert.equal(await stockOf(db, V.shirtM), 5)
    const [h] = await sql(db, `select note from public.order_status_history where order_id = $1 and to_status = 'cancelled'`, [orderId])
    assert.equal(h.note, 'customer called to cancel')
  })

  test('a shipped order that comes back can be cancelled and is restocked', async () => {
    for (const s of ['confirmed', 'preparing', 'shipped']) await setStatus(db, owner, orderId, s)
    assert.equal((await setStatus(db, owner, orderId, 'cancelled')).ok, true)
    assert.equal(await stockOf(db, V.shirtM), 5)
  })

  test('a delivered order can’t be cancelled (stock stays sold)', async () => {
    for (const s of ['confirmed', 'preparing', 'shipped', 'delivered']) await setStatus(db, owner, orderId, s)
    assert.equal((await setStatus(db, owner, orderId, 'cancelled')).error, 'invalid_transition')
    assert.equal(await stockOf(db, V.shirtM), 3)
  })

  test('restocking skips a size that was deleted since', async () => {
    await sql(db, `delete from public.product_variants where id = $1`, [V.shirtL])
    assert.equal((await setStatus(db, owner, orderId, 'cancelled')).ok, true)
    assert.equal(await stockOf(db, V.shirtM), 5)
  })

  test('if someone else changed the order meanwhile, the change is refused', async () => {
    await setStatus(db, owner, orderId, 'confirmed', 'placed')
    const late = await setStatus(db, owner, orderId, 'cancelled', 'placed')
    assert.equal(late.ok, false)
    assert.equal(late.error, 'status_changed')
    assert.equal(late.status, 'confirmed')
    assert.equal(await stockOf(db, V.shirtM), 3, 'nothing restocked')
  })

  test('notes are limited to 500 characters', async () => {
    assert.equal((await setStatus(db, owner, orderId, 'confirmed', null, 'x'.repeat(501))).error, 'note_too_long')
  })

  test('unknown order → not_found', async () => {
    assert.equal((await setStatus(db, owner, '99999999-9999-9999-9999-999999999999', 'confirmed')).error, 'not_found')
  })

  for (const [label, who] of [['visitor', visitor], ['logged-in customer', customer]]) {
    test(`${label} can’t change an order’s status`, async () => {
      const r = await attempt(db, who, `select public.admin_set_order_status($1, 'cancelled')`, [orderId])
      assert.equal(r.ok, false)
      assert.match(r.error, /not authorized|permission denied/)
      assert.equal((await orderRow(db, orderId)).status, 'placed')
      assert.equal(await stockOf(db, V.shirtM), 3)
    })
  }
})

describe('card orders (before Stage 4)', () => {
  let db, orderId
  beforeEach(async () => {
    db = await freshDb()
    await seedShop(db)
    const r = await placeOrder(db, { items: [{ variant_id: V.shirtM, qty: 1 }], customer: goodCustomer(), payment_method: 'card', token_hash: fakeTokenHash() })
    orderId = r.order_id
  })
  afterEach(() => db?.close())

  test('an unpaid card order can only be cancelled, never confirmed or delivered by hand', async () => {
    assert.equal((await setStatus(db, owner, orderId, 'confirmed')).error, 'invalid_transition')
    assert.equal((await setStatus(db, owner, orderId, 'delivered')).error, 'invalid_transition')
    const r = await setStatus(db, owner, orderId, 'cancelled')
    assert.equal(r.ok, true)
    assert.equal(r.payment_status, 'failed')
    assert.equal(await stockOf(db, V.shirtM), 5)
  })
})

describe('delivery fees', () => {
  let db
  beforeEach(async () => {
    db = await freshDb()
    await seedShop(db)
  })
  afterEach(() => db?.close())

  test('the owner can change a fee, switch a zone off and add one', async () => {
    assert.equal((await attempt(db, owner, `update public.shipping_zones set fee = 40 where id = 'alexandria'`)).affected, 1)
    assert.equal((await attempt(db, owner, `update public.shipping_zones set active = false where id = 'upper'`)).affected, 1)
    assert.equal((await attempt(db, owner, `insert into public.shipping_zones (id, name_ar, fee) values ('z-sinai', 'سيناء', 120)`)).ok, true)
    const visible = await attempt(db, visitor, `select id, fee from public.shipping_zones order by position, id`)
    assert.ok(!visible.rows.some((z) => z.id === 'upper'), 'switched-off zone hidden from visitors')
    assert.equal(visible.rows.find((z) => z.id === 'alexandria').fee, 40)
  })

  test('fees can’t be negative', async () => {
    assert.equal((await attempt(db, owner, `update public.shipping_zones set fee = -1 where id = 'alexandria'`)).ok, false)
  })

  test('a new fee applies to new orders, not to orders already placed', async () => {
    const r = await placeOrder(db, { items: [{ variant_id: V.shirtM, qty: 1 }], customer: goodCustomer(), payment_method: 'cod', token_hash: fakeTokenHash() })
    await attempt(db, owner, `update public.shipping_zones set fee = 99 where id = 'alexandria'`)
    assert.equal((await sql(db, `select shipping_fee from public.orders where id = $1`, [r.order_id]))[0].shipping_fee, 50)
  })
})
