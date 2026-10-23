import { SUPABASE_KEY, SUPABASE_URL, dbConfigured } from './config'

// Online checkout needs the database and the checkout Edge Function.
export const checkoutAvailable = dbConfigured
// Card payments are shown only once Paymob is set up (Stage 4). The server enforces this too.
export const cardPaymentsEnabled = import.meta.env.VITE_CARD_PAYMENTS === 'on'

const headers = () => {
  const h = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }
  if (SUPABASE_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SUPABASE_KEY}`
  return h
}

/** Places an order. Returns the server's JSON ({ ok, … }) — never throws for business errors. */
export async function submitCheckout(body) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/checkout`, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
    const data = await res.json().catch(() => null)
    return data ?? { ok: false, error: 'server_error' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** "Pay now" for an unpaid card order. Returns { ok, payment_url } or { ok: false, error }. */
export async function retryPayment(token) {
  return submitCheckout({ action: 'retry_payment', tracking_token: token })
}

/** One order's public view for a secret tracking token, or null. */
export async function fetchOrder(token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_order_by_token`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ p_token: token }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Orders placed on this device, so the customer can find their tracking links again.
const KEY = 'ys-orders'
export function rememberOrder(entry) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    localStorage.setItem(KEY, JSON.stringify([entry, ...list.filter((o) => o.token !== entry.token)].slice(0, 20)))
  } catch {}
}
export function rememberedOrders() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}
