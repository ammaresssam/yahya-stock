# Yahya Stock — يحيى استوك

Website for Yahya Stock, a stock-clothing shop in Miami, Alexandria. Arabic-first (RTL) with an English toggle. The colours come from the shop sign: charcoal `#2b2a2f`, red `#e3262d`, white.

It has two modes:

| Mode | When | Products come from |
|---|---|---|
| **Demo** | No database connected (default) | The sample file `src/data/products.js`. Pages are labelled "demo" |
| **Live** | Supabase connected (steps below) | The database, edited by the owner from the admin panel at `/#/admin` |

> ⚠️ The address, phone numbers and links come from the shop sign and public listings. The owner must confirm them in `src/data/site.js`.

> **Launching?** Follow [docs/LAUNCH_GUIDE.md](docs/LAUNCH_GUIDE.md): the step-by-step checklist from content to live payments.

## Preview it locally

```bash
npm install
npm run dev
```
Open http://localhost:5173. Use the browser's phone view (F12 → device toolbar) to see the mobile layout and the tab bar.

- **Demo mode** (the default): sample products and WhatsApp ordering.
- **Full shop with checkout, no Supabase needed:** run `npm run dev:backend` in one terminal. In a second terminal, run `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=local npm run dev`. On Windows PowerShell: `$env:VITE_SUPABASE_URL='http://localhost:54321'; $env:VITE_SUPABASE_ANON_KEY='local'; npm run dev`.
- **Admin panel without a database:** http://localhost:5173/#/admin?mock, log in with `owner@test.com` / `123456`.

## Run it locally

You need Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # serve the built site locally
```

## What's in it

| Section | Notes |
|---|---|
| Header | Dark, sticky. Logo, product search, language toggle, WhatsApp and cart. Below it a category bar (All, then each category from the database, *العروض* only when a real discount exists, New arrivals) with the active one underlined in red |
| Hero | Compact, so products show quickly. The rotating headlines you chose (`heroTitles` in `src/lib/i18n.jsx`) and *تسوق الآن*. The "up to X% off" badge is **calculated from real before-discount prices** and hidden when there are none. It shows a real product photo once the shop has one, otherwise the brand illustration |
| Categories | Photo tiles (first product photo in each category); a swipeable row on phones |
| Offers | Only products whose in-stock sizes have a real before-discount price; hidden if none |
| Catalogue | Search (Arabic letter variants like ى/ي and أ/ا are matched), filters for category, size, price range, in stock and on sale, plus sorting (featured, newest, price up and down, biggest discount). Filters sit in a sidebar on desktop and a bottom sheet on phones. Active filters show as removable chips; there are loading, error and empty states |
| Product card | Discount badge only for a real discount; sale price in red next to the struck-through original, regular price in black. Sold-out sizes crossed out, "N left" for low stock, add-to-cart, ask-on-WhatsApp, photo gallery |
| New arrivals | Products marked *new* that are in stock (swipe on phones, arrows on desktop) |
| Trust strip | Only facts that are true: cash on delivery and delivery to governorates appear **only when online checkout is connected**; WhatsApp and the physical store always |
| Store and contact | Phones and WhatsApp (from the shop sign). The address shows "قيد التأكيد"; **the map and directions appear only after `addressConfirmed: true`** in `site.js`. Opening hours appear only once entered |
| Promo bar | Above the header, scrolls away. Only true facts: the demo notice, the real highest discount, and "cash on delivery" only when checkout is connected |
| Product page (`#/product/<id>`) | Large photo with thumbnails and full-screen view, size buttons with stock, a quantity selector capped at what's left (minus what's already in the cart), add to cart and buy now, ask on WhatsApp, related products from the same category. The browser tab shows the product name |
| Store picks | Products the owner marks as *featured*. There's no sales data, so this is labelled "اختيارات المحل", not "popular" |
| My orders (`#/orders`) | There are no customer accounts. This lists the orders placed from this device, with their private tracking links |
| Phone tab bar | Home, shop, cart, my orders and WhatsApp, always in thumb reach (phones only) |
| Cart, checkout, tracking | Same behaviour as before: per-size prices, stock caps, cash on delivery, private tracking link, WhatsApp as a second option. The cart now itemises items, delivery ("calculated by governorate") and the total before delivery |

## Connect the database and admin panel (about 15 minutes, free)

