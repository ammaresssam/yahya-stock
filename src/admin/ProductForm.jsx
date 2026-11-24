import { useMemo, useState } from 'react'
import supabase from '../lib/supabase'
import GarmentArt from '../components/GarmentArt'
import { ArrowIcon, CloseIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { toWebp } from './image'
import { ART_TYPES, MAX_IMAGES, Modal, QUICK_SIZES } from './ui'

const BUCKET = 'product-images'

// Western digits only — the owner may type Arabic-Indic digits on an Arabic keyboard
export const toNumber = (v) => {
  const s = String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d]/g, '')
  return s === '' ? null : Number(s)
}

let keySeq = 0
const key = () => `k${++keySeq}`

const SERVER_ERRORS = {
  name_ar_required: 'اكتب اسم المنتج بالعربي',
  unknown_category: 'القسم غير موجود — حدّث الصفحة',
  variants_required: 'أضف مقاس واحد على الأقل',
  size_required: 'في مقاس من غير اسم',
  duplicate_size: 'في مقاس مكرر في نفس اللون',
  color_name_required: 'في لون من غير اسم بالعربي',
  too_many_images: `أقصى عدد صور ${MAX_IMAGES}`,
  not_authorized: 'الحساب ده مش مسموح له يعدّل',
  product_not_found: 'المنتج اتحذف — حدّث الصفحة',
}
const explain = (msg = '') => {
  const hit = Object.keys(SERVER_ERRORS).find((k) => msg.includes(k) || msg.includes(k.replace('_', ' ')))
  if (hit) return SERVER_ERRORS[hit]
  if (msg.includes('check')) return 'راجع الأسعار والكميات (السعر أكبر من صفر، والسعر قبل الخصم أكبر من السعر)'
  return msg || 'حاول مرة أخرى'
}

// Quick mode shows only photo, name, section, one price and sizes with quantities.
// It is offered only when the product fits it (no colours, no discount, one price).
const SIMPLE_PREF = 'ys-admin-simple-form'
const readPref = () => { try { return localStorage.getItem(SIMPLE_PREF) !== 'full' } catch { return true } }
const savePref = (simple) => { try { localStorage.setItem(SIMPLE_PREF, simple ? 'simple' : 'full') } catch { /* private mode */ } }
export const fitsSimple = (colors, variants) =>
  colors.length === 0 && variants.every((v) => !String(v.compare_at_price ?? '').trim()) && new Set(variants.map((v) => toNumber(v.price))).size <= 1

