import { useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { waLink } from '../lib/links'
import GarmentArt from './GarmentArt'
import { BagIcon, CloseIcon, MinusIcon, PlusIcon, TrashIcon, WhatsAppIcon } from './Icons'

export default function CartDrawer() {
  const { t, pick, price, num, dir } = useLang()
  const cart = useCart()
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const panel = useRef(null)
  const closeBtn = useRef(null)

  useEffect(() => {
    if (!cart.open) return
    const prevFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') cart.setOpen(false)
      if (e.key === 'Tab' && panel.current) {
        // keep keyboard focus inside the drawer
        const f = panel.current.querySelectorAll('button, a[href], input, textarea, select')
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      prevFocus?.focus?.()
    }
  }, [cart.open]) // eslint-disable-line react-hooks/exhaustive-deps

  const message = () => {
    const lines = cart.lines.map(
      (l, i) => `${i + 1}) ${pick(l.product.name)} — ${t('size')} ${l.size} × ${l.qty} — ${price(l.product.price * l.qty)}`,
    )
    return [
      t('orderIntro'),
      '',
      ...lines,
      '',
      `${t('orderTotal')}: ${price(cart.total)}`,
      name.trim() ? `${t('orderName')}: ${name.trim()}` : null,
      area.trim() ? `${t('orderArea')}: ${area.trim()}` : null,
      '',
      t('orderFooter'),
    ]
      .filter((x) => x !== null)
      .join('\n')
  }

  // slide in from the reading-end side: left in RTL, right in LTR
  const side = dir === 'rtl' ? 'left-0' : 'right-0'
  const hidden = dir === 'rtl' ? '-translate-x-full' : 'translate-x-full'

  return (
    <div className={`fixed inset-0 z-50 ${cart.open ? '' : 'pointer-events-none'}`} aria-hidden={!cart.open}>
      <div
        className={`absolute inset-0 bg-ink/60 backdrop-blur-[2px] transition-opacity duration-300 ${cart.open ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => cart.setOpen(false)}
      />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        inert={cart.open ? undefined : ''}
        className={`absolute top-0 ${side} flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-[transform,visibility] duration-300 ease-out ${cart.open ? 'visible translate-x-0' : `invisible ${hidden}`}`}
      >
        <div className="flex items-center justify-between bg-ink px-5 py-4 text-white">
          <h2 id="cart-title" className="flex items-center gap-2 text-xl font-black">
            <BagIcon className="size-6" />
            {t('cartTitle')}
            {cart.count > 0 && <span className="rounded-full bg-brand px-2.5 text-sm leading-6">{num(cart.count)}</span>}
          </h2>
          <button ref={closeBtn} type="button" onClick={() => cart.setOpen(false)} aria-label={t('closeCart')} className="grid size-10 place-items-center rounded-full hover:bg-white/10">
            <CloseIcon className="size-6" />
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid size-20 place-items-center rounded-full bg-paper text-muted"><BagIcon className="size-9" /></span>
              <p className="mt-4 text-muted">{t('cartEmpty')}</p>
              <a href="#shop" onClick={() => cart.setOpen(false)} className="btn btn-ink mt-5 h-11 px-6">{t('heroCta')}</a>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {cart.lines.map((l) => (
                <li key={l.id + l.size} className="flex gap-3 py-4">
                  {l.product.image ? (
                    <img src={l.product.image} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <GarmentArt {...l.product.art} className="size-20 shrink-0 rounded-2xl p-1.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-ink">{pick(l.product.name)}</p>
                    <p className="text-sm text-muted">{t('size')}: <b className="text-ink">{l.size}</b></p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-full ring-1 ring-line">
                        <button type="button" className="qty-btn" aria-label={t('increase')} onClick={() => cart.setQty(l.id, l.size, l.qty + 1)}><PlusIcon className="size-4" /></button>
                        <span className="w-7 text-center font-bold" aria-label={t('qty')}>{num(l.qty)}</span>
                        <button type="button" className="qty-btn" aria-label={t('decrease')} onClick={() => cart.setQty(l.id, l.size, l.qty - 1)}><MinusIcon className="size-4" /></button>
                      </div>
                      <span className="font-black text-brand">{price(l.product.price * l.qty)}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => cart.setQty(l.id, l.size, 0)} aria-label={`${t('remove')} ${pick(l.product.name)}`} className="grid size-9 shrink-0 place-items-center self-start rounded-full text-muted hover:bg-paper hover:text-brand">
                    <TrashIcon className="size-[18px]" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-line bg-paper p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="o-name" className="field-label">{t('yourName')}</label>
                  <input id="o-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="field h-11 bg-white" />
                </div>
                <div>
                  <label htmlFor="o-area" className="field-label">{t('yourArea')}</label>
                  <input id="o-area" value={area} onChange={(e) => setArea(e.target.value)} className="field h-11 bg-white" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="font-bold text-muted">{t('subtotal')}</span>
                <span className="text-2xl font-black text-ink">{price(cart.total)}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t('cartNote')}</p>
              <a href={waLink(message())} target="_blank" rel="noopener noreferrer" className="btn mt-4 h-13 w-full bg-[#1fa855] text-lg text-white hover:bg-[#178f47]">
                <WhatsAppIcon className="size-5" />
                {t('sendOrder')}
              </a>
              <button type="button" onClick={cart.clear} className="mt-2 w-full py-2 text-sm font-bold text-muted hover:text-brand">
                {t('clearCart')}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
