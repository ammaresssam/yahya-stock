import { useCallback, useEffect, useMemo, useState } from 'react'
import supabase from '../lib/supabase'
import { PhoneIcon, WhatsAppIcon } from '../components/Icons'
import { ACTION_LABEL, Modal, NEXT_STATUS, ORDER_STATUS, PAY_METHOD, PAY_STATUS, StatusPill } from './ui'

const OPEN = ['placed', 'confirmed', 'preparing', 'shipped']
const PAYMENT_OUTCOME = {
  paid: 'تم الدفع ✓',
  failed_attempt: 'محاولة دفع مرفوضة',
  pending: 'الدفع قيد المراجعة',
  refunded: 'تم استرداد المبلغ',
  voided: 'تم إلغاء العملية',
  amount_mismatch: '⚠️ مبلغ مختلف عن الطلب',
  paid_after_cancel: '⚠️ دفع بعد إلغاء الطلب — محتاج استرداد',
  ignored: 'دفع مكرر (اتجاهل)',
}
const FILTERS = [
  ['open', 'الطلبات المفتوحة'],
  ['placed', 'جديد'],
  ['confirmed', 'مؤكد'],
  ['preparing', 'جاري التجهيز'],
  ['shipped', 'مع المندوب'],
  ['delivered', 'تم التوصيل'],
  ['cancelled', 'ملغي'],
  ['pending_payment', 'في انتظار الدفع'],
  ['all', 'الكل'],
]
const SELECT = '*, order_items(*), order_status_history(*), shipping_zones(name_ar), payment_events(*)'

const money = (n) => `${Number(n).toLocaleString('ar-EG')} ج.م`
const when = (iso) => new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
const orderNo = (o) => `YS-${o.order_number}`
const waPhone = (p) => `2${p}` // 01XXXXXXXXX → 201XXXXXXXXX

// Ready-made message to the customer for each step (the owner sends it from WhatsApp).
const customerMessage = (o) => {
  const first = o.customer_name.split(' ')[0]
  const n = orderNo(o)
  return {
    placed: `أهلاً ${first}، معاك يحيى استوك 👋 استلمنا طلبك رقم ${n} بإجمالي ${money(o.total)}. ممكن تأكدلنا العنوان: ${o.area}، ${o.address}؟`,
    confirmed: `أهلاً ${first}، طلبك رقم ${n} اتأكد ✓ وهنبدأ نجهزه.`,
    preparing: `أهلاً ${first}، بنجهز طلبك رقم ${n} دلوقتي.`,
    shipped: `أهلاً ${first}، طلبك رقم ${n} خرج مع المندوب 🚚 جهّز ${money(o.total)} كاش عند الاستلام.`,
    delivered: `شكراً يا ${first} إنك اشتريت من يحيى استوك! نتمنى المنتجات تعجبك ❤️`,
    cancelled: `أهلاً ${first}، طلبك رقم ${n} اتلغى. لو حابب تطلب تاني إحنا في الخدمة.`,
  }[o.status] ?? `أهلاً ${first}، بخصوص طلبك رقم ${n}`
}

