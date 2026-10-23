import { useState } from 'react'
import { useLang } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { useData } from '../lib/store'
import { cardPaymentsEnabled, checkoutAvailable, rememberOrder, submitCheckout } from '../lib/api'
import { waLink } from '../lib/links'
import GarmentArt from './GarmentArt'
import { WhatsAppIcon } from './Icons'

const FIELDS = ['name', 'phone', 'email', 'zone_id', 'area', 'address', 'notes']

export default function CheckoutPage() {
  const { t, pick, price, num, lang } = useLang()
  const cart = useCart()
  const { zones } = useData()
  const [form, setForm] = useState({ name: '', phone: '', email: '', zone_id: '', area: '', address: '', notes: '' })
  const [method, setMethod] = useState('cod')
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [busy, setBusy] = useState(false)
  // After the server reports a price change, the customer confirms the server's total explicitly.
  const [confirmedTotal, setConfirmedTotal] = useState(null)

  const zone = zones.find((z) => z.id === form.zone_id)
  const fee = zone?.fee ?? null
  const total = cart.total + (fee ?? 0)

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
  }

  const localErrors = () => {
    const e = {}
    if (form.name.trim().length < 2) e.name = true
    const digits = form.phone.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '').replace(/^(20|0020)/, '')
    if (!/^0?1[0125]\d{8}$/.test(digits)) e.phone = true
    if (form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = true
    if (!form.zone_id) e.zone_id = true
    if (form.area.trim().length < 2) e.area = true
    if (form.address.trim().length < 5) e.address = true
    return e
  }

  if (!cart.lines.length) {
    return (
      <Section>
        <p className="rounded-3xl bg-paper p-10 text-center text-muted">{t('checkoutEmpty')}</p>
        <div className="mt-4 text-center"><a href="#shop" className="btn btn-ink h-11 px-6">{t('backToShop')}</a></div>
      </Section>
    )
  }

  const submit = async (ev) => {
    ev.preventDefault()
    setBanner(null)
    const e = localErrors()
    if (Object.keys(e).length) {
      setErrors(e)
      setBanner({ kind: 'error', text: t('errFields') })
      document.querySelector('[aria-invalid="true"]')?.focus()
      return
    }
    setBusy(true)
    const res = await submitCheckout({
      items: cart.lines.map((l) => ({ variant_id: l.variant.id, qty: l.qty })),
      customer: { ...form, email: form.email.trim() || undefined, notes: form.notes.trim() || undefined },
      payment_method: method,
      expected_total: confirmedTotal ?? total,
    })
    setBusy(false)

    if (res.ok) {
      rememberOrder({ number: res.order_number, token: res.tracking_token, at: Date.now(), lang })
      cart.clear()
      if (res.payment_url) {
        window.location.assign(res.payment_url) // Stage 4: Paymob's hosted payment page
        return
      }
      window.location.hash = `#/order/${res.tracking_token}`
      return
    }

    if (res.error === 'payment_unavailable' && res.tracking_token) {
      // the order exists and is reserved; the tracking page lets the customer pay again
      rememberOrder({ number: res.order_number, token: res.tracking_token, at: Date.now(), lang })
      cart.clear()
      window.location.hash = `#/order/${res.tracking_token}?pay=unavailable`
      return
    }

    switch (res.error) {
      case 'invalid_input':
      case 'invalid_customer': {
        const f = res.fields ?? (res.field ? { [res.field]: 'invalid' } : {})
        setErrors(Object.fromEntries(Object.keys(f).filter((k) => FIELDS.includes(k)).map((k) => [k, true])))
        setBanner({ kind: 'error', text: t('errFields') })
        break
      }
      case 'price_changed':
        setConfirmedTotal(res.quote.total)
        setBanner({ kind: 'warn', text: t('errPriceChanged')(price(res.quote.total)) })
        break
      case 'items_unavailable':
        // shrink the cart to what's actually available, then let the customer review
        for (const it of res.items ?? []) {
          const line = cart.lines.find((l) => l.variant.id === it.variant_id)
          if (line) cart.setQty(line.id, line.size, it.available)
        }
        setConfirmedTotal(null)
        setBanner({ kind: 'warn', text: t('errUnavailable') })
        break
      case 'rate_limited':
        setBanner({ kind: 'error', text: t('errRate') })
        break
      case 'card_unavailable':
        setMethod('cod')
        setBanner({ kind: 'error', text: t('errCard') })
        break
      case 'network':
        setBanner({ kind: 'error', text: t('errNetwork') })
        break
      default:
        setBanner({ kind: 'error', text: t('errServer') })
    }
  }

  return (
    <Section>
      {!checkoutAvailable && (
        <div className="mb-6 rounded-3xl bg-amber-50 p-5 text-amber-900">
          <p className="font-bold">{t('checkoutNotConnected')}</p>
          <a href={waLink()} target="_blank" rel="noopener noreferrer" className="btn mt-3 h-11 bg-[#1fa855] px-5 text-white"><WhatsAppIcon className="size-5" />{t('orderWhatsapp')}</a>
        </div>
      )}

      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <div className="grid gap-6">
          <fieldset className="rounded-[28px] bg-white p-5 ring-1 ring-line sm:p-7">
            <legend className="px-1 text-xl font-black text-ink">{t('deliveryDetails')}</legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <Input id="name" label={t('fName')} value={form.name} onChange={set('name')} error={errors.name && t('errField').name} autoComplete="name" />
              <Input id="phone" label={t('fPhone')} hint={t('fPhoneHint')} value={form.phone} onChange={set('phone')} error={errors.phone && t('errField').phone} autoComplete="tel" inputMode="tel" dir="ltr" placeholder="01X XXXX XXXX" />
              <div>
                <label htmlFor="zone_id" className="field-label">{t('fZone')}</label>
                <select id="zone_id" className="field" value={form.zone_id} onChange={set('zone_id')} aria-invalid={errors.zone_id ? 'true' : undefined} aria-describedby={errors.zone_id ? 'zone_id-err' : undefined}>
                  <option value="">{t('fZonePick')}</option>
                  {zones.map((z) => <option key={z.id} value={z.id}>{pick(z.name)} — {price(z.fee)}</option>)}
                </select>
                {errors.zone_id && <p id="zone_id-err" className="mt-1 text-sm font-bold text-brand">{t('errField').zone_id}</p>}
              </div>
              <Input id="area" label={t('fArea')} value={form.area} onChange={set('area')} error={errors.area && t('errField').area} autoComplete="address-level3" />
              <div className="sm:col-span-2">
                <Input id="address" label={t('fAddress')} placeholder={t('fAddressPh')} value={form.address} onChange={set('address')} error={errors.address && t('errField').address} autoComplete="street-address" textarea />
              </div>
              <Input id="email" label={t('fEmail')} value={form.email} onChange={set('email')} error={errors.email && t('errField').email} autoComplete="email" type="email" dir="ltr" />
              <Input id="notes" label={t('fNotes')} value={form.notes} onChange={set('notes')} maxLength={500} />
            </div>
          </fieldset>

          <fieldset className="rounded-[28px] bg-white p-5 ring-1 ring-line sm:p-7">
            <legend className="px-1 text-xl font-black text-ink">{t('payMethod')}</legend>
            <div className="mt-2 grid gap-3">
              <PayOption checked={method === 'cod'} onChange={() => setMethod('cod')} title={t('payCod')} hint={t('payCodHint')} />
              <PayOption checked={method === 'card'} onChange={() => setMethod('card')} title={t('payCard')} hint={cardPaymentsEnabled ? 'Visa · Mastercard · Meeza' : t('payCardSoon')} disabled={!cardPaymentsEnabled} />
            </div>
            {method === 'card' && <p className="mt-3 text-sm text-muted">🔒 {t('payCardHint')}</p>}
          </fieldset>
        </div>

        <aside className="rounded-[28px] bg-paper p-5 sm:p-7 lg:sticky lg:top-28">
          <h2 className="text-xl font-black text-ink">{t('summary')}</h2>
          <ul className="mt-4 divide-y divide-line">
            {cart.lines.map((l) => (
              <li key={l.id + l.size} className="flex items-center gap-3 py-3">
                {l.product.image ? <img src={l.product.image} alt="" className="size-14 shrink-0 rounded-xl object-cover" /> : <GarmentArt {...l.product.art} className="size-14 shrink-0 rounded-xl p-1" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{pick(l.product.name)}</p>
                  <p className="text-sm text-muted">{t('size')} <span dir="ltr">{l.size}</span> × {num(l.qty)}</p>
                </div>
                <span className="font-bold">{price(l.unitPrice * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid gap-1.5 border-t border-line pt-3 text-sm">
            <Row label={t('itemsTotal')} value={price(cart.total)} />
            <Row label={t('shippingFee')} value={fee === null ? t('pickZoneForFee') : price(fee)} />
            <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-bold text-ink">{t('grandTotal')}</dt>
              <dd className="text-2xl font-black text-ink">{price(confirmedTotal ?? total)}</dd>
            </div>
          </dl>

          {banner && (
            <p role="alert" className={`mt-4 rounded-2xl p-3 text-sm font-bold ${banner.kind === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-brand/10 text-brand'}`}>{banner.text}</p>
          )}

          <button type="submit" disabled={busy || !checkoutAvailable} className="btn btn-red mt-4 h-13 w-full text-lg">
            {busy ? t('placing') : confirmedTotal !== null ? t('confirmNewTotal') : t('placeOrder')}
          </button>
          <p className="mt-3 text-center text-xs text-muted">{t('privacyNote')}</p>
          <a href={waLink()} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-sm font-bold text-[#1fa855] hover:underline">{t('orWhatsapp')}</a>
        </aside>
      </form>
    </Section>
  )
}

function Section({ children }) {
  const { t, dir } = useLang()
  return (
    <section className="bg-white py-10 sm:py-14" aria-labelledby="checkout-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <a href="#shop" className="text-sm font-bold text-muted hover:text-ink">{dir === 'rtl' ? '→' : '←'} {t('backToShop')}</a>
        <h1 id="checkout-title" className="mt-2 mb-6 text-3xl font-black text-ink sm:text-4xl">{t('checkoutTitle')}</h1>
        {children}
      </div>
    </section>
  )
}

function Input({ id, label, hint, error, textarea, ...rest }) {
  const Tag = textarea ? 'textarea' : 'input'
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <Tag
        id={id}
        name={id}
        className={`field ${textarea ? 'h-auto min-h-24 resize-y py-3' : ''} ${error ? 'border-brand bg-brand/5' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {error ? <p id={`${id}-err`} className="mt-1 text-sm font-bold text-brand">{error}</p> : hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

function PayOption({ checked, onChange, title, hint, disabled }) {
  return (
    <label className={`flex items-center gap-3 rounded-2xl border p-4 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${checked ? 'border-ink bg-paper' : 'border-line'}`}>
      <input type="radio" name="payment" className="size-5 accent-[#e3262d]" checked={checked} onChange={onChange} disabled={disabled} />
      <span>
        <span className="block font-bold text-ink">{title}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
    </label>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-bold text-ink">{value}</dd>
    </div>
  )
}
