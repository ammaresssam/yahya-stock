// ============================================================
//  DEV ONLY — a tiny local stand-in for Supabase, so the full shop (including
//  checkout) can be tried without a Supabase account.
//
//  It runs the REAL migrations on an in-memory Postgres (PGlite) and the REAL
//  checkout logic (supabase/functions/_shared/checkout-core.js). Only the HTTP
//  layer is imitated, for the handful of endpoints the storefront uses.
//  Data is lost when it stops. It is not a security boundary — never deploy it.
//
//  Usage:   npm run dev:backend        (then, in another terminal)
//           VITE_SUPABASE_URL=http://localhost:54321  VITE_SUPABASE_ANON_KEY=local  VITE_CARD_PAYMENTS=on  npm run dev
//  Card payments use a FAKE Paymob page served from here (clearly labelled; no real money).
// ============================================================
import http from 'node:http'
import { as, freshDb, sql } from '../tests/helpers/db.js'
import { rpcVia } from '../tests/helpers/shop.js'
import { handleCheckout, handleRetryPayment } from '../supabase/functions/_shared/checkout-core.js'
import { handleWebhook, hmacSha512Hex, hmacString, startPayment } from '../supabase/functions/_shared/paymob-core.js'
import { categories, products } from '../src/data/products.js'
import { fromDemo } from '../src/lib/product.js'

const PORT = Number(process.env.PORT || 54321)
const BASE = `http://localhost:${PORT}`
const db = await freshDb()

// ---------- a FAKE Paymob, for trying card checkout locally (never real money) ----------
// The real checkout and webhook code is used; only Paymob's servers are imitated here.
const fakePaymob = {
  cfg: {
    enabled: true, mode: 'test', secretKey: 'sk_local_fake', publicKey: 'pk_local_fake', hmacSecret: 'local-fake-hmac-secret',
    integrationId: 1, apiBase: `${BASE}/__fake-paymob`, checkoutUrl: `${BASE}/__fake-paymob/checkout`,
  },
  intentions: new Map(), // client_secret → intention
  seq: 1000,
}
const startCardPayment = (ref, trackingUrl) =>
  startPayment(ref, trackingUrl, { rpc: rpcVia(db), fetch, cfg: fakePaymob.cfg, functionsUrl: `${BASE}/functions/v1`, randomId: () => Math.random().toString(36).slice(2, 8), log: console.error })

const fakeCheckoutPage = (it) => `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fake Paymob (test)</title>
<body style="font-family:system-ui,sans-serif;background:#f4f4f6;margin:0;display:grid;place-items:center;min-height:100vh">
<main style="background:#fff;border-radius:18px;padding:28px;max-width:360px;width:90%;box-shadow:0 10px 30px #0002">
<p style="background:#fde68a;padding:8px 12px;border-radius:10px;font-weight:700;margin:0 0 14px">⚠️ صفحة دفع وهمية للتجربة المحلية فقط — مش Paymob الحقيقي ومفيش فلوس بتتدفع</p>
<h1 style="margin:0 0 6px;font-size:20px">ادفع ${(it.amount / 100).toLocaleString('ar-EG')} ج.م</h1>
<p style="color:#666;margin:0 0 18px">طلب ${it.extras?.order_number ?? ''}</p>
<form method="post" action="${BASE}/__fake-paymob/pay"><input type="hidden" name="cs" value="${it.client_secret}">
<button name="result" value="success" style="width:100%;height:48px;border:0;border-radius:999px;background:#16a34a;color:#fff;font-size:16px;font-weight:700;margin-bottom:10px">دفع ناجح (تجربة)</button>
<button name="result" value="declined" style="width:100%;height:48px;border:0;border-radius:999px;background:#e5e7eb;font-size:16px;font-weight:700">البطاقة اترفضت (تجربة)</button>
</form></main></body></html>`

// ---------- seed the demo catalogue ----------
for (const c of categories) {
  await sql(db, `insert into public.categories (id, name_ar, name_en, art_type, art_color, art_bg) values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing`,
    [c.id, c.name.ar, c.name.en, c.art.type, c.art.color, c.art.bg])
}
for (const [i, raw] of products.entries()) {
  const p = fromDemo(raw)
  const [{ id }] = await sql(db, `insert into public.products (name_ar, name_en, category, is_new, featured, art_type, art_color, art_bg, created_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8, now() - make_interval(mins => $9)) returning id`,
    [p.name.ar, p.name.en, p.category, p.isNew, p.featured, p.art.type, p.art.color, p.art.bg, i])
  for (const [pos, v] of p.variants.entries()) {
    await sql(db, `insert into public.product_variants (product_id, size, price, compare_at_price, stock_qty, position) values ($1,$2,$3,$4,$5,$6)`,
      [id, v.size, v.price, v.compareAt ?? null, v.stock, pos])
  }
}

// ---------- tiny HTTP layer ----------
const asVisitor = (text, params = []) => as(db, { role: 'anon' }, (tx) => tx.query(text, params)).then((r) => r.rows)

const PRODUCTS_SQL = `
  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) as list from (
    select p.created_at, to_jsonb(p) || jsonb_build_object(
      'product_variants', (select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) from public.product_variants v where v.product_id = p.id),
      'product_images',  (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.product_images i where i.product_id = p.id)
    ) as j
    from public.products p where p.active
  ) x`

const send = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  res.end(JSON.stringify(body))
}
const readBody = (req) => new Promise((resolve) => {
  let data = ''
  req.on('data', (c) => { data += c; if (data.length > 20000) req.destroy() })
  req.on('end', () => resolve(data))
})

