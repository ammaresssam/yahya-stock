// Supabase Edge Function: POST /functions/v1/paymob-webhook?hmac=…
// Paymob's server calls this after every card transaction ("transaction processed callback").
// This is the ONLY way an order becomes paid:
//   1. the HMAC-SHA512 signature is checked with PAYMOB_HMAC_SECRET (bad signature → 401, nothing stored)
//   2. apply_payment_event() matches the order, checks amount + currency, ignores repeats,
//      and only then marks the order paid.
// The customer's browser redirect is never used for payment status.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { handleWebhook, paymobConfig } from '../_shared/paymob-core.js'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const paymob = paymobConfig(Deno.env.toObject())

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  if (!paymob.hmacSecret) return new Response('not configured', { status: 503 })

  const text = await req.text()
  if (text.length > 100_000) return new Response('too large', { status: 413 })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const hmac = new URL(req.url).searchParams.get('hmac') ?? ''
  const result = await handleWebhook({ body, hmac }, {
    rpc: (fn: string, args: unknown) => supabase.rpc(fn, args as Record<string, unknown>),
    cfg: paymob,
    log: (...args: unknown[]) => console.error(...args),
  })
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'Content-Type': 'application/json' } })
})
