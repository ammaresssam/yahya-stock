// Supabase Edge Function: POST /functions/v1/checkout
// Runs on Supabase's servers. The service-role key is injected by Supabase as an
// environment variable and never leaves the server.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { handleCheckout } from '../_shared/checkout-core.js'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Comma-separated list, e.g. "https://yahyastock.com,http://localhost:5173"
const allowedOrigins = (Deno.env.get('SITE_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const siteUrl = Deno.env.get('SITE_URL') ?? allowedOrigins[0] ?? ''

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
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json(400, { ok: false, error: 'invalid_input' }, headers)
  }

  const result = await handleCheckout(body, {
    rpc: (fn: string, args: unknown) => supabase.rpc(fn, args as Record<string, unknown>),
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
    ipSalt: Deno.env.get('IP_HASH_SALT') ?? '',
    siteUrl,
    cardEnabled: false, // Stage 4 turns this on when Paymob test keys are configured
    log: (...args: unknown[]) => console.error(...args),
  })
  return json(result.status, result.body, headers)
})
