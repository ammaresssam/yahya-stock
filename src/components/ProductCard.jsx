import { useEffect, useId, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { useData } from '../lib/store'
import { LOW_STOCK } from '../lib/product'
import { discountOf, maxDiscount } from '../lib/catalog'
import GarmentArt from './GarmentArt'
import { BagIcon } from './Icons'

export default function ProductCard({ product: p, className = '' }) {
  const { t, pick, price, num } = useLang()
  const cart = useCart()
  const { live } = useData()
  const inStock = p.variants.filter((v) => v.stock > 0)
  const [size, setSize] = useState(inStock.length === 1 && p.variants.length === 1 ? inStock[0].size : null)
  const [hint, setHint] = useState(null) // null | 'pick' | 'max'
  const [added, setAdded] = useState(false)
  const sizesId = useId()
  const name = pick(p.name)
  const sold = p.totalStock === 0
  const chosen = p.variants.find((v) => v.size === size)

  // The price follows the chosen size; before a choice, the lowest available price.
  const shownPrice = chosen ? chosen.price : p.price
  const shownOld = chosen ? chosen.compareAt : p.oldPrice
  const onSale = Boolean(shownOld && shownOld > shownPrice)
  const badge = chosen ? discountOf(chosen) : maxDiscount(p)
  const lowLeft = chosen ? (chosen.stock > 0 && chosen.stock <= LOW_STOCK ? chosen.stock : 0) : 0

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

  const many = p.images.length > 1

  return (
    <article className={`product-card group relative flex flex-col ${className}`}>
      <div className="relative overflow-hidden rounded-lg bg-paper">
        {p.image ? (
          <a href={`#/product/${p.id}`} className="relative block w-full" aria-label={`${t('viewProduct')}: ${name}`}>
            <img src={p.image} alt={name} loading="lazy" decoding="async" width="600" height="750" className="product-media aspect-[4/5] w-full object-cover" />
            {many && <img src={p.images[1]} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
          </a>
        ) : (
          <a href={`#/product/${p.id}`} className="block" aria-label={`${t('viewProduct')}: ${name}`}>
            <GarmentArt {...p.art} label={`${name} — ${t('illustration')}`} className="product-media aspect-[4/5] p-7" />
          </a>
        )}

        {/* badges sit in the bottom corner, like a theme's card */}
        <div className="pointer-events-none absolute bottom-2.5 start-2.5 flex flex-wrap gap-1.5">
          {sold ? (
            <span className="badge bg-ink text-white">{t('outStock')}</span>
          ) : (
            <>
              {badge > 0 && <span className="sale-badge">{t('off')(num(badge))}</span>}
              {p.isNew && <span className="badge bg-white text-ink ring-1 ring-ink/10">{t('newBadge')}</span>}
              {lowLeft > 0 && <span className="badge bg-amber-400 text-amber-950">{t('itemsLeft')(num(lowLeft))}</span>}
            </>
          )}
        </div>
        {!live && <span className="badge pointer-events-none absolute end-2.5 top-2.5 bg-white/90 font-semibold text-muted">{t('sample')}</span>}
        {sold && <div className="pointer-events-none absolute inset-0 bg-white/40" />}
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink sm:text-base">
          <a href={`#/product/${p.id}`} className="underline-offset-4 group-hover:underline">{name}</a>
        </h3>

        <p className="mt-1 flex flex-wrap items-baseline gap-x-2" aria-live="polite">
          <span className={`text-base font-bold sm:text-[17px] ${onSale ? 'text-brand' : 'text-ink'}`}>
            {!chosen && p.priceVaries ? t('from')(price(shownPrice)) : price(shownPrice)}
          </span>
          {onSale && <s className="text-sm text-muted">{price(shownOld)}</s>}
        </p>

        {!sold && (
          <div className="mt-2.5">
            <p id={sizesId} className="sr-only">{t('chooseSize')}</p>
            <div role="group" aria-labelledby={sizesId} className="flex flex-wrap gap-1">
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
            <p className={`mt-1 min-h-4 text-xs font-bold text-brand ${hint ? '' : 'invisible'}`} aria-live="polite">
              {hint === 'pick' ? t('pickSizeFirst') : hint === 'max' ? t('maxInCart') : ' '}
            </p>
          </div>
        )}

        {!sold && (
          <button type="button" onClick={add} className={`btn mt-auto h-11 w-full text-sm sm:text-[15px] ${added ? 'bg-emerald-600 text-white' : 'btn-outline'}`}>
            {!added && <BagIcon className="size-[18px]" />}
            {added ? t('added') : t('quickAdd')}
          </button>
        )}
      </div>
    </article>
  )
}
