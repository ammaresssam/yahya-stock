import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'
import { toNumber } from './ProductForm'

// Delivery zones and fees. A new fee applies to new orders only; past orders keep theirs.
export default function ZonesTab({ notify }) {
  const [zones, setZones] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [adding, setAdding] = useState({ name_ar: '', fee: '' })

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('shipping_zones').select('*').order('position', { ascending: true })
    if (error) return notify('تعذر تحميل مناطق التوصيل', 'error')
    setZones(data)
    setDrafts({})
  }, [notify])

  useEffect(() => { load() }, [load])

  const draft = (z) => drafts[z.id] ?? { name_ar: z.name_ar, name_en: z.name_en, fee: String(z.fee) }
  const setDraft = (z, patch) => setDrafts((d) => ({ ...d, [z.id]: { ...draft(z), ...patch } }))

  const save = async (z) => {
    const d = draft(z)
    const fee = toNumber(d.fee)
    if (!d.name_ar.trim()) return notify('اكتب اسم المنطقة', 'error')
    if (fee === null || fee > 10000) return notify('اكتب سعر توصيل صحيح', 'error')
    const { error } = await supabase.from('shipping_zones').update({ name_ar: d.name_ar.trim(), name_en: (d.name_en ?? '').trim(), fee }).eq('id', z.id)
    if (error) return notify('تعذر الحفظ', 'error')
    notify('تم حفظ سعر التوصيل ✓')
    load()
  }

  const toggle = async (z) => {
    const { error } = await supabase.from('shipping_zones').update({ active: !z.active }).eq('id', z.id)
    if (error) return notify('تعذر الحفظ', 'error')
    notify(z.active ? 'المنطقة اتقفلت — مش هتظهر للعملاء' : 'المنطقة اتفتحت ✓')
    load()
  }

  const add = async (e) => {
    e.preventDefault()
    const fee = toNumber(adding.fee)
    if (!adding.name_ar.trim() || fee === null) return notify('اكتب اسم المنطقة وسعر التوصيل', 'error')
    const { error } = await supabase.from('shipping_zones').insert({
      id: `z-${Date.now().toString(36)}`,
      name_ar: adding.name_ar.trim(),
      fee,
      position: (zones?.length ?? 0) + 1,
    })
    if (error) return notify('تعذر الإضافة', 'error')
    setAdding({ name_ar: '', fee: '' })
    notify('تمت إضافة المنطقة ✓')
    load()
  }

  if (!zones) return <p className="py-16 text-center text-muted">جاري التحميل…</p>

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">سعر التوصيل الجديد بيتطبق على الطلبات الجديدة بس. المنطقة المقفولة مش بتظهر للعملاء في صفحة الطلب.</p>
      <ul className="grid gap-2">
        {zones.map((z) => {
          const d = draft(z)
          const dirty = drafts[z.id] !== undefined
          return (
            <li key={z.id} className={`grid grid-cols-[1fr_7rem] items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-line sm:grid-cols-[1fr_1fr_7rem_auto_auto] ${z.active ? '' : 'opacity-60'}`}>
              <div>
                <label htmlFor={`zn-${z.id}`} className="mb-1 block text-xs font-bold text-muted">المنطقة</label>
                <input id={`zn-${z.id}`} className="field h-10 px-3" value={d.name_ar} onChange={(e) => setDraft(z, { name_ar: e.target.value })} />
              </div>
              <div className="hidden sm:block">
                <label htmlFor={`ze-${z.id}`} className="mb-1 block text-xs font-bold text-muted">بالإنجليزي</label>
                <input id={`ze-${z.id}`} dir="ltr" className="field h-10 px-3" value={d.name_en ?? ''} onChange={(e) => setDraft(z, { name_en: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`zf-${z.id}`} className="mb-1 block text-xs font-bold text-muted">التوصيل (ج.م)</label>
                <input id={`zf-${z.id}`} inputMode="numeric" className="field h-10 px-3" value={d.fee} onChange={(e) => setDraft(z, { fee: e.target.value })} />
              </div>
              <button type="button" onClick={() => save(z)} disabled={!dirty} className="btn btn-red h-10 px-4 text-sm disabled:opacity-40">حفظ</button>
              <button type="button" onClick={() => toggle(z)} className="btn h-10 border border-line px-4 text-sm hover:border-ink">{z.active ? 'قفل' : 'فتح'}</button>
            </li>
          )
        })}
      </ul>

      <form onSubmit={add} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2 rounded-2xl bg-paper p-3">
        <div>
          <label htmlFor="zn-new" className="mb-1 block text-xs font-bold text-muted">منطقة جديدة</label>
          <input id="zn-new" className="field h-10 bg-white px-3" value={adding.name_ar} onChange={(e) => setAdding((a) => ({ ...a, name_ar: e.target.value }))} placeholder="مثلاً: مطروح" />
        </div>
        <div>
          <label htmlFor="zf-new" className="mb-1 block text-xs font-bold text-muted">التوصيل</label>
          <input id="zf-new" inputMode="numeric" className="field h-10 bg-white px-3" value={adding.fee} onChange={(e) => setAdding((a) => ({ ...a, fee: e.target.value }))} />
        </div>
        <button type="submit" className="btn btn-ink h-10 px-4 text-sm">إضافة</button>
      </form>
    </div>
  )
}
