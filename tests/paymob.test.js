// Stage 4 — card payments through Paymob: signature checks, payment creation, the webhook,
// idempotency, amount checks, expiry and permissions. Paymob itself is faked; the database is real.
import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { attempt, freshDb, sql } from './helpers/db.js'
import { V, customer, goodCustomer, owner, rpcVia, seedShop, stockOf, visitor } from './helpers/shop.js'
import { buildIntentionBody, eventFromTransaction, handleWebhook, hmacString, hmacSha512Hex, paymobConfig, startPayment, verifyHmac } from '../supabase/functions/_shared/paymob-core.js'
import { handleCheckout, handleRetryPayment } from '../supabase/functions/_shared/checkout-core.js'

const HMAC_SECRET = 'test-hmac-secret-0123456789'
const cfg = paymobConfig({
  PAYMOB_SECRET_KEY: 'egy_sk_test_abc',
  PAYMOB_PUBLIC_KEY: 'egy_pk_test_xyz',
  PAYMOB_HMAC_SECRET: HMAC_SECRET,
  PAYMOB_CARD_INTEGRATION_ID: '4097558',
})

// Independent signer (Node's crypto) — checks our Web Crypto implementation against another one.
const sign = (obj, secret = HMAC_SECRET) => createHmac('sha512', secret).update(hmacString(obj)).digest('hex')

let txSeq = 9000
function txn({ amount_cents, success = true, pending = false, merchant_order_id, order_id = 777, id = ++txSeq, ...rest }) {
  return {
    id, pending, amount_cents, success, is_auth: false, is_capture: false, is_standalone_payment: true,
    is_voided: false, is_refunded: false, is_3d_secure: true, integration_id: 4097558, has_parent_transaction: false,
    created_at: '2026-10-23T10:00:00.000000', currency: 'EGP', error_occured: !success, owner: 302852,
    source_data: { pan: '2346', type: 'card', sub_type: 'MasterCard' },
    order: { id: order_id, merchant_order_id },
    ...rest,
  }
}

// ------------------------------------------------------------------
describe('HMAC signature (Paymob transaction callback)', () => {
  test('builds exactly the string from Paymob’s documented example', () => {
    const obj = {
      amount_cents: 100000, created_at: '2024-06-13T11:33:44.592345', currency: 'EGP', error_occured: false,
      has_parent_transaction: false, id: 192036465, integration_id: 4097558, is_3d_secure: true, is_auth: false,
      is_capture: false, is_refunded: false, is_standalone_payment: true, is_voided: false,
      order: { id: 217503754 }, owner: 302852, pending: false,
      source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' }, success: true,
    }
    assert.equal(hmacString(obj), '1000002024-06-13T11:33:44.592345EGPfalsefalse1920364654097558truefalsefalsefalsetruefalse217503754302852false2346MasterCardcardtrue')
  })

  test('Web Crypto HMAC-SHA512 matches Node’s implementation', async () => {
    const obj = txn({ amount_cents: 35000, merchant_order_id: 'YS-1' })
    assert.equal(await hmacSha512Hex(HMAC_SECRET, hmacString(obj)), sign(obj))
  })

  test('accepts a correct signature (any letter case)', async () => {
    const obj = txn({ amount_cents: 35000, merchant_order_id: 'YS-1' })
    assert.equal(await verifyHmac(obj, sign(obj), HMAC_SECRET), true)
    assert.equal(await verifyHmac(obj, sign(obj).toUpperCase(), HMAC_SECRET), true)
  })

  test('rejects tampering, the wrong secret and junk', async () => {
    const obj = txn({ amount_cents: 35000, merchant_order_id: 'YS-1' })
    const good = sign(obj)
    assert.equal(await verifyHmac({ ...obj, amount_cents: 1 }, good, HMAC_SECRET), false, 'changed amount')
    assert.equal(await verifyHmac({ ...obj, success: !obj.success }, good, HMAC_SECRET), false, 'flipped success')
    assert.equal(await verifyHmac({ ...obj, order: { id: 1 } }, good, HMAC_SECRET), false, 'other order')
    assert.equal(await verifyHmac(obj, sign(obj, 'wrong-secret'), HMAC_SECRET), false, 'wrong secret')
    for (const bad of ['', 'abc', null, undefined, good.slice(1), `${good}0`]) assert.equal(await verifyHmac(obj, bad, HMAC_SECRET), false, String(bad))
    assert.equal(await verifyHmac(obj, good, ''), false, 'no secret configured')
  })
})

