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
  }
  let session = null
  const listeners = new Set()
  const emit = () => listeners.forEach((fn) => fn(session ? 'SIGNED_IN' : 'SIGNED_OUT', session))
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 120))
  const denied = { data: null, error: { message: 'new row violates row-level security policy' } }

  const embed = (table, rows, select) => {
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

  return {
    from,
    rpc: async (fn, args) => {
      await wait()
      if (fn === 'is_admin') return { data: !!session?.admin, error: null }
      if (fn === 'admin_save_product') return adminSaveProduct(args.payload)
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
