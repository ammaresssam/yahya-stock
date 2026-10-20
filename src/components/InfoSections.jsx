import { useState } from 'react'
import { useLang } from '../lib/i18n'
import { mapsDirections, mapsEmbed, waLink } from '../lib/links'
import { site } from '../data/site'
import SectionHeading from './SectionHeading'
import {
  ChatIcon, ClockIcon, FacebookIcon, InstagramIcon, LayersIcon, PhoneIcon, PinIcon,
  StoreIcon, TagIcon, TelegramIcon, TikTokIcon, WhatsAppIcon,
} from './Icons'

const whyIcons = [TagIcon, LayersIcon, ChatIcon, StoreIcon]

export function WhyUs() {
  const { t, num } = useLang()
  return (
    <section id="about" className="scroll-mt-28 bg-paper py-16 sm:py-20" aria-labelledby="why-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="why-title" kicker={t('whyKicker')} title={t('whyTitle')} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t('why').map((item, i) => {
            const Icon = whyIcons[i]
            return (
              <li key={i} className="why-card reveal rounded-[24px] bg-white p-6 ring-1 ring-line" data-reveal style={{ '--d': `${i * 70}ms` }}>
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl bg-ink text-white">
                    <Icon className="size-6" />
                  </span>
                  <span className="font-logo text-4xl font-black text-line">{num(i + 1).padStart(2, num(0))}</span>
                </div>
                <h3 className="mt-5 text-xl font-extrabold text-ink">{item.t}</h3>
                <p className="mt-2 leading-relaxed text-muted">{item.d}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function Visit() {
  const { t, pick } = useLang()
  return (
    <section id="visit" className="scroll-mt-28 py-16 sm:py-20" aria-labelledby="visit-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="visit-title" kicker={t('visitKicker')} title={t('visitTitle')} />
        <div className="grid overflow-hidden rounded-[28px] ring-1 ring-line lg:grid-cols-[1fr_1.25fr]">
          <div className="bg-ink p-6 text-white sm:p-9">
            <dl className="grid gap-6">
              <InfoRow icon={PinIcon} label={t('address')}>
                <span className="text-lg font-bold">{pick(site.address)}</span>
                <span className="block text-white/60">{pick(site.area)}</span>
              </InfoRow>
              <InfoRow icon={ClockIcon} label={t('hours')}>
                {site.hours?.length ? (
                  site.hours.map((h, i) => (
                    <span key={i} className="block font-bold">{pick(h.days)}: <span dir="auto">{pick(h.time)}</span></span>
                  ))
                ) : (
                  <span className="text-white/70">{t('hoursPending')}</span>
                )}
              </InfoRow>
              <InfoRow icon={PhoneIcon} label={t('phones')}>
                {site.phones.map((p) => (
                  <a key={p.tel} href={`tel:${p.tel}`} dir="ltr" className="block w-fit text-lg font-bold hover:text-brand">{p.display}</a>
                ))}
                <a href={`tel:${site.landline.tel}`} dir="ltr" className="block w-fit text-white/70 hover:text-brand">{site.landline.display}</a>
              </InfoRow>
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={mapsDirections} target="_blank" rel="noopener noreferrer" className="btn btn-red h-12 px-6">
                <PinIcon className="size-5" />
                {t('directions')}
              </a>
              <a href={`tel:${site.phones[0].tel}`} className="btn h-12 border border-white/25 px-6 hover:bg-white hover:text-ink">
                <PhoneIcon className="size-5" />
                {t('callNow')}
              </a>
            </div>
          </div>
          <div className="relative min-h-[320px] bg-paper">
            <iframe
              title={t('mapTitle')}
              src={mapsEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0 grayscale-[.35]"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand">
        <Icon className="size-5" />
      </span>
      <div>
        <dt className="text-sm font-semibold text-white/55">{label}</dt>
        <dd className="mt-0.5 space-y-0.5">{children}</dd>
      </div>
    </div>
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

export function Contact() {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!msg.trim()) return
    window.open(waLink(t('contactMsg')(name.trim(), msg.trim())), '_blank', 'noopener')
  }

  return (
    <section id="contact" className="scroll-mt-28 bg-paper py-16 sm:py-20" aria-labelledby="contact-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="contact-title" kicker={t('contactKicker')} title={t('contactTitle')} text={t('contactText')} />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <a href={waLink()} target="_blank" rel="noopener noreferrer" className="contact-tile bg-[#1fa855] text-white">
              <WhatsAppIcon className="size-8" />
              <span>
                <span className="block text-xl font-black">{t('whatsapp')}</span>
                <span dir="ltr" className="block text-white/85">{site.phones[0].display}</span>
              </span>
            </a>
            <div className="grid gap-3 sm:grid-cols-2">
              {site.phones.map((p) => (
                <a key={p.tel} href={`tel:${p.tel}`} className="contact-tile bg-white text-ink ring-1 ring-line">
                  <PhoneIcon className="size-6 text-brand" />
                  <span>
                    <span className="block text-sm font-semibold text-muted">{t('callMobile')}</span>
                    <span dir="ltr" className="block text-lg font-black">{p.display}</span>
                  </span>
                </a>
              ))}
            </div>
            <a href={`tel:${site.landline.tel}`} className="contact-tile bg-white text-ink ring-1 ring-line">
              <PhoneIcon className="size-6 text-brand" />
              <span>
                <span className="block text-sm font-semibold text-muted">{t('landline')}</span>
                <span dir="ltr" className="block text-lg font-black">{site.landline.display}</span>
              </span>
            </a>
            {socialList(t).length > 0 && (
              <div className="mt-2">
                <p className="mb-2 text-sm font-bold text-muted">{t('followUs')}</p>
                <div className="flex flex-wrap gap-2">
                  {socialList(t).map(({ key, href, label, Icon }) => (
                    <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="btn h-11 bg-ink px-5 text-white hover:bg-brand">
                      <Icon className="size-5" />
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={submit} className="rounded-[28px] bg-white p-6 ring-1 ring-line sm:p-8">
            <h3 className="text-2xl font-black text-ink">{t('msgFormTitle')}</h3>
            <div className="mt-5 grid gap-4">
              <div>
                <label htmlFor="c-name" className="field-label">{t('formName')}</label>
                <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('formNamePh')} autoComplete="name" className="field" />
              </div>
              <div>
                <label htmlFor="c-msg" className="field-label">{t('formMsg')}</label>
                <textarea id="c-msg" required rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t('formMsgPh')} className="field resize-y py-3" />
              </div>
              <button type="submit" className="btn btn-red h-13 text-lg">
                <WhatsAppIcon className="size-5" />
                {t('formSend')}
              </button>
              <p className="text-sm text-muted">{t('formNote')}</p>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
