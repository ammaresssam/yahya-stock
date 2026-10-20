import { useMemo, useState } from 'react'
import supabase from '../lib/supabase'
import GarmentArt from '../components/GarmentArt'
import { toWebp } from './image'
import { ART_TYPES, Modal, QUICK_SIZES, STOCK } from './ui'

const BUCKET = 'product-images'
const pathFromUrl = (url) => (url && url.includes(`/${BUCKET}/`) ? url.split(`/${BUCKET}/`)[1] : null)

// Western digits only — the owner may type Arabic-Indic digits on an Arabic keyboard
const toNumber = (v) => {
  const s = String(v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d]/g, '')
  return s === '' ? null : Number(s)
}

export default function ProductForm({ product, categories, onClose, onSaved, notify }) {
  const editing = Boolean(product)
  const [f, setF] = useState(() => ({
    name_ar: product?.name_ar ?? '',
    name_en: product?.name_en ?? '',
    category: product?.category ?? categories[0]?.id ?? '',
    price: product?.price?.toString() ?? '',
    old_price: product?.old_price?.toString() ?? '',
    sizes: (product?.sizes ?? []).join(', '),
    stock: product?.stock ?? 'in',
    is_new: product?.is_new ?? true,
    featured: product?.featured ?? false,
    active: product?.active ?? true,
    art_type: product?.art_type ?? 'tee',
    art_color: product?.art_color ?? '#2b2a2f',
    art_bg: product?.art_bg ?? '#e9e7e3',
  }))
  const [file, setFile] = useState(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const sizeList = useMemo(() => f.sizes.split(/[,،\s]+/).map((s) => s.trim()).filter(Boolean), [f.sizes])
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  const currentImage = preview || (removeImage ? null : product?.image_url)

  const toggleSize = (s) => {
    const has = sizeList.some((x) => x.toLowerCase() === s.toLowerCase())
    set('sizes', (has ? sizeList.filter((x) => x.toLowerCase() !== s.toLowerCase()) : [...sizeList, s]).join(', '))
  }

  const save = async (e) => {
    e.preventDefault()
    setError('')
    const price = toNumber(f.price)
    const oldPrice = toNumber(f.old_price)
    if (!f.name_ar.trim()) return setError('اكتب اسم المنتج بالعربي')
    if (!f.category) return setError('اختار القسم (أضف قسماً من تبويب الأقسام أولاً)')
    if (price === null || price <= 0) return setError('اكتب السعر بالجنيه')
    if (oldPrice !== null && oldPrice <= price) return setError('السعر قبل الخصم لازم يكون أكبر من السعر الحالي')
    if (!sizeList.length) return setError('اختار مقاس واحد على الأقل (أو Free Size)')

    setSaving(true)
    try {
      let image_url = removeImage ? null : product?.image_url ?? null
      let uploadedPath = null

      if (file) {
        const blob = await toWebp(file)
        uploadedPath = `${crypto.randomUUID()}.webp`
        const up = await supabase.storage.from(BUCKET).upload(uploadedPath, blob, { contentType: 'image/webp', cacheControl: '31536000' })
        if (up.error) throw up.error
        image_url = supabase.storage.from(BUCKET).getPublicUrl(uploadedPath).data.publicUrl
      }

      const row = {
        name_ar: f.name_ar.trim(),
        name_en: f.name_en.trim(),
        category: f.category,
        price,
        old_price: oldPrice,
        sizes: sizeList,
        stock: f.stock,
        is_new: f.is_new,
        featured: f.featured,
        active: f.active,
        image_url,
        art_type: f.art_type,
        art_color: f.art_color,
        art_bg: f.art_bg,
      }

      const res = editing
        ? await supabase.from('products').update(row).eq('id', product.id)
        : await supabase.from('products').insert(row)
      if (res.error) {
        // don't leave an orphan photo behind if the row didn't save
        if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath])
        throw res.error
      }

      // the old photo is no longer used
      const oldPath = pathFromUrl(product?.image_url)
      if (oldPath && (file || removeImage)) await supabase.storage.from(BUCKET).remove([oldPath])

      notify(editing ? 'تم حفظ التعديلات ✓' : 'تمت إضافة المنتج ✓')
      onSaved()
    } catch (err) {
      setError(`تعذر الحفظ: ${err.message || 'حاول مرة أخرى'}`)
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? 'تعديل منتج' : 'منتج جديد'} onClose={onClose}>
      <form onSubmit={save} className="grid gap-5">
        {/* photo */}
        <div>
          <p className="field-label">صورة المنتج</p>
          <div className="flex items-center gap-4">
            <div className="size-28 shrink-0 overflow-hidden rounded-2xl ring-1 ring-line">
              {currentImage ? (
                <img src={currentImage} alt="" className="size-full object-cover" />
              ) : (
                <GarmentArt type={f.art_type} color={f.art_color} bg={f.art_bg} className="size-full p-2" />
              )}
            </div>
            <div className="grid gap-2">
              <label className="btn btn-ink h-11 cursor-pointer px-5 text-sm">
                {currentImage ? 'تغيير الصورة' : 'رفع صورة'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoveImage(false) }}
                />
              </label>
              {currentImage && (
                <button type="button" onClick={() => { setFile(null); setRemoveImage(true) }} className="text-sm font-bold text-muted hover:text-brand">
                  حذف الصورة
                </button>
              )}
              <p className="text-xs text-muted">الصورة بتتصغر أوتوماتيك عشان الموقع يفضل سريع.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="p-ar" className="field-label">اسم المنتج (عربي) *</label>
            <input id="p-ar" className="field" value={f.name_ar} onChange={(e) => set('name_ar', e.target.value)} />
          </div>
          <div>
            <label htmlFor="p-en" className="field-label">الاسم بالإنجليزي (اختياري)</label>
            <input id="p-en" dir="ltr" className="field" value={f.name_en} onChange={(e) => set('name_en', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="p-cat" className="field-label">القسم *</label>
            <select id="p-cat" className="field" value={f.category} onChange={(e) => set('category', e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="p-price" className="field-label">السعر (ج.م) *</label>
            <input id="p-price" inputMode="numeric" className="field" value={f.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div>
            <label htmlFor="p-old" className="field-label">السعر قبل الخصم</label>
            <input id="p-old" inputMode="numeric" className="field" placeholder="اختياري" value={f.old_price} onChange={(e) => set('old_price', e.target.value)} />
          </div>
        </div>

        <div>
          <label htmlFor="p-sizes" className="field-label">المقاسات المتاحة *</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_SIZES.map((s) => (
              <button key={s} type="button" className="size-chip" aria-pressed={sizeList.some((x) => x.toLowerCase() === s.toLowerCase())} onClick={() => toggleSize(s)}>
                {s}
              </button>
            ))}
          </div>
          <input id="p-sizes" dir="ltr" className="field" placeholder="S, M, L أو 30, 32, 34" value={f.sizes} onChange={(e) => set('sizes', e.target.value)} />
        </div>

        <div>
          <p className="field-label">التوفر</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="التوفر">
            {Object.entries(STOCK).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={f.stock === k} onClick={() => set('stock', k)} className="filter-tab" aria-selected={f.stock === k}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Check label="يظهر في «وصل حديثاً»" checked={f.is_new} onChange={(v) => set('is_new', v)} />
          <Check label="منتج مميز (يظهر أولاً)" checked={f.featured} onChange={(v) => set('featured', v)} />
          <Check label="ظاهر في الموقع" checked={f.active} onChange={(v) => set('active', v)} />
        </div>

        {!currentImage && (
          <details className="rounded-2xl bg-paper p-4">
            <summary className="cursor-pointer font-bold">الرسمة البديلة (لو مفيش صورة)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="a-type" className="field-label">الشكل</label>
                <select id="a-type" className="field bg-white" value={f.art_type} onChange={(e) => set('art_type', e.target.value)}>
                  {ART_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <ColorField id="a-color" label="لون القطعة" value={f.art_color} onChange={(v) => set('art_color', v)} />
              <ColorField id="a-bg" label="لون الخلفية" value={f.art_bg} onChange={(v) => set('art_bg', v)} />
            </div>
          </details>
        )}

        {error && <p role="alert" className="rounded-2xl bg-brand/10 p-3 font-bold text-brand">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn btn-red h-12 flex-1 text-lg">{saving ? 'جاري الحفظ…' : 'حفظ'}</button>
          <button type="button" onClick={onClose} className="btn h-12 border border-line px-6 hover:border-ink">إلغاء</button>
        </div>
      </form>
    </Modal>
  )
}

function Check({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl bg-paper px-4 py-3 font-semibold">
      <input type="checkbox" className="size-5 accent-[#e3262d]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function ColorField({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full cursor-pointer rounded-2xl border border-line bg-white p-1" />
    </div>
  )
}