// product: the row being edited. copyOf: a row to start a new product from (sizes and prices, no photos, empty quantities).
export default function ProductForm({ product, copyOf, categories, onClose, onSaved, notify }) {
  const editing = Boolean(product)
  const src = product ?? copyOf
  const [f, setF] = useState(() => ({
    name_ar: copyOf ? `${copyOf.name_ar} (نسخة)` : product?.name_ar ?? '',
    name_en: src?.name_en ?? '',
    category: src?.category ?? categories[0]?.id ?? '',
    is_new: copyOf ? true : product?.is_new ?? true,
    featured: copyOf ? false : product?.featured ?? false,
    active: src?.active ?? true,
    art_type: src?.art_type ?? 'tee',
    art_color: src?.art_color ?? '#2b2a2f',
    art_bg: src?.art_bg ?? '#e9e7e3',
  }))
  // Colours: each group has a name (Arabic required, English optional) and a swatch.
  // When there are no colour groups, sizes work exactly as before.
  const initial = useMemo(() => {
    const rows = [...(src?.product_variants ?? [])].sort((a, b) => a.position - b.position)
    const groups = []
    for (const v of rows) {
      if (v.color_ar && !groups.some((g) => g.ar === v.color_ar)) groups.push({ cid: key(), ar: v.color_ar, en: v.color_en ?? '', hex: v.color_hex || '#888888' })
    }
    const variants = rows.map((v) => ({
      key: key(),
      fixed: true,
      id: copyOf ? undefined : v.id,
      cid: v.color_ar ? groups.find((g) => g.ar === v.color_ar).cid : null,
      size: v.size,
      price: String(v.price),
      compare_at_price: v.compare_at_price ? String(v.compare_at_price) : '',
      stock_qty: copyOf ? '' : String(v.stock_qty),
    }))
    return { groups, variants }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [colors, setColors] = useState(initial.groups)
  const [variants, setVariants] = useState(initial.variants)
  const [images, setImages] = useState(() =>
    [...(product?.product_images ?? [])].sort((a, b) => a.position - b.position).map((i) => ({ key: key(), url: i.url, storage_path: i.storage_path })),
  )
  const [bulkPrice, setBulkPrice] = useState('')
  const canSimple = fitsSimple(colors, variants)
  const [simple, setSimpleState] = useState(() => readPref() && fitsSimple(initial.groups, initial.variants))
  const [simplePrice, setSimplePrice] = useState(() => initial.variants[0]?.price ?? '')
  const setSimple = (on) => {
    if (on && !canSimple) return
    if (on) setSimplePrice(variants[0]?.price ?? simplePrice)
    else setVariants((vs) => vs.map((v) => ({ ...v, price: simplePrice }))) // carry the one price into every size
    setSimpleState(on)
    savePref(on)
  }
  const changeSimplePrice = (value) => {
    setSimplePrice(value)
    setVariants((vs) => vs.map((v) => ({ ...v, price: value })))
  }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const setVariant = (k, field, value) => setVariants((vs) => vs.map((v) => (v.key === k ? { ...v, [field]: value } : v)))
  const sizesIn = (cid) => variants.filter((v) => v.cid === cid).map((v) => v.size.trim().toLowerCase())

  const addSize = (size = '', cid = null) => {
    if (size && sizesIn(cid).includes(size.toLowerCase())) return
    const last = variants[variants.length - 1]
    const price = simple ? simplePrice : last?.price ?? ''
    setVariants((vs) => [...vs, { key: key(), fixed: Boolean(size), cid, size, price, compare_at_price: simple ? '' : last?.compare_at_price ?? '', stock_qty: '' }])
  }

  const setColor = (cid, field, value) => setColors((cs) => cs.map((c) => (c.cid === cid ? { ...c, [field]: value } : c)))
  // a new colour starts with the same sizes and prices as the first colour (quantities empty)
  const addColor = () => {
    const cid = key()
    if (!colors.length) {
      setColors([{ cid, ar: '', en: '', hex: '#888888' }])
      setVariants((vs) => vs.map((v) => ({ ...v, cid })))
      return
    }
    const first = variants.filter((v) => v.cid === colors[0].cid)
    setColors((cs) => [...cs, { cid, ar: '', en: '', hex: '#888888' }])
    setVariants((vs) => [...vs, ...first.map((v) => ({ key: key(), cid, size: v.size, price: v.price, compare_at_price: v.compare_at_price, stock_qty: '' }))])
  }
  const removeColor = (cid) => {
    const rest = colors.filter((c) => c.cid !== cid)
    setColors(rest)
    // removing the last colour keeps its sizes as plain sizes
    setVariants((vs) => (rest.length ? vs.filter((v) => v.cid !== cid) : vs.map((v) => ({ ...v, cid: null }))))
  }

  const addFiles = (files) => {
    const room = MAX_IMAGES - images.length
    const picked = [...files].filter((f) => f.type.startsWith('image/')).slice(0, room)
    if (files.length > room) notify(`أقصى عدد صور ${MAX_IMAGES}`, 'error')
    setImages((imgs) => [...imgs, ...picked.map((file) => ({ key: key(), file, url: URL.createObjectURL(file) }))])
  }
  const moveImage = (i, dir) =>
    setImages((imgs) => {
      const j = i + dir
      if (j < 0 || j >= imgs.length) return imgs
      const next = [...imgs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const validate = () => {
    if (!f.name_ar.trim()) return 'اكتب اسم المنتج بالعربي'
    if (!f.category) return 'اختار القسم (أضف قسماً من تبويب الأقسام أولاً)'
    if (simple && !toNumber(simplePrice)) return 'اكتب السعر'
    if (!variants.length) return 'أضف مقاس واحد على الأقل (أو Free Size)'
    const names = new Set()
    for (const c of colors) {
      const n = c.ar.trim()
      if (!n) return 'اكتب اسم كل لون بالعربي'
      if (names.has(n)) return `اللون ${n} مكرر`
      names.add(n)
      if (!variants.some((v) => v.cid === c.cid)) return `أضف مقاس واحد على الأقل للون ${n}`
    }
    const seen = new Set()
    for (const v of variants) {
      const size = v.size.trim()
      if (!size) return 'في مقاس من غير اسم'
      const k = `${v.cid}|${size.toLowerCase()}`
      if (seen.has(k)) return `المقاس ${size} مكرر${v.cid ? ' في نفس اللون' : ''}`
      seen.add(k)
      const price = toNumber(v.price)
      const old = toNumber(v.compare_at_price)
      if (!price) return `اكتب سعر المقاس ${size}`
      if (old !== null && old <= price) return `في المقاس ${size}: السعر قبل الخصم لازم يكون أكبر من السعر`
      if (toNumber(v.stock_qty) === null) return `اكتب الكمية المتاحة من المقاس ${size} (اكتب 0 لو خلصان)`
    }
    return ''
  }

  const save = async (e) => {
    e.preventDefault()
    const problem = validate()
    if (problem) return setError(problem)
    setError('')
    setSaving(true)

    const uploaded = []
    try {
      // 1) upload new photos (shrunk to WebP first)
      const finalImages = []
      for (const img of images) {
        if (!img.file) {
          finalImages.push({ url: img.url, storage_path: img.storage_path ?? null })
          continue
        }
        const blob = await toWebp(img.file)
        const path = `${crypto.randomUUID()}.webp`
        const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' })
        if (up.error) throw up.error
        uploaded.push(path)
        finalImages.push({ url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, storage_path: path })
      }

      // 2) save everything in one checked database step
      const payload = {
        id: product?.id,
        ...f,
        name_ar: f.name_ar.trim(),
        name_en: f.name_en.trim(),
        variants: variants.map((v) => {
          const c = colors.find((x) => x.cid === v.cid)
          return {
          id: v.id,
          size: v.size.trim(),
          color_ar: c ? c.ar.trim() : '',
          color_en: c ? c.en.trim() : '',
          color_hex: c ? c.hex : null,
          price: toNumber(v.price),
          compare_at_price: toNumber(v.compare_at_price),
          stock_qty: toNumber(v.stock_qty),
          }
        }),
        images: finalImages,
      }
      const { error: rpcError } = await supabase.rpc('admin_save_product', { payload })
      if (rpcError) throw rpcError

      // 3) photos the owner removed are no longer used anywhere
      const kept = new Set(finalImages.map((i) => i.storage_path).filter(Boolean))
      const removed = (product?.product_images ?? []).map((i) => i.storage_path).filter((p) => p && !kept.has(p))
      if (removed.length) await supabase.storage.from(BUCKET).remove(removed)

      notify(editing ? 'تم حفظ التعديلات ✓' : 'تمت إضافة المنتج ✓')
      onSaved()
    } catch (err) {
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded) // don't leave orphan photos
      setError(`تعذر الحفظ: ${explain(err.message)}`)
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? 'تعديل منتج' : copyOf ? 'نسخة من منتج' : 'منتج جديد'} onClose={onClose}>
      <form onSubmit={save} className="grid gap-6">
        <div className="-mt-1 grid gap-2">
          <div role="group" aria-label="شكل الفورم" className="grid grid-cols-2 gap-1 rounded-full bg-paper p-1">
            <button type="button" aria-pressed={simple} onClick={() => setSimple(true)} disabled={!canSimple && !simple} className={`h-10 rounded-full text-sm font-bold disabled:opacity-40 ${simple ? 'bg-white text-ink shadow' : 'text-muted'}`}>
              سريع
            </button>
            <button type="button" aria-pressed={!simple} onClick={() => setSimple(false)} className={`h-10 rounded-full text-sm font-bold ${!simple ? 'bg-white text-ink shadow' : 'text-muted'}`}>
              كل التفاصيل
            </button>
          </div>
          {copyOf && <p className="rounded-2xl bg-paper p-3 text-sm text-muted">نسخنا الاسم والقسم والمقاسات والأسعار. غيّر الاسم، ضيف الصور، واكتب الكميات.</p>}
          {!simple && !canSimple && <p className="text-xs text-muted">الشكل السريع مش متاح للمنتج ده لأن فيه ألوان أو خصم أو أكتر من سعر.</p>}
        </div>

        {/* ---------- photos ---------- */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="field-label mb-0">الصور ({images.length}/{MAX_IMAGES})</p>
            <p className="text-xs text-muted">الصورة الأولى هي الرئيسية</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((img, i) => (
              <div key={img.key} className="relative overflow-hidden rounded-2xl ring-1 ring-line">
                <img src={img.url} alt={`صورة ${i + 1}`} className="aspect-[4/5] w-full object-cover" />
                {i === 0 && <span className="badge absolute start-1.5 top-1.5 bg-brand text-white">رئيسية</span>}
                <button type="button" onClick={() => setImages((x) => x.filter((y) => y.key !== img.key))} aria-label={`حذف الصورة ${i + 1}`} className="absolute end-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-white/90 text-ink shadow hover:text-brand">
                  <CloseIcon className="size-4" />
                </button>
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                  <button type="button" disabled={i === 0} onClick={() => moveImage(i, -1)} aria-label="تحريك للأمام" className="grid size-8 place-items-center rounded-full bg-white/90 shadow disabled:opacity-0">
                    <ArrowIcon className="size-4 -scale-x-100 rtl:scale-x-100" />
                  </button>
                  <button type="button" disabled={i === images.length - 1} onClick={() => moveImage(i, 1)} aria-label="تحريك للخلف" className="grid size-8 place-items-center rounded-full bg-white/90 shadow disabled:opacity-0">
                    <ArrowIcon className="size-4 rtl:-scale-x-100" />
                  </button>
                </div>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label className="grid aspect-[4/5] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-line text-center text-sm font-bold text-muted hover:border-ink hover:text-ink">
                <span>
                  <PlusIcon className="mx-auto mb-1 size-6" />
                  إضافة صور
                </span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
              </label>
            )}
          </div>
          {!images.length && !simple && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-paper p-3">
              <GarmentArt type={f.art_type} color={f.art_color} bg={f.art_bg} className="size-16 shrink-0 rounded-xl p-1" />
              <div className="grid flex-1 grid-cols-3 gap-2">
                <select aria-label="شكل الرسمة البديلة" className="field h-10 bg-white px-2 text-sm" value={f.art_type} onChange={(e) => set('art_type', e.target.value)}>
                  {ART_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <input aria-label="لون القطعة" type="color" value={f.art_color} onChange={(e) => set('art_color', e.target.value)} className="h-10 w-full cursor-pointer rounded-xl border border-line bg-white p-1" />
                <input aria-label="لون الخلفية" type="color" value={f.art_bg} onChange={(e) => set('art_bg', e.target.value)} className="h-10 w-full cursor-pointer rounded-xl border border-line bg-white p-1" />
              </div>
            </div>
          )}
        </section>

        {/* ---------- basics ---------- */}
        <section className={`grid gap-4 ${simple ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          <div className="sm:col-span-1">
            <label htmlFor="p-ar" className="field-label">{simple ? 'اسم المنتج *' : 'اسم المنتج (عربي) *'}</label>
            <input id="p-ar" className="field" value={f.name_ar} onChange={(e) => set('name_ar', e.target.value)} />
          </div>
          {!simple && (
            <div>
              <label htmlFor="p-en" className="field-label">بالإنجليزي (اختياري)</label>
              <input id="p-en" dir="ltr" className="field" value={f.name_en} onChange={(e) => set('name_en', e.target.value)} />
            </div>
          )}
          <div>
            <label htmlFor="p-cat" className="field-label">القسم *</label>
            <select id="p-cat" className="field" value={f.category} onChange={(e) => set('category', e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
          </div>
        </section>

        {simple && (
          <SimpleSizes price={simplePrice} onPrice={changeSimplePrice} variants={variants} sizesIn={sizesIn} addSize={addSize} setVariant={setVariant} setVariants={setVariants} />
        )}

        {/* ---------- sizes (and colours) ---------- */}
        {!simple && <section>
          <p className="field-label">المقاسات والألوان والأسعار والكميات *</p>

          {variants.length > 1 && (
            <div className="mb-3 flex items-end gap-2 rounded-2xl bg-paper p-3">
              <div className="flex-1">
                <label htmlFor="bulk" className="field-label text-xs">سعر واحد لكل المقاسات</label>
                <input id="bulk" inputMode="numeric" className="field h-10 bg-white" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} />
              </div>
              <button type="button" className="btn btn-ink h-10 px-4 text-sm" onClick={() => toNumber(bulkPrice) && setVariants((vs) => vs.map((v) => ({ ...v, price: String(toNumber(bulkPrice)) })))}>
                تطبيق
              </button>
            </div>
          )}

          {colors.length === 0 ? (
            <SizeGroup cid={null} variants={variants} sizesIn={sizesIn} addSize={addSize} setVariant={setVariant} setVariants={setVariants} />
          ) : (
            <ul className="grid gap-4">
              {colors.map((c, i) => (
                <li key={c.cid} className="rounded-2xl border border-line p-3">
                  <div className="mb-3 grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2">
                    <div>
                      <label htmlFor={`hex-${c.cid}`} className="mb-1 block text-xs font-bold text-muted">اللون</label>
                      <input id={`hex-${c.cid}`} type="color" value={c.hex} onChange={(e) => setColor(c.cid, 'hex', e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border border-line bg-white p-1" />
                    </div>
                    <Field label={`اسم اللون ${i + 1} (عربي) *`} id={`car-${c.cid}`} placeholder="أحمر" value={c.ar} onChange={(x) => setColor(c.cid, 'ar', x)} />
                    <Field label="English" id={`cen-${c.cid}`} dir="ltr" placeholder="Red" value={c.en} onChange={(x) => setColor(c.cid, 'en', x)} />
                    <button type="button" onClick={() => removeColor(c.cid)} aria-label={`حذف اللون ${c.ar}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-paper hover:text-brand">
                      <TrashIcon className="size-5" />
                    </button>
                  </div>
                  <SizeGroup cid={c.cid} variants={variants} sizesIn={sizesIn} addSize={addSize} setVariant={setVariant} setVariants={setVariants} />
                </li>
              ))}
            </ul>
          )}

          <button type="button" onClick={addColor} className="btn mt-3 h-10 border border-dashed border-ink/40 px-4 text-sm hover:border-ink">
            <PlusIcon className="size-4" />
            {colors.length ? 'لون جديد (بنفس المقاسات)' : 'أضف ألوان للمنتج (أحمر، أزرق…)'}
          </button>
        </section>}

        {!simple && <section className="grid gap-2 sm:grid-cols-3">
          <Check label="يظهر في «وصل حديثاً»" checked={f.is_new} onChange={(v) => set('is_new', v)} />
          <Check label="منتج مميز (يظهر أولاً)" checked={f.featured} onChange={(v) => set('featured', v)} />
          <Check label="ظاهر في الموقع" checked={f.active} onChange={(v) => set('active', v)} />
        </section>}

        {error && <p role="alert" className="rounded-2xl bg-brand/10 p-3 font-bold text-brand">{error}</p>}

        <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-3 border-t border-line bg-white p-4">
          <button type="submit" disabled={saving} className="btn btn-red h-12 flex-1 text-lg">{saving ? 'جاري الحفظ…' : 'حفظ'}</button>
          <button type="button" onClick={onClose} className="btn h-12 border border-line px-6 hover:border-ink">إلغاء</button>
        </div>
      </form>
    </Modal>
  )
}

