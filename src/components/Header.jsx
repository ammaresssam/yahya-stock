import { useEffect, useId, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { useData } from '../lib/store'
import { useCatalog } from '../lib/catalogState'
import { isOnSale } from '../lib/catalog'
import { waLink } from '../lib/links'
import { site } from '../data/site'
import { Wordmark } from './Brand'
import { BagIcon, CloseIcon, GlobeIcon, MenuIcon, SearchIcon, WhatsAppIcon } from './Icons'

export const navItems = [
  ['#home', 'navHome'],
  ['#shop', 'navShop'],
  ['#new', 'navNew'],
  ['#about', 'navAbout'],
  ['#contact', 'navContact'],
]

function SearchBox({ id, className = '', autoFocus = false, onDone }) {
  const { t } = useLang()
  const { filters, browse } = useCatalog()
  const [q, setQ] = useState(filters.q)
  useEffect(() => setQ(filters.q), [filters.q])

  const submit = (e) => {
    e.preventDefault()
    browse({ q: q.trim() })
    onDone?.()
  }
  return (
    <form role="search" onSubmit={submit} className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">{t('searchLabel')}</label>
      <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-white/55" />
      <input
        id={id}
        type="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('searchPh')}
        className="h-11 w-full rounded-full border border-white/15 bg-white/10 ps-10 pe-4 text-[15px] text-white outline-none transition placeholder:text-white/50 focus:border-white/40 focus:bg-white/15"
      />
    </form>
  )
}

export default function Header() {
  const { t, pick, toggle } = useLang()
  const cart = useCart()
  const { live, categories, products } = useData()
  const { filters, browse } = useCatalog()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const mobileSearchId = useId()
  const hasOffers = products.some(isOnSale)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // category bar: the same links on every screen size, scrollable on phones
  const cats = [
    { key: 'all', label: t('navAll'), active: filters.category === 'all' && !filters.onSale, go: () => browse({}) },
    ...categories.map((c) => ({ key: c.id, label: pick(c.name), active: filters.category === c.id && !filters.onSale, go: () => browse({ category: c.id }) })),
    ...(hasOffers ? [{ key: 'offers', label: t('navOffers'), active: filters.onSale, go: () => browse({ onSale: true, sort: 'discount' }), hot: true }] : []),
  ]

  return (
    <header className="sticky top-0 z-40 bg-ink-900 text-white shadow-[0_8px_30px_-18px_rgba(0,0,0,.6)]">
      {!live && <p className="bg-brand px-4 py-1 text-center text-[12px] font-semibold leading-snug">{t('demoBar')}</p>}

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <button
          type="button"
          className="-ms-2 inline-flex size-10 items-center justify-center rounded-full hover:bg-white/10 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t('closeMenu') : t('menu')}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
        </button>

        <a href="#home" className="shrink-0 rounded-lg" aria-label={pick(site.name)}>
          <Wordmark className="h-9 w-auto sm:h-11" title={pick(site.name)} />
        </a>

        <SearchBox id="search-desktop" className="mx-4 hidden max-w-xl flex-1 md:block" />

        <div className="ms-auto flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full hover:bg-white/10 md:hidden"
            aria-label={t('searchLabel')}
            aria-expanded={searchOpen}
            aria-controls={mobileSearchId}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <SearchIcon className="size-[21px]" />
          </button>
          <button type="button" onClick={toggle} aria-label={t('switchLangLabel')} className="inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 text-sm font-bold text-white/85 hover:bg-white/10 hover:text-white">
            <GlobeIcon className="size-4" />
            <span>{t('switchLang')}</span>
          </button>
          <a href={waLink()} target="_blank" rel="noopener noreferrer" className="hidden h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-bold hover:border-[#25d366] hover:text-[#25d366] lg:inline-flex">
            <WhatsAppIcon className="size-[18px]" />
            {t('whatsapp')}
          </a>
          <button
            type="button"
            onClick={() => cart.setOpen(true)}
            aria-label={`${t('cart')} (${cart.count})`}
            className="relative inline-flex h-10 items-center gap-2 rounded-full bg-brand px-3.5 font-bold transition hover:bg-brand-600"
          >
            <BagIcon className="size-[20px]" />
            <span className="hidden sm:inline">{t('cart')}</span>
            {cart.count > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-black leading-5 text-brand">{cart.count}</span>
            )}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div id={mobileSearchId} className="px-4 pb-3 md:hidden">
          <SearchBox id="search-mobile" autoFocus onDone={() => setSearchOpen(false)} />
        </div>
      )}

      <nav aria-label={t('categoriesNav')} className="border-t border-white/10">
        <ul className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 sm:px-5 lg:px-7">
          {cats.map((c) => (
            <li key={c.key} className="shrink-0">
              <button
                type="button"
                onClick={c.go}
                aria-current={c.active ? 'true' : undefined}
                className={`cat-link relative h-11 px-3 text-[15px] font-bold transition ${c.active ? 'text-white' : c.hot ? 'text-brand hover:text-white' : 'text-white/70 hover:text-white'}`}
              >
                {c.label}
              </button>
            </li>
          ))}
          <li className="shrink-0">
            <a href="#new" className="cat-link relative inline-flex h-11 items-center px-3 text-[15px] font-bold text-white/70 hover:text-white">{t('navNew')}</a>
          </li>
        </ul>
      </nav>

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
          <a href={waLink()} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-[#1fa855] font-bold">
            <WhatsAppIcon className="size-5" />
            {t('orderWhatsapp')}
          </a>
        </nav>
      </div>
    </header>
  )
}