export default function OrdersTab({ notify, onStockChange }) {
  const [orders, setOrders] = useState(null)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState('open')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('orders').select(SELECT).order('created_at', { ascending: false })
    if (error) return setFailed(true)
    setFailed(false)
    setOrders(data)
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000) // pick up new orders without a manual refresh
    return () => clearInterval(id)
  }, [load])

  const counts = useMemo(() => {
    const c = { all: orders?.length ?? 0, open: 0 }
    for (const o of orders ?? []) {
      c[o.status] = (c[o.status] ?? 0) + 1
      if (OPEN.includes(o.status)) c.open++
    }
    return c
  }, [orders])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^ys-?/, '')
    return (orders ?? []).filter((o) => {
      if (filter === 'open' ? !OPEN.includes(o.status) : filter !== 'all' && o.status !== filter) return false
      if (!term) return true
      return String(o.order_number).includes(term) || o.phone.includes(term) || o.customer_name.toLowerCase().includes(term)
    })
  }, [orders, filter, q])

  const open = orders?.find((o) => o.id === openId)

  if (failed) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-line">
        <p className="font-bold text-ink">تعذر تحميل الطلبات</p>
        <button type="button" onClick={load} className="btn btn-ink mt-4 h-11 px-6">إعادة المحاولة</button>
      </div>
    )
  }
  if (!orders) return <p className="py-16 text-center text-muted">جاري تحميل الطلبات…</p>

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input type="search" aria-label="بحث في الطلبات" placeholder="رقم الطلب، الاسم أو الموبايل…" value={q} onChange={(e) => setQ(e.target.value)} className="field h-11 min-w-0 flex-1 basis-56 bg-white" />
        <button type="button" onClick={load} className="btn h-11 border border-line bg-white px-4 text-sm hover:border-ink">تحديث</button>
      </div>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4" role="tablist" aria-label="حالة الطلب">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className="filter-tab h-9 px-3.5 text-sm">
            {label}
            <span className="filter-count">{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-3xl bg-white p-10 text-center text-muted ring-1 ring-line">{orders.length ? 'مفيش طلبات هنا.' : 'لسه مفيش طلبات. أول ما عميل يطلب من الموقع هيظهر هنا.'}</p>
      ) : (
        <ul className="grid gap-2">
          {list.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => setOpenId(o.id)} className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] bg-white p-4 text-start ring-1 transition hover:ring-ink ${o.status === 'placed' ? 'ring-brand/50' : 'ring-line'}`}>
                <span className="min-w-0 flex-1 basis-48">
                  <span className="flex items-center gap-2">
                    <b dir="ltr" className="text-ink">{orderNo(o)}</b>
                    <StatusPill status={o.status} />
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">{o.customer_name} · <span dir="ltr">{o.phone}</span> · {o.shipping_zones?.name_ar ?? o.zone_id}</span>
                </span>
                <span className="text-end">
                  <b className="block text-ink">{money(o.total)}</b>
                  <span className="text-xs text-muted">{PAY_METHOD[o.payment_method]} · {when(o.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <OrderDetail
          order={open}
          onClose={() => setOpenId(null)}
          onChanged={async (stockChanged) => {
            await load()
            if (stockChanged) onStockChange?.()
          }}
          notify={notify}
        />
      )}
    </div>
  )
}

function OrderDetail({ order: o, onClose, onChanged, notify }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const next = NEXT_STATUS[o.status] ?? []
  const history = [...(o.order_status_history ?? [])].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id))

  const change = async (status) => {
    if (status === 'cancelled' && !window.confirm(`إلغاء الطلب ${orderNo(o)}؟\nالكميات هترجع للمخزون.`)) return
    setBusy(status)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('admin_set_order_status', {
      p_order_id: o.id,
      p_status: status,
      p_expected_status: o.status, // refuse if someone else changed it meanwhile
      p_note: note.trim() || null,
    })
    setBusy(null)
    if (rpcError || !data?.ok) {
      const code = data?.error
      setError(
        code === 'status_changed' ? `الطلب اتغير من مكان تاني (حالته دلوقتي: ${ORDER_STATUS[data.status]?.label ?? data.status}). حدّثنا البيانات.`
          : code === 'invalid_transition' ? 'الخطوة دي مش مسموحة من الحالة الحالية.'
          : code === 'note_too_long' ? 'الملاحظة طويلة (أقصى 500 حرف).'
          : 'تعذر الحفظ — حاول مرة أخرى.',
      )
      if (code === 'status_changed') onChanged(false)
      return
    }
    setNote('')
    notify(status === 'cancelled' ? 'تم إلغاء الطلب ورجعت الكميات للمخزون' : `تم: ${ORDER_STATUS[status].label} ✓`)
    onChanged(status === 'cancelled')
  }

  return (
    <Modal title={`طلب ${orderNo(o)}`} onClose={onClose}>
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={o.status} />
          <span className="text-sm text-muted">{when(o.created_at)}</span>
          <span className="badge bg-paper text-ink">{PAY_METHOD[o.payment_method]} · {PAY_STATUS[o.payment_status]}</span>
        </div>

        {o.payment_method === 'card' && o.payment_status === 'paid' && ['cancelled', 'payment_failed'].includes(o.status) && (
          <p role="alert" className="rounded-2xl bg-brand/10 p-3 text-sm font-bold text-brand">الطلب ده مدفوع بالبطاقة لكنه ملغي — لازم ترجّع الفلوس للعميل من لوحة Paymob (أو تتواصل معاه لو المنتج لسه متاح).</p>
        )}
        {(o.payment_events ?? []).some((e) => e.outcome === 'amount_mismatch') && (
          <p role="alert" className="rounded-2xl bg-brand/10 p-3 text-sm font-bold text-brand">وصل دفع بمبلغ مختلف عن إجمالي الطلب — الطلب ماتعلمش كمدفوع. راجعه في لوحة Paymob.</p>
        )}

        {/* customer */}
        <section className="rounded-2xl bg-paper p-4">
          <p className="text-lg font-black text-ink">{o.customer_name}</p>
          <p dir="ltr" className="text-end font-bold text-ink sm:text-start">{o.phone}</p>
          {o.email && <p dir="ltr" className="text-end text-sm text-muted sm:text-start">{o.email}</p>}
          <p className="mt-2 text-ink"><b>{o.shipping_zones?.name_ar ?? o.zone_id}</b> — {o.area}</p>
          <p className="text-ink">{o.address}</p>
          {o.notes && <p className="mt-2 rounded-xl bg-white p-2 text-sm text-ink">📝 {o.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`tel:+2${o.phone}`} className="btn h-10 bg-ink px-4 text-sm text-white"><PhoneIcon className="size-4" />اتصال</a>
            <a href={`https://wa.me/${waPhone(o.phone)}?text=${encodeURIComponent(customerMessage(o))}`} target="_blank" rel="noopener noreferrer" className="btn h-10 bg-[#1fa855] px-4 text-sm text-white">
              <WhatsAppIcon className="size-4" />رسالة للعميل
            </a>
          </div>
        </section>

        {/* items */}
        <section>
          <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
            {(o.order_items ?? []).map((i) => (
              <li key={i.id} className="flex justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block font-bold text-ink">{i.product_name_ar}</span>
                  <span className="text-sm text-muted">مقاس <b dir="ltr">{i.size}</b> × {i.qty} · {money(i.unit_price)} للقطعة</span>
                </span>
                <b className="text-ink">{money(i.line_total)}</b>
              </li>
            ))}
          </ul>
          <dl className="mt-2 grid gap-1 px-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted">المنتجات</dt><dd className="font-bold">{money(o.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">التوصيل</dt><dd className="font-bold">{money(o.shipping_fee)}</dd></div>
            <div className="flex justify-between text-base"><dt className="font-black">الإجمالي</dt><dd className="font-black">{money(o.total)}</dd></div>
          </dl>
        </section>

        {/* actions */}
        {next.length > 0 ? (
          <section className="rounded-2xl ring-1 ring-line p-4">
            <label htmlFor="o-note" className="field-label">ملاحظة (اختياري — بتتسجل مع التغيير)</label>
            <input id="o-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="مثلاً: العميل أكد العنوان" className="field h-11" />
            {error && <p role="alert" className="mt-3 rounded-2xl bg-brand/10 p-3 text-sm font-bold text-brand">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {next.map((s) => (
                <button key={s} type="button" disabled={busy !== null} onClick={() => change(s)} className={`btn h-12 flex-1 px-5 ${s === 'cancelled' ? 'border border-brand text-brand hover:bg-brand/10' : 'btn-red'}`}>
                  {busy === s ? 'جاري الحفظ…' : ACTION_LABEL[s]}
                </button>
              ))}
            </div>
            {o.payment_method === 'cod' && next.includes('delivered') && <p className="mt-2 text-xs text-muted">«تم التوصيل» بيسجّل إن المندوب استلم الكاش.</p>}
            {o.status === 'pending_payment' && <p className="mt-2 text-xs text-muted">طلب البطاقة بيتأكد لوحده لما شركة الدفع تأكد الدفع — مينفعش يتأكد يدوي.</p>}
          </section>
        ) : (
          <p className="rounded-2xl bg-paper p-3 text-sm text-muted">الطلب ده خلص — مفيش خطوات تانية.</p>
        )}

        {/* card payment notifications received from Paymob (signature verified) */}
        {o.payment_method === 'card' && (o.payment_events ?? []).length > 0 && (
          <section>
            <p className="field-label">إشعارات الدفع من Paymob</p>
            <ul className="grid gap-1.5 text-sm">
              {[...o.payment_events].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-paper px-3 py-2">
                  <span className="font-bold text-ink">{PAYMENT_OUTCOME[e.outcome] ?? e.outcome}</span>
                  <span className="text-muted" dir="ltr">#{e.transaction_id} · {(e.amount_cents / 100).toLocaleString('ar-EG')} {e.currency}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* history */}
        <section>
          <p className="field-label">سجل الطلب</p>
          <ol className="grid gap-2">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-2 text-sm">
                <StatusPill status={h.to_status} />
                <span className="text-muted">{when(h.created_at)}{h.note ? ` — ${h.note === 'order placed' ? 'الطلب اتعمل من الموقع' : h.note === 'cash collected' ? 'تم تحصيل الكاش' : h.note}` : ''}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Modal>
  )
}
