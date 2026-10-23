// ============================================================
//  Paymob (Egypt) — shared by the Edge Functions (Deno) and the tests (Node).
//  Plain JavaScript + Web Crypto, no SDK.
//
//  References (Paymob developer docs):
//   • Create Intention: POST {apiBase}/v1/intention/  with  Authorization: Token <secret key>
//   • Unified Checkout: https://eg.checkout.paymob.com/?publicKey=…&clientSecret=…
//   • Transaction processed callback: POST JSON { type: 'TRANSACTION', obj }, signature in ?hmac=
//     HMAC-SHA512 over these 20 values concatenated in this exact order (no separators).
// ============================================================

export const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction',
  'id', 'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded',
  'is_standalone_payment', 'is_voided', 'order.id', 'owner', 'pending',
  'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
]

const get = (obj, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), obj)

/** The exact string Paymob signs for a transaction callback `obj`. */
export function hmacString(obj) {
  return HMAC_FIELDS.map((f) => {
    const v = get(obj, f)
    if (v === null || v === undefined) return ''
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    return String(v)
  }).join('')
}

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function hmacSha512Hex(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
}

/** Constant-time comparison of two hex strings. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** true only if `received` is Paymob's signature of `obj` with our HMAC secret. */
export async function verifyHmac(obj, received, secret) {
  if (!secret || !obj || typeof obj !== 'object' || typeof received !== 'string' || !/^[0-9a-f]{128}$/i.test(received)) return false
  return safeEqual(await hmacSha512Hex(secret, hmacString(obj)), received.toLowerCase())
}

/** Normalised fields for apply_payment_event(). */
export function eventFromTransaction(obj) {
  return {
    transaction_id: obj?.id != null ? String(obj.id) : '',
    provider_order_id: obj?.order?.id != null ? String(obj.order.id) : null,
    merchant_reference: obj?.order?.merchant_order_id != null ? String(obj.order.merchant_order_id) : null,
    amount_cents: Number.isInteger(obj?.amount_cents) ? obj.amount_cents : Number.parseInt(obj?.amount_cents, 10) || 0,
    currency: obj?.currency ?? null,
    success: obj?.success === true,
    pending: obj?.pending === true,
    is_refunded: obj?.is_refunded === true,
    is_voided: obj?.is_voided === true,
    // keep a trimmed copy for the owner's records — never the full card data
    raw: {
      id: obj?.id, created_at: obj?.created_at, amount_cents: obj?.amount_cents, currency: obj?.currency,
      success: obj?.success, pending: obj?.pending, error_occured: obj?.error_occured,
      integration_id: obj?.integration_id, order_id: obj?.order?.id, merchant_order_id: obj?.order?.merchant_order_id,
      card: obj?.source_data ? { type: obj.source_data.type, sub_type: obj.source_data.sub_type, last4: obj.source_data.pan } : undefined,
      message: obj?.data?.message,
    },
  }
}

// ---------- configuration (Supabase function secrets) ----------
/**
 * Returns the Paymob settings, or { enabled: false, reason } when card payments must stay off.
 * Live keys are refused unless PAYMOB_MODE is explicitly 'live' (which needs the owner's approval).
 */
export function paymobConfig(env) {
  const cfg = {
    mode: (env.PAYMOB_MODE || 'test').toLowerCase(),
    secretKey: env.PAYMOB_SECRET_KEY || '',
    publicKey: env.PAYMOB_PUBLIC_KEY || '',
    hmacSecret: env.PAYMOB_HMAC_SECRET || '',
    integrationId: Number.parseInt(env.PAYMOB_CARD_INTEGRATION_ID || '', 10),
    apiBase: (env.PAYMOB_API_BASE || 'https://accept.paymob.com').replace(/\/$/, ''),
    checkoutUrl: env.PAYMOB_CHECKOUT_URL || 'https://eg.checkout.paymob.com/',
  }
  if (!cfg.secretKey || !cfg.publicKey || !cfg.hmacSecret || !Number.isInteger(cfg.integrationId)) {
    return { enabled: false, reason: 'not_configured', ...cfg }
  }
  const looksLive = /_live_/i.test(cfg.secretKey) || /_live_/i.test(cfg.publicKey)
  if (cfg.mode !== 'live' && looksLive) return { enabled: false, reason: 'live_keys_in_test_mode', ...cfg }
  if (cfg.mode !== 'test' && cfg.mode !== 'live') return { enabled: false, reason: 'bad_mode', ...cfg }
  return { enabled: true, ...cfg }
}

// ---------- creating a payment ----------
const splitName = (full) => {
  const parts = String(full || '').trim().split(/\s+/)
  return { first: parts[0] || 'Customer', last: parts.slice(1).join(' ') || parts[0] || 'Customer' }
}

