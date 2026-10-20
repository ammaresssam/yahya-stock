import { useState } from 'react'
import supabase from '../lib/supabase'
import GarmentArt from '../components/GarmentArt'
import { PlusIcon, TrashIcon } from '../components/Icons'
import { ColorField } from './ProductForm'
import { ART_TYPES, Modal } from './ui'

export default function CategoriesTab({ categories, products, refresh, notify }) {
  const [editing, setEditing] = useState(null) // null | 'new' | category row

  const remove = async (c) => {
    const used = products.filter((p) => p.category === c.id).length
    if (used) return notify(`القسم فيه ${used} منتج — انقلهم لقسم تاني أو احذفهم الأول`, 'error')
    if (!window.confirm(`حذف قسم «${c.name_ar}»؟`)) return
    const { error } = await supabase.from('categories').delete().eq('id', c.id)
    if (error) return notify('تعذر الحذف', 'error')
    notify('تم حذف القسم')
    refresh()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-muted">الأقسام اللي بتظهر في الموقع.</p>
        <button type="button" onClick={() => setEditing('new')} className="btn btn-red h-11 shrink-0 px-5">
          <PlusIcon className="size-5" />
          قسم جديد
        </button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-[22px] bg-white p-3 ring-1 ring-line">
            <GarmentArt type={c.art_type} color={c.art_color} bg={c.art_bg} className="size-16 shrink-0 rounded-2xl p-1.5" />
            <div className="min-w-0 flex-1">
              <p className="font-black text-ink">{c.name_ar}</p>
              <p dir="ltr" className="truncate text-start text-sm text-muted">{c.name_en || '—'}</p>
              <p className="text-xs text-muted">{products.filter((p) => p.category === c.id).length} منتج</p>
            </div>
            <button type="button" onClick={() => setEditing(c)} className="btn h-10 border border-line px-4 text-sm hover:border-ink">تعديل</button>
            <button type="button" onClick={() => remove(c)} aria-label={`حذف ${c.name_ar}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-paper hover:text-brand">
              <TrashIcon className="size-5" />
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <CategoryForm
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh() }}
          notify={notify}
        />
      )}
    </div>
  )
}

function CategoryForm({ category, onClose, onSaved, notify }) {
  const [f, setF] = useState({
    name_ar: category?.name_ar ?? '',
    name_en: category?.name_en ?? '',
    art_type: category?.art_type ?? 'tee',
    art_color: category?.art_color ?? '#2b2a2f',
    art_bg: category?.art_bg ?? '#e9e7e3',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  const save = async (e) => {
    e.preventDefault()
    if (!f.name_ar.trim()) return setError('اكتب اسم القسم')
    setSaving(true)
    const row = { ...f, name_ar: f.name_ar.trim(), name_en: f.name_en.trim() }
    const res = category
      ? await supabase.from('categories').update(row).eq('id', category.id)
      : await supabase.from('categories').insert({ id: `c-${Date.now().toString(36)}`, ...row })
    if (res.error) {
      setError('تعذر الحفظ — حاول مرة أخرى')
      return setSaving(false)
    }
    notify('تم الحفظ ✓')
    onSaved()
  }

  return (
    <Modal title={category ? 'تعديل قسم' : 'قسم جديد'} onClose={onClose}>
      <form onSubmit={save} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="c-ar" className="field-label">الاسم بالعربي *</label>
            <input id="c-ar" className="field" value={f.name_ar} onChange={(e) => set('name_ar', e.target.value)} />
          </div>
          <div>
            <label htmlFor="c-en" className="field-label">بالإنجليزي (اختياري)</label>
            <input id="c-en" dir="ltr" className="field" value={f.name_en} onChange={(e) => set('name_en', e.target.value)} />
          </div>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <label htmlFor="c-type" className="field-label">الرسمة</label>
            <select id="c-type" className="field" value={f.art_type} onChange={(e) => set('art_type', e.target.value)}>
              {ART_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <ColorField id="c-color" label="لون القطعة" value={f.art_color} onChange={(v) => set('art_color', v)} />
          <ColorField id="c-bg" label="لون الخلفية" value={f.art_bg} onChange={(v) => set('art_bg', v)} />
          <GarmentArt type={f.art_type} color={f.art_color} bg={f.art_bg} className="size-16 rounded-2xl p-1.5" />
        </div>
        {error && <p role="alert" className="rounded-2xl bg-brand/10 p-3 font-bold text-brand">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn btn-red h-12 flex-1 text-lg">{saving ? 'جاري الحفظ…' : 'حفظ'}</button>
          <button type="button" onClick={onClose} className="btn h-12 border border-line px-6 hover:border-ink">إلغاء</button>
        </div>
      </form>
    </Modal>
  )
}