Uses [Supabase](https://supabase.com): a database, a login and photo storage. The free tier is enough for a shop this size.

1. **Create a project** at supabase.com → *New project*. Pick the region closest to Egypt (e.g. Frankfurt) and save the database password somewhere safe.
2. **Create the tables:** run every file in `supabase/migrations/` **in filename order**. Either:
   - *SQL Editor* → *New query* → paste one file → **Run**, then the next one; or
   - with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.

   This creates the tables, the photo bucket, the security rules and the starting categories (رجالي / حريمي / أطفال).
3. **Create the owner's login:** *Authentication → Users → Add user → Create new user*. Enter the owner's email and a strong password, and tick *Auto Confirm User*.
4. **Make that account the admin:** only accounts listed in `admin_users` can change products. In the SQL Editor run (with the owner's email):
   ```sql
   insert into public.admin_users (user_id, note)
   select id, 'store owner' from auth.users where email = 'OWNER-EMAIL@example.com';
   ```
   To remove someone's access later: `delete from public.admin_users where user_id = '…';`
5. **Close public sign-up (recommended):** *Authentication → Sign In / Providers* → switch **off** *Allow new users to sign up*. The database rules already stop non-admins from editing anything, but there's no reason to let strangers create accounts.
6. **Copy the two keys:** *Project Settings → API*. Copy the **Project URL** and the **anon / publishable** key. Copy `.env.example` to `.env.local` and paste them in:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   The anon key is public by design; the security rules in `supabase/migrations/` are what protect your data. **Never** use the `service_role` key anywhere in this project.
7. Restart `npm run dev` and open **`http://localhost:5173/#/admin`**. Log in with the account from step 3. A logged-in account that isn't in `admin_users` sees "الحساب ده مش مسموح له".

When deploying (below), add the same two variables in your host's *Environment variables* settings.

### Turn on online checkout (cash on delivery)

Checkout runs on Supabase's servers as an **Edge Function** (`supabase/functions/checkout`). It holds the server-only key; the browser never does.

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and log in: `supabase login`, then `supabase link --project-ref <your-project-ref>`.
2. Set the function's settings (these stay on Supabase's servers, never in the website code):
   ```bash
   supabase secrets set SITE_ORIGINS="http://localhost:5173" SITE_URL="http://localhost:5173" IP_HASH_SALT="<any long random text>"
   ```
   After the site has its real address, set both `SITE_ORIGINS` and `SITE_URL` to it (e.g. `https://yahyastock.com`). `SITE_ORIGINS` may list several addresses separated by commas.
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function by Supabase automatically; don't set or copy them anywhere.
3. Deploy the function: `supabase functions deploy checkout`. The setting `verify_jwt = false` in `supabase/config.toml` lets customers check out without an account; the function checks everything itself.
4. **Set the real delivery fees.** The fees in the database (Alexandria 50, Cairo 75, …) are **placeholders**. Change them in the admin panel → *التوصيل*.

The cart then shows *إتمام الطلب* (checkout). Customers fill in their name, mobile, governorate, area and address and choose cash on delivery. The order is saved, the stock is reserved, and they land on a private tracking page (`/#/order/…`). Ordering on WhatsApp stays available as a second option.

How checkout stays safe:
- **Prices:** the browser only sends *which size* and *how many*. Prices, delivery fee and total are read from the database inside `place_order()`. If the total the customer saw no longer matches (a price changed), nothing is saved and the customer is shown the new total to confirm.
- **Stock:** sizes are locked while an order is placed, so the last piece can only be sold once.
- **Privacy:** orders can't be read from the browser at all, except by the admin. A customer sees only their own order, through a secret 43-character link. Only its fingerprint (SHA-256) is stored, and the link page never shows the full address or phone.
- **Abuse:** at most 5 orders per hour per device and per phone number.

### Card payments with Paymob (TEST mode)

Card payment runs entirely on the server. The secret keys live only in Supabase function secrets.

**How a card payment works**
1. The customer chooses *بطاقة بنكية*. The `checkout` function creates the order: stock is reserved for 30 minutes, and the status is *في انتظار الدفع*.
2. The function asks Paymob for a payment of the **order's total from the database**. The browser is sent to Paymob's own payment page; we never see card numbers.
3. Paymob's server calls `paymob-webhook`. The function checks the **HMAC-SHA512 signature** with `PAYMOB_HMAC_SECRET`. A bad signature is rejected and nothing is stored.
4. `apply_payment_event()` finds the order and checks that the **amount and currency match exactly**. It ignores a transaction it has already seen, and only then marks the order **paid**.
5. Paymob sends the customer back to the tracking page, which **reads the status from the database**. Anything Paymob or anyone else puts in the address bar is ignored.

**Edge cases**
- **Declined card:** the order stays reserved and the tracking page offers *ادفع الآن* again.
- **Not paid within 30 minutes:** the order becomes *لم يتم الدفع* and the stock goes back on sale.
- **Paid after expiry:** the admin panel shows a red "needs refund" warning.
- **Wrong amount:** the order is never marked paid, and the payment is flagged in the admin panel.
- **Refunds:** done in Paymob's dashboard. Paymob's refund notification marks the payment *مسترد*.

**Setup (test mode; your Paymob account, no real money)**
1. Get a Paymob merchant account. In the dashboard, switch to **Test mode** and copy the test keys:
   - Secret Key
   - Public Key
   - HMAC secret
   - the **Integration ID** of the online card integration
2. Set them as Supabase function secrets yourself. Never put them in the code, in `.env.local` or in a chat:
   ```bash
   supabase secrets set PAYMOB_MODE=test PAYMOB_SECRET_KEY=... PAYMOB_PUBLIC_KEY=... PAYMOB_HMAC_SECRET=... PAYMOB_CARD_INTEGRATION_ID=...
   ```
   Optional settings:
   - `PAYMOB_API_BASE`, default `https://accept.paymob.com`. The intention request goes to `{base}/v1/intention/`.
   - `PAYMOB_CHECKOUT_URL`, default `https://eg.checkout.paymob.com/`.

   **Confirm both against your Paymob account's documentation.** Paymob's public docs don't show the full intention URL.
3. Deploy: `supabase functions deploy checkout` and `supabase functions deploy paymob-webhook`.
4. In Paymob's dashboard, set the integration's **Transaction processed callback** to `https://<project-ref>.supabase.co/functions/v1/paymob-webhook`. The checkout also sends this address with every payment.
5. In the website's hosting settings, add `VITE_CARD_PAYMENTS=on` and rebuild. The card option is greyed out ("قريباً") until then.
6. Optional: enable `pg_cron` and run `supabase/cron.sql`, so unpaid orders also expire on quiet days. They already expire whenever someone orders or opens a tracking page.
7. **Sandbox test:** place a card order with one of Paymob's published test cards (see Paymob's docs).
   - Check that the order turns *paid* in the admin panel.
   - Try a declined test card, and let one order expire.
   - In Supabase → Table Editor → `payment_events`, check every outcome.

