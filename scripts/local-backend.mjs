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
//           VITE_SUPABASE_URL=http://localhost:54321  VITE_SUPABASE_ANON_KEY=local  npm run dev
// ============================================================
import http from 'node:http'
import { as, freshDb, sql } from '../tests/helpers/db.js'
import { rpcVia } from '../tests/helpers/shop.js'
import { handleCheckout } from '../supabase/functions/_shared/checkout-core.js'
import { categories, products } from '../src/data/products.js'
import { fromDemo } from '../src/lib/product.js'

const PORT = Number(process.env.PORT || 54321)
const db = await freshDb()

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
      const r = await handleCheckout(body, {
        rpc: rpcVia(db),
        ip: req.socket.remoteAddress ?? '',
        ipSalt: 'local',
        siteUrl: req.headers.origin ?? 'http://localhost:5173',
        cardEnabled: false,
        log: console.error,
      })
      return send(res, r.status, r.body)
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
