import { useMemo, useState } from 'react'
import supabase from '../lib/supabase'
import GarmentArt from '../components/GarmentArt'
import { PlusIcon, TrashIcon } from '../components/Icons'
import ProductForm from './ProductForm'
import { LOW_STOCK } from './ui'

const BUCKET = 'product-images'

export const sortedVariants = (p) => [...(p.product_variants ?? [])].sort((a, b) => a.position - b.position)
export const mainImage = (p) => [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0]?.url

export function priceRange(p) {
  const prices = (p.product_variants ?? []).map((v) => v.price)
  if (!prices.length) return '—'
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  return lo === hi ? `${lo} ج.م` : `${lo}–${hi} ج.م`
}

export function StockPill({ qty }) {
  const cls = qty === 0 ? 'bg-ink text-white' : qty <= LOW_STOCK ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
  return <span className={`badge ${cls}`}>{qty === 0 ? 'نفد' : `${qty} قطعة`}</span>
}

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

  const toggleActive = async (p) => {
    const { error } = await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    if (error) return notify('تعذر الحفظ', 'error')
    notify(p.active ? 'تم إخفاء المنتج' : 'المنتج ظاهر الآن ✓')
    refresh()
  }

  const remove = async (p) => {
    if (!window.confirm(`حذف «${p.name_ar}» نهائياً بكل مقاساته وصوره؟\n(لو عايز تخفيه بس، استخدم زر الإخفاء)`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) return notify('تعذر الحذف', 'error')
    const paths = (p.product_images ?? []).map((i) => i.storage_path).filter(Boolean)
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
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
          {list.map((p) => {
            const variants = sortedVariants(p)
            const total = variants.reduce((s, v) => s + v.stock_qty, 0)
            const img = mainImage(p)
            return (
              <li key={p.id} className={`flex flex-wrap items-center gap-3 rounded-[22px] bg-white p-3 ring-1 ring-line ${p.active ? '' : 'opacity-60'}`}>
                <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl">
                  {img ? (
                    <img src={img} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <GarmentArt type={p.art_type} color={p.art_color} bg={p.art_bg} className="size-full p-1.5" />
                  )}
                  {(p.product_images?.length ?? 0) > 1 && (
                    <span className="badge absolute bottom-1 end-1 bg-ink/80 text-white">{p.product_images.length}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate font-black text-ink">{p.name_ar}</p>
                  <p className="text-sm text-muted">
                    {catName[p.category] ?? '—'} · <b className="text-brand">{priceRange(p)}</b>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1" dir="ltr">
                    {variants.map((v) => (
                      <span key={v.id} className={`rounded-md px-1.5 text-xs font-bold ${v.stock_qty === 0 ? 'bg-paper text-muted line-through' : 'bg-paper text-ink'}`}>
                        {v.size}·{v.stock_qty}
                      </span>
                    ))}
                  </p>
                  {!p.active && <span className="badge mt-1 inline-block bg-ink text-white">مخفي عن الموقع</span>}
                </div>

                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <StockPill qty={total} />
                  <button type="button" onClick={() => toggleActive(p)} className="btn h-10 border border-line px-4 text-sm hover:border-ink">
                    {p.active ? 'إخفاء' : 'إظهار'}
                  </button>
                  <button type="button" onClick={() => setEditing(p)} className="btn btn-ink h-10 px-4 text-sm">تعديل</button>
                  <button type="button" onClick={() => remove(p)} aria-label={`حذف ${p.name_ar}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-paper hover:text-brand">
                    <TrashIcon className="size-5" />
                  </button>
                </div>
              </li>
            )
          })}
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