**Safety switch:** the functions **refuse live keys** (keys containing `_live_`) unless `PAYMOB_MODE=live` is set. **Don't switch to live without the owner's explicit approval** and a successful sandbox test.

### Try the full shop locally, without Supabase

`npm run dev:backend` starts a local stand-in for Supabase on port 54321. It runs the real database migrations (in-memory Postgres) and the real checkout logic, with the demo products loaded. Then in a second terminal:
```bash
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=local npm run dev
```
Add `VITE_CARD_PAYMENTS=on` to try card payments too. They use a **fake Paymob page** served by the local backend, clearly labelled, with "successful payment" and "declined" buttons. It sends properly signed notifications to the real webhook code. No real money is involved and Paymob isn't contacted.

Everything resets when it stops. It's for trying and demoing only; never deploy it. The admin panel still uses `/#/admin?mock` locally.

### Using the admin panel

Open `your-site.com/#/admin` (bookmark it on the owner's phone). The link is not shown anywhere on the public site.

- **Orders (الطلبات, the first tab):** every order from the website, newest first. Filter by status, or search by order number, name or phone. It refreshes every minute.
  - Open an order to see the customer's full name, phone, address and notes, with buttons to **call** them or **send a ready-made WhatsApp message** for the current step.
  - Move it along with one tap: *تأكيد الطلب* → *بدء التجهيز* → *تسليم للمندوب* → *تم التوصيل*. Only the valid next step is offered, and an optional note is saved in the order's history.
  - *إلغاء الطلب* (before delivery, including a parcel that comes back) **puts the pieces back in stock automatically, once**.
  - For cash on delivery, *تم التوصيل* records the cash as collected. A card order is never marked paid by hand; only the verified payment confirmation can do that (Stage 4).
  - The customer's tracking page shows each step as it happens.
  - If two people change the same order at the same time, the second one is told it changed and the screen refreshes.
- **Delivery (التوصيل):** change the fee for each governorate, switch a zone off (customers stop seeing it), or add a new one. A new fee applies to new orders only.
- **Add a product:** *منتج جديد* → photos, name, category, then the sizes → *حفظ*. It appears on the site immediately.
- **Sizes:** each size has its own **price**, optional **before-discount price** and **quantity**. Tap the quick buttons (S, M, L, …) or *+ مقاس آخر* for any size (e.g. 32, 4 years). *سعر واحد لكل المقاسات* fills the same price into every size.
- **Photos:** up to 8 per product, straight from the phone camera or gallery. The first one is the main photo; use the arrows to reorder. They are resized and converted to WebP automatically (max 1000px, typically under 100 KB). Customers can tap a product photo to see them all.
- **Stock:** the *المخزون* tab lists every size of every product. Use + / − or type a number and press *حفظ*. *قرّب يخلص أو خلص* shows only sizes with 3 or fewer pieces left. In the shop, sold-out sizes can't be chosen, a size with 3 or fewer shows "متبقي N فقط", and customers can't add more than the available quantity to the cart.
- **Hide a product** without deleting it: *إخفاء* (e.g. when you don't have it today).
- **Discount:** fill in *قبل الخصم* on a size. The site shows the percentage off automatically.
- **Categories:** the *الأقسام* tab. A category can only be deleted once it has no products.

Saving a product is one all-or-nothing database step (`admin_save_product`). The database checks that the account is an admin, that every price is above zero, that quantities aren't negative, that the before-discount price is higher, that no size is repeated, and that there are no more than 8 photos. If anything is wrong, nothing is changed.

### What is still edited in code

`src/data/site.js` holds the address, phone numbers, WhatsApp number, opening hours and social links. These change rarely, so they stay in a file for now. Moving them into the admin panel is a small extension if the owner wants it.

## Deploying (free)

The build output is a static folder (`dist/`), so any static host works:

- **Netlify:** connect the Git repo (build `npm run build`, publish `dist`) or drag the `dist` folder onto app.netlify.com/drop. Add the two `VITE_SUPABASE_*` variables under *Site settings → Environment variables* **before** building.
- **Vercel / Cloudflare Pages:** import the repo (Vite is detected automatically) and add the same two variables.

Environment variables are baked in at build time, so re-deploy after changing them. After that, add a custom domain and update the `og:` tags in `index.html`.

## Before going live: checklist

- [ ] Supabase project created, all migrations run, owner user created **and added to `admin_users`**, public sign-up turned off
- [ ] The manual security checks in `tests/README.md` done on the real project
- [ ] Owner confirms the address (then set `addressConfirmed: true` to show the map and directions), phone numbers, WhatsApp number and opening hours (`site.js`)
- [ ] Facebook / Instagram / TikTok links added (the Facebook QR on the sign has no readable URL)
- [ ] Real products and photos added through the admin panel
- [ ] **Real delivery fees** set in the admin panel → *التوصيل* (the current ones are placeholders)
- [ ] Checkout function deployed, `SITE_ORIGINS` / `SITE_URL` set to the real site address, and one real test order placed and checked in the database
- [ ] Card payments: Paymob **test** keys set as secrets, `paymob-webhook` deployed, callback URL set in Paymob, sandbox payments tested (paid, declined, expired)
- [ ] **Live payments only with the owner's explicit approval:** live keys plus `PAYMOB_MODE=live`, then one small real payment refunded from the Paymob dashboard
- [ ] Owner confirms the claims in the rotating hero headlines ("براندات", "كل أسبوع", "أطفال") are true. Edit them in `src/lib/i18n.jsx` (`heroTitles`)
- [ ] Add a 1200×630 PNG social-share image and an `og:image` tag
- [ ] Policy pages filled in by the owner (`src/data/policies.js`, then `policiesApproved = true`)
- [ ] Security headers active on the host (`public/_headers` or `vercel.json`); check with securityheaders.com

## Project structure

```
supabase/migrations/       database tables and security rules, one numbered file per change
tests/                     automated database security tests (`npm test`)
src/data/site.js           shop details (address, phones, hours, social)
src/data/products.js       demo products (used only when no database is connected)
src/lib/product.js         turns database rows / demo entries into one product shape (sizes, prices, stock, photos)
src/lib/catalog.js         search, filters and sorting (pure functions, tested)
src/lib/store.jsx          loads products/categories (database or demo file)
src/lib/i18n.jsx           all Arabic/English text, hero headlines
src/components/            public site sections
src/admin/                 admin panel (loaded as its own chunk; customers never download it)
src/components/CheckoutPage.jsx, OrderPage.jsx   checkout and order tracking
supabase/functions/        Edge Functions (server side): checkout, paymob-webhook; shared, tested logic in _shared/
supabase/cron.sql          optional: expire unpaid card orders every 5 minutes (needs pg_cron)
scripts/local-backend.mjs  dev-only local stand-in for Supabase (npm run dev:backend)
src/dev/mockSupabase.js    dev-only fake database: try the panel offline at /#/admin?mock
```

To try the admin panel without a database while developing: `npm run dev`, open `/#/admin?mock`, log in with `owner@test.com` / `123456` (admin) or `customer@test.com` / `123456` (a non-admin, which is refused). Changes live only in memory. This mock is not included in production builds.

## Limits to know about

- Refunds of card payments are done in Paymob's dashboard, not on this site.
- Card payments have been tested against a fake Paymob only. The first real test must be a Paymob **sandbox** payment with your test keys. Real inventory counts, order history or online payment need more backend work (and an Egyptian payment gateway such as Paymob or Fawry with a merchant account).
- The product list is loaded once per visit; customers see changes on their next page load.

## Tech

React 18, Vite 6, Tailwind CSS 4, and `@supabase/supabase-js` (admin panel only). The public site talks to the database over plain `fetch`. Fonts: Cairo (Arabic) and Nunito (wordmark) from Google Fonts.
