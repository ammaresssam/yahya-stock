import { useCallback, useEffect, useRef, useState } from 'react'
import supabase from '../lib/supabase'
import { Wordmark } from '../components/Brand'
import ProductsTab from './Products'
import CategoriesTab from './Categories'
import { Toast } from './ui'

function useAdminPage() {
  useEffect(() => {
    const root = document.documentElement
    const prev = { lang: root.lang, dir: root.dir, title: document.title }
    root.lang = 'ar'
    root.dir = 'rtl'
    document.title = 'لوحة التحكم | يحيى استوك'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex,nofollow'
    document.head.appendChild(meta)
    return () => {
      root.lang = prev.lang
      root.dir = prev.dir
      document.title = prev.title
      meta.remove()
    }
  }, [])
}

export default function Admin() {
  useAdminPage()
  const [session, setSession] = useState(undefined) // undefined = still checking

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!supabase) return <Shell><SetupNotice /></Shell>
  if (session === undefined) return <Shell><p className="py-20 text-center text-muted">جاري التحميل…</p></Shell>
  if (!session) return <Shell><Login /></Shell>
  return <Shell onLogout={() => supabase.auth.signOut()}><Panel /></Shell>
}

function Shell({ children, onLogout }) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="bg-ink text-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Wordmark className="h-10 w-auto" title="يحيى استوك" />
          <span className="ms-1 rounded-full bg-white/10 px-3 py-1 text-sm font-bold">لوحة التحكم</span>
          <div className="ms-auto flex items-center gap-2">
            <a href="#/" onClick={() => { location.hash = '' }} className="rounded-full px-3 py-2 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white">
              عرض الموقع
            </a>
            {onLogout && (
              <button type="button" onClick={onLogout} className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-brand">
                تسجيل الخروج
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">{children}</main>
    </div>
  )
}

function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl rounded-[28px] bg-white p-7 ring-1 ring-line">
      <h1 className="text-2xl font-black text-ink">قاعدة البيانات لسه متوصلتش</h1>
      <p className="mt-3 leading-relaxed text-muted">
        لوحة التحكم محتاجة مشروع Supabase. اتبع خطوات «لوحة التحكم» في ملف README، وبعدها ضيف
        <code dir="ltr" className="mx-1 rounded bg-paper px-1.5 py-0.5 text-sm">VITE_SUPABASE_URL</code>
        و
        <code dir="ltr" className="mx-1 rounded bg-paper px-1.5 py-0.5 text-sm">VITE_SUPABASE_ANON_KEY</code>
        في ملف <code dir="ltr" className="rounded bg-paper px-1.5 py-0.5 text-sm">.env.local</code> وأعد تشغيل الموقع.
      </p>
      <p className="mt-3 text-sm text-muted">لحد ما يحصل ده، الموقع بيعرض المنتجات التجريبية من ملف <span dir="ltr">products.js</span>.</p>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError('الإيميل أو كلمة السر غير صحيحة')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-6 grid max-w-sm gap-4 rounded-[28px] bg-white p-7 ring-1 ring-line">
      <h1 className="text-2xl font-black text-ink">تسجيل الدخول</h1>
      <div>
        <label htmlFor="l-email" className="field-label">الإيميل</label>
        <input id="l-email" type="email" dir="ltr" autoComplete="username" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="l-pass" className="field-label">كلمة السر</label>
        <input id="l-pass" type="password" dir="ltr" autoComplete="current-password" required className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="rounded-2xl bg-brand/10 p-3 font-bold text-brand">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-red h-12 text-lg">{busy ? 'جاري الدخول…' : 'دخول'}</button>
    </form>
  )
}

function Panel() {
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState(null)
  const [categories, setCategories] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [toast, setToast] = useState(null)
  const timer = useRef()

  const notify = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const refresh = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('created_at', { ascending: true }),
    ])
    if (p.error || c.error) return setLoadError(true)
    setLoadError(false)
    setProducts(p.data)
    setCategories(c.data)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (loadError) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-line">
        <p className="font-bold text-ink">تعذر تحميل البيانات</p>
        <p className="mt-1 text-sm text-muted">اتأكد إنك شغلت ملف schema.sql في Supabase وإن النت شغال.</p>
        <button type="button" onClick={refresh} className="btn btn-ink mt-4 h-11 px-6">إعادة المحاولة</button>
      </div>
    )
  }
  if (!products || !categories) return <p className="py-20 text-center text-muted">جاري التحميل…</p>

  const tabs = [
    ['products', `المنتجات (${products.length})`],
    ['categories', `الأقسام (${categories.length})`],
  ]

  return (
    <>
      <div role="tablist" className="mb-5 flex gap-2">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} className="filter-tab">
            {label}
          </button>
        ))}
      </div>
      {tab === 'products' ? (
        <ProductsTab products={products} categories={categories} refresh={refresh} notify={notify} />
      ) : (
        <CategoriesTab products={products} categories={categories} refresh={refresh} notify={notify} />
      )}
      <Toast toast={toast} />
    </>
  )
}
