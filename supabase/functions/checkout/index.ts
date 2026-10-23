// Supabase Edge Function: POST /functions/v1/checkout
// Runs on Supabase's servers. The service-role key and the Paymob keys are secrets on
// the server and never reach the browser.
//   body { items, customer, payment_method, expected_total }   → place an order
//   body { action: 'retry_payment', tracking_token }            → "pay now" for an unpaid card order
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { handleCheckout, handleRetryPayment } from '../_shared/checkout-core.js'
import { paymobConfig, startPayment } from '../_shared/paymob-core.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Comma-separated list, e.g. "https://yahyastock.com,http://localhost:5173"
const allowedOrigins = (Deno.env.get('SITE_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const siteUrl = Deno.env.get('SITE_URL') ?? allowedOrigins[0] ?? ''

// Card payments switch on only with complete Paymob TEST keys (live keys are refused unless PAYMOB_MODE=live).
const paymob = paymobConfig(Deno.env.toObject())
if (!paymob.enabled) console.log(`card payments off: ${paymob.reason}`)

function cors(origin: string | null) {
  const allow = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? ''
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const json = (status: number, body: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })

const rpc = (fn: string, args: unknown) => supabase.rpc(fn, args as Record<string, unknown>)
const log = (...args: unknown[]) => console.error(...args)

const startCardPayment = (orderRef: unknown, trackingUrl: string) =>
  startPayment(orderRef, trackingUrl, {
    rpc,
    fetch,
    cfg: paymob,
    functionsUrl: `${SUPABASE_URL}/functions/v1`,
    randomId: () => crypto.randomUUID().slice(0, 8),
    log,
  })

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' }, headers)

  const origin = req.headers.get('origin')
  if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) {
    return json(403, { ok: false, error: 'forbidden_origin' }, headers)
  }

  const text = await req.text()
  if (text.length > 20_000) return json(413, { ok: false, error: 'too_large' }, headers)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text)
  } catch {
    return json(400, { ok: false, error: 'invalid_input' }, headers)
  }

  const deps = {
    rpc,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
    ipSalt: Deno.env.get('IP_HASH_SALT') ?? '',
    siteUrl,
    cardEnabled: paymob.enabled,
    startCardPayment,
    log,
  }
  const result = body?.action === 'retry_payment' ? await handleRetryPayment(body, deps) : await handleCheckout(body, deps)
  return json(result.status, result.body, headers)
})
