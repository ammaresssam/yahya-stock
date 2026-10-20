// Stage 2 — placing orders, prices from the database, stock, privacy of orders.
import { after, afterEach, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { as, attempt, freshDb, sql } from './helpers/db.js'
import { V, customer, fakeTokenHash, goodCustomer, owner, placeOrder, seedShop, stockOf, visitor } from './helpers/shop.js'

const order = (over = {}) => ({
  items: [{ variant_id: V.shirtM, qty: 2 }],
  customer: goodCustomer(),
  payment_method: 'cod',
  token_hash: fakeTokenHash(),
  ...over,
})

describe('placing an order (server only)', () => {
  let db
  beforeEach(async () => {
    db = await freshDb()
    await seedShop(db)
  })
  afterEach(() => db?.close())

  test('a COD order is saved with prices from the database and stock is reserved', async () => {
    const r = await placeOrder(db, order({ expected_total: 650 }))
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.equal(r.status, 'placed')
    assert.deepEqual([r.subtotal, r.shipping_fee, r.total], [600, 50, 650])
    assert.equal(await stockOf(db, V.shirtM), 3)
    const [o] = await sql(db, `select status, payment_status, payment_method, total, phone from public.orders`)
    assert.deepEqual(o, { status: 'placed', payment_status: 'unpaid', payment_method: 'cod', total: 650, phone: '01012345678' })
    const items = await sql(db, `select product_name_ar, size, unit_price, qty, line_total from public.order_items`)
    assert.deepEqual(items, [{ product_name_ar: 'قميص', size: 'M', unit_price: 300, qty: 2, line_total: 600 }])
    const hist = await sql(db, `select from_status, to_status from public.order_status_history`)
    assert.deepEqual(hist, [{ from_status: null, to_status: 'placed' }])
  })

  test('prices or totals sent by the browser are ignored', async () => {
    const r = await placeOrder(db, order({
      items: [{ variant_id: V.shirtM, qty: 1, price: 1, unit_price: 1, line_total: 1 }],
      subtotal: 1, total: 1, shipping_fee: 0,
    }))
    assert.equal(r.ok, true)
    assert.equal(r.total, 350)
    assert.equal((await sql(db, `select total from public.orders`))[0].total, 350)
  })

  test('if the total the customer saw is wrong, nothing is saved and the real total is returned', async () => {
    const r = await placeOrder(db, order({ expected_total: 51 }))
    assert.equal(r.ok, false)
    assert.equal(r.error, 'price_changed')
    assert.equal(r.quote.total, 650)
    assert.equal(await stockOf(db, V.shirtM), 5, 'stock untouched')
    assert.equal((await sql(db, `select count(*)::int n from public.orders`))[0].n, 0)
  })

  test('cannot buy more than the stock; the last piece can only be sold once', async () => {
    const tooMany = await placeOrder(db, order({ items: [{ variant_id: V.shirtL, qty: 2 }] }))
    assert.equal(tooMany.error, 'items_unavailable')
    assert.deepEqual(tooMany.items, [{ variant_id: V.shirtL, problem: 'out_of_stock', available: 1 }])

    const first = await placeOrder(db, order({ items: [{ variant_id: V.shirtL, qty: 1 }] }))
    const second = await placeOrder(db, order({ items: [{ variant_id: V.shirtL, qty: 1 }], customer: goodCustomer({ phone: '01198765432' }) }))
    assert.equal(first.ok, true)
    assert.equal(second.ok, false)
    assert.equal(second.error, 'items_unavailable')
    assert.equal(await stockOf(db, V.shirtL), 0)
  })

  test('the same size listed twice is added up (and still checked against stock)', async () => {
    const r = await placeOrder(db, order({ items: [{ variant_id: V.shirtM, qty: 3 }, { variant_id: V.shirtM, qty: 3 }] }))
    assert.equal(r.error, 'items_unavailable', 'merged 6 > stock 5')
    const ok = await placeOrder(db, order({ items: [{ variant_id: V.shirtM, qty: 2 }, { variant_id: V.shirtM, qty: 1 }] }))
    assert.equal(ok.ok, true)
    assert.equal((await sql(db, `select qty from public.order_items`))[0].qty, 3)
  })

  test('hidden products, switched-off sizes and unknown ids cannot be bought', async () => {
    for (const vid of [V.hiddenM, V.offSize, '99999999-9999-9999-9999-999999999999']) {
      const r = await placeOrder(db, order({ items: [{ variant_id: vid, qty: 1 }] }))
      assert.equal(r.error, 'items_unavailable', vid)
      assert.equal(r.items[0].problem, 'unavailable')
    }
    assert.equal(await stockOf(db, V.hiddenM), 9)
  })

  test('a mix of good and bad lines is rejected as a whole', async () => {
    const r = await placeOrder(db, order({ items: [{ variant_id: V.shirtM, qty: 1 }, { variant_id: V.hiddenM, qty: 1 }] }))
    assert.equal(r.ok, false)
    assert.equal(await stockOf(db, V.shirtM), 5)
  })

  test('bad input is rejected', async () => {
    const cases = [
      [{ items: [] }, 'invalid_items'],
      [{ items: [{ variant_id: V.shirtM, qty: 0 }] }, 'invalid_items'],
      [{ items: [{ variant_id: V.shirtM, qty: 11 }] }, 'invalid_items'],
      [{ items: [{ variant_id: V.shirtM, qty: 1.5 }] }, 'invalid_items'],
      [{ items: [{ variant_id: V.shirtM, qty: '2' }] }, 'invalid_items'],
      [{ items: [{ variant_id: 'not-a-uuid', qty: 1 }] }, 'invalid_items'],
      [{ items: Array.from({ length: 21 }, () => ({ variant_id: V.shirtM, qty: 1 })) }, 'invalid_items'],
      [{ payment_method: 'free' }, 'invalid_payment_method'],
      [{ token_hash: 'short' }, 'invalid_request'],
      [{ customer: goodCustomer({ phone: '0123' }) }, 'invalid_customer'],
      [{ customer: goodCustomer({ phone: '01312345678' }) }, 'invalid_customer'],
      [{ customer: goodCustomer({ zone_id: 'mars' }) }, 'invalid_customer'],
      [{ customer: goodCustomer({ name: 'a' }) }, 'invalid_customer'],
      [{ customer: goodCustomer({ address: 'x' }) }, 'invalid_customer'],
      [{ customer: goodCustomer({ email: 'not-an-email' }) }, 'invalid_customer'],
    ]
    for (const [over, expected] of cases) {
      const r = await placeOrder(db, order(over))
      assert.equal(r.ok, false, JSON.stringify(over))
      assert.equal(r.error, expected, JSON.stringify(over))
    }
    assert.equal((await sql(db, `select count(*)::int n from public.orders`))[0].n, 0)
    assert.equal(await stockOf(db, V.shirtM), 5)
  })

  test('a switched-off delivery zone cannot be used', async () => {
    await sql(db, `update public.shipping_zones set active = false where id = 'alexandria'`)
    const r = await placeOrder(db, order())
    assert.equal(r.error, 'invalid_customer')
    assert.equal(r.field, 'zone_id')
  })

  test('at most 5 orders per hour from the same device or phone', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await placeOrder(db, order({ items: [{ variant_id: V.shirtM, qty: 1 }], ip_hash: 'device-1', customer: goodCustomer({ phone: `0101234560${i}` }) }))
      assert.equal(r.ok, true, `order ${i}`)
    }
    const blocked = await placeOrder(db, order({ items: [{ variant_id: V.shirtM, qty: 1 }], ip_hash: 'device-1', customer: goodCustomer({ phone: '01099999999' }) }))
    assert.equal(blocked.error, 'rate_limited')
  })

  test('past orders keep their price and name after the product is edited or deleted', async () => {
    await placeOrder(db, order())
    await sql(db, `update public.product_variants set price = 999 where id = $1`, [V.shirtM])
    await sql(db, `delete from public.products where id = '20000000-0000-0000-0000-000000000001'`)
    const [i] = await sql(db, `select product_name_ar, unit_price, variant_id from public.order_items`)
    assert.deepEqual(i, { product_name_ar: 'قميص', unit_price: 300, variant_id: null })
  })
})