describe('configuration safety', () => {
  const keys = { PAYMOB_SECRET_KEY: 'egy_sk_test_1', PAYMOB_PUBLIC_KEY: 'egy_pk_test_1', PAYMOB_HMAC_SECRET: 'h', PAYMOB_CARD_INTEGRATION_ID: '12' }
  test('card payments stay off until every key is set', () => {
    assert.equal(paymobConfig({}).enabled, false)
    assert.equal(paymobConfig({ ...keys, PAYMOB_HMAC_SECRET: '' }).enabled, false)
    assert.equal(paymobConfig({ ...keys, PAYMOB_CARD_INTEGRATION_ID: 'x' }).enabled, false)
    assert.equal(paymobConfig(keys).enabled, true)
  })
  test('LIVE keys are refused unless PAYMOB_MODE=live is set on purpose', () => {
    const live = { ...keys, PAYMOB_SECRET_KEY: 'egy_sk_live_1', PAYMOB_PUBLIC_KEY: 'egy_pk_live_1' }
    assert.deepEqual([paymobConfig(live).enabled, paymobConfig(live).reason], [false, 'live_keys_in_test_mode'])
    assert.equal(paymobConfig({ ...live, PAYMOB_MODE: 'live' }).enabled, true)
    assert.equal(paymobConfig({ ...keys, PAYMOB_MODE: 'prod' }).enabled, false)
  })
})

describe('payment request built from the server’s order', () => {
  const order = {
    order_number: 10001, total: 690, subtotal: 640, shipping_fee: 50,
    customer: { name: 'أحمد علي حسن', phone: '01012345678', email: null, area: 'ميامي', address: 'شارع ١', zone_id: 'alexandria' },
    items: [{ name: 'قميص', size: 'M', qty: 2, unit_price: 300 }, { name: 'قميص', size: 'L', qty: 1, unit_price: 40 }],
  }
  test('amount is the order total in piastres and the items add up to it exactly', () => {
    const b = buildIntentionBody(order, { integrationId: 12, notificationUrl: 'https://x/fn/paymob-webhook', redirectionUrl: 'https://shop/#/order/t', specialReference: 'YS-10001-a' })
    assert.equal(b.amount, 69000)
    assert.equal(b.items.reduce((s, i) => s + i.amount * i.quantity, 0), 69000)
    assert.equal(b.currency, 'EGP')
    assert.deepEqual(b.payment_methods, [12])
    assert.equal(b.billing_data.phone_number, '+201012345678')
    assert.equal(b.billing_data.first_name, 'أحمد')
    assert.equal(b.special_reference, 'YS-10001-a')
  })
})

