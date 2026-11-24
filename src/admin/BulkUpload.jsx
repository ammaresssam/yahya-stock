import { useState } from 'react'
import supabase from '../lib/supabase'
import { Modal } from './ui'
import { readSheet, writeXlsx } from './sheet'
import { rowsToProducts, templateSheets } from './bulk'

const SAVE_ERRORS = {
  'not authorized': 'الحساب ده مش مسموح له يضيف منتجات',
  unknown_category: 'القسم اتحذف — حدّث الصفحة',
  duplicate_size: 'في مقاس مكرر',
}
const explain = (m = '') => Object.entries(SAVE_ERRORS).find(([k]) => m.includes(k))?.[1] ?? 'حصلت مشكلة في الحفظ، جرّب تاني'

function downloadTemplate(categories) {
  const url = URL.createObjectURL(writeXlsx(templateSheets(categories)))
  const a = document.createElement('a')
  a.href = url
  a.download = 'yahya-stock-products.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function BulkUpload({ categories, products, onClose, onDone, notify }) {
  const [hidden, setHidden] = useState(true)
  const [file, setFile] = useState(null) // { name, rows }
  const [readError, setReadError] = useState('')
  const [progress, setProgress] = useState(null) // { done, total }
  const [result, setResult] = useState(null) // { saved, failed: [{ name, msg }] }

  const check = file ? rowsToProducts(file.rows, categories, products, { active: !hidden }) : null
  const busy = Boolean(progress) && !result

  const pick = async (f) => {
    setReadError('')
    setResult(null)
    setFile(null)
    if (!f) return
    try {
      setFile({ name: f.name, rows: await readSheet(f) })
    } catch {
      setReadError('مش قادر أقرأ الملف ده. احفظه Excel (.xlsx) أو CSV وجرّب تاني.')
    }
  }

  const upload = async () => {
    const list = check.products
    const failed = []
    let saved = 0
    setProgress({ done: 0, total: list.length })
    for (const [i, p] of list.entries()) {
      const { error } = await supabase.rpc('admin_save_product', { payload: p.payload })
      if (error) failed.push({ name: p.payload.name_ar, rows: p.rows, msg: explain(error.message) })
      else saved++
      setProgress({ done: i + 1, total: list.length })
    }
    setResult({ saved, failed })
    if (saved) {
      notify(`تمت إضافة ${saved} منتج ✓`)
      onDone()
    }
  }

  return (
    <Modal title="رفع منتجات من Excel" onClose={busy ? () => {} : onClose}>
      <div className="grid gap-5">
        {/* step 1 */}
        <section className="rounded-2xl bg-paper p-4">
          <p className="font-black text-ink">1. نزّل النموذج واملاه</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            كل سطر = مقاس واحد (المقاس والسعر والكمية). لو المنتج له كذا مقاس، سيب الاسم فاضي في السطور اللي تحته.
            الصور بتتضاف بعدين من «تعديل».
          </p>
          <button type="button" onClick={() => downloadTemplate(categories)} className="btn btn-ink mt-3 h-11 px-5">
            تنزيل النموذج (Excel)
          </button>
        </section>

        {/* step 2 */}
        <section>
          <p className="mb-2 font-black text-ink">2. ارفع الملف</p>
          <label className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-6 text-center hover:border-ink ${file ? 'border-ink/40' : 'border-line'} ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            <span className="font-bold text-ink">{file ? file.name : 'اختار ملف Excel أو CSV'}</span>
            <span className="text-xs text-muted">{file ? 'دوس هنا لاختيار ملف تاني' : '.xlsx أو .csv'}</span>
            <input
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }}
            />
          </label>
          {readError && <p role="alert" className="mt-3 rounded-2xl bg-brand/10 p-3 font-bold text-brand">{readError}</p>}
        </section>

        {/* step 3: what we found */}
        {check && !result && (
          <section className="grid gap-3">
            {check.headerError ? (
              <p role="alert" className="rounded-2xl bg-brand/10 p-3 font-bold text-brand">{check.headerError}</p>
            ) : (
              <>
                <p className="font-black text-ink">3. راجع وارفع</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat n={check.products.length} label="منتج جاهز" tone="ok" />
                  <Stat n={check.errors.length} label="سطر فيه مشكلة" tone={check.errors.length ? 'bad' : ''} />
                  <Stat n={check.skipped.length} label="موجود بالفعل" />
                </div>

                {check.errors.length > 0 && (
                  <div className="rounded-2xl bg-brand/5 p-3 ring-1 ring-brand/20">
                    <p className="mb-2 text-sm font-bold text-brand">صلّح السطور دي في الملف وارفعه تاني (المنتجات اللي فيها مشكلة مش هتترفع):</p>
                    <ul className="grid max-h-56 gap-1.5 overflow-y-auto text-sm">
                      {check.errors.map((e, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="badge shrink-0 bg-brand text-white">سطر {e.row}</span>
                          <span className="text-ink">{e.msg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {check.skipped.length > 0 && (
                  <p className="rounded-2xl bg-paper p-3 text-sm text-muted">
                    مش هنضيف دول عشان موجودين في المحل بنفس الاسم: {check.skipped.map((s) => `«${s.name}»`).join('، ')}. لو عايز تغيّرهم، عدّلهم من القائمة.
                  </p>
                )}

                {check.products.length > 0 && (
                  <>
                    <ul className="grid max-h-56 gap-1.5 overflow-y-auto rounded-2xl border border-line p-3 text-sm">
                      {check.products.map((p) => {
                        const v = p.payload.variants
                        const prices = [...new Set(v.map((x) => x.price))]
                        return (
                          <li key={p.rows[0]} className="flex flex-wrap items-baseline gap-x-2">
                            <b className="text-ink">{p.payload.name_ar}</b>
                            <span className="text-muted">
                              {categories.find((c) => c.id === p.payload.category)?.name_ar} · {v.length} مقاس · {v.reduce((s, x) => s + x.stock_qty, 0)} قطعة · {prices.join(' / ')} ج.م
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl bg-paper px-4 py-3 text-sm font-semibold">
                      <input type="checkbox" className="size-5 accent-[#e3262d]" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
                      اخفيهم من الموقع لحد ما أضيف الصور
                    </label>
                    <button type="button" disabled={busy} onClick={upload} className="btn btn-red h-12 text-lg">
                      {busy ? `جاري الرفع… ${progress.done} من ${progress.total}` : `رفع ${check.products.length} منتج`}
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        )}

        {result && (
          <section className="grid gap-3">
            {result.saved > 0 && (
              <p className="rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-800">
                تمت إضافة {result.saved} منتج ✓ {hidden ? 'وهم مخفيين لحد ما تضيف الصور وتدوس «إظهار».' : ''}
              </p>
            )}
            {result.failed.length > 0 && (
              <div className="rounded-2xl bg-brand/5 p-3 ring-1 ring-brand/20">
                <p className="mb-2 text-sm font-bold text-brand">{result.failed.length} منتج متضافش:</p>
                <ul className="grid gap-1 text-sm">
                  {result.failed.map((f) => <li key={f.rows[0]}>«{f.name}» (سطر {f.rows[0]}): {f.msg}</li>)}
                </ul>
              </div>
            )}
            <button type="button" onClick={onClose} className="btn btn-ink h-12">تمام</button>
          </section>
        )}
      </div>
    </Modal>
  )
}

function Stat({ n, label, tone }) {
  const cls = tone === 'ok' && n ? 'bg-emerald-50 text-emerald-800' : tone === 'bad' ? 'bg-brand/10 text-brand' : 'bg-paper text-ink'
  return (
    <div className={`rounded-2xl p-3 ${cls}`}>
      <p className="text-2xl font-black">{n}</p>
      <p className="text-xs font-bold">{label}</p>
    </div>
  )
}
