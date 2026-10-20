import { useLang } from '../lib/i18n'
import { mapsDirections, waLink } from '../lib/links'
import { site } from '../data/site'
import { useData } from '../lib/store'
import { Wordmark } from './Brand'
import { navItems } from './Header'
import { socialList } from './InfoSections'
import { WhatsAppIcon } from './Icons'

export default function Footer() {
  const { t, pick } = useLang()
  const { live } = useData()
  const year = new Date().getFullYear()
  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <div className="pointer-events-none absolute inset-0 dots opacity-[.06]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <Wordmark className="h-14 w-auto" title={pick(site.name)} />
          <p className="mt-4 max-w-xs leading-relaxed text-white/65">{t('footerText')}</p>
          {socialList(t).length > 0 && (
            <ul className="mt-5 flex gap-2">
              {socialList(t).map(({ key, href, label, Icon }) => (
                <li key={key}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-brand">
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
              <li key={href}><a href={href} className="text-white/70 hover:text-white">{t(key)}</a></li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="footer-h">{t('footerVisit')}</h2>
          <address className="not-italic leading-relaxed text-white/70">
            {pick(site.address)}
            <br />
            {pick(site.area)}
          </address>
          <a href={mapsDirections} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-bold text-brand hover:underline">
            {t('directions')}
          </a>
        </div>

        <div>
          <h2 className="footer-h">{t('footerContact')}</h2>
          <ul className="space-y-2.5">
            {[...site.phones, site.landline].map((p) => (
              <li key={p.tel}><a href={`tel:${p.tel}`} dir="ltr" className="text-white/70 hover:text-white">{p.display}</a></li>
            ))}
          </ul>
          <a href={waLink()} target="_blank" rel="noopener noreferrer" className="btn btn-red mt-4 h-11 px-5">
            <WhatsAppIcon className="size-[18px]" />
            {t('whatsapp')}
          </a>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 pb-24 pt-5 text-sm text-white/50 sm:px-6 sm:pb-5 lg:px-8">
          <p>© {year} {pick(site.name)} — {t('rights')}</p>
          {!live && <p>{t('demoNote')}</p>}
        </div>
      </div>
    </footer>
  )
}
