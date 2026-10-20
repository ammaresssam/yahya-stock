// Stage 2 — the checkout Edge Function's logic, run against the real database functions.
import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { attempt, freshDb, sql } from './helpers/db.js'
import { V, goodCustomer, rpcVia, seedShop, stockOf, visitor } from './helpers/shop.js'
import { handleCheckout, normalizePhone, randomToken, sha256Hex, validateCheckout } from '../supabase/functions/_shared/checkout-core.js'

describe('phone numbers', () => {
  const cases = [
    ['01012345678', '01012345678'],
    ['010 1234 5678', '01012345678'],
    ['010-1234-5678', '01012345678'],
    ['+201012345678', '01012345678'],
    ['00201112345678', '01112345678'],
    ['201512345678', '01512345678'],
    ['٠١٢٢٣٤٥٦٧٨٩', '01223456789'],
    ['01312345678', null], // not an Egyptian mobile prefix
    ['0101234567', null],
    ['010123456789', null],
    ['', null],
    [12345678901, null],
  ]
  for (const [input, expected] of cases) test(`${JSON.stringify(input)} → ${expected}`, () => assert.equal(normalizePhone(input), expected))
})

describe('input validation', () => {
  const body = (over = {}) => ({ items: [{ variant_id: V.shirtM, qty: 1 }], customer: goodCustomer(), payment_method: 'cod', ...over })
  test('accepts a normal order and trims text', () => {
    const r = validateCheckout(body({ customer: goodCustomer({ name: '  أحمد   علي  ', phone: '+20 101 234 5678' }) }))
    assert.equal(r.ok, true)
    assert.equal(r.value.customer.name, 'أحمد علي')
    assert.equal(r.value.customer.phone, '01012345678')
  })
  test('drops any extra fields such as prices', () => {
    const r = validateCheckout(body({ items: [{ variant_id: V.shirtM, qty: 1, price: 1 }], total: 1 }))
    assert.deepEqual(r.value.items, [{ variant_id: V.shirtM, qty: 1 }])
    assert.equal('total' in r.value, false)
  })
  test('reports each bad field', () => {
    const r = validateCheckout(body({ customer: { name: 'a', phone: '123', zone_id: 'X Y', area: '', address: '' }, payment_method: 'crypto' }))
    assert.equal(r.ok, false)
    assert.deepEqual(Object.keys(r.fields).sort(), ['address', 'area', 'name', 'payment_method', 'phone', 'zone_id'])
  })
  test('rejects non-objects and junk', () => {
    for (const b of [null, [], 'x', 42, { items: 'x' }]) assert.equal(validateCheckout(b).ok, false)
  })
})

describe('tokens', () => {
  test('are 43 URL-safe characters and different every time', () => {
    const a = randomToken()
    const b = randomToken()
    assert.match(a, /^[A-Za-z0-9_-]{43}$/)
    assert.notEqual(a, b)
  })
  test('hash the same way as the database does', async () => {
    const db = await freshDb()
    const t = randomToken()
    const [{ h }] = await sql(db, `select encode(sha256(convert_to($1, 'UTF8')), 'hex') h`, [t])
    assert.equal(await sha256Hex(t), h)
    await db.close()
  })
})

describe('handleCheckout end to end (logic + real database functions)', () => {
  let db, deps
  beforeEach(async () => {
    db = await freshDb()
    await seedShop(db)
    deps = { rpc: rpcVia(db), ip: '197.0.0.1', ipSalt: 'test-salt', siteUrl: 'https://shop.test/', cardEnabled: false }
  })
  afterEach(() => db?.close())

  const body = (over = {}) => ({ items: [{ variant_id: V.shirtM, qty: 1 }], customer: goodCustomer(), payment_method: 'cod', expected_total: 350, ...over })

  test('places a COD order and returns a working private tracking link', async () => {
    const r = await handleCheckout(body(), deps)
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.match(r.body.order_number, /^YS-\d+$/)
    assert.equal(r.body.total, 350)
    assert.ok(r.body.tracking_url.startsWith('https://shop.test/#/order/'))
    const view = await attempt(db, visitor, `select public.get_order_by_token($1) as o`, [r.body.tracking_token])
    assert.equal(view.rows[0].o.order_number, r.body.order_number)
    // the secret itself is never stored
    assert.equal((await sql(db, `select count(*)::int n from public.orders where tracking_token_hash = $1`, [r.body.tracking_token]))[0].n, 0)
    // the IP is stored only as a salted hash
    const [{ client_ip_hash }] = await sql(db, `select client_ip_hash from public.orders`)
    assert.equal(client_ip_hash, await sha256Hex('test-salt:197.0.0.1'))
  })

  test('invalid input → 400 with the bad fields, nothing saved', async () => {
    const r = await handleCheckout(body({ customer: goodCustomer({ phone: '999' }) }), deps)
    assert.equal(r.status, 400)
    assert.deepEqual(r.body.fields, { phone: 'invalid' })
    assert.equal((await sql(db, `select count(*)::int n from public.orders`))[0].n, 0)
  })

  test('changed price → 409 with the new quote', async () => {
    await sql(db, `update public.product_variants set price = 310 where id = $1`, [V.shirtM])
    const r = await handleCheckout(body(), deps)
    assert.equal(r.status, 409)
    assert.equal(r.body.error, 'price_changed')
    assert.equal(r.body.quote.total, 360)
  })

  test('out of stock → 409 with what is available', async () => {
    const r = await handleCheckout(body({ items: [{ variant_id: V.shirtL, qty: 3 }], expected_total: undefined }), deps)
    assert.equal(r.status, 409)
    assert.equal(r.body.error, 'items_unavailable')
    assert.equal(r.body.items[0].available, 1)
    assert.equal(await stockOf(db, V.shirtL), 1)
  })

  test('card payment is refused while Paymob is not configured', async () => {
    const r = await handleCheckout(body({ payment_method: 'card' }), deps)
    assert.equal(r.status, 400)
    assert.equal(r.body.error, 'card_unavailable')
    assert.equal((await sql(db, `select count(*)::int n from public.orders`))[0].n, 0)
  })

  test('database errors are not shown to the customer', async () => {
    const r = await handleCheckout(body(), { ...deps, rpc: async () => ({ data: null, error: new Error('relation "x" does not exist; secret detail') }) })
    assert.equal(r.status, 500)
    assert.deepEqual(r.body, { ok: false, error: 'server_error' })
  })

  test('too many orders → 429', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await handleCheckout(body({ customer: goodCustomer({ phone: `0101234560${i}` }), expected_total: undefined }), deps)
      assert.equal(r.status, 200)
    }
    const r = await handleCheckout(body({ customer: goodCustomer({ phone: '01099999999' }), expected_total: undefined }), deps)
    assert.equal(r.status, 429)
  })
})