// ------------------------------------------------------------------
describe('card checkout end to end (fake Paymob, real database)', () => {
  let db, sent, deps
  const fakePaymob = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization })
    return new Response(JSON.stringify({ id: `pi_${sent.length}`, client_secret: `cs_${sent.length}`, intention_order_id: 5000 + sent.length }), { status: 201 })
  }
  const payDeps = () => ({ rpc: rpcVia(db), fetch: fakePaymob, cfg, functionsUrl: 'https://proj.supabase.co/functions/v1', randomId: () => Math.random().toString(36).slice(2, 8) })

  beforeEach(async () => {
    db = await freshDb()
    await seedShop(db)
    sent = []
    deps = {
      rpc: rpcVia(db), ip: '', siteUrl: 'https://shop.test', cardEnabled: true,
      startCardPayment: (ref, trackingUrl) => startPayment(ref, trackingUrl, payDeps()),
    }
  })
  afterEach(() => db?.close())

  const checkoutCard = (over = {}) =>
    handleCheckout({ items: [{ variant_id: V.shirtM, qty: 2 }], customer: goodCustomer(), payment_method: 'card', expected_total: 650, ...over }, deps)
  const webhook = (obj, hmac = sign(obj)) => handleWebhook({ body: { type: 'TRANSACTION', obj }, hmac }, { rpc: rpcVia(db), cfg })
  const theOrder = async () => (await sql(db, `select id, status, payment_status, stock_released from public.orders`))[0]
  const ref = async () => (await sql(db, `select special_reference from public.payment_intents order by created_at desc limit 1`))[0].special_reference

  test('creates the Paymob payment for the database total and returns Paymob’s checkout page', async () => {
    const r = await checkoutCard({ items: [{ variant_id: V.shirtM, qty: 2, price: 1 }] })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.match(r.body.payment_url, /^https:\/\/eg\.checkout\.paymob\.com\/\?publicKey=egy_pk_test_xyz&clientSecret=cs_1$/)
    assert.equal(sent.length, 1)
    assert.equal(sent[0].url, 'https://accept.paymob.com/v1/intention/')
    assert.equal(sent[0].auth, 'Token egy_sk_test_abc', 'secret key only in the server-to-server call')
    assert.equal(sent[0].body.amount, 65000, 'server total, not anything the browser sent')
    assert.equal(sent[0].body.notification_url, 'https://proj.supabase.co/functions/v1/paymob-webhook')
    assert.ok(sent[0].body.redirection_url.startsWith('https://shop.test/#/order/'))
    assert.ok(!JSON.stringify(r.body).includes('egy_sk_'), 'secret key never returned to the browser')
    const o = await theOrder()
    assert.deepEqual([o.status, o.payment_status], ['pending_payment', 'pending'])
    assert.equal(await stockOf(db, V.shirtM), 3, 'stock reserved while paying')
  })

  test('a verified successful payment marks the order paid — once', async () => {
    await checkoutCard()
    const obj = txn({ amount_cents: 65000, merchant_order_id: await ref() })
    const r = await webhook(obj)
    assert.deepEqual([r.status, r.body.outcome], [200, 'paid'])
    const o = await theOrder()
    assert.deepEqual([o.status, o.payment_status], ['placed', 'paid'])
    // Paymob retries / replays the same transaction → nothing changes
    const again = await webhook(obj)
    assert.deepEqual([again.status, again.body.outcome], [200, 'duplicate'])
    assert.equal((await sql(db, `select count(*)::int n from public.order_status_history where to_status = 'placed' and from_status = 'pending_payment'`))[0].n, 1)
    assert.equal((await sql(db, `select count(*)::int n from public.payment_events`))[0].n, 1)
  })

  test('a forged or tampered notification is rejected and changes nothing', async () => {
    await checkoutCard()
    const obj = txn({ amount_cents: 65000, merchant_order_id: await ref() })
    assert.equal((await webhook(obj, 'f'.repeat(128))).status, 401)
    assert.equal((await webhook(obj, sign(obj, 'attacker-secret'))).status, 401)
    assert.equal((await webhook({ ...obj, amount_cents: 100 }, sign(obj))).status, 401)
    const o = await theOrder()
    assert.deepEqual([o.status, o.payment_status], ['pending_payment', 'pending'])
    assert.equal((await sql(db, `select count(*)::int n from public.payment_events`))[0].n, 0)
  })

  test('a correctly signed payment for the wrong amount is recorded but never marks the order paid', async () => {
    await checkoutCard()
    const r = await webhook(txn({ amount_cents: 100, merchant_order_id: await ref() }))
    assert.equal(r.body.outcome, 'amount_mismatch')
    assert.equal((await theOrder()).payment_status, 'pending')
  })

  test('wrong currency is treated like a wrong amount', async () => {
    await checkoutCard()
    const r = await webhook(txn({ amount_cents: 65000, currency: 'USD', merchant_order_id: await ref() }))
    assert.equal(r.body.outcome, 'amount_mismatch')
  })

  test('a declined card keeps the order open so the customer can try again', async () => {
    await checkoutCard()
    const reference = await ref()
    assert.equal((await webhook(txn({ amount_cents: 65000, success: false, merchant_order_id: reference }))).body.outcome, 'failed_attempt')
    assert.equal((await theOrder()).status, 'pending_payment')
    assert.equal((await webhook(txn({ amount_cents: 65000, pending: true, success: false, merchant_order_id: reference }))).body.outcome, 'pending')
    assert.equal((await webhook(txn({ amount_cents: 65000, merchant_order_id: reference }))).body.outcome, 'paid')
    assert.equal((await theOrder()).payment_status, 'paid')
  })

  test('the order can also be matched by Paymob’s own order id', async () => {
    await checkoutCard()
    const [{ provider_order_id }] = await sql(db, `select provider_order_id from public.payment_intents`)
    const r = await webhook(txn({ amount_cents: 65000, merchant_order_id: null, order_id: Number(provider_order_id) }))
    assert.equal(r.body.outcome, 'paid')
  })

  test('a notification for an order that isn’t ours is acknowledged and ignored', async () => {
    const r = await webhook(txn({ amount_cents: 65000, merchant_order_id: 'SOMEONE-ELSE', order_id: 1 }))
    assert.deepEqual([r.status, r.body.outcome], [200, 'unknown_order'])
  })

  test('unpaid orders expire after 30 minutes: stock returns once, the order is closed', async () => {
    const c = await checkoutCard()
    await sql(db, `update public.orders set expires_at = now() - interval '1 minute'`)
    // opening the tracking page (or any new order) runs the expiry
    const view = await attempt(db, visitor, `select public.get_order_by_token($1) as o`, [c.body.tracking_token])
    assert.equal(view.rows[0].o.status, 'payment_failed')
    assert.equal(view.rows[0].o.can_pay, false)
    assert.equal(await stockOf(db, V.shirtM), 5)
    await attempt(db, visitor, `select public.get_order_by_token($1) as o`, [c.body.tracking_token])
    assert.equal(await stockOf(db, V.shirtM), 5, 'not returned twice')
  })

  test('a payment that arrives after expiry is flagged for the owner to refund, not silently fulfilled', async () => {
    await checkoutCard()
    const reference = await ref()
    await sql(db, `update public.orders set expires_at = now() - interval '1 minute'`)
    await sql(db, `select public.expire_unpaid_orders()`)
    const r = await webhook(txn({ amount_cents: 65000, merchant_order_id: reference }))
    assert.equal(r.body.outcome, 'paid_after_cancel')
    const o = await theOrder()
    assert.deepEqual([o.status, o.payment_status], ['payment_failed', 'paid'])
    const [h] = await sql(db, `select note from public.order_status_history order by id desc limit 1`)
    assert.match(h.note, /refund/)
  })

  test('a refund notification marks the payment refunded', async () => {
    await checkoutCard()
    const reference = await ref()
    await webhook(txn({ amount_cents: 65000, merchant_order_id: reference }))
    const r = await webhook(txn({ amount_cents: 65000, is_refunded: true, merchant_order_id: reference }))
    assert.equal(r.body.outcome, 'refunded')
    assert.equal((await theOrder()).payment_status, 'refunded')
  })

  test('“pay now” from the tracking page makes a new payment for the same order; not for paid or COD orders', async () => {
    const c = await checkoutCard()
    const retry = await handleRetryPayment({ tracking_token: c.body.tracking_token }, deps)
    assert.equal(retry.status, 200)
    assert.match(retry.body.payment_url, /clientSecret=cs_2$/)
    assert.equal(sent[1].body.amount, 65000)
    await webhook(txn({ amount_cents: 65000, merchant_order_id: await ref() }))
    const after = await handleRetryPayment({ tracking_token: c.body.tracking_token }, deps)
    assert.deepEqual([after.status, after.body.error], [409, 'not_payable'])
    const bad = await handleRetryPayment({ tracking_token: 'x' }, deps)
    assert.equal(bad.status, 400)
  })

  test('if Paymob is down, the customer gets their tracking link and the stock is held until expiry', async () => {
    deps.startCardPayment = (ref2, url) => startPayment(ref2, url, { ...payDeps(), fetch: async () => new Response('{}', { status: 500 }) })
    const r = await checkoutCard()
    assert.equal(r.status, 502)
    assert.equal(r.body.error, 'payment_unavailable')
    assert.ok(r.body.tracking_url)
    assert.equal((await theOrder()).status, 'pending_payment')
  })

  test('card orders are refused when Paymob isn’t configured', async () => {
    const r = await handleCheckout({ items: [{ variant_id: V.shirtM, qty: 1 }], customer: goodCustomer(), payment_method: 'card' }, { ...deps, cardEnabled: false })
    assert.equal(r.body.error, 'card_unavailable')
  })
})

