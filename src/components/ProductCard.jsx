import { useEffect, useId, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { waLink } from '../lib/links'
import { useData } from '../lib/store'
import { LOW_STOCK } from '../lib/product'
import GarmentArt from './GarmentArt'
import Gallery from './Gallery'
import { BagIcon, CameraIcon, WhatsAppIcon } from './Icons'

export default function ProductCard({ product: p, className = '' }) {
  const { t, pick, price, num } = useLang()
  const cart = useCart()
  const { live } = useData()
  const inStock = p.variants.filter((v) => v.stock > 0)
  const [size, setSize] = useState(inStock.length === 1 && p.variants.length === 1 ? inStock[0].size : null)
  const [hint, setHint] = useState(null) // null | 'pick' | 'max'
  const [added, setAdded] = useState(false)
  const [gallery, setGallery] = useState(null) // index of the photo to open, or null
  const sizesId = useId()
  const name = pick(p.name)
  const sold = p.totalStock === 0
  const chosen = p.variants.find((v) => v.size === size)

  // price shown follows the chosen size; before a choice, the lowest available price
  const shownPrice = chosen ? chosen.price : p.price
  const shownOld = chosen ? chosen.compareAt : p.oldPrice
  const off = shownOld ? Math.round((1 - shownPrice / shownOld) * 100) : 0

  useEffect(() => {
    if (!added) return
    const id = setTimeout(() => setAdded(false), 1600)
    return () => clearTimeout(id)
  }, [added])

  const add = () => {
    if (!chosen) return setHint('pick')
    if (!cart.add(p.id, chosen.size)) return setHint('max')
    setHint(null)
    setAdded(true)
  }

  const status = chosen
    ? chosen.stock === 0 ? 'out' : chosen.stock <= LOW_STOCK ? 'low' : 'in'
    : p.stock
  const stockLabel =
    chosen && status === 'low' ? t('leftOnly')(num(chosen.stock)) : { in: t('inStock'), low: t('lowStock'), out: t('outStock') }[status]
  const stockDot = { in: 'bg-emerald-500', low: 'bg-amber-500', out: 'bg-neutral-400' }[status]
  const many = p.images.length > 1

  return (
    <article className={`product-card group flex flex-col overflow-hidden rounded-[24px] bg-white ring-1 ring-line ${className}`}>
      <div className="relative">
        {p.image ? (
          <button
            type="button"
            onClick={() => setGallery(0)}
            className="relative block w-full overflow-hidden"
            aria-label={many ? `${name} — ${t('viewPhotos')(num(p.images.length))}` : name}
          >
            <img src={p.image} alt={name} loading="lazy" decoding="async" width="600" height="750" className="product-media aspect-[4/5] w-full object-cover" />
            {/* second photo shows on hover (desktop) */}
            {many && (
              <img src={p.images[1]} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            )}
          </button>
        ) : (
          <GarmentArt {...p.art} label={`${name} — ${t('illustration')}`} className="product-media aspect-[4/5] p-7" />
        )}

        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start gap-1.5">
          {p.isNew && <span className="badge bg-ink text-white">{t('newBadge')}</span>}
          {off > 0 && <span className="badge bg-brand text-white">{t('off')(num(off))}</span>}
        </div>
        <div className="pointer-events-none absolute bottom-3 end-3 flex gap-1.5">
          {many && <span className="badge inline-flex items-center gap-1 bg-ink/80 text-white"><CameraIcon className="size-3" />{num(p.images.length)}</span>}
          {!live && <span className="badge bg-white/90 text-ink ring-1 ring-black/5">{t('sample')}</span>}
        </div>

        {sold && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/55 backdrop-blur-[1px]">
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

        <p className="mt-1 flex flex-wrap items-baseline gap-x-2" aria-live="polite">
          <span className="text-lg font-black text-brand sm:text-xl">
            {!chosen && p.priceVaries ? t('from')(price(shownPrice)) : price(shownPrice)}
          </span>
          {shownOld && <s className="text-sm font-semibold text-muted">{price(shownOld)}</s>}
        </p>

        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-muted">
          <span className={`inline-block size-2 rounded-full ${stockDot}`} aria-hidden="true" />
          {stockLabel}
        </p>

        <div className="mt-3">
          <p id={sizesId} className="mb-1.5 text-xs font-bold text-muted">{t('chooseSize')}</p>
          <div role="group" aria-labelledby={sizesId} className="flex flex-wrap gap-1.5">
            {p.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={v.stock === 0}
                aria-pressed={size === v.size}
                title={v.stock === 0 ? t('sizeSoldOut') : undefined}
                aria-label={v.stock === 0 ? `${v.size} — ${t('sizeSoldOut')}` : v.size}
                onClick={() => { setSize(v.size); setHint(null) }}
                className={`size-chip ${v.stock === 0 ? 'line-through' : ''}`}
              >
                {v.size}
              </button>
            ))}
          </div>
          <p className={`mt-1.5 h-4 text-xs font-bold text-brand transition-opacity ${hint ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
            {hint === 'pick' ? t('pickSizeFirst') : hint === 'max' ? t('maxInCart') : ''}
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

      {gallery !== null && <Gallery images={p.images} name={name} start={gallery} onClose={() => setGallery(null)} />}
    </article>
  )
}
