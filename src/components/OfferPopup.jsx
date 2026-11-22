import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { useCatalog } from '../lib/catalogState'
import { maxDiscount } from '../lib/catalog'
import { waLink } from '../lib/links'
import { CloseIcon, WhatsAppIcon } from './Icons'

const KEY = 'ys-offer-closed'

// Small dark offer box in the bottom corner, like the reference store.
// It only appears when there is a real discount, waits a few seconds, and stays closed once closed.
// (No email box: the shop has nowhere to keep emails yet, so it points to WhatsApp instead.)
export default function OfferPopup() {
  const { t, num } = useLang()
  const { products } = useData()
  const { browse } = useCatalog()
  const [open, setOpen] = useState(false)
  const topDiscount = useMemo(() => products.filter((p) => p.totalStock > 0).reduce((m, p) => Math.max(m, maxDiscount(p)), 0), [products])

  useEffect(() => {
    if (topDiscount <= 0) return
    try { if (localStorage.getItem(KEY)) return } catch {}
    const id = setTimeout(() => setOpen(true), 6000)
    return () => clearTimeout(id)
  }, [topDiscount])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    setOpen(false)
    try { localStorage.setItem(KEY, '1') } catch {}
  }
  if (!open) return null

  return (
    <div role="dialog" aria-labelledby="offer-title" className="rise fixed inset-x-4 bottom-20 z-40 border border-line bg-white p-7 text-center text-ink shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)] sm:inset-x-auto sm:end-5 sm:w-[380px] md:bottom-5">
      <button type="button" onClick={close} aria-label={t('popupClose')} className="absolute end-2 top-2 grid size-10 place-items-center text-muted hover:text-ink">
        <CloseIcon className="size-5" />
      </button>
      <p className="script text-3xl leading-none text-muted" aria-hidden="true">{t('heroScript')}</p>
      <h2 id="offer-title" className="display mt-1 px-8 text-2xl text-ink-900">{t('popupTitle')}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{t('popupText')(num(topDiscount))}</p>
      <a href={waLink()} target="_blank" rel="noopener noreferrer" onClick={close} className="btn btn-ink mt-5 h-12 w-full">
        <WhatsAppIcon className="size-5" />
        {t('popupCta')}
      </a>
      <button type="button" onClick={() => { close(); browse({ onSale: true, sort: 'discount' }) }} className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-ink">
        {t('popupShop')}
      </button>
    </div>
  )
}
