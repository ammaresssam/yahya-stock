// ============================================================
//  Checkout logic shared by the Supabase Edge Function (Deno) and the tests (Node).
//  Plain JavaScript + Web Crypto only, so it runs unchanged in both.
//
//  The browser sends WHAT it wants (size ids, quantities, delivery details).
//  It never decides a price: place_order() reads prices and stock from the database.
// ============================================================

const ARABIC_DIGITS = /[٠-٩۰-۹]/g
const toLatinDigits = (s) =>
  String(s).replace(ARABIC_DIGITS, (d) => {
    const c = d.charCodeAt(0)
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660)
  })

/** Egyptian mobile → 01XXXXXXXXX, or null. Accepts spaces, dashes, +20 / 0020 and Arabic digits. */
export function normalizePhone(raw) {
  if (typeof raw !== 'string') return null
  let d = toLatinDigits(raw).replace(/[\s\-().]/g, '')
  if (d.startsWith('+20')) d = '0' + d.slice(3)
  else if (d.startsWith('0020')) d = '0' + d.slice(4)
  else if (d.startsWith('20') && d.length === 12) d = '0' + d.slice(2)
  return /^01[0125]\d{8}$/.test(d) ? d : null
}

const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max + 1) : '')
const UUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i

/** Validates and normalises the request body. Returns { ok, value } or { ok: false, fields }. */
export function validateCheckout(body) {
  const fields = {}
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, fields: { body: 'invalid' } }

  const items = Array.isArray(body.items) ? body.items : null
  if (!items || items.length < 1 || items.length > 20) fields.items = 'invalid'
  const cleanItems = (items ?? []).map((i) => ({ variant_id: i?.variant_id, qty: i?.qty }))
  if (cleanItems.some((i) => typeof i.variant_id !== 'string' || !UUID.test(i.variant_id) || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 10)) {
    fields.items = 'invalid'
  }

  const c = body.customer && typeof body.customer === 'object' ? body.customer : {}
  const name = clean(c.name, 80)
  const phone = normalizePhone(c.phone)
  const email = clean(c.email, 254).toLowerCase()
  const zone_id = typeof c.zone_id === 'string' ? c.zone_id : ''
  const area = clean(c.area, 80)
  const address = clean(c.address, 300)
  const notes = clean(c.notes, 500)

  if (name.length < 2 || name.length > 80) fields.name = 'invalid'
  if (!phone) fields.phone = 'invalid'
  if (email && (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) fields.email = 'invalid'
  if (!/^[a-z0-9_-]{1,40}$/.test(zone_id)) fields.zone_id = 'invalid'
  if (area.length < 2 || area.length > 80) fields.area = 'invalid'
  if (address.length < 5 || address.length > 300) fields.address = 'invalid'
  if (notes.length > 500) fields.notes = 'invalid'

  const payment_method = body.payment_method
  if (payment_method !== 'cod' && payment_method !== 'card') fields.payment_method = 'invalid'

  const expected_total = body.expected_total
  if (expected_total !== undefined && (!Number.isInteger(expected_total) || expected_total < 0)) fields.expected_total = 'invalid'

  if (Object.keys(fields).length) return { ok: false, fields }
  return {
    ok: true,
    value: {
      items: cleanItems,
      customer: { name, phone, email: email || null, zone_id, area, address, notes: notes || null },
      payment_method,
      expected_total,
    },
  }
}

// ---------- crypto helpers (Web Crypto: Deno, browsers, Node ≥ 19) ----------
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const toBase64Url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export const sha256Hex = async (text) => toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))

/** 32 random bytes → 43-character URL-safe secret. Only its SHA-256 hash is stored. */
export function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

const PUBLIC_ERRORS = new Set(['invalid_items', 'invalid_customer', 'invalid_payment_method', 'items_unavailable', 'price_changed', 'rate_limited'])

/**
 * deps:
 *   rpc(name, args) → { data, error }     supabase-js client created with the SERVICE ROLE key (server only)
 *   ip                                    client IP as seen by the server (may be empty)
 *   ipSalt                                secret salt so stored IP hashes can't be reversed
 *   siteUrl                               e.g. https://yahyastock.com (for the tracking link)
 *   cardEnabled                           false until Paymob is configured (Stage 4)
 *   startCardPayment?(order) → { redirect_url }   Stage 4
 *   log?(…)                               server-side logging (never sent to the browser)
 * Returns { status, body } — body is safe to send to the browser.
 */
export async function handleCheckout(body, deps) {
  const v = validateCheckout(body)
  if (!v.ok) return { status: 400, body: { ok: false, error: 'invalid_input', fields: v.fields } }
  const input = v.value

  if (input.payment_method === 'card' && !deps.cardEnabled) {
    return { status: 400, body: { ok: false, error: 'card_unavailable' } }
  }

  const token = randomToken()
  const payload = {
    items: input.items,
    customer: input.customer,
    payment_method: input.payment_method,
    token_hash: await sha256Hex(token),
    ip_hash: deps.ip ? await sha256Hex(`${deps.ipSalt ?? ''}:${deps.ip}`) : null,
  }
  if (input.expected_total !== undefined) payload.expected_total = input.expected_total

  const { data, error } = await deps.rpc('place_order', { p: payload })
  if (error || !data) {
    deps.log?.('place_order failed', error)
    return { status: 500, body: { ok: false, error: 'server_error' } }
  }
  if (!data.ok) {
    const code = PUBLIC_ERRORS.has(data.error) ? data.error : 'server_error'
    const status = code === 'rate_limited' ? 429 : code === 'server_error' ? 500 : 409
    return { status, body: { ok: false, error: code, ...(data.items && { items: data.items }), ...(data.quote && { quote: data.quote }), ...(data.field && { field: data.field }) } }
  }

  const tracking_url = `${(deps.siteUrl ?? '').replace(/\/$/, '')}/#/order/${token}`
  const result = {
    ok: true,
    order_number: `YS-${data.order_number}`,
    status: data.status,
    subtotal: data.subtotal,
    shipping_fee: data.shipping_fee,
    total: data.total,
    tracking_token: token,
    tracking_url,
  }

  if (input.payment_method === 'card') {
    // Stage 4: create the Paymob payment for THIS order's server-side total.
    const pay = await deps.startCardPayment?.({ ...data, customer: input.customer, tracking_url })
    if (!pay?.redirect_url) return { status: 502, body: { ok: false, error: 'payment_unavailable', tracking_url } }
    result.payment_url = pay.redirect_url
  }
  return { status: 200, body: result }
}
