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
2. **Create the tables:** *SQL Editor* → *New query* → paste the entire contents of `supabase/schema.sql` → **Run**. This creates the products and categories tables, the photo bucket, the security rules and the starting categories (رجالي / حريمي / أطفال).
3. **Create the owner's login:** *Authentication → Users → Add user → Create new user*. Enter the owner's email and a strong password, and tick *Auto Confirm User*.
4. **Close public sign-up (important):** *Authentication → Sign In / Providers* → switch **off** *Allow new users to sign up*. Otherwise anyone could register an account and edit your products.
5. **Copy the two keys:** *Project Settings → API*. Copy the **Project URL** and the **anon / publishable** key. Copy `.env.example` to `.env.local` and paste them in:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   The anon key is public by design; the security rules in `schema.sql` are what protect your data. **Never** use the `service_role` key anywhere in this project.
6. Restart `npm run dev` and open **`http://localhost:5173/#/admin`**. Log in with the account from step 3.

When deploying (below), add the same two variables in your host's *Environment variables* settings.

### Using the admin panel

Open `your-site.com/#/admin` (bookmark it on the owner's phone). The link is not shown anywhere on the public site.

- **Add a product:** *منتج جديد* → name, category, price, sizes, availability, photo → *حفظ*. It appears on the site immediately.
- **Change availability:** the dropdown on each product row (متاح / كمية محدودة / نفدت الكمية) saves instantly.
- **Hide a product** without deleting it: *إخفاء* (e.g. when you don't have it today).
- **Discount:** fill in *السعر قبل الخصم*. The site shows the percentage off automatically.
- **Photos:** upload straight from the phone camera or gallery. They are resized and converted to WebP automatically (max 1000px, typically under 100 KB).
- **Categories:** the *الأقسام* tab. A category can only be deleted once it has no products.

### What is still edited in code

`src/data/site.js` holds the address, phone numbers, WhatsApp number, opening hours and social links. These change rarely, so they stay in a file for now. Moving them into the admin panel is a small extension if the owner wants it.

## Deploying (free)

The build output is a static folder (`dist/`), so any static host works:

- **Netlify:** connect the Git repo (build `npm run build`, publish `dist`) or drag the `dist` folder onto app.netlify.com/drop. Add the two `VITE_SUPABASE_*` variables under *Site settings → Environment variables* **before** building.
- **Vercel / Cloudflare Pages:** import the repo (Vite is detected automatically) and add the same two variables.

Environment variables are baked in at build time, so re-deploy after changing them. After that, add a custom domain and update the `og:` tags in `index.html`.

## Before going live: checklist

- [ ] Supabase project created, `schema.sql` run, owner user created, **public sign-up turned off**
- [ ] Owner confirms the address, phone numbers, WhatsApp number and opening hours (`site.js`)
- [ ] Facebook / Instagram / TikTok links added (the Facebook QR on the sign has no readable URL)
- [ ] Real products and photos added through the admin panel
- [ ] Owner confirms the claims in the rotating hero headlines ("براندات", "كل أسبوع", "أطفال") are true. Edit them in `src/lib/i18n.jsx` (`heroTitles`)
- [ ] Add a 1200×630 PNG social-share image and an `og:image` tag

## Project structure

```
supabase/schema.sql        database tables, security rules, photo bucket
src/data/site.js           shop details (address, phones, hours, social)
src/data/products.js       demo products (used only when no database is connected)
src/lib/store.jsx          loads products/categories (database or demo file)
src/lib/i18n.jsx           all Arabic/English text, hero headlines
src/components/            public site sections
src/admin/                 admin panel (loaded as its own chunk; customers never download it)
src/dev/mockSupabase.js    dev-only fake database: try the panel offline at /#/admin?mock
```

To try the admin panel without a database while developing: `npm run dev`, open `/#/admin?mock`, log in with `owner@test.com` / `123456`. Changes live only in memory. This mock is not included in production builds.

## Limits to know about

- Stock is a status (available / limited / sold out), not a counted quantity, and orders go to WhatsApp rather than being stored. Real inventory counts, order history or online payment need more backend work (and an Egyptian payment gateway such as Paymob or Fawry with a merchant account).
- Each product has one photo.
- The product list is loaded once per visit; customers see changes on their next page load.

## Tech

React 18, Vite 6, Tailwind CSS 4, and `@supabase/supabase-js` (admin panel only). The public site talks to the database over plain `fetch`. Fonts: Cairo (Arabic) and Nunito (wordmark) from Google Fonts.