describe('who can place and read orders', () => {
  let db, token
  before(async () => {
    db = await freshDb()
    await seedShop(db)
    token = 'A'.repeat(43)
    const hash = (await sql(db, `select encode(sha256(convert_to($1, 'UTF8')), 'hex') h`, [token]))[0].h
    const r = await placeOrder(db, order({ token_hash: hash }))
    assert.equal(r.ok, true)
    await placeOrder(db, order({ token_hash: fakeTokenHash(), customer: goodCustomer({ name: 'منى حسن', phone: '01155555555', address: 'عنوان سري جدا ١٢٣' }) }))
  })
  after(() => db.close())

  for (const [label, who] of [['visitor', visitor], ['logged-in customer', customer]]) {
    test(`${label} cannot call place_order directly`, async () => {
      const r = await attempt(db, who, `select public.place_order($1::jsonb)`, [JSON.stringify(order())])
      assert.equal(r.ok, false)
      assert.match(r.error, /permission denied/)
    })
    test(`${label} cannot read any orders, items or history`, async () => {
      for (const t of ['orders', 'order_items', 'order_status_history']) {
        const r = await attempt(db, who, `select * from public.${t}`)
        assert.ok(!r.ok || r.rows.length === 0, `${t} leaked to ${label}`)
      }
    })
    test(`${label} cannot create, change or delete orders`, async () => {
      const ins = await attempt(db, who, `insert into public.orders (tracking_token_hash, customer_name, phone, zone_id, area, address, payment_method, status, payment_status, subtotal, shipping_fee, total) values ($1, 'x y', '01012345678', 'alexandria', 'aa', 'aaaaa', 'cod', 'placed', 'paid', 1, 0, 1)`, [fakeTokenHash()])
      const upd = await attempt(db, who, `update public.orders set payment_status = 'paid', total = 1`)
      const del = await attempt(db, who, `delete from public.orders`)
      assert.equal(ins.ok, false)
      assert.equal(upd.affected, 0)
      assert.equal(del.affected, 0)
      assert.equal((await sql(db, `select count(*)::int n from public.orders where payment_status = 'paid'`))[0].n, 0)
    })
    test(`${label} cannot change delivery fees`, async () => {
      const u = await attempt(db, who, `update public.shipping_zones set fee = 0`)
      assert.equal(u.affected, 0)
      assert.equal((await sql(db, `select fee from public.shipping_zones where id = 'alexandria'`))[0].fee, 50)
    })
  }

  test('visitors can see active delivery zones and fees', async () => {
    const r = await attempt(db, visitor, `select id, fee from public.shipping_zones order by position`)
    assert.equal(r.rows[0].id, 'alexandria')
  })

  test('the secret link shows exactly that one order, without the full address or phone', async () => {
    const r = await attempt(db, visitor, `select public.get_order_by_token($1) as o`, [token])
    const o = r.rows[0].o
    assert.equal(o.status, 'placed')
    assert.equal(o.total, 650)
    assert.equal(o.customer_first_name, 'أحمد')
    assert.equal(o.phone_masked, '010******78')
    assert.equal(o.items.length, 1)
    const text = JSON.stringify(o)
    assert.ok(!text.includes('خالد بن الوليد'), 'full address must not be returned')
    assert.ok(!text.includes('01012345678'), 'full phone must not be returned')
    assert.ok(!text.includes('منى'), 'another customer must not appear')
  })

  test('a wrong, short or empty link shows nothing', async () => {
    for (const t of ['B'.repeat(43), 'A'.repeat(42) + 'B', 'short', '', null]) {
      const r = await attempt(db, visitor, `select public.get_order_by_token($1) as o`, [t])
      assert.equal(r.rows[0].o, null, String(t))
    }
  })

  test('the stored hash cannot be used as a link (only the secret works)', async () => {
    const [{ h }] = await sql(db, `select tracking_token_hash h from public.orders limit 1`)
    const r = await attempt(db, visitor, `select public.get_order_by_token($1) as o`, [h])
    assert.equal(r.rows[0].o, null)
  })

  test('the owner can read all orders; still cannot edit them directly', async () => {
    const r = await attempt(db, owner, `select count(*)::int n from public.orders`)
    assert.equal(r.rows[0].n, 2)
    const u = await attempt(db, owner, `update public.orders set total = 1`)
    assert.equal(u.ok, false)
  })
})
