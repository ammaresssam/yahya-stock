import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { useData } from '../lib/store'
import { checkoutAvailable } from '../lib/api'
import { waLink } from '../lib/links'
import { LOW_STOCK } from '../lib/product'
import { discountOf } from '../lib/catalog'
import GarmentArt from './GarmentArt'
import Gallery from './Gallery'
import Rail from './Rail'
import { BagIcon, MinusIcon, PlusIcon, WhatsAppIcon } from './Icons'
import { policies } from '../data/policies'

export default function ProductPage({ id }) {
  const { t, pick, price, num, dir } = useLang()
  const { products, categories, loading, live } = useData()
  const cart = useCart()
  const p = products.find((x) => String(x.id) === id)

  const inStock = p ? p.variants.filter((v) => v.stock > 0) : []
  const [size, setSize] = useState(null)
  const [qty, setQty] = useState(1)
  const [img, setImg] = useState(0)
  const [gallery, setGallery] = useState(null)
  const [msg, setMsg] = useState(null) // { kind, text }

  // pick the only available size automatically
  useEffect(() => {
    if (p && size === null && inStock.length === 1) setSize(inStock[0].size)
  }, [p]) // eslint-disable-line react-hooks/exhaustive-deps

  // page title for sharing / browser tabs
  useEffect(() => {
    if (!p) return
    const prev = document.title
    document.title = `${pick(p.name)} | ${pick({ ar: 'يحيى استوك', en: 'Yahya Stock' })}`
    return () => { document.title = prev }
  }, [p, pick])

  const chosen = p?.variants.find((v) => v.size === size)
  const inCart = chosen ? cart.inCartQty(p.id, chosen.size) : 0
  const canAdd = chosen ? Math.max(0, chosen.stock - inCart) : 0

  // keep the quantity within what can still be added
  useEffect(() => {
    if (chosen) setQty((q) => Math.min(Math.max(1, q), Math.max(1, canAdd)))
  }, [chosen?.size, canAdd]) // eslint-disable-line react-hooks/exhaustive-deps

  const related = useMemo(() => (p ? products.filter((x) => x.category === p.category && x.id !== p.id && x.totalStock > 0).slice(0, 10) : []), [p, products])

  if (!p) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        {loading ? <div className="mx-auto aspect-[4/5] max-w-sm animate-pulse rounded-lg bg-paper" /> : (
          <>
            <p className="text-lg font-bold text-ink">{t('productNotFound')}</p>
            <a href="#/shop" className="btn btn-ink mt-5 h-11 px-6">{t('backToShop')}</a>
          </>
        )}
      </section>
    )
  }

  const name = pick(p.name)
  const category = categories.find((c) => c.id === p.category)
  const shownPrice = chosen ? chosen.price : p.price
  const shownOld = chosen ? chosen.compareAt : p.oldPrice
  const onSale = Boolean(shownOld && shownOld > shownPrice)
  const pct = chosen ? discountOf(chosen) : onSale ? Math.round((1 - shownPrice / shownOld) * 100) : 0
  const sold = p.totalStock === 0
  const images = p.images

  const add = (thenCheckout = false) => {
    if (!chosen) return setMsg({ kind: 'error', text: t('pickSizeFirst') })
    const n = cart.addMany(p.id, chosen.size, qty)
    if (!n) return setMsg({ kind: 'error', text: t('maxInCart') })
    setMsg({ kind: 'ok', text: t('addedN')(num(n)) })
    setQty(1)
    if (thenCheckout) {
      if (checkoutAvailable) window.location.hash = '#/checkout'
      else cart.setOpen(true)
    }
  }

  return (
    <>
      <section className="bg-white pb-12 pt-5 sm:pb-16 sm:pt-8" aria-labelledby="product-title">
        <div className="page-width">
          <nav aria-label="breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <a href="#home" className="hover:text-ink">{t('home')}</a>
            <span aria-hidden="true">{dir === 'rtl' ? '‹' : '›'}</span>
            <a href="#/shop" className="hover:text-ink">{t('shop')}</a>
            {category && (
              <>
                <span aria-hidden="true">{dir === 'rtl' ? '‹' : '›'}</span>
                <span className="font-semibold text-ink">{pick(category.name)}</span>
              </>
            )}
          </nav>

          <div className="grid items-start gap-7 md:grid-cols-[1.2fr_1fr] lg:gap-14">
            {/* ---------- photos ---------- */}
            <div>
              <div className="relative overflow-hidden rounded-lg bg-paper">
                {images.length ? (
                  <button type="button" onClick={() => setGallery(img)} className="block w-full" aria-label={t('viewPhotos')(num(images.length))}>
                    <img src={images[img]} alt={`${name} — ${t('photoN')(num(img + 1))}`} className="aspect-[4/5] w-full object-cover" fetchPriority="high" />
                  </button>
                ) : (
                  <GarmentArt {...p.art} label={`${name} — ${t('illustration')}`} className="aspect-[4/5] p-12" />
                )}
                <div className="pointer-events-none absolute start-3 top-3 flex flex-col items-start gap-1.5">
                  {pct > 0 && !sold && <span className="sale-badge text-sm">{t('off')(num(pct))}</span>}
                  {p.isNew && <span className="badge bg-white text-ink ring-1 ring-ink/10">{t('newBadge')}</span>}
                </div>
                {!live && <span className="badge absolute end-3 top-3 bg-white/90 text-ink">{t('sample')}</span>}
              </div>
              {images.length > 1 && (
                <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                  {images.map((src, i) => (
                    <li key={src + i} className="shrink-0">
                      <button type="button" onClick={() => setImg(i)} aria-label={t('photoN')(num(i + 1))} aria-current={i === img ? 'true' : undefined} className={`block overflow-hidden rounded-md ring-2 ${i === img ? 'ring-ink' : 'ring-transparent hover:ring-line'}`}>
                        <img src={src} alt="" loading="lazy" className="aspect-[4/5] w-16 object-cover sm:w-20" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ---------- buying ---------- */}
            <div className="md:sticky md:top-24">
              {category && <p className="text-sm text-muted">{pick(category.name)}</p>}
              <h1 id="product-title" className="mt-1 text-[1.75rem] font-bold leading-tight text-ink sm:text-4xl">{name}</h1>

              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
                <span className={`text-2xl font-bold ${onSale ? 'text-brand' : 'text-ink'}`}>
                  {!chosen && p.priceVaries ? t('from')(price(shownPrice)) : price(shownPrice)}
                </span>
                {onSale && <s className="text-lg text-muted">{price(shownOld)}</s>}
                {onSale && chosen && <span className="sale-badge">{t('youSave')(price(shownOld - shownPrice))}</span>}
              </div>

              <StockLine p={p} chosen={chosen} />

              {/* sizes */}
              <fieldset className="mt-6">
                <legend className="mb-2 text-sm text-muted">{t('chooseSize')}{size && <>: <b className="text-ink" dir="ltr">{size}</b></>}</legend>
                <div className="flex flex-wrap gap-2">
                  {p.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={v.stock === 0}
                      aria-pressed={size === v.size}
                      aria-label={v.stock === 0 ? `${v.size} — ${t('sizeSoldOut')}` : v.size}
                      onClick={() => { setSize(v.size); setMsg(null) }}
                      className={`size-chip-lg ${v.stock === 0 ? 'line-through' : ''}`}
                    >
                      {v.size}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* quantity */}
              {!sold && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span className="w-full text-sm text-muted" id="qty-label">{t('quantity')}</span>
                  <div className="flex items-center rounded-md border border-ink/30" role="group" aria-labelledby="qty-label">
                    <button type="button" className="grid size-12 place-items-center hover:bg-paper disabled:opacity-30" aria-label={t('decrease')} disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                      <MinusIcon className="size-5" />
                    </button>
                    <span className="w-10 text-center text-lg font-bold" aria-live="polite">{num(qty)}</span>
                    <button type="button" className="grid size-12 place-items-center hover:bg-paper disabled:opacity-30" aria-label={t('increase')} disabled={!chosen || qty >= canAdd} onClick={() => setQty((q) => Math.min(canAdd, q + 1))}>
                      <PlusIcon className="size-5" />
                    </button>
                  </div>
                  {chosen && inCart > 0 && <span className="text-sm text-muted">{t('inCartAlready')(num(inCart))}</span>}
                  {chosen && canAdd > 0 && qty >= canAdd && <span className="text-sm font-bold text-amber-700">{t('maxQty')(num(canAdd))}</span>}
                </div>
              )}

              {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-md p-3 text-sm font-bold ${msg.kind === 'error' ? 'bg-brand/10 text-brand' : 'bg-emerald-50 text-emerald-800'}`}>{msg.text}</p>}

              {/* theme-style buttons: add to cart (outlined) above buy now (solid) */}
              <div className="mt-6 grid gap-2.5">
                <button type="button" onClick={() => add(false)} disabled={sold || (chosen && canAdd === 0)} className="btn btn-outline h-13 text-lg">
                  <BagIcon className="size-5" />
                  {sold ? t('outStock') : t('addToCart')}
                </button>
                {!sold && (
                  <button type="button" onClick={() => add(true)} disabled={chosen && canAdd === 0} className="btn btn-ink h-13 text-lg">{t('buyNow')}</button>
                )}
              </div>

              <a href={waLink(t('askMsg')(name, size))} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 font-semibold text-ink underline-offset-4 hover:underline">
                <WhatsAppIcon className="size-5 text-[#1fa855]" />
                {t('askWhatsapp')}
              </a>

              <div className="mt-7 border-t border-line">
                <Accordion title={t('detailsTab')} open>
                  <dl className="grid gap-2">
                    {category && <Row label={t('filterCategory')} value={pick(category.name)} />}
                    <Row label={t('availableSizes')} value={<span dir="ltr">{inStock.map((v) => v.size).join(' · ') || '—'}</span>} />
                  </dl>
                </Accordion>
                <Accordion title={t('deliveryReturns')}>
                  <p>{t('deliveryReturnsText')}</p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <a href="#/policy/delivery" className="link-u font-semibold text-ink">{pick(policies.delivery.title)}</a>
                    <a href="#/policy/returns" className="link-u font-semibold text-ink">{pick(policies.returns.title)}</a>
                  </p>
                </Accordion>
              </div>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && <Rail id="related" title={t('related')} products={related} limit={4} />}
      {gallery !== null && <Gallery images={images} name={name} start={gallery} onClose={() => setGallery(null)} />}
    </>
  )
}

function StockLine({ p, chosen }) {
  const { t, num } = useLang()
  const status = chosen ? (chosen.stock === 0 ? 'out' : chosen.stock <= LOW_STOCK ? 'low' : 'in') : p.stock
  const label = chosen && status === 'low' ? t('leftOnly')(num(chosen.stock)) : { in: t('inStock'), low: t('lowStock'), out: t('outStock') }[status]
  const dot = { in: 'bg-emerald-500', low: 'bg-amber-500', out: 'bg-neutral-400' }[status]
  return (
    <p className="mt-2 flex items-center gap-2 font-semibold text-muted">
      <span className={`inline-block size-2.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </p>
  )
}

function Accordion({ title, open = false, children }) {
  return (
    <details className="accordion border-b border-line" open={open}>
      <summary className="flex cursor-pointer items-center justify-between gap-3 py-4 font-semibold text-ink">
        {title}
        <PlusIcon className="acc-icon size-5 transition-transform" />
      </summary>
      <div className="pb-5 text-sm leading-relaxed text-muted">{children}</div>
    </details>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-bold text-ink">{value}</dd>
    </div>
  )
}
