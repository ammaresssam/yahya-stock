import { useLang } from '../lib/i18n'
import { rememberedOrders } from '../lib/api'
import { ReceiptIcon } from './Icons'

// There are no customer accounts: this lists the orders placed from this device,
// using the private tracking links saved at checkout.
export default function OrdersPage() {
  const { t, lang, dir } = useLang()
  const orders = rememberedOrders()
  const date = (ms) => new Date(ms).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section className="bg-white py-10 sm:py-14" aria-labelledby="orders-title">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <a href="#shop" className="text-sm font-bold text-muted hover:text-ink">{dir === 'rtl' ? '→' : '←'} {t('backToShop')}</a>
        <h1 id="orders-title" className="mt-2 text-3xl font-black text-ink">{t('myOrdersTitle')}</h1>
        <p className="mt-2 text-sm text-muted">{t('myOrdersNote')}</p>

        {orders.length === 0 ? (
          <div className="mt-6 rounded-3xl bg-paper p-10 text-center">
            <ReceiptIcon className="mx-auto size-10 text-muted" />
            <p className="mt-3 font-bold text-ink">{t('myOrdersEmpty')}</p>
            <a href="#shop" className="btn btn-ink mt-4 h-11 px-6">{t('shopNowCta')}</a>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3">
            {orders.map((o) => (
              <li key={o.token}>
                <a href={`#/order/${o.token}`} className="flex items-center justify-between gap-3 rounded-[20px] bg-white p-4 ring-1 ring-line transition hover:ring-ink">
                  <span className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-ink text-white"><ReceiptIcon className="size-5" /></span>
                    <span>
                      <span dir="ltr" className="block font-black text-ink">{o.number}</span>
                      <span className="text-sm text-muted">{date(o.at)}</span>
                    </span>
                  </span>
                  <span className="text-sm font-bold text-brand">{t('trackOrder')}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
