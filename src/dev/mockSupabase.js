// DEV ONLY — an in-memory stand-in for Supabase so the admin panel can be tried and tested offline.
// Open  /#/admin?mock   (admin: owner@test.com / 123456, non-admin: customer@test.com / 123456).
// Not included in production builds.
export function createMock() {
  const db = {
    categories: [
      { id: 'men', name_ar: 'رجالي', name_en: 'Men', art_type: 'shirt', art_color: '#2b2a2f', art_bg: '#e9e7e3', created_at: '2026-01-01' },
      { id: 'women', name_ar: 'حريمي', name_en: 'Women', art_type: 'dress', art_color: '#e3262d', art_bg: '#f6e4e2', created_at: '2026-01-02' },
      { id: 'kids', name_ar: 'أطفال', name_en: 'Kids', art_type: 'tee', art_color: '#f2b705', art_bg: '#fbf1cf', created_at: '2026-01-03' },
    ],
    products: [
      { id: 'p1', name_ar: 'قميص تجريبي', name_en: 'Test Shirt', category: 'men', price: 300, old_price: 400, sizes: ['M', 'L'], stock: 'in', is_new: true, featured: true, active: true, image_url: null, art_type: 'shirt', art_color: '#ffffff', art_bg: '#2b2a2f', created_at: '2026-02-01' },
      { id: 'p2', name_ar: 'فستان تجريبي', name_en: '', category: 'women', price: 450, old_price: null, sizes: ['S', 'M'], stock: 'low', is_new: false, featured: false, active: false, image_url: null, art_type: 'dress', art_color: '#e3262d', art_bg: '#f6e4e2', created_at: '2026-02-02' },
    ],
  }
  let session = null
  const listeners = new Set()
  const emit = () => listeners.forEach((fn) => fn(session ? 'SIGNED_IN' : 'SIGNED_OUT', session))
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 150))

  const from = (table) => {
    const q = { op: 'select', filters: [], order: null, payload: null }
    const api = {
      select() { return api },
      insert(p) { q.op = 'insert'; q.payload = p; return api },
      update(p) { q.op = 'update'; q.payload = p; return api },
      delete() { q.op = 'delete'; return api },
      eq(c, v) { q.filters.push([c, v]); return api },
      order(c, o = {}) { q.order = [c, o.ascending !== false]; return api },
      then(res, rej) { return wait(run()).then(res, rej) },
    }
    const match = (row) => q.filters.every(([c, v]) => row[c] === v)
    function run() {
      const rows = db[table]
      if (q.op !== 'select' && !session?.admin) return { data: null, error: { message: 'new row violates row-level security policy' } }
      if (q.op === 'select') {
        let out = rows.filter(match)
        if (q.order) out = [...out].sort((a, b) => (a[q.order[0]] > b[q.order[0]] ? 1 : -1) * (q.order[1] ? 1 : -1))
        return { data: out, error: null }
      }
      if (q.op === 'insert') {
        const row = { id: 'id' + Math.random().toString(36).slice(2, 8), created_at: new Date().toISOString(), active: true, ...q.payload }
        rows.push(row)
        return { data: [row], error: null }
      }
      if (q.op === 'update') {
        rows.filter(match).forEach((r) => Object.assign(r, q.payload))
        return { data: null, error: null }
      }
      if (table === 'categories' && rows.filter(match).some((c) => db.products.some((p) => p.category === c.id))) {
        return { data: null, error: { code: '23503', message: 'violates foreign key constraint' } }
      }
      db[table] = rows.filter((r) => !match(r))
      return { data: null, error: null }
    }
    return api
  }

  return {
    from,
    rpc: async (fn) => (fn === 'is_admin' ? wait({ data: !!session?.admin, error: null }) : { data: null, error: { message: 'unknown rpc' } }),
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
        remove: async () => ({ data: null, error: null }),
      }),
    },
  }
}
