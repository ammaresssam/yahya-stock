import { useEffect } from 'react'
import { CloseIcon } from '../components/Icons'


export const ART_TYPES = [
  ['tee', 'تيشيرت'],
  ['shirt', 'قميص'],
  ['hoodie', 'هودي'],
  ['jacket', 'جاكيت'],
  ['pants', 'بنطلون'],
  ['dress', 'فستان'],
  ['skirt', 'جيبة'],
]

export const QUICK_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'Free Size']
export const MAX_IMAGES = 8 // matches the limit enforced by the database
export { LOW_STOCK } from '../lib/product'

// Modal that becomes a full-height sheet on phones
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-xl font-black text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-10 place-items-center rounded-full hover:bg-paper">
            <CloseIcon className="size-6" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div
      role="status"
      className={`fixed inset-x-4 bottom-5 z-[60] mx-auto w-fit max-w-md rounded-full px-5 py-3 text-center font-bold text-white shadow-xl ${
        toast.kind === 'error' ? 'bg-brand' : 'bg-ink'
      }`}
    >
      {toast.msg}
    </div>
  )
}

// ---------- orders ----------
export const ORDER_STATUS = {
  pending_payment: { label: 'في انتظار الدفع', cls: 'bg-amber-100 text-amber-900' },
  placed: { label: 'جديد', cls: 'bg-brand text-white' },
  confirmed: { label: 'مؤكد', cls: 'bg-sky-100 text-sky-900' },
  preparing: { label: 'جاري التجهيز', cls: 'bg-violet-100 text-violet-900' },
  shipped: { label: 'مع المندوب', cls: 'bg-indigo-100 text-indigo-900' },
  delivered: { label: 'تم التوصيل', cls: 'bg-emerald-100 text-emerald-900' },
  cancelled: { label: 'ملغي', cls: 'bg-paper text-muted line-through' },
  payment_failed: { label: 'الدفع فشل', cls: 'bg-paper text-muted' },
}
export const PAY_STATUS = { unpaid: 'لم يُدفع', pending: 'في انتظار الدفع', paid: 'مدفوع', failed: 'فشل الدفع', refunded: 'مسترد' }
export const PAY_METHOD = { cod: 'عند الاستلام', card: 'بطاقة' }

// Mirrors public.order_next_statuses() so the panel only offers valid buttons.
// The database checks again — this list is only for display.
export const NEXT_STATUS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  pending_payment: ['cancelled'],
}
export const ACTION_LABEL = {
  confirmed: 'تأكيد الطلب',
  preparing: 'بدء التجهيز',
  shipped: 'تسليم للمندوب',
  delivered: 'تم التوصيل',
  cancelled: 'إلغاء الطلب',
}

export function StatusPill({ status }) {
  const s = ORDER_STATUS[status] ?? { label: status, cls: 'bg-paper text-ink' }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}
