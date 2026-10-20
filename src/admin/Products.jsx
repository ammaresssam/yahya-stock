import { useMemo, useState } from 'react'
import supabase from '../lib/supabase'
import GarmentArt from '../components/GarmentArt'
import { PlusIcon, TrashIcon } from '../components/Icons'
import ProductForm from './ProductForm'
import { STOCK } from './ui'

const BUCKET = 'product-images'

export default function ProductsTab({ products, categories, refresh, notify }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [editing, setEditing] = useState(null) // null | 'new' | product row

  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name_ar])), [categories])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return products.filter(
      (p) =>
        (cat === 'all' || p.category === cat) &&
        (!term || p.name_ar.toLowerCase().includes(term) || (p.name_en || '').toLowerCase().includes(term)),
    )
  }, [products, q, cat])

  const patch = async (p, changes, msg) => {
    const { error } = await supabase.from('products').update(changes).eq('id', p.id)
    if (error) return notify('تعذر الحفظ', 'error')
    notify(msg)
    refresh()
  }

  const remove = async (p) => {
    if (!window.confirm(`حذف «${p.name_ar}» نهائياً؟\n(لو عايز تخفيه بس، استخدم زر الإخفاء)`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) return notify('تعذر الحذف', 'error')
    if (p.image_url?.includes(`/${BUCKET}/`)) await supabase.storage.from(BUCKET).remove([p.image_url.split(`/${BUCKET}/`)[1]])
    notify('تم حذف المنتج')
    refresh()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="بحث عن منتج"
          placeholder="ابحث عن منتج…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="field h-11 min-w-0 flex-1 basis-48 bg-white"
        />
        <select aria-label="فلتر القسم" value={cat} onChange={(e) => setCat(e.target.value)} className="field h-11 w-auto bg-white">
          <option value="all">كل الأقسام</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
        </select>
        <button type="button" onClick={() => setEditing('new')} className="btn btn-red h-11 px-5">
          <PlusIcon className="size-5" />
          منتج جديد
        </button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-line">
          <p className="text-lg font-bold text-ink">لسه مفيش منتجات</p>
          <p className="mt-1 text-muted">دوس «منتج جديد» وضيف أول منتج — هيظهر في الموقع على طول.</p>
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-3xl bg-white p-10 text-center text-muted ring-1 ring-line">مفيش نتائج.</p>
      ) : (
        <ul className="grid gap-3">
          {list.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center gap-3 rounded-[22px] bg-white p-3 ring-1 ring-line ${p.active ? '' : 'opacity-60'}`}>
              <div className="size-20 shrink-0 overflow-hidden rounded-2xl">
                {p.image_url ? (
                  <img src={p.image_url} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  <GarmentArt type={p.art_type} color={p.art_color} bg={p.art_bg} className="size-full p-1.5" />
                )}
              </div>

              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate font-black text-ink">{p.name_ar}</p>
                <p className="text-sm text-muted">
                  {catName[p.category] ?? '—'} · <b className="text-brand">{p.price} ج.م</b>
                  {p.old_price ? <s className="ms-1.5">{p.old_price}</s> : null}
                </p>
                <p dir="ltr" className="truncate text-start text-xs text-muted">{p.sizes.join(' · ')}</p>
                {!p.active && <span className="badge mt-1 inline-block bg-ink text-white">مخفي عن الموقع</span>}
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <select
                  aria-label={`التوفر — ${p.name_ar}`}
                  value={p.stock}
                  onChange={(e) => patch(p, { stock: e.target.value }, 'تم تحديث التوفر ✓')}
                  className="h-10 rounded-full border border-line bg-white px-3 text-sm font-bold"
                >
                  {Object.entries(STOCK).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => patch(p, { active: !p.active }, p.active ? 'تم إخفاء المنتج' : 'المنتج ظاهر الآن ✓')}
                  className="btn h-10 border border-line px-4 text-sm hover:border-ink"
                >
                  {p.active ? 'إخفاء' : 'إظهار'}
                </button>
                <button type="button" onClick={() => setEditing(p)} className="btn btn-ink h-10 px-4 text-sm">تعديل</button>
                <button type="button" onClick={() => remove(p)} aria-label={`حذف ${p.name_ar}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-paper hover:text-brand">
                  <TrashIcon className="size-5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh() }}
          notify={notify}
        />
      )}
    </div>
  )
}
