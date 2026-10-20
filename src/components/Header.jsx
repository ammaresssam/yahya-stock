import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { waLink } from '../lib/links'
import { site } from '../data/site'
import { useData } from '../lib/store'
import { Wordmark } from './Brand'
import { BagIcon, CloseIcon, GlobeIcon, MenuIcon, WhatsAppIcon } from './Icons'

export const navItems = [
  ['#home', 'navHome'],
  ['#shop', 'navShop'],
  ['#new', 'navNew'],
  ['#about', 'navAbout'],
  ['#contact', 'navContact'],
]

export default function Header() {
  const { t, pick, toggle } = useLang()
  const cart = useCart()
  const { live } = useData()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className={`sticky top-0 z-40 bg-ink text-white transition-shadow ${scrolled ? 'shadow-[0_8px_30px_-12px_rgba(0,0,0,.5)]' : ''}`}>
      {!live && (
        <p className="bg-brand px-4 py-1.5 text-center text-[12px] font-semibold leading-snug sm:text-[13px]">{t('demoBar')}</p>
      )}
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <a href="#home" className="shrink-0 rounded-lg focus-visible:outline-offset-4" aria-label={pick(site.name)}>
          <Wordmark className="h-10 w-auto sm:h-12" title={pick(site.name)} />
        </a>

        <nav aria-label={t('menu')} className="ms-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.map(([href, key]) => (
              <li key={href}>
                <a href={href} className="nav-link rounded-full px-4 py-2 text-[15px] font-semibold text-white/80 transition hover:text-white">
                  {t(key)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={t('switchLangLabel')}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-white/85 transition hover:bg-white/10 hover:text-white"
          >
            <GlobeIcon className="size-4" />
            <span>{t('switchLang')}</span>
          </button>

          <button
            type="button"
            onClick={() => cart.setOpen(true)}
            aria-label={`${t('cart')} (${cart.count})`}
            className="relative inline-flex size-10 items-center justify-center rounded-full transition hover:bg-white/10"
          >
            <BagIcon className="size-[22px]" />
            {cart.count > 0 && (
              <span className="absolute -top-0.5 -end-0.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold leading-5 ring-2 ring-ink">
                {cart.count}
              </span>
            )}
          </button>

          <a
            href={waLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-11 items-center gap-2 rounded-full bg-brand px-5 text-[15px] font-bold transition hover:bg-brand-600 active:scale-[.98] sm:inline-flex"
          >
            <WhatsAppIcon className="size-[18px]" />
            {t('whatsapp')}
          </a>

          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full transition hover:bg-white/10 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t('closeMenu') : t('menu')}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
          </button>
        </div>
      </div>

      <div id="mobile-menu" hidden={!open} className="border-t border-white/10 lg:hidden">
        <nav aria-label={t('menu')} className="mx-auto max-w-7xl px-4 pb-5 pt-2 sm:px-6">
          <ul className="grid">
            {navItems.map(([href, key]) => (
              <li key={href}>
                <a href={href} onClick={() => setOpen(false)} className="flex items-center justify-between border-b border-white/10 py-3.5 text-lg font-bold">
                  {t(key)}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={waLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-brand font-bold"
          >
            <WhatsAppIcon className="size-5" />
            {t('orderWhatsapp')}
          </a>
        </nav>
      </div>
    </header>
  )
}
