import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { useCatalog } from '../lib/catalogState'
import { maxDiscount } from '../lib/catalog'
import { BrandMark } from './Brand'
import GarmentArt from './GarmentArt'
import { ArrowIcon, PinIcon } from './Icons'

function RotatingTitle() {
  const { t } = useLang()
  const titles = t('heroTitles')
  const [i, setI] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setI((n) => n + 1), 4200)
    return () => clearInterval(id)
  }, [])

  const [a, b] = titles[i % titles.length]
  return (
    <h1 className="mt-4 min-h-[6.2rem] text-[2.35rem] font-black leading-[1.12] tracking-tight sm:min-h-[8rem] sm:text-5xl lg:min-h-[9.4rem] lg:text-[3.6rem]">
      <span key={i % titles.length} className="title-swap block" aria-live="off">
        <span className="block">{a}</span>
        <span className="block text-brand">{b}</span>
      </span>
    </h1>
  )
}

export default function Hero() {
  const { t, num, pick } = useLang()
  const { products } = useData()
  const { browse } = useCatalog()

  // Only claim a discount the catalogue really has.
  const topDiscount = useMemo(() => products.filter((p) => p.totalStock > 0).reduce((m, p) => Math.max(m, maxDiscount(p)), 0), [products])
  // A real product photo if the shop has one; otherwise the brand illustration.
  const photo = useMemo(() => products.find((p) => p.featured && p.image) ?? products.find((p) => p.image), [products])

  return (
    <section id="home" className="relative overflow-hidden bg-ink text-white">
      <div className="pointer-events-none absolute inset-0 dots opacity-[.06]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:px-8 lg:py-12">
        <div className="rise">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
            <PinIcon className="size-4 text-brand" />
            {t('heroKicker')}
          </p>
          <RotatingTitle />
          <p className="mt-3 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">{t('heroText')}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => browse({})} className="btn btn-red group h-13 px-8 text-lg">
              {t('shopNowCta')}
              <ArrowIcon className="size-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
            </button>
            {topDiscount > 0 && (
              <button type="button" onClick={() => browse({ onSale: true, sort: 'discount' })} className="btn h-13 border border-white/25 px-6 text-white hover:border-white hover:bg-white hover:text-ink">
                {t('seeOffers')}
              </button>
            )}
          </div>
        </div>

        <div className="rise relative hidden lg:block" style={{ '--d': '120ms' }}>
          {photo ? (
            <img src={photo.image} alt={pick(photo.name)} width="640" height="560" fetchPriority="high" className="aspect-[8/7] w-full rounded-[28px] object-cover" />
          ) : (
            <div className="grid aspect-[8/7] grid-cols-[1.2fr_1fr] gap-3" aria-hidden="true">
              <GarmentArt type="shirt" color="#ffffff" bg="#e3262d" className="hero-tile row-span-2 rounded-[28px] px-3 py-8" />
              <GarmentArt type="hoodie" color="#2b2a2f" bg="#f3f1ec" className="hero-tile rounded-[28px] p-3" />
              <div className="hero-tile relative grid place-items-center overflow-hidden rounded-[28px] bg-white">
                <BrandMark className="size-[58%]" />
              </div>
            </div>
          )}
          {topDiscount > 0 && (
            <div className="absolute -top-3 start-6 rotate-[-6deg] rounded-2xl bg-brand px-5 py-3 text-center shadow-[0_14px_30px_-12px_rgba(227,38,45,.8)]">
              <span className="block text-xs font-bold">{t('upTo')}</span>
              <span className="block text-3xl font-black leading-none">{t('pct')(num(topDiscount))}</span>
              <span className="block text-xs font-bold">{t('offWord')}</span>
            </div>
          )}
        </div>

        {topDiscount > 0 && (
          <p className="-mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-brand px-4 py-1.5 text-sm font-black lg:hidden">{t('heroUpTo')(num(topDiscount))}</p>
        )}
      </div>
    </section>
  )
}