/**
 * Request body for Create Intention, built ONLY from the server's order (get_payable_order()).
 * amount = order total × 100; items add up to exactly the same amount (delivery is its own line).
 */
export function buildIntentionBody(order, { integrationId, notificationUrl, redirectionUrl, specialReference, expirationSeconds = 1800 }) {
  const name = splitName(order.customer.name)
  const items = order.items.map((i) => ({
    name: `${i.name} (${i.size})`.slice(0, 50),
    amount: i.unit_price * 100,
    quantity: i.qty,
    description: `size ${i.size}`.slice(0, 255),
  }))
  if (order.shipping_fee > 0) items.push({ name: 'Delivery', amount: order.shipping_fee * 100, quantity: 1, description: 'delivery fee' })
  return {
    amount: order.total * 100,
    currency: 'EGP',
    payment_methods: [integrationId],
    items,
    billing_data: {
      first_name: name.first,
      last_name: name.last,
      phone_number: `+2${order.customer.phone}`,
      email: order.customer.email || 'no-email@yahyastock.invalid',
      street: String(order.customer.address || 'NA').slice(0, 200),
      building: 'NA',
      floor: 'NA',
      apartment: 'NA',
      city: order.customer.area || 'NA',
      state: order.customer.zone_id || 'NA',
      country: 'EG',
    },
    special_reference: specialReference,
    notification_url: notificationUrl,
    redirection_url: redirectionUrl,
    expiration: expirationSeconds,
    extras: { order_number: `YS-${order.order_number}` },
  }
}

/** Calls Paymob. Returns { ok, intentionId, clientSecret, providerOrderId } — never throws. */
export async function createIntention(fetchImpl, cfg, body) {
  try {
    const res = await fetchImpl(`${cfg.apiBase}/v1/intention/`, {
      method: 'POST',
      headers: { Authorization: `Token ${cfg.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.client_secret || !data?.id) return { ok: false, status: res.status, error: data }
    return { ok: true, intentionId: String(data.id), clientSecret: data.client_secret, providerOrderId: data.intention_order_id != null ? String(data.intention_order_id) : null }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

export const checkoutRedirectUrl = (cfg, clientSecret) =>
  `${cfg.checkoutUrl}?publicKey=${encodeURIComponent(cfg.publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`

/**
 * Full "start a card payment" step for an order that is still pending payment.
 * deps: { rpc, fetch, cfg, siteUrl, functionsUrl, randomId }
 */
export async function startPayment(orderRef, trackingUrl, deps) {
  const { data: order, error } = await deps.rpc('get_payable_order', { p: orderRef })
  if (error || !order?.ok) return { ok: false, error: order?.error ?? 'server_error' }

  const specialReference = `YS-${order.order_number}-${deps.randomId()}`
  const body = buildIntentionBody(order, {
    integrationId: deps.cfg.integrationId,
    notificationUrl: `${deps.functionsUrl}/paymob-webhook`,
    redirectionUrl: trackingUrl,
    specialReference,
  })
  const intent = await createIntention(deps.fetch, deps.cfg, body)
  if (!intent.ok) {
    deps.log?.('paymob intention failed', intent.status, intent.error)
    return { ok: false, error: 'payment_unavailable' }
  }
  const rec = await deps.rpc('record_payment_intent', {
    p: { order_id: order.order_id, intention_id: intent.intentionId, provider_order_id: intent.providerOrderId, special_reference: specialReference, amount_cents: body.amount },
  })
  if (rec.error || !rec.data?.ok) return { ok: false, error: 'payment_unavailable' }
  return { ok: true, redirect_url: checkoutRedirectUrl(deps.cfg, intent.clientSecret) }
}

/**
 * The webhook: verify, then hand the normalised event to the database.
 * Returns { status, body }. A bad signature never reaches the database.
 */
export async function handleWebhook({ body, hmac }, deps) {
  const obj = body?.obj
  if (!obj || (body.type && body.type !== 'TRANSACTION')) return { status: 200, body: { ok: true, ignored: true } }
  if (!(await verifyHmac(obj, hmac, deps.cfg.hmacSecret))) {
    deps.log?.('paymob webhook: bad signature', obj?.id)
    return { status: 401, body: { ok: false, error: 'invalid_signature' } }
  }
  const { data, error } = await deps.rpc('apply_payment_event', { p: eventFromTransaction(obj) })
  if (error || !data?.ok) {
    deps.log?.('apply_payment_event failed', error ?? data)
    return { status: 500, body: { ok: false } } // Paymob will retry
  }
  return { status: 200, body: { ok: true, outcome: data.outcome ?? (data.duplicate ? 'duplicate' : undefined) } }
}
