// DEV ONLY — an in-memory stand-in for Supabase so the admin panel can be tried and tested offline.
// Open  /#/admin?mock   (admin: owner@test.com / 123456, non-admin: customer@test.com / 123456).
// Not included in production builds. The real rules live in supabase/migrations and are tested by `npm test`.
export function createMock() {
  const now = () => new Date().toISOString()
  const uid = () => 'id' + Math.random().toString(36).slice(2, 10)
  const db = {
    categories: [
      { id: 'men', name_ar: 'رجالي', name_en: 'Men', art_type: 'shirt', art_color: '#2b2a2f', art_bg: '#e9e7e3', created_at: '2026-01-01' },
      { id: 'women', name_ar: 'حريمي', name_en: 'Women', art_type: 'dress', art_color: '#e3262d', art_bg: '#f6e4e2', created_at: '2026-01-02' },
      { id: 'kids', name_ar: 'أطفال', name_en: 'Kids', art_type: 'tee', art_color: '#f2b705', art_bg: '#fbf1cf', created_at: '2026-01-03' },
    ],
    products: [
      { id: 'p1', name_ar: 'قميص تجريبي', name_en: 'Test Shirt', category: 'men', is_new: true, featured: true, active: true, art_type: 'shirt', art_color: '#ffffff', art_bg: '#2b2a2f', created_at: '2026-02-01' },
      { id: 'p2', name_ar: 'فستان تجريبي', name_en: '', category: 'women', is_new: false, featured: false, active: false, art_type: 'dress', art_color: '#e3262d', art_bg: '#f6e4e2', created_at: '2026-02-02' },
    ],
    product_variants: [
      { id: 'v1', product_id: 'p1', size: 'M', price: 300, compare_at_price: 400, stock_qty: 5, position: 0 },
      { id: 'v2', product_id: 'p1', size: 'L', price: 320, compare_at_price: null, stock_qty: 1, position: 1 },
      { id: 'v3', product_id: 'p2', size: 'S', price: 450, compare_at_price: null, stock_qty: 0, position: 0 },
    ],
    product_images: [],
    shipping_zones: [
      { id: 'alexandria', name_ar: 'الإسكندرية', name_en: 'Alexandria', fee: 50, active: true, position: 0 },
      { id: 'cairo', name_ar: 'القاهرة والجيزة', name_en: 'Cairo and Giza', fee: 75, active: true, position: 1 },
      { id: 'upper', name_ar: 'الصعيد', name_en: 'Upper Egypt', fee: 90, active: true, position: 2 },
    ],
    orders: [
      { id: 'o1', order_number: 10001, customer_name: 'أحمد علي', phone: '01012345678', email: null, zone_id: 'alexandria', area: 'ميامي', address: '12 شارع خالد بن الوليد، الدور الثالث', notes: 'اتصل قبل ما تيجي', payment_method: 'cod', status: 'placed', payment_status: 'unpaid', subtotal: 600, shipping_fee: 50, total: 650, stock_released: false, created_at: new Date(Date.now() - 36e5).toISOString() },
      { id: 'o3', order_number: 10003, customer_name: 'كريم فؤاد', phone: '01222333444', email: 'karim@example.com', zone_id: 'alexandria', area: 'سيدي بشر', address: 'شارع جمال عبد الناصر 40', notes: null, payment_method: 'card', status: 'payment_failed', payment_status: 'paid', subtotal: 255, shipping_fee: 50, total: 305, stock_released: true, created_at: new Date(Date.now() - 60e5).toISOString() },
      { id: 'o2', order_number: 10002, customer_name: 'منى حسن', phone: '01155555555', email: null, zone_id: 'cairo', area: 'مدينة نصر', address: 'شارع عباس العقاد، عمارة 5', notes: null, payment_method: 'cod', status: 'shipped', payment_status: 'unpaid', subtotal: 320, shipping_fee: 75, total: 395, stock_released: false, created_at: new Date(Date.now() - 864e5).toISOString() },
    ],
    payment_events: [
      { id: 1, order_id: 'o3', transaction_id: '5501', amount_cents: 30500, currency: 'EGP', outcome: 'failed_attempt', created_at: new Date(Date.now() - 50e5).toISOString() },
      { id: 2, order_id: 'o3', transaction_id: '5502', amount_cents: 30500, currency: 'EGP', outcome: 'paid_after_cancel', created_at: new Date(Date.now() - 30e5).toISOString() },
    ],
    order_items: [
      { id: 'i1', order_id: 'o1', variant_id: 'v1', product_name_ar: 'قميص تجريبي', size: 'M', unit_price: 300, qty: 2, line_total: 600 },
      { id: 'i2', order_id: 'o2', variant_id: 'v2', product_name_ar: 'قميص تجريبي', size: 'L', unit_price: 320, qty: 1, line_total: 320 },
    ],
    order_status_history: [
      { id: 1, order_id: 'o1', from_status: null, to_status: 'placed', note: 'order placed', created_at: new Date(Date.now() - 36e5).toISOString() },
      { id: 2, order_id: 'o2', from_status: null, to_status: 'placed', note: 'order placed', created_at: new Date(Date.now() - 864e5).toISOString() },
      { id: 3, order_id: 'o2', from_status: 'placed', to_status: 'confirmed', note: null, created_at: new Date(Date.now() - 80e6).toISOString() },
      { id: 4, order_id: 'o2', from_status: 'confirmed', to_status: 'shipped', note: null, created_at: new Date(Date.now() - 7e6).toISOString() },
    ],
  }
  let session = null
  const listeners = new Set()
  const emit = () => listeners.forEach((fn) => fn(session ? 'SIGNED_IN' : 'SIGNED_OUT', session))
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 120))
  const denied = { data: null, error: { message: 'new row violates row-level security policy' } }

  const embed = (table, rows, select) => {
    if (table === 'orders') {
      return rows.map((o) => ({
        ...o,
        order_items: db.order_items.filter((i) => i.order_id === o.id).map((i) => ({ ...i })),
        order_status_history: db.order_status_history.filter((h) => h.order_id === o.id).map((h) => ({ ...h })),
        shipping_zones: { name_ar: db.shipping_zones.find((z) => z.id === o.zone_id)?.name_ar },
        payment_events: db.payment_events.filter((e) => e.order_id === o.id).map((e) => ({ ...e })),
      }))
    }
    if (table !== 'products') return rows
    return rows.map((r) => ({
      ...r,
      ...(select.includes('product_variants(') && { product_variants: db.product_variants.filter((v) => v.product_id === r.id).map((v) => ({ ...v })) }),
      ...(select.includes('product_images(') && { product_images: db.product_images.filter((i) => i.product_id === r.id).map((i) => ({ ...i })) }),
    }))
  }

  const from = (table) => {
    const q = { op: 'select', select: '*', filters: [], order: null, payload: null }
    const api = {
      select(s = '*') { if (q.op === 'select') q.select = s; return api },
      insert(p) { q.op = 'insert'; q.payload = p; return api },
      update(p) { q.op = 'update'; q.payload = p; return api },
      delete() { q.op = 'delete'; return api },
      eq(c, v) { q.filters.push([c, v]); return api },
      order(c, o = {}) { q.order = [c, o.ascending !== false]; return api },
      then(res, rej) { return wait(run()).then(res, rej) },
    }
    const match = (row) => q.filters.every(([c, v]) => row[c] === v)
    function run() {
      if (q.op !== 'select' && !session?.admin) return denied
      if (q.op === 'select') {
        let out = db[table].filter(match)
        if (q.order) out = [...out].sort((a, b) => (a[q.order[0]] > b[q.order[0]] ? 1 : -1) * (q.order[1] ? 1 : -1))
        return { data: embed(table, out, q.select), error: null }
      }
      if (q.op === 'insert') {
        const row = { id: uid(), created_at: now(), active: true, ...q.payload }
        db[table].push(row)
        return { data: [row], error: null }
      }
      if (q.op === 'update') {
        if (table === 'product_variants' && 'stock_qty' in q.payload && !(q.payload.stock_qty >= 0)) return { data: null, error: { message: 'violates check constraint' } }
        db[table].filter(match).forEach((r) => Object.assign(r, q.payload))
        return { data: null, error: null }
      }
      // delete
      if (table === 'categories' && db[table].filter(match).some((c) => db.products.some((p) => p.category === c.id))) {
        return { data: null, error: { code: '23503', message: 'violates foreign key constraint' } }
      }
      const gone = db[table].filter(match).map((r) => r.id)
      db[table] = db[table].filter((r) => !match(r))
      if (table === 'products') {
        db.product_variants = db.product_variants.filter((v) => !gone.includes(v.product_id))
        db.product_images = db.product_images.filter((i) => !gone.includes(i.product_id))
      }
      return { data: null, error: null }
    }
    return api
  }

  // Same rules as public.admin_save_product (supabase/migrations/…_variants_and_images.sql)
  function adminSaveProduct(p) {
    const fail = (message) => ({ data: null, error: { message } })
    if (!session?.admin) return fail('not authorized')
    if (!p.name_ar?.trim()) return fail('name_ar_required')
    if (!db.categories.some((c) => c.id === p.category)) return fail('unknown_category')
    if (!Array.isArray(p.variants) || !p.variants.length) return fail('variants_required')
    if ((p.images ?? []).length > 8) return fail('too_many_images')
    const seen = new Set()
    for (const v of p.variants) {
      const size = (v.size ?? '').trim()
      if (!size) return fail('size_required')
      if (seen.has(size.toLowerCase())) return fail('duplicate_size')
      seen.add(size.toLowerCase())
      if (!(v.price > 0) || !(v.stock_qty >= 0) || (v.compare_at_price != null && !(v.compare_at_price > v.price))) return fail('violates check constraint')
    }
    let id = p.id
    const fields = { name_ar: p.name_ar.trim(), name_en: p.name_en ?? '', category: p.category, is_new: !!p.is_new, featured: !!p.featured, active: p.active !== false, art_type: p.art_type, art_color: p.art_color, art_bg: p.art_bg }
    if (id) {
      const row = db.products.find((r) => r.id === id)
      if (!row) return fail('product_not_found')
      Object.assign(row, fields)
    } else {
      id = uid()
      db.products.push({ id, created_at: now(), ...fields })
    }
    const keep = p.variants.filter((v) => v.id).map((v) => v.id)
    db.product_variants = db.product_variants.filter((v) => v.product_id !== id || keep.includes(v.id))
    p.variants.forEach((v, position) => {
      const row = { size: v.size.trim(), price: v.price, compare_at_price: v.compare_at_price ?? null, stock_qty: v.stock_qty, position }
      const existing = v.id && db.product_variants.find((x) => x.id === v.id && x.product_id === id)
      if (existing) Object.assign(existing, row)
      else db.product_variants.push({ id: uid(), product_id: id, ...row })
    })
    db.product_images = db.product_images.filter((i) => i.product_id !== id)
    ;(p.images ?? []).forEach((img, position) => db.product_images.push({ id: uid(), product_id: id, url: img.url, storage_path: img.storage_path ?? null, position }))
    return { data: id, error: null }
  }

  // Same rules as public.admin_set_order_status (supabase/migrations/…_admin_orders.sql)
  function adminSetOrderStatus({ p_order_id, p_status, p_expected_status, p_note }) {
    if (!session?.admin) return { data: null, error: { message: 'not authorized' } }
    const next = { placed: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['shipped', 'cancelled'], shipped: ['delivered', 'cancelled'], pending_payment: ['cancelled'] }
    const o = db.orders.find((x) => x.id === p_order_id)
    if (!o) return { data: { ok: false, error: 'not_found' }, error: null }
    if (p_expected_status && o.status !== p_expected_status) return { data: { ok: false, error: 'status_changed', status: o.status }, error: null }
    if (!(next[o.status] ?? []).includes(p_status)) return { data: { ok: false, error: 'invalid_transition', status: o.status }, error: null }
    const from = o.status
    if (p_status === 'cancelled' && !o.stock_released) {
      for (const i of db.order_items.filter((x) => x.order_id === o.id)) {
        const v = db.product_variants.find((x) => x.id === i.variant_id)
        if (v) v.stock_qty += i.qty
      }
      o.stock_released = true
      if (o.payment_status === 'pending') o.payment_status = 'failed'
    }
    if (p_status === 'delivered' && o.payment_method === 'cod') o.payment_status = 'paid'
    o.status = p_status
    db.order_status_history.push({ id: db.order_status_history.length + 1, order_id: o.id, from_status: from, to_status: p_status, note: p_note || (p_status === 'delivered' && o.payment_method === 'cod' ? 'cash collected' : null), created_at: now() })
    return { data: { ok: true, status: p_status, payment_status: o.payment_status }, error: null }
  }

  return {
    from,
    rpc: async (fn, args) => {
      await wait()
      if (fn === 'is_admin') return { data: !!session?.admin, error: null }
      if (fn === 'admin_save_product') return adminSaveProduct(args.payload)
      if (fn === 'admin_set_order_status') return adminSetOrderStatus(args)
      return { data: null, error: { message: 'unknown rpc' } }
    },
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (fn) => {
        listeners.add(fn)
        return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } }
      },
      signInWithPassword: async ({ email, password }) => {
        await wait()
        if ((email === 'owner@test.com' || email === 'customer@test.com') && password === '123456') {
          session = { user: { id: email, email }, admin: email === 'owner@test.com' }
          emit()
          return { data: { session }, error: null }
        }
        return { data: null, error: { message: 'Invalid login credentials' } }
      },
      signOut: async () => {
        session = null
        emit()
        return { error: null }
      },
    },
    storage: {
      from: () => ({
        upload: async (path) => wait({ data: { path }, error: null }),
        getPublicUrl: (path) => ({ data: { publicUrl: `https://placehold.co/800x1000/e3262d/ffffff.png?text=${encodeURIComponent(path.slice(0, 6))}` } }),
        remove: async (paths) => {
          ;(window.__mockRemoved ??= []).push(...paths)
          return { data: null, error: null }
        },
      }),
    },
  }
}
