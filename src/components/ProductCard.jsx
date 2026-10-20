import { useEffect, useId, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { waLink } from '../lib/links'
import { useData } from '../lib/store'
import GarmentArt from './GarmentArt'
import { BagIcon, WhatsAppIcon } from './Icons'

export default function ProductCard({ product: p, className = '' }) {
  const { t, pick, price, num } = useLang()
  const cart = useCart()
  const { live } = useData()
  const [size, setSize] = useState(p.sizes.length === 1 ? p.sizes[0] : null)
  const [hint, setHint] = useState(false)
  const [added, setAdded] = useState(false)
  const sizesId = useId()
  const name = pick(p.name)
  const sold = p.stock === 'out'
  const off = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0

  useEffect(() => {
    if (!added) return
    const id = setTimeout(() => setAdded(false), 1600)
    return () => clearTimeout(id)
  }, [added])

  const add = () => {
    if (!size) return setHint(true)
    cart.add(p.id, size)
    setAdded(true)
  }

  const stockLabel = { in: t('inStock'), low: t('lowStock'), out: t('outStock') }[p.stock]
  const stockDot = { in: 'bg-emerald-500', low: 'bg-amber-500', out: 'bg-neutral-400' }[p.stock]

  return (
    <article className={`product-card group flex flex-col overflow-hidden rounded-[24px] bg-white ring-1 ring-line ${className}`}>
      <div className="relative">
        {p.image ? (
          <img src={p.image} alt={name} loading="lazy" decoding="async" width="600" height="750" className="product-media aspect-[4/5] w-full object-cover" />
        ) : (
          <GarmentArt {...p.art} label={`${name} — ${t('illustration')}`} className="product-media aspect-[4/5] p-7" />
        )}

        <div className="absolute inset-x-3 top-3 flex flex-wrap items-start gap-1.5">
          {p.isNew && <span className="badge bg-ink text-white">{t('newBadge')}</span>}
          {off > 0 && <span className="badge bg-brand text-white">{t('off')(num(off))}</span>}
        </div>
        {!live && <span className="badge absolute bottom-3 end-3 bg-white/90 text-ink ring-1 ring-black/5">{t('sample')}</span>}

        {sold && (
          <div className="absolute inset-0 grid place-items-center bg-white/55 backdrop-blur-[1px]">
            <span className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">{t('outStock')}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-extrabold leading-snug text-ink sm:text-lg">{name}</h3>
          <a
            href={waLink(t('askMsg')(name, size))}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('askWhatsapp')}
            title={t('askWhatsapp')}
            className="-mt-1 -me-1.5 inline-flex size-8 shrink-0 sm:size-9 items-center justify-center rounded-full text-[#1fa855] transition hover:bg-[#1fa855]/10"
          >
            <WhatsAppIcon className="size-[19px]" />
          </a>
        </div>

        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-black text-brand sm:text-xl">{price(p.price)}</span>
          {p.oldPrice && <s className="text-sm font-semibold text-muted">{price(p.oldPrice)}</s>}
        </p>

        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-muted">
          <span className={`inline-block size-2 rounded-full ${stockDot}`} aria-hidden="true" />
          {stockLabel}
        </p>

        <div className="mt-3">
          <p id={sizesId} className="mb-1.5 text-xs font-bold text-muted">{t('chooseSize')}</p>
          <div role="group" aria-labelledby={sizesId} className="flex flex-wrap gap-1.5">
            {p.sizes.map((s) => (
              <button
                key={s}
                type="button"
                disabled={sold}
                aria-pressed={size === s}
                onClick={() => { setSize(s); setHint(false) }}
                className="size-chip"
              >
                {s}
              </button>
            ))}
          </div>
          <p className={`mt-1.5 h-4 text-xs font-bold text-brand transition-opacity ${hint ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
            {hint ? t('pickSizeFirst') : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={add}
          disabled={sold}
          className={`btn mt-auto h-11 w-full text-sm sm:h-12 sm:text-[15px] ${added ? 'bg-emerald-600 text-white' : 'btn-ink'}`}
        >
          {!added && <BagIcon className="size-[18px]" />}
          {sold ? t('outStock') : added ? t('added') : t('addToCart')}
        </button>
      </div>
    </article>
  )
}
