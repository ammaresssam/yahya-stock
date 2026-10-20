import { useMemo, useState } from 'react'
import supabase from '../lib/supabase'
import { MinusIcon, PlusIcon } from '../components/Icons'
import { toNumber } from './ProductForm'
import { mainImage, sortedVariants } from './Products'
import { LOW_STOCK } from './ui'

// Fast restocking: every size of every product, with its quantity editable in place.
export default function InventoryTab({ products, refresh, notify }) {
  const [q, setQ] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)
  const [drafts, setDrafts] = useState({}) // variant id → typed value
  const [saving, setSaving] = useState(null)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return products
      .filter((p) => !term || p.name_ar.toLowerCase().includes(term))
      .flatMap((p) => sortedVariants(p).map((v) => ({ p, v })))
      .filter(({ v }) => !onlyLow || v.stock_qty <= LOW_STOCK)
  }, [products, q, onlyLow])

  const lowCount = useMemo(
    () => products.flatMap((p) => p.product_variants ?? []).filter((v) => v.stock_qty <= LOW_STOCK).length,
    [products],
  )

  const saveQty = async (v, qty) => {
    if (qty === null || qty < 0 || qty > 100000) {
      setDrafts((d) => ({ ...d, [v.id]: undefined }))
      return notify('اكتب رقم صحيح للكمية', 'error')
    }
    if (qty === v.stock_qty) return setDrafts((d) => ({ ...d, [v.id]: undefined }))
    setSaving(v.id)
    const { error } = await supabase.from('product_variants').update({ stock_qty: qty }).eq('id', v.id)
    setSaving(null)
    setDrafts((d) => ({ ...d, [v.id]: undefined }))
    if (error) return notify('تعذر حفظ الكمية', 'error')
    notify(`تم: ${v.size} ← ${qty} قطعة`)
    refresh()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="search" aria-label="بحث عن منتج" placeholder="ابحث عن منتج…" value={q} onChange={(e) => setQ(e.target.value)} className="field h-11 min-w-0 flex-1 basis-48 bg-white" />
        <button type="button" aria-pressed={onlyLow} onClick={() => setOnlyLow((x) => !x)} className="filter-tab" aria-selected={onlyLow}>
          قرّب يخلص أو خلص
          <span className="filter-count">{lowCount}</span>
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-10 text-center text-muted ring-1 ring-line">{onlyLow ? 'كل المقاسات متوفرة بكمية كويسة 👌' : 'مفيش مقاسات.'}</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map(({ p, v }) => {
            const draft = drafts[v.id]
            const shown = draft ?? String(v.stock_qty)
            const img = mainImage(p)
            const low = v.stock_qty <= LOW_STOCK
            return (
              <li key={v.id} className={`flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ${v.stock_qty === 0 ? 'ring-brand/40' : low ? 'ring-amber-300' : 'ring-line'}`}>
                {img ? <img src={img} alt="" className="size-12 shrink-0 rounded-xl object-cover" /> : <span className="size-12 shrink-0 rounded-xl bg-paper" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{p.name_ar}</p>
                  <p className="text-sm text-muted">مقاس <b dir="ltr" className="text-ink">{v.size}</b> · {v.price} ج.م{!p.active && ' · مخفي'}</p>
                </div>
                <div className="flex items-center rounded-full ring-1 ring-line">
                  <button type="button" className="qty-btn" aria-label={`زيادة ${p.name_ar} ${v.size}`} disabled={saving === v.id} onClick={() => saveQty(v, v.stock_qty + 1)}>
                    <PlusIcon className="size-4" />
                  </button>
                  <input
                    aria-label={`الكمية — ${p.name_ar} مقاس ${v.size}`}
                    inputMode="numeric"
                    className="w-12 bg-transparent text-center font-black outline-none"
                    value={shown}
                    onChange={(e) => setDrafts((d) => ({ ...d, [v.id]: e.target.value }))}
                    onBlur={() => draft !== undefined && saveQty(v, toNumber(draft))}
                    onKeyDown={(e) => e.key === 'Enter' && draft !== undefined && saveQty(v, toNumber(draft))}
                  />
                  <button type="button" className="qty-btn" aria-label={`تقليل ${p.name_ar} ${v.size}`} disabled={saving === v.id || v.stock_qty === 0} onClick={() => saveQty(v, v.stock_qty - 1)}>
                    <MinusIcon className="size-4" />
                  </button>
                </div>
                {draft !== undefined && draft !== String(v.stock_qty) && (
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => saveQty(v, toNumber(draft))} className="btn btn-red h-9 px-3 text-sm">
                    حفظ
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
