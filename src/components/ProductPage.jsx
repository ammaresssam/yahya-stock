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
        {loading ? <div className="mx-auto aspect-[4/5] max-w-sm animate-pulse rounded-[28px] bg-paper" /> : (
          <>
            <p className="text-lg font-bold text-ink">{t('productNotFound')}</p>
            <a href="#shop" className="btn btn-ink mt-5 h-11 px-6">{t('backToShop')}</a>
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
      <section className="bg-white py-6 sm:py-10" aria-labelledby="product-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav aria-label="breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <a href="#home" className="hover:text-ink">{t('home')}</a>
            <span aria-hidden="true">{dir === 'rtl' ? '‹' : '›'}</span>
            <a href="#shop" className="hover:text-ink">{t('shop')}</a>
            {category && (
              <>
                <span aria-hidden="true">{dir === 'rtl' ? '‹' : '›'}</span>
                <span className="font-semibold text-ink">{pick(category.name)}</span>
              </>
            )}
          </nav>

          <div className="grid gap-6 md:grid-cols-2 lg:gap-12">
            {/* ---------- photos ---------- */}
            <div>
              <div className="relative overflow-hidden rounded-[24px] bg-paper">
                {images.length ? (
                  <button type="button" onClick={() => setGallery(img)} className="block w-full" aria-label={t('viewPhotos')(num(images.length))}>
                    <img src={images[img]} alt={`${name} — ${t('photoN')(num(img + 1))}`} className="aspect-[4/5] w-full object-cover" fetchPriority="high" />
                  </button>
                ) : (
                  <GarmentArt {...p.art} label={`${name} — ${t('illustration')}`} className="aspect-[4/5] p-12" />
                )}
                <div className="pointer-events-none absolute start-3 top-3 flex flex-col items-start gap-1.5">
                  {pct > 0 && !sold && <span className="sale-badge text-base">{t('off')(num(pct))}</span>}
                  {p.isNew && <span className="badge bg-ink text-white">{t('newBadge')}</span>}
                </div>
                {!live && <span className="badge absolute end-3 top-3 bg-white/90 text-ink">{t('sample')}</span>}
              </div>
              {images.length > 1 && (
                <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                  {images.map((src, i) => (
                    <li key={src + i} className="shrink-0">
                      <button type="button" onClick={() => setImg(i)} aria-label={t('photoN')(num(i + 1))} aria-current={i === img ? 'true' : undefined} className={`block overflow-hidden rounded-xl ring-2 ${i === img ? 'ring-ink' : 'ring-transparent hover:ring-line'}`}>
                        <img src={src} alt="" loading="lazy" className="aspect-[4/5] w-16 object-cover sm:w-20" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ---------- buying ---------- */}
            <div className="md:pt-2">
              <h1 id="product-title" className="text-2xl font-black leading-tight text-ink sm:text-3xl">{name}</h1>

              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
                <span className={`text-3xl font-black ${onSale ? 'text-brand' : 'text-ink'}`}>
                  {!chosen && p.priceVaries ? t('from')(price(shownPrice)) : price(shownPrice)}
                </span>
                {onSale && <s className="text-lg font-semibold text-muted">{price(shownOld)}</s>}
                {onSale && chosen && <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-black text-brand">{t('youSave')(price(shownOld - shownPrice))}</span>}
              </div>

              <StockLine p={p} chosen={chosen} />

              {/* sizes */}
              <fieldset className="mt-6">
                <legend className="mb-2 font-black text-ink">{t('chooseSize')}</legend>
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
                  <span className="font-black text-ink" id="qty-label">{t('quantity')}</span>
                  <div className="flex items-center rounded-full ring-1 ring-line" role="group" aria-labelledby="qty-label">
                    <button type="button" className="grid size-12 place-items-center rounded-full hover:bg-paper disabled:opacity-30" aria-label={t('decrease')} disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                      <MinusIcon className="size-5" />
                    </button>
                    <span className="w-10 text-center text-lg font-black" aria-live="polite">{num(qty)}</span>
                    <button type="button" className="grid size-12 place-items-center rounded-full hover:bg-paper disabled:opacity-30" aria-label={t('increase')} disabled={!chosen || qty >= canAdd} onClick={() => setQty((q) => Math.min(canAdd, q + 1))}>
                      <PlusIcon className="size-5" />
                    </button>
                  </div>
                  {chosen && inCart > 0 && <span className="text-sm text-muted">{t('inCartAlready')(num(inCart))}</span>}
                  {chosen && canAdd > 0 && qty >= canAdd && <span className="text-sm font-bold text-amber-700">{t('maxQty')(num(canAdd))}</span>}
                </div>
              )}

              {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-2xl p-3 text-sm font-bold ${msg.kind === 'error' ? 'bg-brand/10 text-brand' : 'bg-emerald-50 text-emerald-800'}`}>{msg.text}</p>}

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => add(false)} disabled={sold || (chosen && canAdd === 0)} className="btn btn-red h-14 text-lg">
                  <BagIcon className="size-5" />
                  {sold ? t('outStock') : t('addToCart')}
                </button>
                {!sold && (
                  <button type="button" onClick={() => add(true)} disabled={chosen && canAdd === 0} className="btn btn-ink h-14 text-lg">{t('buyNow')}</button>
                )}
              </div>

              <a href={waLink(t('askMsg')(name, size))} target="_blank" rel="noopener noreferrer" className="btn mt-3 h-12 w-full border border-[#1fa855] text-[#178f47] hover:bg-[#1fa855]/10">
                <WhatsAppIcon className="size-5" />
                {t('askWhatsapp')}
              </a>

              <dl className="mt-6 grid gap-2 rounded-[20px] bg-paper p-4 text-sm">
                {category && <Row label={t('filterCategory')} value={pick(category.name)} />}
                <Row label={t('availableSizes')} value={<span dir="ltr">{inStock.map((v) => v.size).join(' · ') || '—'}</span>} />
              </dl>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && <Rail id="related" kicker={category ? pick(category.name) : ''} title={t('related')} products={related} />}
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

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-bold text-ink">{value}</dd>
    </div>
  )
}
