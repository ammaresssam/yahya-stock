import { useEffect } from 'react'
import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { POLICY_KEYS, policies, policiesApproved } from '../data/policies'

// Highlights the owner's [blanks] so they can't be missed before launch.
function Text({ children }) {
  const parts = String(children).split(/(\[[^\]]+\])/g)
  return parts.map((part, i) =>
    part.startsWith('[') ? <mark key={i} className="rounded bg-amber-100 px-1 font-bold text-amber-900">{part}</mark> : <span key={i}>{part}</span>,
  )
}

export default function PolicyPage({ which }) {
  const { t, pick, price, lang, dir } = useLang()
  const { zones } = useData()
  const policy = policies[which] ?? policies.terms

  useEffect(() => {
    const prev = document.title
    document.title = `${pick(policy.title)} | ${pick({ ar: 'يحيى استوك', en: 'Yahya Stock' })}`
    return () => { document.title = prev }
  }, [policy, pick])

  return (
    <section className="bg-white py-10 sm:py-14" aria-labelledby="policy-title">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <a href="#home" className="text-sm font-bold text-muted hover:text-ink">{dir === 'rtl' ? '→' : '←'} {t('home')}</a>
        <h1 id="policy-title" className="mt-2 text-3xl font-black text-ink">{pick(policy.title)}</h1>

        {!policiesApproved && <p role="note" className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{t('policyTemplate')}</p>}

        <nav aria-label={t('policies')} className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4">
          {POLICY_KEYS.map((k) => (
            <a key={k} href={`#/policy/${k}`} aria-current={k === which ? 'page' : undefined} className={`pill shrink-0 ${k === which ? 'border-ink bg-ink text-white' : ''}`}>
              {pick(policies[k].title)}
            </a>
          ))}
        </nav>

        <div className="mt-6 grid gap-5">
          {policy.body[lang].map(([heading, text]) => (
            <div key={heading}>
              <h2 className="text-lg font-black text-ink">{heading}</h2>
              <p className="mt-1 leading-relaxed text-ink/85"><Text>{text}</Text></p>
            </div>
          ))}
        </div>

        {policy.showZones && zones.length > 0 && (
          <table className="mt-6 w-full overflow-hidden rounded-2xl text-start ring-1 ring-line">
            <caption className="mb-2 text-start font-black text-ink">{t('deliveryFees')}</caption>
            <thead className="bg-paper text-sm">
              <tr><th className="p-3 text-start">{t('fZone')}</th><th className="p-3 text-start">{t('shippingFee')}</th></tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-t border-line"><td className="p-3">{pick(z.name)}</td><td className="p-3 font-bold">{price(z.fee)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
