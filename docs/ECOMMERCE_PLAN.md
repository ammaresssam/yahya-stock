# Yahya Stock: E-commerce Upgrade Plan (Option C)

Status: **stages 0–5 implemented and tested locally** (see README and docs/LAUNCH_GUIDE.md). Real Supabase and Paymob sandbox checks are still to do.

---

## 1. Gap analysis

| Area | Today | Needed | Gap |
|---|---|---|---|
| Products | One price and a list of size labels per product | A price and stock quantity per size | New `product_variants` table; storefront and admin changes |
| Stock | A manual status (متاح / محدودة / نفدت) | Real quantities, decremented on order, no overselling | Locked stock updates inside the order transaction |
| Cart | Browser-only; sends a WhatsApp message | Cart and checkout that create real orders | Checkout page and server endpoint |
| Prices | Read by the browser | The server decides every price and total | Pricing done in the database, never trusted from the browser |
| Orders | None (WhatsApp only) | Stored orders, statuses, history | `orders`, `order_items`, `order_status_history` |
| Payment | None | Cash on delivery and Paymob card, verified server-side | Edge Functions for payment creation and the signed webhook |
| Customer tracking | None | Confirmation and status page | Secret per-order tracking link |
| Admin | Products and categories | Plus inventory per size, orders, status changes | New admin tabs |
| **Security** | ⚠️ Any logged-in user can edit products | Only admins edit; customers see only their own order | `admin_users` table and an `is_admin()` check on every write rule |
| Secrets | Only the public anon key, which is correct | Paymob secret and Supabase service key, server-only | Stored as Supabase Function secrets, never in `src/` |
| Delivery | None | Delivery fee per governorate | `shipping_zones` table (owner sets the fees) |
| Legal pages | None | Paymob requires terms, refund policy and privacy pages | Pages with text the owner provides |
| Tests | Manual browser checks | Automated security and pricing tests | Test suite on real Postgres (PGlite) |
| Version control | None (no git) | Ability to roll back | `git init` before starting |

Kept unchanged: the whole storefront design, Arabic/English, the rotating headlines, categories, filters, the WhatsApp contact buttons and the demo mode when no database is connected. "Order on WhatsApp" stays as a second option in the cart.

---

## 2. Database schema

```
categories            (exists)  id, name_ar, name_en, art…
products              (changed) id, name_ar, name_en, category, is_new, featured, active, image_url, art…
                                (price / sizes / stock move to variants)
product_variants      (new)     id, product_id, size, price, compare_at_price, stock_qty, sku, active, position
                                unique(product_id, size), check stock_qty >= 0, check price > 0
shipping_zones        (new)     id, name_ar, name_en, fee, active        (e.g. الإسكندرية, القاهرة, …)
orders                (new)     id, order_number ('YS-10001'), tracking_token_hash,
                                customer_name, phone, email?, zone_id, area, address, notes,
                                payment_method ('cod' | 'card'),
                                status ('pending_payment' | 'placed' | 'confirmed' | 'preparing' |
                                        'shipped' | 'delivered' | 'cancelled' | 'payment_failed'),
                                payment_status ('unpaid' | 'pending' | 'paid' | 'failed' | 'refunded'),
                                subtotal, shipping_fee, total, currency 'EGP',
                                stock_released bool, expires_at (card only), client_ip_hash, created_at
order_items           (new)     order_id, variant_id, product_name_ar/en, size, unit_price, qty, line_total
                                (snapshot, so later price edits don't change past orders)
order_status_history  (new)     order_id, from_status, to_status, changed_by, note, created_at
payments              (new)     order_id, provider 'paymob', intention_id, provider_order_id,
                                transaction_id UNIQUE (idempotency), amount_cents, success,
                                hmac_valid, raw jsonb, created_at
admin_users           (new)     user_id → auth.users    (who is allowed to manage the shop)
```

Prices are stored in whole Egyptian pounds; Paymob receives `total × 100` piastres.

### Row Level Security (who can do what)

| Table | Visitor / customer | Admin | Server (Edge Functions) |
|---|---|---|---|
| categories, products, variants, shipping_zones | **read** active rows only | full | full |
| orders, order_items, history, payments | **no access at all** | read + status changes via a checked function | full |
| admin_users | none | read | full |

Customers never query `orders` directly. They see their order only through `get_order_by_token(token)`. That function hashes the token, returns that single order with limited fields (phone masked), and returns nothing for a wrong token. The token is 32 random bytes in the confirmation link; only its SHA-256 hash is stored.

