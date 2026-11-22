import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { useData } from '../lib/store'
import { useCatalog } from '../lib/catalogState'
import { isOnSale, maxDiscount } from '../lib/catalog'
import { checkoutAvailable, rememberedOrders } from '../lib/api'
import { waLink } from '../lib/links'
import { site } from '../data/site'
import { TextLogo } from './Brand'
import { BagIcon, ChevronIcon, CloseIcon, GlobeIcon, MenuIcon, ReceiptIcon, SearchIcon, WhatsAppIcon } from './Icons'

export const navItems = [
  ['#home', 'navHome'],
  ['#/shop', 'navShop'],
  ['#new', 'navNew'],
  ['#about', 'navAbout'],
  ['#contact', 'navContact'],
]

// Thin bar above the header. Only facts that are true right now; it rotates when there is more than one.
function AnnouncementBar() {
  const { t, num } = useLang()
  const { live, products } = useData()
  const { browse } = useCatalog()
  const topDiscount = products.filter((p) => p.totalStock > 0).reduce((m, p) => Math.max(m, maxDiscount(p)), 0)
  const items = [
    !live && { key: 'demo', text: t('demoBar') },
    topDiscount > 0 && { key: 'offers', text: t('promoOffers')(num(topDiscount)), go: () => browse({ onSale: true, sort: 'discount' }) },
    checkoutAvailable && { key: 'cod', text: t('promoCod') },
    { key: 'store', text: t('announceStore'), href: '#visit' },
  ].filter(Boolean)
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (items.length < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setI((n) => n + 1), 5000)
    return () => clearInterval(id)
  }, [items.length, paused])

  const cur = items[((i % items.length) + items.length) % items.length]
  const many = items.length > 1
  const content = cur.go ? (
    <button type="button" onClick={cur.go} className="link-u">{cur.text}</button>
  ) : cur.href ? (
    <a href={cur.href} className="link-u">{cur.text}</a>
  ) : (
    <span>{cur.text}</span>
  )

  return (
    <div className="border-b border-line bg-paper text-ink" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="page-width flex min-h-10 items-center justify-center gap-2">
        {many && (
          <button type="button" onClick={() => setI((n) => n - 1)} aria-label={t('prevMessage')} className="grid size-8 shrink-0 place-items-center hover:bg-ink/5">
            <ChevronIcon className="size-4 -scale-x-100 rtl:scale-x-100" />
          </button>
        )}
        <p key={cur.key} className="announce-in caps min-w-0 flex-1 py-1.5 text-center text-[12px] leading-snug sm:flex-none sm:px-6" aria-live="polite">
          {content}
        </p>
        {many && (
          <button type="button" onClick={() => setI((n) => n + 1)} aria-label={t('nextMessage')} className="grid size-8 shrink-0 place-items-center hover:bg-ink/5">
            <ChevronIcon className="size-4 rtl:-scale-x-100" />
          </button>
        )}
      </div>
    </div>
  )
}