// Quick mode: one price, then tap sizes and type how many of each.
function SimpleSizes({ price, onPrice, variants, sizesIn, addSize, setVariant, setVariants }) {
  const have = sizesIn(null)
  const toggle = (s) => {
    const hit = variants.find((v) => v.size.trim().toLowerCase() === s.toLowerCase())
    if (hit) setVariants((vs) => vs.filter((v) => v.key !== hit.key))
    else addSize(s, null)
  }
  return (
    <section className="grid gap-4">
      <div className="max-w-48">
        <label htmlFor="p-price" className="field-label">السعر (ج.م) *</label>
        <input id="p-price" inputMode="numeric" className="field" value={price} onChange={(e) => onPrice(e.target.value)} />
      </div>
      <div>
        <p className="field-label">المقاسات والكمية *</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {QUICK_SIZES.map((s) => (
            <button key={s} type="button" className="size-chip" aria-pressed={have.includes(s.toLowerCase())} onClick={() => toggle(s)}>
              {have.includes(s.toLowerCase()) ? '✓' : '+'} {s}
            </button>
          ))}
          <button type="button" className="size-chip" onClick={() => addSize('', null)}>+ مقاس آخر</button>
        </div>
        {variants.length === 0 ? (
          <p className="rounded-2xl bg-paper p-4 text-center text-sm text-muted">دوس على المقاسات اللي عندك</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {variants.map((v) => (
              <li key={v.key} className="flex items-end gap-2 rounded-2xl border border-line p-2.5">
                {v.fixed ? (
                  <span dir="ltr" className="grid h-10 min-w-12 place-items-center rounded-xl bg-paper px-2 text-sm font-black text-ink">{v.size}</span>
                ) : (
                  <Field label="المقاس" id={`s-${v.key}`} dir="ltr" value={v.size} onChange={(x) => setVariant(v.key, 'size', x)} />
                )}
                <Field label="الكمية" id={`q-${v.key}`} numeric value={v.stock_qty} onChange={(x) => setVariant(v.key, 'stock_qty', x)} />
                <button type="button" onClick={() => setVariants((vs) => vs.filter((y) => y.key !== v.key))} aria-label={`حذف المقاس ${v.size}`} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-paper hover:text-brand">
                  <CloseIcon className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

// The size rows of one colour (or of the whole product when it has no colours).
function SizeGroup({ cid, variants, sizesIn, addSize, setVariant, setVariants }) {
  const rows = variants.filter((v) => v.cid === cid)
  const have = sizesIn(cid)
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {QUICK_SIZES.map((s) => (
          <button key={s} type="button" className="size-chip" aria-pressed={have.includes(s.toLowerCase())} onClick={() => addSize(s, cid)}>
            + {s}
          </button>
        ))}
        <button type="button" className="size-chip" onClick={() => addSize('', cid)}>+ مقاس آخر</button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-paper p-4 text-center text-sm text-muted">اختار مقاس من فوق</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((v) => (
            <li key={v.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <Field label="المقاس" id={`s-${v.key}`} dir="ltr" value={v.size} onChange={(x) => setVariant(v.key, 'size', x)} />
              <Field label="السعر (ج.م)" id={`pr-${v.key}`} numeric value={v.price} onChange={(x) => setVariant(v.key, 'price', x)} />
              <button type="button" onClick={() => setVariants((vs) => vs.filter((y) => y.key !== v.key))} aria-label={`حذف المقاس ${v.size}`} className="row-span-2 grid size-10 place-items-center self-center rounded-full text-muted hover:bg-paper hover:text-brand sm:row-span-1 sm:col-start-5">
                <TrashIcon className="size-5" />
              </button>
              <Field label="قبل الخصم" id={`cp-${v.key}`} numeric placeholder="اختياري" value={v.compare_at_price} onChange={(x) => setVariant(v.key, 'compare_at_price', x)} />
              <Field label="الكمية" id={`q-${v.key}`} numeric value={v.stock_qty} onChange={(x) => setVariant(v.key, 'stock_qty', x)} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Field({ label, id, numeric, onChange, ...rest }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-bold text-muted">{label}</label>
      <input id={id} inputMode={numeric ? 'numeric' : undefined} className="field h-10 px-3" onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
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
