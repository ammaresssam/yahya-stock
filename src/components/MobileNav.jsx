import { useLang } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { useCatalog } from '../lib/catalogState'
import { waLink } from '../lib/links'
import { BagIcon, GridIcon, HomeIcon, ReceiptIcon, WhatsAppIcon } from './Icons'

// App-style tab bar for phones: big touch targets, always within thumb reach.
export default function MobileNav({ route }) {
  const { t, num } = useLang()
  const cart = useCart()
  const { browse } = useCatalog()

  const item = 'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-bold'
  const tone = (on) => (on ? 'text-white' : 'text-white/60')

  return (
    <nav aria-label={t('menu')} className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] text-white backdrop-blur md:hidden">
      <ul className="flex h-16">
        <li className="flex flex-1">
          <a href="#home" onClick={() => window.scrollTo({ top: 0 })} aria-current={route === 'home' ? 'page' : undefined} className={`${item} ${tone(route === 'home')}`}>
            <HomeIcon className="size-6" />
            {t('home')}
          </a>
        </li>
        <li className="flex flex-1">
          <button type="button" onClick={() => browse({})} className={`${item} ${tone(false)}`}>
            <GridIcon className="size-6" />
            {t('shop')}
          </button>
        </li>
        <li className="flex flex-1">
          <button type="button" onClick={() => cart.setOpen(true)} aria-label={`${t('cart')} (${cart.count})`} className={`${item} ${tone(cart.open)}`}>
            <span className="relative">
              <BagIcon className="size-6" />
              {cart.count > 0 && <span className="absolute -top-1.5 -end-2.5 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-black leading-[18px] text-white">{num(cart.count)}</span>}
            </span>
            {t('cart')}
          </button>
        </li>
        <li className="flex flex-1">
          <a href="#/orders" aria-current={route === 'orders' ? 'page' : undefined} className={`${item} ${tone(route === 'orders')}`}>
            <ReceiptIcon className="size-6" />
            {t('myOrders')}
          </a>
        </li>
        <li className="flex flex-1">
          <a href={waLink()} target="_blank" rel="noopener noreferrer" className={`${item} text-[#25d366]`}>
            <WhatsAppIcon className="size-6" />
            {t('whatsapp')}
          </a>
        </li>
      </ul>
    </nav>
  )
}