// Search opens over the header, like a theme's search modal.
function SearchBar({ onClose }) {
  const { t } = useLang()
  const { filters, browse } = useCatalog()
  const [q, setQ] = useState(filters.q)
  const input = useRef(null)

  useEffect(() => {
    input.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e) => {
    e.preventDefault()
    browse({ q: q.trim() })
    onClose()
  }
  return (
    <div className="absolute inset-0 z-10 bg-page">
      <div className="page-width flex h-full items-center gap-3">
        <form role="search" onSubmit={submit} className="relative mx-auto flex w-full max-w-2xl">
          <label htmlFor="site-search" className="sr-only">{t('searchLabel')}</label>
          <input
            ref={input}
            id="site-search"
            type="search"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPh')}
            className="h-12 w-full border border-ink/40 bg-white ps-4 pe-12 text-base text-ink outline-none transition placeholder:text-muted focus:border-ink"
          />
          <button type="submit" aria-label={t('searchLabel')} className="absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-ink hover:bg-paper">
            <SearchIcon className="size-5" />
          </button>
        </form>
        <button type="button" onClick={onClose} aria-label={t('searchClose')} className="grid size-11 shrink-0 place-items-center rounded-md text-ink hover:bg-paper">
          <CloseIcon className="size-6" />
        </button>
      </div>
    </div>
  )
}

// Phone menu: a drawer from the start side with the same links as the desktop menu.
function MenuDrawer({ open, onClose, links }) {
  const { t, pick, dir, toggle, lang } = useLang()
  const closeBtn = useRef(null)

  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      prevFocus?.focus?.()
    }
  }, [open, onClose])

  const hidden = dir === 'rtl' ? 'translate-x-full' : '-translate-x-full'
  return (
    <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-ink/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <nav
        id="mobile-menu"
        aria-label={t('menu')}
        inert={open ? undefined : ''}
        className={`absolute inset-y-0 start-0 flex w-[86%] max-w-sm flex-col bg-white shadow-xl transition-[transform,visibility] duration-300 ease-out ${open ? 'visible translate-x-0' : `invisible ${hidden}`}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <TextLogo lang={lang} size="sm" />
          <button ref={closeBtn} type="button" onClick={onClose} aria-label={t('closeMenu')} className="grid size-10 place-items-center rounded-md text-ink hover:bg-paper">
            <CloseIcon className="size-6" />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto px-4 py-2">
          {links.map((l) => (
            <li key={l.key}>
              {l.href ? (
                <a href={l.href} onClick={onClose} className={`display flex items-center justify-between border-b border-line py-4 text-lg ${l.hot ? 'text-brand' : 'text-ink'}`}>
                  {l.label}
                  <ChevronIcon className="size-5 text-muted rtl:-scale-x-100" />
                </a>
              ) : (
                <button type="button" onClick={() => { l.go(); onClose() }} className={`display flex w-full items-center justify-between border-b border-line py-4 text-start text-lg ${l.hot ? 'text-brand' : 'text-ink'}`}>
                  {l.label}
                  <ChevronIcon className="size-5 text-muted rtl:-scale-x-100" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="grid gap-2 border-t border-line bg-paper p-4">
          <button type="button" onClick={toggle} aria-label={t('switchLangLabel')} className="btn btn-outline h-11">
            <GlobeIcon className="size-4" />
            {t('switchLang')}
          </button>
          <a href={waLink()} target="_blank" rel="noopener noreferrer" className="btn h-11 bg-[#1fa855] text-white hover:bg-[#178f47]">
            <WhatsAppIcon className="size-5" />
            {t('orderWhatsapp')}
          </a>
        </div>
      </nav>
    </div>
  )
}

export default function Header({ route = 'home' }) {
  const { t, pick, toggle, lang } = useLang()
  const cart = useCart()
  const { categories, products } = useData()
  const { filters, browse } = useCatalog()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const hasOffers = products.some(isOnSale)
  const showOrders = checkoutAvailable || rememberedOrders().length > 0
  const onShop = route === 'shop'
  const closeMenu = useCallback(() => setOpen(false), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  // the same links in the desktop menu and the phone drawer
  const links = [
    { key: 'home', label: t('navHome'), href: '#home', active: route === 'home' },
    { key: 'all', label: t('navShop'), go: () => browse({}), active: onShop && filters.category === 'all' && !filters.onSale },
    ...categories.map((c) => ({ key: c.id, label: pick(c.name), go: () => browse({ category: c.id }), active: onShop && filters.category === c.id && !filters.onSale })),
    ...(hasOffers ? [{ key: 'offers', label: t('navOffers'), go: () => browse({ onSale: true, sort: 'discount' }), active: onShop && filters.onSale, hot: true }] : []),
    { key: 'new', label: t('navNew'), href: '#new' },
    { key: 'contact', label: t('navContact'), href: '#contact' },
  ]

  const icon = 'relative grid size-11 place-items-center rounded-md text-ink transition hover:bg-paper'
  const navLink = (on, hot) => `caps relative inline-flex h-10 items-center px-3 text-[13px] transition underline-offset-[8px] hover:underline ${on ? 'text-ink-900 underline' : hot ? 'text-brand' : 'text-ink/75 hover:text-ink-900'}`

  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-40 border-b border-line bg-page">
        <div className="page-width relative flex h-[72px] items-center gap-1 lg:h-[96px] lg:gap-6">
          <button
            type="button"
            className={`${icon} -ms-2.5 lg:hidden`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={t('menu')}
            onClick={() => setOpen(true)}
          >
            <MenuIcon className="size-6" />
          </button>

          <a href="#home" className="absolute start-1/2 shrink-0 -translate-x-1/2 rounded-md rtl:translate-x-1/2 lg:static lg:translate-x-0 lg:rtl:translate-x-0" aria-label={pick(site.name)}>
            <TextLogo lang={lang} />
          </a>

          <nav aria-label={t('categoriesNav')} className="hidden min-w-0 flex-1 lg:block">
            <ul className="flex flex-wrap items-center justify-center gap-x-1">
              {links.map((l) => (
                <li key={l.key}>
                  {l.href ? (
                    <a href={l.href} aria-current={l.active ? 'page' : undefined} className={navLink(l.active, l.hot)}>{l.label}</a>
                  ) : (
                    <button type="button" onClick={l.go} aria-current={l.active ? 'true' : undefined} className={navLink(l.active, l.hot)}>{l.label}</button>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className="ms-auto flex items-center -me-2.5 lg:ms-0">
            <button type="button" className={icon} aria-label={t('searchLabel')} aria-expanded={searchOpen} onClick={() => setSearchOpen(true)}>
              <SearchIcon className="size-5" />
            </button>
            <button type="button" onClick={toggle} aria-label={t('switchLangLabel')} className="caps hidden h-11 items-center gap-1.5 px-2.5 text-[12px] text-ink hover:bg-paper sm:inline-flex">
              <GlobeIcon className="size-4" />
              {t('switchLang')}
            </button>
            {showOrders && (
              <a href="#/orders" aria-label={t('myOrders')} title={t('myOrders')} className={`${icon} hidden md:grid`}>
                <ReceiptIcon className="size-5" />
              </a>
            )}
            <button type="button" onClick={() => cart.setOpen(true)} aria-label={`${t('cart')} (${cart.count})`} className={icon}>
              <BagIcon className="size-[22px]" />
              {cart.count > 0 && (
                <span className="absolute bottom-1.5 end-1 grid min-w-[18px] place-items-center rounded-full bg-ink-900 px-1 text-[10px] font-medium leading-[18px] text-white">{cart.count}</span>
              )}
            </button>
          </div>

          {searchOpen && <SearchBar onClose={closeSearch} />}
        </div>
      </header>
      <MenuDrawer open={open} onClose={closeMenu} links={links} />
    </>
  )
}