---

## 3. Checkout architecture

```
Browser (cart: variant_id + qty only, never prices)
   │  POST /functions/v1/checkout   {items, customer, payment_method, expected_total}
   ▼
Edge Function "checkout"  (Deno, holds the secrets)
   • validates input (Egyptian phone, lengths, max 20 lines, qty 1–10, zone exists)
   • rate limit: max N orders per IP-hash per hour
   • calls SQL place_order(...)   ← one transaction:
        – reads prices from product_variants (ignores anything the browser sent)
        – locks each variant row, checks stock, decrements it
        – reads shipping fee from shipping_zones
        – inserts order + items + history
        – if total ≠ expected_total → aborts with "prices changed" and returns the new quote
   • COD  → status 'placed', done → returns tracking link
   • Card → calls Paymob Intention API with the SERVER total
            → returns Paymob checkout URL; order is 'pending_payment' (stock reserved 30 min)
   ▼
Customer pays on Paymob's page (we never see card numbers)
   │
   ├─► Paymob → POST /functions/v1/paymob-webhook   (server-to-server)
   │        • verifies HMAC-SHA512 with the HMAC secret → reject if invalid
   │        • checks the amount and order reference match OUR order
   │        • records the payment (unique transaction_id → replays ignored)
   │        • success → order 'placed' + payment 'paid'; failure → 'payment_failed' + restock
   │
   └─► Browser redirect → /#/order/<token>
            • shows status READ FROM THE DATABASE (polls until the webhook lands)
            • URL parameters from the redirect are ignored for payment status
```

Unpaid card orders older than 30 minutes are cancelled and their stock is returned by a scheduled database job (`pg_cron`).

Admin status changes go through `admin_set_order_status(order_id, new_status, note)`. It checks `is_admin()`, allows only valid transitions (e.g. `delivered` can't go back to `placed`), restocks on cancel, and writes the history. For COD, "delivered" also marks the payment as collected.

---

## 4. Implementation stages (each one tested before the next)

| # | Stage | Done when |
|---|---|---|
| 0 | `git init`; test harness on real Postgres (PGlite); **fix the admin security hole** (`admin_users`, `is_admin()`) | Test proves a logged-in non-admin cannot edit products |
| 1 | Variants and inventory: schema, storefront size/price/stock per size, admin variant editor | Out-of-stock sizes are disabled; admin edits stock per size |
| 2 | Orders and COD: `place_order`, `checkout` function, checkout page, confirmation and tracking page | Tests: browser prices ignored, oversell blocked, wrong token sees nothing |
| 3 | Admin orders: list, filters, details, status changes, restock on cancel, history | Invalid transitions rejected; cancel restores stock |
| 4 | Paymob card payments: intention, webhook with HMAC, idempotency, 30-minute expiry, return-page polling | Tests: forged or altered webhooks rejected; replays ignored; paid only via a verified webhook |
| 5 | Hardening: full RLS test suite, rate limit, legal page templates, README runbook | Every security requirement in the brief has a passing test |
| 6 | **Your setup**: Supabase project, deploy functions, Paymob **test** keys, sandbox test payment | One test-card payment end-to-end in Paymob sandbox |

What I can and can't test here:
- **Tested for real here:** database rules, pricing, stock and status logic on real Postgres. Webhook signature checks and the checkout logic run in Node with a mocked Paymob.
- **Needs your keys:** the real Paymob sandbox call, and the real Supabase deployment (stage 6).

---

## 5. Needs your setup or approval

1. **Supabase project and CLI** to deploy Edge Functions. I'll give exact commands.
2. **Paymob merchant account.** The owner applies with business documents (commercial register, tax card). Approval is Paymob's decision and takes time. Until then cash on delivery works on its own, and card payment stays switched off by a setting.
3. **Paymob test keys** (secret key, public key, HMAC secret, card integration ID). You set them as Supabase secrets yourself; never paste them into the code or chat.
4. **Delivery fees per governorate.** I'll put placeholders.
5. **Policy texts** (returns and exchanges, delivery time, privacy). I'll provide templates; the owner must confirm the content.
6. **Going live** (real payments, public deploy) only with your explicit approval.

## 6. Decisions I need from you

- **Customer accounts:** I recommend guest checkout with a secret tracking link now, with no customer passwords. Optional customer login with order history can come later.
- **Card methods:** I recommend card only at first. Mobile wallets (Vodafone Cash etc.) through Paymob can come later; same flow, another integration ID.
- **Reservation time for unpaid card orders:** 30 minutes.
