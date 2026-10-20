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
