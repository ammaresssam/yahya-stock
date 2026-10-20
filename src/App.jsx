import { useEffect, useState } from 'react'
import { LangProvider, useLang } from './lib/i18n'
import { CartProvider, useCart } from './lib/cart'
import { DataProvider } from './lib/store'
import { waLink } from './lib/links'
import Header from './components/Header'
import Hero, { Marquee } from './components/Hero'
import Categories from './components/Categories'
import Shop from './components/Shop'
import NewArrivals from './components/NewArrivals'
import { Contact, Visit, WhyUs } from './components/InfoSections'
import Footer from './components/Footer'
import CartDrawer from './components/CartDrawer'
import { BagIcon, WhatsAppIcon } from './components/Icons'

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    if (!('IntersectionObserver' in window)) return els.forEach((el) => el.classList.add('is-visible'))
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function FloatingActions() {
  const { t } = useLang()
  const cart = useCart()
  return (
    <div className="fixed bottom-4 end-4 z-30 flex flex-col items-center gap-3">
      {cart.count > 0 && (
        <button type="button" onClick={() => cart.setOpen(true)} aria-label={`${t('cart')} (${cart.count})`} className="fab bg-ink text-white">
          <BagIcon className="size-6" />
          <span className="absolute -top-1 -end-1 grid min-w-6 place-items-center rounded-full bg-brand px-1 text-xs font-bold leading-6 ring-2 ring-white">{cart.count}</span>
        </button>
      )}
      <a href={waLink()} target="_blank" rel="noopener noreferrer" aria-label={t('orderWhatsapp')} className="fab bg-[#1fa855] text-white">
        <WhatsAppIcon className="size-7" />
      </a>
    </div>
  )
}

function Page() {
  const [category, setCategory] = useState('all')
  useReveal()
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Header />
      <main id="main">
        <Hero />
        <Marquee />
        <Categories onPick={setCategory} />
        <Shop category={category} setCategory={setCategory} />
        <NewArrivals />
        <WhyUs />
        <Visit />
        <Contact />
      </main>
      <Footer />
      <FloatingActions />
      <CartDrawer />
    </>
  )
}

export default function App() {
  return (
    <LangProvider>
      <DataProvider>
        <CartProvider>
          <Page />
        </CartProvider>
      </DataProvider>
    </LangProvider>
  )
}
