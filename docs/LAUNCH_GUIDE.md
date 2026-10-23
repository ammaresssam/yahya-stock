# Yahya Stock: launch guide

Follow the steps in order. Each step says **who** does it. 🛑 marks a step that needs the owner's explicit approval. Nothing here costs money until step 9 (domain) and step 12 (live payments).

Details for each step are in the README; this is the checklist.

---

## Part A: content (owner)

**1. Confirm the shop details** in `src/data/site.js`. Who: owner, then developer.
- [ ] Address. Then set `addressConfirmed: true` to show the map and directions.
- [ ] Mobile numbers, landline and the **WhatsApp number**.
- [ ] Opening hours (`hours`).
- [ ] Facebook, Instagram and TikTok links (the Facebook QR on the sign has no readable link yet).

**2. Confirm the headlines** in `src/lib/i18n.jsx` → `heroTitles`. Who: owner.
- [ ] "البس براندات": does the shop sell branded stock?
- [ ] "تشكيلة جديدة كل أسبوع": is there really new stock every week? Otherwise remove it.

**3. Fill in the policies** in `src/data/policies.js`. Who: owner. Paymob requires these pages.
- [ ] Every `[blank]`: return days, refund rules, who pays return shipping, delivery times, cancellation deadline, data retention, legal name and commercial registry number.
- [ ] Then set `policiesApproved = true`.

**4. Real products.** Who: owner, in the admin panel after Part B.
- [ ] Photos, names, sizes, prices and quantities for each product.
- [ ] The demo products in `products.js` disappear automatically once the database is connected.

---

## Part B: database (developer, about 30 minutes, free)

**5. Supabase project.** Who: developer.
- [ ] Create the project, region Frankfurt.
- [ ] Run **all 7 files** in `supabase/migrations/` in filename order (SQL Editor, or `supabase db push`).
- [ ] Create the owner's login and add it to `admin_users` (README step 4).
- [ ] Turn off public sign-up.
- [ ] Copy the Project URL and the **anon/publishable** key into `.env.local`. **Never** the service_role key.

**6. Security checks on the real project.** Who: developer. Do the 6 checks in `tests/README.md`.
- [ ] Row Level Security is on everywhere.
- [ ] The policies are as expected.
- [ ] The admin list holds only the owner.
- [ ] A non-admin is blocked.
- [ ] Orders are private.
- [ ] No service key appears in `dist/`.

**7. Delivery fees.** Who: owner, in the admin panel → *التوصيل*.
- [ ] Set the real fees (the current ones are placeholders) and close any zones you don't deliver to.

**8. Checkout (cash on delivery).** Who: developer.
- [ ] `supabase secrets set SITE_ORIGINS=… SITE_URL=… IP_HASH_SALT=…`
- [ ] `supabase functions deploy checkout`
- [ ] Place one real test order and check it in the admin panel → *الطلبات*.
- [ ] Take it from confirm through to delivered, then cancel a second test order and check its stock came back.

---

## Part C: going online

**9. 🛑 Domain and hosting.** Who: owner decides, developer sets up.
- [ ] Choose a domain, e.g. `yahyastock.com` (paid, yearly).
- [ ] Host on Netlify, Vercel or Cloudflare Pages (free tier).
- [ ] Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and later `VITE_CARD_PAYMENTS=on`), then build.
- [ ] The security headers come from `public/_headers` (Netlify and Cloudflare) or `vercel.json` (Vercel). After deploying, check them at securityheaders.com.
- [ ] Update `SITE_ORIGINS` and `SITE_URL` to the real address, and the `og:` tags in `index.html`.
- [ ] Set `isLive: true` in `site.js` once the real products are in, so the demo banners disappear.

**10. Final check on a real phone.** Who: owner and developer.
- [ ] Arabic and English, search, filters, a product page, the cart, checkout, the tracking page, WhatsApp and the call buttons.

---

## Part D: card payments (optional, after cash on delivery works)

**11. Paymob test mode.** Who: owner applies, developer sets up.
- [ ] The owner applies for a Paymob merchant account with the business documents. **Approval is Paymob's decision and can take time.**
- [ ] In Paymob's dashboard, in **test mode**, the owner or developer copies:
  - Secret Key
  - Public Key
  - HMAC secret
  - card Integration ID

  Enter them directly as Supabase secrets (`PAYMOB_MODE=test`, …) and **never share them in chat or code**.
- [ ] `supabase functions deploy checkout` and `supabase functions deploy paymob-webhook`
- [ ] In Paymob, set the *Transaction processed callback* to `https://<project>.supabase.co/functions/v1/paymob-webhook`.
- [ ] Confirm Paymob's intention URL and checkout URL for your account (`PAYMOB_API_BASE`, `PAYMOB_CHECKOUT_URL`).
- [ ] Set `VITE_CARD_PAYMENTS=on` in hosting and rebuild.
- [ ] **Sandbox tests** with Paymob's test cards:
  - one successful payment (the order shows *paid*)
  - one declined card (the order stays open, and *ادفع الآن* works)
  - one order left unpaid for 30 minutes (it closes and the stock comes back)
- [ ] Check `payment_events` in Supabase for each case.
- [ ] Optional: enable `pg_cron` and run `supabase/cron.sql`.

**12. 🛑 Live payments.** Who: owner approves explicitly.
- [ ] Only after every check in step 11 passes.
- [ ] Replace the keys with the **live** keys and set `PAYMOB_MODE=live`. The functions refuse live keys without it.
- [ ] Make one small real payment, then **refund it from Paymob's dashboard**, and check the admin panel shows *مسترد*.

---

## After launch: what the owner does day to day

- **Orders:** admin panel → *الطلبات*. New orders are marked **جديد**. Call or WhatsApp the customer, then press *تأكيد الطلب* → *بدء التجهيز* → *تسليم للمندوب* → *تم التوصيل*.
- **Stock:** *المخزون* tab, with + / − per size, or use "قرّب يخلص" to see sizes running low.
- **A red warning on a card order** means a refund is needed. Do it in Paymob's dashboard.
- **Never share** the Supabase service key or the Paymob secret keys with anyone, including in WhatsApp or email.
