import { as, sql } from './db.js'

export const OWNER = '00000000-0000-0000-0000-00000000000a'
export const CUSTOMER = '00000000-0000-0000-0000-00000000000c'
export const visitor = { role: 'anon' }
export const customer = { role: 'authenticated', uid: CUSTOMER }
export const owner = { role: 'authenticated', uid: OWNER }
export const server = { role: 'service_role' }

export const V = {
  shirtM: '10000000-0000-0000-0000-000000000001', // 300 EGP, stock 5
  shirtL: '10000000-0000-0000-0000-000000000002', // 320 EGP, stock 1
  hiddenM: '10000000-0000-0000-0000-000000000003', // product hidden
  offSize: '10000000-0000-0000-0000-000000000004', // size switched off
}

/** Owner + customer accounts, one visible shirt (M 300×5, L 320×1), a hidden product and an inactive size. */
export async function seedShop(db) {
  await sql(db, `insert into auth.users (id, email) values ($1, 'owner@shop.test'), ($2, 'c@mail.test')`, [OWNER, CUSTOMER])
  await sql(db, `insert into public.admin_users (user_id) values ($1)`, [OWNER])
  await sql(db, `
    insert into public.products (id, name_ar, name_en, category, active) values
      ('20000000-0000-0000-0000-000000000001', 'قميص', 'Shirt', 'men', true),
      ('20000000-0000-0000-0000-000000000002', 'مخفي', 'Hidden', 'men', false)`)
  await sql(db, `
    insert into public.product_variants (id, product_id, size, price, stock_qty, active) values
      ('${V.shirtM}', '20000000-0000-0000-0000-000000000001', 'M', 300, 5, true),
      ('${V.shirtL}', '20000000-0000-0000-0000-000000000001', 'L', 320, 1, true),
      ('${V.hiddenM}', '20000000-0000-0000-0000-000000000002', 'M', 100, 9, true),
      ('${V.offSize}', '20000000-0000-0000-0000-000000000001', 'XL', 300, 9, false)`)
}

export const stockOf = async (db, id) => (await sql(db, `select stock_qty from public.product_variants where id = $1`, [id]))[0].stock_qty

export const goodCustomer = (over = {}) => ({
  name: 'أحمد علي',
  phone: '01012345678',
  zone_id: 'alexandria',
  area: 'ميامي',
  address: '12 شارع خالد بن الوليد، الدور الثالث',
  ...over,
})

let tokenSeq = 0
export const fakeTokenHash = () => (++tokenSeq).toString(16).padStart(64, '0')

/** Calls place_order exactly as the Edge Function does (service role). */
export async function placeOrder(db, p, who = server) {
  const r = await as(db, who, (tx) => tx.query(`select public.place_order($1::jsonb) as r`, [JSON.stringify(p)]))
  return r.rows[0].r
}

/** supabase-js-like rpc() backed by PGlite, used to run the real checkout logic in tests. */
export const rpcVia = (db, who = server) => async (fn, args) => {
  try {
    const [name, value] = Object.entries(args)[0]
    const r = await as(db, who, (tx) => tx.query(`select public.${fn}(${name} => $1::jsonb) as r`, [JSON.stringify(value)]))
    return { data: r.rows[0].r, error: null }
  } catch (error) {
    return { data: null, error }
  }
}
