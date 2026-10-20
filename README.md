# Yahya Stock — يحيى استوك

Website for Yahya Stock, a stock-clothing shop in Miami, Alexandria. Arabic-first (RTL) with an English toggle. The colours come from the shop sign: charcoal `#2b2a2f`, red `#e3262d`, white.

It has two modes:

| Mode | When | Products come from |
|---|---|---|
| **Demo** | No database connected (default) | The sample file `src/data/products.js`. Pages are labelled "demo" |
| **Live** | Supabase connected (steps below) | The database, edited by the owner from the admin panel at `/#/admin` |

> ⚠️ The address, phone numbers and links come from the shop sign and public listings. The owner must confirm them in `src/data/site.js`.

## Run it locally

You need Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # serve the built site locally
```

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
4. **Set the real delivery fees.** The fees in the database (Alexandria 50, Cairo 75, …) are **placeholders**. Change them in *Table Editor → shipping_zones* (an admin screen for this comes in Stage 3).

The cart then shows *إتمام الطلب* (checkout). Customers fill in their name, mobile, governorate, area and address and choose cash on delivery. The order is saved, the stock is reserved, and they land on a private tracking page (`/#/order/…`). Ordering on WhatsApp stays available as a second option.

How checkout stays safe:
- **Prices:** the browser only sends *which size* and *how many*. Prices, delivery fee and total are read from the database inside `place_order()`. If the total the customer saw no longer matches (a price changed), nothing is saved and the customer is shown the new total to confirm.
- **Stock:** sizes are locked while an order is placed, so the last piece can only be sold once.
- **Privacy:** orders can't be read from the browser at all, except by the admin. A customer sees only their own order, through a secret 43-character link. Only its fingerprint (SHA-256) is stored, and the link page never shows the full address or phone.
- **Abuse:** at most 5 orders per hour per device and per phone number.

### Try the full shop locally, without Supabase

`npm run dev:backend` starts a local stand-in for Supabase on port 54321. It runs the real database migrations (in-memory Postgres) and the real checkout logic, with the demo products loaded. Then in a second terminal:
```bash
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=local npm run dev
```
Everything resets when it stops. It's for trying and demoing only; never deploy it. The admin panel still uses `/#/admin?mock` locally.

### Using the admin panel

Open `your-site.com/#/admin` (bookmark it on the owner's phone). The link is not shown anywhere on the public site.

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
- [ ] Owner confirms the address, phone numbers, WhatsApp number and opening hours (`site.js`)
- [ ] Facebook / Instagram / TikTok links added (the Facebook QR on the sign has no readable URL)
- [ ] Real products and photos added through the admin panel
- [ ] **Real delivery fees** set in `shipping_zones` (the current ones are placeholders)
- [ ] Checkout function deployed, `SITE_ORIGINS` / `SITE_URL` set to the real site address, and one real test order placed and checked in the database
- [ ] Owner confirms the claims in the rotating hero headlines ("براندات", "كل أسبوع", "أطفال") are true. Edit them in `src/lib/i18n.jsx` (`heroTitles`)
- [ ] Add a 1200×630 PNG social-share image and an `og:image` tag

## Project structure

```
supabase/migrations/       database tables and security rules, one numbered file per change
tests/                     automated database security tests (`npm test`)
src/data/site.js           shop details (address, phones, hours, social)
src/data/products.js       demo products (used only when no database is connected)
src/lib/product.js         turns database rows / demo entries into one product shape (sizes, prices, stock, photos)
src/lib/store.jsx          loads products/categories (database or demo file)
src/lib/i18n.jsx           all Arabic/English text, hero headlines
src/components/            public site sections
src/admin/                 admin panel (loaded as its own chunk; customers never download it)
src/components/CheckoutPage.jsx, OrderPage.jsx   checkout and order tracking
supabase/functions/        Edge Functions (server side): checkout; shared logic in _shared/
scripts/local-backend.mjs  dev-only local stand-in for Supabase (npm run dev:backend)
src/dev/mockSupabase.js    dev-only fake database: try the panel offline at /#/admin?mock
```

To try the admin panel without a database while developing: `npm run dev`, open `/#/admin?mock`, log in with `owner@test.com` / `123456` (admin) or `customer@test.com` / `123456` (a non-admin, which is refused). Changes live only in memory. This mock is not included in production builds.

## Limits to know about

- Order management in the admin panel (seeing orders, changing their status) comes in Stage 3, and card payments in Stage 4. Until then, read orders in Supabase → *Table Editor → orders*. Real inventory counts, order history or online payment need more backend work (and an Egyptian payment gateway such as Paymob or Fawry with a merchant account).
- The product list is loaded once per visit; customers see changes on their next page load.

## Tech

React 18, Vite 6, Tailwind CSS 4, and `@supabase/supabase-js` (admin panel only). The public site talks to the database over plain `fetch`. Fonts: Cairo (Arabic) and Nunito (wordmark) from Google Fonts.
