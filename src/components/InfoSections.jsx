import { useState } from 'react'
import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { checkoutAvailable } from '../lib/api'
import { mapsDirections, mapsEmbed, waLink } from '../lib/links'
import { site } from '../data/site'
import {
  CashIcon, ClockIcon, FacebookIcon, InstagramIcon, PhoneIcon, PinIcon,
  StoreIcon, TelegramIcon, TikTokIcon, TruckIcon, WhatsAppIcon,
} from './Icons'

// Short facts, each only shown when it's actually true for this shop.
export function TrustStrip() {
  const { t } = useLang()
  const { zones } = useData()
  const items = [
    checkoutAvailable && [CashIcon, t('trustCod'), t('trustCodD')],
    checkoutAvailable && zones.length > 1 && [TruckIcon, t('trustDelivery'), t('trustDeliveryD')],
    [WhatsAppIcon, t('trustWa'), t('trustWaD')],
    [StoreIcon, t('trustStore'), t('trustStoreD')],
  ].filter(Boolean)
  return (
    <section id="about" className="scroll-mt-32 border-y border-line bg-white" aria-label={t('whyKicker')}>
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-5 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
        {items.map(([Icon, title, text]) => (
          <li key={title} className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink text-white"><Icon className="size-5" /></span>
            <span>
              <span className="block font-black text-ink">{title}</span>
              <span className="block text-sm text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export const socialList = (t) =>
  [
    ['telegram', TelegramIcon],
    ['facebook', FacebookIcon],
    ['instagram', InstagramIcon],
    ['tiktok', TikTokIcon],
  ]
    .filter(([k]) => site.social[k])
    .map(([k, Icon]) => ({ key: k, href: site.social[k], label: t(k), Icon }))

export function StoreContact() {
  const { t, pick } = useLang()
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [msgError, setMsgError] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (!msg.trim()) return setMsgError(true)
    window.open(waLink(t('contactMsg')(name.trim(), msg.trim())), '_blank', 'noopener')
  }

  return (
    <section id="visit" className="scroll-mt-32 bg-paper py-10 sm:py-14" aria-labelledby="store-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-black text-brand">{t('storeKicker')}</p>
        <h2 id="store-title" className="mb-6 text-2xl font-black text-ink sm:text-3xl">{t('storeTitle')}</h2>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* store details */}
          <div className="rounded-[24px] bg-ink p-6 text-white lg:col-span-1">
            <dl className="grid gap-5">
              <Info icon={PinIcon} label={t('address')}>
                <span className="font-bold">{pick(site.address)}</span>
                <span className="block text-sm text-white/60">{pick(site.area)}</span>
                {!site.addressConfirmed && <span className="mt-1 block text-xs font-bold text-amber-300">{t('addressPending')}</span>}
              </Info>
              {site.hours?.length > 0 && (
                <Info icon={ClockIcon} label={t('hours')}>
                  {site.hours.map((h, i) => <span key={i} className="block font-bold">{pick(h.days)}: <span dir="auto">{pick(h.time)}</span></span>)}
                </Info>
              )}
              <Info icon={PhoneIcon} label={t('phones')}>
                {site.phones.map((p) => <a key={p.tel} href={`tel:${p.tel}`} dir="ltr" className="block w-fit font-bold hover:text-brand">{p.display}</a>)}
                <a href={`tel:${site.landline.tel}`} dir="ltr" className="block w-fit text-white/70 hover:text-brand">{site.landline.display}</a>
              </Info>
            </dl>
            {site.addressConfirmed && (
              <a href={mapsDirections} target="_blank" rel="noopener noreferrer" className="btn btn-red mt-6 h-11 w-full px-5">
                <PinIcon className="size-5" />
                {t('directions')}
              </a>
            )}
          </div>

          {/* contact actions */}
          <div id="contact" className="grid scroll-mt-32 content-start gap-3">
            <a href={waLink()} target="_blank" rel="noopener noreferrer" className="contact-tile bg-[#1fa855] text-white">
              <WhatsAppIcon className="size-8" />
              <span>
                <span className="block text-xl font-black">{t('whatsapp')}</span>
                <span dir="ltr" className="block text-white/85">{site.phones[0].display}</span>
              </span>
            </a>
            {site.phones.map((p) => (
              <a key={p.tel} href={`tel:${p.tel}`} className="contact-tile bg-white text-ink ring-1 ring-line">
                <PhoneIcon className="size-6 text-brand" />
                <span>
                  <span className="block text-sm font-semibold text-muted">{t('callMobile')}</span>
                  <span dir="ltr" className="block text-lg font-black">{p.display}</span>
                </span>
              </a>
            ))}
            {socialList(t).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {socialList(t).map(({ key, href, label, Icon }) => (
                  <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="btn h-11 bg-ink px-5 text-white hover:bg-brand">
                    <Icon className="size-5" />
                    {label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* map only once the address is confirmed; otherwise the quick message form */}
          {site.addressConfirmed ? (
            <div className="relative min-h-[300px] overflow-hidden rounded-[24px] ring-1 ring-line">
              <iframe title={t('mapTitle')} src={mapsEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="absolute inset-0 h-full w-full border-0" />
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="rounded-[24px] bg-white p-5 ring-1 ring-line">
              <h3 className="text-lg font-black text-ink">{t('msgFormTitle')}</h3>
              <div className="mt-3 grid gap-3">
                <div>
                  <label htmlFor="c-name" className="field-label">{t('formName')}</label>
                  <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('formNamePh')} autoComplete="name" className="field" />
                </div>
                <div>
                  <label htmlFor="c-msg" className="field-label">{t('formMsg')}</label>
                  <textarea
                    id="c-msg"
                    rows={3}
                    value={msg}
                    onChange={(e) => { setMsg(e.target.value); setMsgError(false) }}
                    placeholder={t('formMsgPh')}
                    aria-invalid={msgError ? 'true' : undefined}
                    aria-describedby={msgError ? 'c-msg-err' : 'c-msg-note'}
                    className={`field h-auto resize-y py-3 ${msgError ? 'border-brand' : ''}`}
                  />
                  {msgError && <p id="c-msg-err" className="mt-1 text-sm font-bold text-brand">{t('formMsgRequired')}</p>}
                </div>
                <button type="submit" className="btn btn-red h-12">
                  <WhatsAppIcon className="size-5" />
                  {t('formSend')}
                </button>
                <p id="c-msg-note" className="text-xs text-muted">{t('formNote')}</p>
                <p className="text-xs text-muted">{t('mapPending')}</p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function Info({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand"><Icon className="size-5" /></span>
      <div>
        <dt className="text-sm text-white/55">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  )
}
