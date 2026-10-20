import { useEffect, useState } from 'react'
import { LangProvider, useLang } from './lib/i18n'
import { CartProvider } from './lib/cart'
import { DataProvider } from './lib/store'
import { CatalogProvider } from './lib/catalogState'
import { waLink } from './lib/links'
import Header from './components/Header'
import Hero from './components/Hero'
import Categories from './components/Categories'
import Shop from './components/Shop'
import NewArrivals, { Offers } from './components/NewArrivals'
import { StoreContact, TrustStrip } from './components/InfoSections'
import Footer from './components/Footer'
import CartDrawer from './components/CartDrawer'
import CheckoutPage from './components/CheckoutPage'
import OrderPage from './components/OrderPage'
import { WhatsAppIcon } from './components/Icons'

// "#/checkout" and "#/order/<token>" are pages; any other hash (e.g. "#shop") is a section of the home page.
function readRoute() {
  const h = window.location.hash
  if (h.startsWith('#/checkout')) return { name: 'checkout' }
  const m = h.match(/^#\/order\/([A-Za-z0-9_-]{32,128})/)
  if (m) return { name: 'order', token: m[1] }
  return { name: 'home' }
}

function useRoute() {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const onChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function useReveal(key) {
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
  }, [key])
}

// A small WhatsApp button that stays out of the way (the cart lives in the sticky header).
function FloatingWhatsApp() {
  const { t } = useLang()
  return (
    <a href={waLink()} target="_blank" rel="noopener noreferrer" aria-label={t('orderWhatsapp')} className="fab fixed bottom-4 end-4 z-30 size-12 bg-[#1fa855] text-white">
      <WhatsAppIcon className="size-6" />
    </a>
  )
}

function Page() {
  const route = useRoute()
  useReveal(route.name)

  // Pages start at the top; returning home from a page jumps to the requested section.
  useEffect(() => {
    if (route.name !== 'home') {
      window.scrollTo(0, 0) // (newer browsers return a value here — never return it from an effect)
      return
    }
    const id = window.location.hash.slice(1)
    if (id && !id.startsWith('/')) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
  }, [route.name, route.token])

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Header />
      <main id="main">
        {route.name === 'checkout' ? (
          <CheckoutPage />
        ) : route.name === 'order' ? (
          <OrderPage key={route.token} token={route.token} />
        ) : (
          <>
            <Hero />
            <Categories />
            <Offers />
            <Shop />
            <NewArrivals />
            <TrustStrip />
            <StoreContact />
          </>
        )}
      </main>
      <Footer />
      {route.name !== 'checkout' && <FloatingWhatsApp />}
      <CartDrawer />
    </>
  )
}

export default function App() {
  return (
    <LangProvider>
      <DataProvider>
        <CartProvider>
          <CatalogProvider>
            <Page />
          </CatalogProvider>
        </CartProvider>
      </DataProvider>
    </LangProvider>
  )
}
