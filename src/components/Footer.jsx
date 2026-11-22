import { useLang } from '../lib/i18n'
import { mapsDirections, waLink } from '../lib/links'
import { site } from '../data/site'
import { useData } from '../lib/store'
import { checkoutAvailable, cardPaymentsEnabled } from '../lib/api'
import { Wordmark } from './Brand'
import { navItems } from './Header'
import { socialList } from './InfoSections'
import { CashIcon, GlobeIcon, WhatsAppIcon } from './Icons'
import { POLICY_KEYS, policies } from '../data/policies'

// Theme-style footer: link columns on a light background, then a bottom row
// with the language switch, the payment methods and the copyright.
export default function Footer() {
  const { t, pick, toggle } = useLang()
  const { live } = useData()
  const year = new Date().getFullYear()
  const socials = socialList(t)
  // only the ways to pay that really work on this site
  const payments = [
    checkoutAvailable && { key: 'cash', label: t('payCash'), icon: CashIcon },
    checkoutAvailable && cardPaymentsEnabled && { key: 'card', label: t('payCard'), text: 'VISA · Mastercard' },
    { key: 'wa', label: t('payWhatsapp'), icon: WhatsAppIcon },
  ].filter(Boolean)

  const link = 'text-ink/70 underline-offset-4 transition hover:text-ink hover:underline'

  return (
    <footer className="border-t border-line bg-paper text-ink">
      <div className="page-width grid gap-10 py-12 sm:grid-cols-2 sm:py-14 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Wordmark tone="light" className="h-14 w-auto" title={pick(site.name)} />
          <p className="mt-4 max-w-xs leading-relaxed text-muted">{t('footerText')}</p>
          {socials.length > 0 && (
            <ul className="mt-5 flex gap-1">
              {socials.map(({ key, href, label, Icon }) => (
                <li key={key}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid size-10 place-items-center rounded-md text-ink transition hover:bg-white">
                    <Icon className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label={t('footerLinks')}>
          <h2 className="footer-h">{t('footerLinks')}</h2>
          <ul className="space-y-2.5">
            {navItems.map(([href, key]) => (
              <li key={href}><a href={href} className={link}>{t(key)}</a></li>
            ))}
            <li><a href="#/orders" className={link}>{t('myOrders')}</a></li>
          </ul>
        </nav>

        <nav aria-label={t('policies')}>
          <h2 className="footer-h">{t('policies')}</h2>
          <ul className="space-y-2.5">
            {POLICY_KEYS.map((k) => <li key={k}><a href={`#/policy/${k}`} className={link}>{pick(policies[k].title)}</a></li>)}
          </ul>
        </nav>

        <div>
          <h2 className="footer-h">{t('footerContact')}</h2>
          <address className="not-italic leading-relaxed text-ink/70">
            {pick(site.address)}
            <br />
            {pick(site.area)}
          </address>
          {site.addressConfirmed ? (
            <a href={mapsDirections} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-ink underline underline-offset-4">
              {t('directions')}
            </a>
          ) : (
            <p className="mt-1 text-xs font-semibold text-amber-700">{t('addressPending')}</p>
          )}
          <ul className="mt-3 space-y-1.5">
            {[...site.phones, site.landline].map((p) => (
              <li key={p.tel}><a href={`tel:${p.tel}`} dir="ltr" className={link}>{p.display}</a></li>
            ))}
          </ul>
          <a href={waLink()} target="_blank" rel="noopener noreferrer" className="btn mt-4 h-11 bg-[#1fa855] px-5 text-white hover:bg-[#178f47]">
            <WhatsAppIcon className="size-[18px]" />
            {t('whatsapp')}
          </a>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="page-width flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pb-24 pt-6 text-sm text-muted md:pb-6">
          <button type="button" onClick={toggle} aria-label={t('switchLangLabel')} className="inline-flex h-10 items-center gap-2 rounded-md border border-ink/25 bg-white px-3 font-semibold text-ink hover:border-ink">
            <GlobeIcon className="size-4" />
            {t('switchLang')}
          </button>
          <ul className="flex flex-wrap gap-2" aria-label={t('paymentMethods')}>
            {payments.map(({ key, label, icon: Icon, text }) => (
              <li key={key} title={label} className="inline-flex h-8 items-center gap-1.5 rounded border border-line bg-white px-2.5 text-xs font-semibold text-ink">
                {Icon ? <Icon className="size-4" /> : null}
                {text ? <span dir="ltr">{text}</span> : label}
              </li>
            ))}
          </ul>
          <p className="w-full sm:w-auto">© {year} {pick(site.name)} — {t('rights')}{!live && <span className="block sm:inline sm:ms-2">{t('demoNote')}</span>}</p>
        </div>
      </div>
    </footer>
  )
}