http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, null)
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname

    if (req.method === 'GET' && path === '/rest/v1/categories') return send(res, 200, await asVisitor(`select * from public.categories order by created_at`))
    if (req.method === 'GET' && path === '/rest/v1/shipping_zones') return send(res, 200, await asVisitor(`select id, name_ar, name_en, fee from public.shipping_zones order by position`))
    if (req.method === 'GET' && path === '/rest/v1/products') return send(res, 200, (await asVisitor(PRODUCTS_SQL))[0].list)

    if (req.method === 'POST' && path === '/rest/v1/rpc/get_order_by_token') {
      const { p_token } = JSON.parse((await readBody(req)) || '{}')
      return send(res, 200, (await asVisitor(`select public.get_order_by_token($1) as o`, [p_token ?? null]))[0].o)
    }

    if (req.method === 'POST' && path === '/functions/v1/checkout') {
      let body
      try { body = JSON.parse(await readBody(req)) } catch { return send(res, 400, { ok: false, error: 'invalid_input' }) }
      const deps = {
        rpc: rpcVia(db),
        ip: req.socket.remoteAddress ?? '',
        ipSalt: 'local',
        siteUrl: req.headers.origin ?? 'http://localhost:5173',
        cardEnabled: true,
        startCardPayment,
        log: console.error,
      }
      const r = body?.action === 'retry_payment' ? await handleRetryPayment(body, deps) : await handleCheckout(body, deps)
      return send(res, r.status, r.body)
    }

    // ----- the real webhook code, reached the way Paymob would call it -----
    if (req.method === 'POST' && path === '/functions/v1/paymob-webhook') {
      let body
      try { body = JSON.parse(await readBody(req)) } catch { return send(res, 400, { ok: false }) }
      const r = await handleWebhook({ body, hmac: url.searchParams.get('hmac') ?? '' }, { rpc: rpcVia(db), cfg: fakePaymob.cfg, log: console.error })
      return send(res, r.status, r.body)
    }

    // ----- fake Paymob: create intention / hosted page / "pay" -----
    if (req.method === 'POST' && path === '/__fake-paymob/v1/intention/') {
      if (req.headers.authorization !== `Token ${fakePaymob.cfg.secretKey}`) return send(res, 401, { detail: 'bad key' })
      const it = JSON.parse(await readBody(req))
      const id = `pi_${++fakePaymob.seq}`
      const intention = { ...it, id, client_secret: `cs_${id}_${Math.random().toString(36).slice(2)}`, intention_order_id: fakePaymob.seq }
      fakePaymob.intentions.set(intention.client_secret, intention)
      return send(res, 201, { id, client_secret: intention.client_secret, intention_order_id: intention.intention_order_id })
    }
    if (req.method === 'GET' && path === '/__fake-paymob/checkout') {
      const it = fakePaymob.intentions.get(url.searchParams.get('clientSecret'))
      if (!it || url.searchParams.get('publicKey') !== fakePaymob.cfg.publicKey) return send(res, 404, { message: 'unknown payment' })
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end(fakeCheckoutPage(it))
    }
    if (req.method === 'POST' && path === '/__fake-paymob/pay') {
      const form = new URLSearchParams(await readBody(req))
      const it = fakePaymob.intentions.get(form.get('cs'))
      if (!it) return send(res, 404, { message: 'unknown payment' })
      const success = form.get('result') === 'success'
      const obj = {
        id: ++fakePaymob.seq, pending: false, amount_cents: it.amount, success, is_auth: false, is_capture: false,
        is_standalone_payment: true, is_voided: false, is_refunded: false, is_3d_secure: true, integration_id: 1,
        has_parent_transaction: false, created_at: new Date().toISOString(), currency: 'EGP', error_occured: !success,
        owner: 1, source_data: { pan: '2346', type: 'card', sub_type: 'MasterCard' },
        order: { id: it.intention_order_id, merchant_order_id: it.special_reference },
      }
      const hmac = await hmacSha512Hex(fakePaymob.cfg.hmacSecret, hmacString(obj))
      // server-to-server notification, exactly like Paymob → our webhook
      await fetch(`${it.notification_url}?hmac=${hmac}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'TRANSACTION', obj }) })
      // then the customer's browser goes back to the shop (with Paymob-like query data that the shop ignores)
      res.writeHead(302, { Location: `${it.redirection_url}?success=${success}&id=${obj.id}` })
      return res.end()
    }

    // dev helper: see what's in the database
    if (req.method === 'GET' && path === '/__debug/orders') {
      return send(res, 200, await sql(db, `select order_number, status, payment_status, payment_method, customer_name, phone, total, created_at from public.orders order by created_at desc`))
    }
    if (req.method === 'GET' && path === '/__debug/stock') {
      return send(res, 200, await sql(db, `select p.name_ar, v.size, v.stock_qty, v.id from public.product_variants v join public.products p on p.id = v.product_id order by p.name_ar, v.position`))
    }

    // dev helper: change a price, to try the "price changed during checkout" path
    if (req.method === 'POST' && path === '/__debug/set-price') {
      const { variant_id, price } = JSON.parse((await readBody(req)) || '{}')
      await sql(db, `update public.product_variants set price = $2 where id = $1`, [variant_id, price])
      return send(res, 200, { ok: true })
    }

    send(res, 404, { message: 'not found in local backend' })
  } catch (e) {
    console.error(e)
    send(res, 500, { message: 'local backend error' })
  }
}).listen(PORT, () => console.log(`Local Supabase stand-in on http://localhost:${PORT}  (dev only, in-memory)`))
