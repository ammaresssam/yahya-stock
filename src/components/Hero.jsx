import { useMemo } from 'react'
import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { useCatalog } from '../lib/catalogState'
import { maxDiscount } from '../lib/catalog'
import GarmentArt from './GarmentArt'

// Full-width image banner (like a theme's "Image banner" section).
// Uses a real product photo when the shop has one; otherwise the shop-sign panel with illustrations.
export default function Hero() {
  const { t, num, pick } = useLang()
  const { products } = useData()
  const { browse } = useCatalog()

  // Only claim a discount the catalogue really has.
  const topDiscount = useMemo(() => products.filter((p) => p.totalStock > 0).reduce((m, p) => Math.max(m, maxDiscount(p)), 0), [products])
  const photo = useMemo(() => products.find((p) => p.featured && p.image) ?? products.find((p) => p.image), [products])
  const [a, b] = t('heroTitles')[0]

  return (
    <section id="home" className="relative isolate overflow-hidden bg-ink text-white">
      {photo ? (
        <>
          <img src={photo.image} alt={pick(photo.name)} fetchPriority="high" className="absolute inset-0 -z-10 size-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-ink/45" aria-hidden="true" />
        </>
      ) : (
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="dots absolute inset-0 opacity-[.07]" />
          <div className="absolute -bottom-6 -start-10 hidden w-[30%] max-w-[360px] opacity-90 md:block">
            <GarmentArt type="shirt" color="#ffffff" bg="transparent" className="no-sheen aspect-square" />
          </div>
          <div className="absolute -bottom-4 -end-8 hidden w-[26%] max-w-[320px] md:block">
            <GarmentArt type="dress" color="#e3262d" bg="transparent" className="no-sheen aspect-square" />
          </div>
        </div>
      )}

      <div className="page-width flex min-h-[440px] flex-col items-center justify-center py-16 text-center sm:min-h-[520px] lg:min-h-[600px]">
        <p className="rise text-sm font-semibold text-white/80 sm:text-base">{t('heroKicker')}</p>
        <h1 className="rise display mt-3 max-w-4xl text-[2.6rem] leading-[1.1] sm:text-6xl lg:text-7xl" style={{ '--d': '80ms' }}>
          {a} {b}
        </h1>
        <p className="rise mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg" style={{ '--d': '160ms' }}>{t('heroText')}</p>
        <div className="rise mt-8 flex flex-wrap justify-center gap-3" style={{ '--d': '240ms' }}>
          <button type="button" onClick={() => browse({})} className="btn h-13 min-w-44 bg-white px-8 text-lg text-ink hover:bg-paper">
            {t('shopNowCta')}
          </button>
          {topDiscount > 0 && (
            <button type="button" onClick={() => browse({ onSale: true, sort: 'discount' })} className="btn h-13 min-w-44 border border-white px-8 text-lg text-white hover:bg-white hover:text-ink">
              {t('heroUpTo')(num(topDiscount))}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
