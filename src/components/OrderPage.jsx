import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { fetchOrder, isSafePaymentUrl, retryPayment } from '../lib/api'
import { waLink } from '../lib/links'
import { WhatsAppIcon } from './Icons'

const STEPS = ['placed', 'confirmed', 'preparing', 'shipped', 'delivered']

// The status shown here always comes from the database — never from the URL.
export default function OrderPage({ token }) {
  const { t, pick, price, num, lang, dir } = useLang()
  const [order, setOrder] = useState(undefined) // undefined = loading, null = not found
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState(() => window.location.hash.includes('pay=unavailable'))

  const payNow = async () => {
    setPaying(true)
    setPayError(false)
    const res = await retryPayment(token)
    if (res.ok && isSafePaymentUrl(res.payment_url)) return window.location.assign(res.payment_url)
    setPaying(false)
    if (res.error === 'not_payable') load()
    else setPayError(true)
  }

  const load = useCallback(async () => {
    try {
      setFailed(false)
      setOrder(await fetchOrder(token))
    } catch {
      setFailed(true)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // while a card payment is being confirmed by the payment provider, check again every few seconds
  useEffect(() => {
    if (order?.status !== 'pending_payment') return
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [order?.status, load])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const date = (iso) => new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section className="bg-white py-10 sm:py-14" aria-labelledby="order-title">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <a href="#shop" className="text-sm font-bold text-muted hover:text-ink">{dir === 'rtl' ? '→' : '←'} {t('backToShop')}</a>

        {order === undefined && !failed && <p className="py-20 text-center text-muted" aria-busy="true">{t('orderLoading')}</p>}
        {failed && (
          <div className="py-16 text-center">
            <p className="text-muted">{t('errNetwork')}</p>
            <button type="button" onClick={load} className="btn btn-ink mt-4 h-11 px-6">{t('retry')}</button>
          </div>
        )}
        {order === null && (
          <div className="mt-6 rounded-3xl bg-paper p-8 text-center">
            <h1 id="order-title" className="text-2xl font-black text-ink">{t('orderTitle')}</h1>
            <p className="mt-2 text-muted">{t('orderNotFound')}</p>
            <a href={waLink()} target="_blank" rel="noopener noreferrer" className="btn mt-4 h-11 bg-[#1fa855] px-5 text-white"><WhatsAppIcon className="size-5" />{t('whatsapp')}</a>
          </div>
        )}

        {order && (
          <>
            <h1 id="order-title" className="mt-3 text-3xl font-black text-ink sm:text-4xl">{t('orderThanks')(order.customer_first_name)}</h1>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Box label={t('orderNumber')}><span dir="ltr" className="text-2xl font-black">{order.order_number}</span></Box>
              <Box label={t('orderStatus')}>
                <span className={`text-xl font-black ${['cancelled', 'payment_failed'].includes(order.status) ? 'text-brand' : 'text-white'}`}>{t('status')[order.status]}</span>
              </Box>
            </div>

            {order.status === 'pending_payment' && (
              <div className="mt-6 rounded-[24px] bg-amber-50 p-5 text-amber-950" role="status">
                <p className="flex items-center gap-2 font-black">
                  <span className="inline-block size-3 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
                  {t('payWaiting')}
                </p>
                <p className="mt-1 text-sm">{t('payWaitingHint')}</p>
                {order.expires_at && <p className="mt-1 text-sm font-bold">{t('payExpiresAt')(new Date(order.expires_at).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-EG', { timeStyle: 'short' }))}</p>}
                {payError && <p className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-brand">{t('payUnavailable')}</p>}
                {order.can_pay && (
                  <button type="button" onClick={payNow} disabled={paying} className="btn btn-red mt-4 h-12 w-full px-6 sm:w-auto">
                    {paying ? t('payOpening') : t('payNow')}
                  </button>
                )}
              </div>
            )}
            {order.status === 'payment_failed' && (
              <div className="mt-6 rounded-[24px] bg-paper p-5">
                <p className="font-black text-ink">{t('payFailedTitle')}</p>
                <p className="mt-1 text-sm text-muted">{t('payFailedText')}</p>
                <a href="#shop" className="btn btn-ink mt-4 h-11 px-6">{t('backToShop')}</a>
              </div>
            )}
            {order.payment_method === 'card' && order.payment_status === 'paid' && !['cancelled', 'payment_failed'].includes(order.status) && (
              <p className="mt-4 rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-800">{t('payPaid')}</p>
            )}

            {!['cancelled', 'payment_failed', 'pending_payment'].includes(order.status) && <Timeline current={order.status} history={order.history} date={date} />}

            <div className="mt-6 rounded-[24px] bg-paper p-5">
              <p className="font-bold text-ink">{t('orderSaveLink')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={copy} className="btn btn-ink h-11 px-5">{copied ? t('copied') : t('copyLink')}</button>
                <button type="button" onClick={load} className="btn h-11 border border-line bg-white px-5 hover:border-ink">{t('refresh')}</button>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] ring-1 ring-line">
              <ul className="divide-y divide-line px-5">
                {order.items.map((i, k) => (
                  <li key={k} className="flex justify-between gap-3 py-3">
                    <span>
                      <span className="block font-bold text-ink">{pick({ ar: i.name_ar, en: i.name_en || i.name_ar })}</span>
                      <span className="text-sm text-muted">{t('size')} <span dir="ltr">{i.size}</span> × {num(i.qty)}</span>
                    </span>
                    <span className="font-bold">{price(i.line_total)}</span>
                  </li>
                ))}
              </ul>
              <dl className="grid gap-1.5 border-t border-line p-5 text-sm">
                <Row label={t('itemsTotal')} value={price(order.subtotal)} />
                <Row label={t('shippingFee')} value={price(order.shipping_fee)} />
                <Row label={t('grandTotal')} value={<span className="text-lg font-black">{price(order.total)}</span>} />
                <Row label={t('payment')} value={`${t('payMethodName')[order.payment_method]} · ${t('payStatus')[order.payment_status]}`} />
                <Row label={t('deliverTo')} value={`${order.area}${lang === 'ar' ? '،' : ','} ${pick(order.zone)} · ${order.phone_masked}`} />
              </dl>
            </div>

            <a href={waLink(t('askOrderMsg')(order.order_number))} target="_blank" rel="noopener noreferrer" className="btn mt-6 h-12 w-full bg-[#1fa855] text-white sm:w-auto sm:px-6">
              <WhatsAppIcon className="size-5" />
              {t('askAboutOrder')}
            </a>
          </>
        )}
      </div>
    </section>
  )
}

function Timeline({ current, history, date }) {
  const { t } = useLang()
  const at = Object.fromEntries((history ?? []).map((h) => [h.status, h.at]))
  const reached = STEPS.indexOf(current)
  return (
    <ol className="mt-6 grid gap-0 rounded-[24px] ring-1 ring-line p-5">
      {STEPS.map((s, i) => {
        const done = i <= reached
        return (
          <li key={s} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span className={`grid size-7 place-items-center rounded-full text-xs font-black ${done ? 'bg-brand text-white' : 'bg-paper text-muted'}`} aria-hidden="true">{done ? '✓' : i + 1}</span>
              {i < STEPS.length - 1 && <span className={`w-0.5 flex-1 ${i < reached ? 'bg-brand' : 'bg-line'}`} style={{ minHeight: 18 }} />}
            </span>
            <span className="pb-4">
              <span className={`block font-bold ${done ? 'text-ink' : 'text-muted'}`}>{t('status')[s]}</span>
              {at[s] && <span className="text-xs text-muted">{date(at[s])}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Box({ label, children }) {
  return (
    <div className="rounded-[24px] bg-ink p-5 text-white">
      <p className="text-sm text-white/60">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-bold text-ink">{value}</dd>
    </div>
  )
}