// ------------------------------------------------------------------
describe('who can touch payments', () => {
  let db
  beforeEach(async () => {
    db = await freshDb()
    await seedShop(db)
  })
  afterEach(() => db?.close())

  const calls = [
    [`select public.apply_payment_event($1::jsonb)`, [JSON.stringify(eventFromTransaction(txn({ amount_cents: 1, merchant_order_id: 'x' })))]],
    [`select public.record_payment_intent($1::jsonb)`, [JSON.stringify({ order_id: '99999999-9999-9999-9999-999999999999' })]],
    [`select public.get_payable_order($1::jsonb)`, [JSON.stringify({ token_hash: 'x' })]],
    [`select public.expire_unpaid_orders()`, []],
    [`select public.place_order_with_expiry($1::jsonb)`, [JSON.stringify({})]],
  ]
  for (const [label, who] of [['visitor', visitor], ['logged-in customer', customer], ['owner (admin)', owner]]) {
    test(`${label} can’t call the server-only payment functions`, async () => {
      for (const [q, params] of calls) {
        const r = await attempt(db, who, q, params)
        assert.equal(r.ok, false, `${label}: ${q}`)
        assert.match(r.error, /permission denied/)
      }
    })
  }
  test('visitors and customers can’t read or write payment records; the owner can read them', async () => {
    for (const who of [visitor, customer]) {
      for (const t of ['payment_intents', 'payment_events']) {
        const r = await attempt(db, who, `select * from public.${t}`)
        assert.ok(!r.ok || r.rows.length === 0)
        assert.equal((await attempt(db, who, `insert into public.${t} (order_id) values (null)`)).ok, false)
      }
    }
    assert.equal((await attempt(db, owner, `select count(*)::int n from public.payment_events`)).ok, true)
    assert.equal((await attempt(db, owner, `insert into public.payment_events (transaction_id, outcome) values ('x', 'paid')`)).ok, false, 'not even the owner can fake a payment')
  })
})
