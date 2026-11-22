import { useMemo } from 'react'
import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { useCatalog } from '../lib/catalogState'
import GarmentArt from './GarmentArt'

// Full-width banner with a soft dark box in the middle: a script word, a large serif title
// and a thin outlined button. Uses a real product photo when the shop has one.
export default function Hero() {
  const { t, pick } = useLang()
  const { products } = useData()
  const { browse } = useCatalog()
  const photo = useMemo(() => products.find((p) => p.featured && p.image) ?? products.find((p) => p.image), [products])

  return (
    <>
      <section id="home" className="relative isolate overflow-hidden bg-stone">
        {photo ? (
          <img src={photo.image} alt={pick(photo.name)} fetchPriority="high" className="absolute inset-0 -z-10 size-full object-cover" />
        ) : (
          // until there are photos: three garments in soft neutral tones, like clothes on a rail
          <div className="absolute inset-0 -z-10 flex items-end justify-between px-[3%]" aria-hidden="true">
            <div className="w-[30%] max-w-[400px] translate-y-[6%]"><GarmentArt type="shirt" color="#f7f5f1" bg="transparent" className="no-sheen aspect-square" /></div>
            <div className="w-[30%] max-w-[400px] translate-y-[6%]"><GarmentArt type="dress" color="#b9aa9a" bg="transparent" className="no-sheen aspect-square" /></div>
          </div>
        )}

        <div className="page-width flex min-h-[460px] items-center justify-center py-16 sm:min-h-[560px] lg:min-h-[640px]">
          <div className="rise w-full max-w-xl bg-ink-900/60 px-6 py-10 text-center text-white backdrop-blur-[2px] sm:px-12 sm:py-12">
            <p className="script text-5xl leading-none sm:text-6xl">{t('heroScript')}</p>
            <h1 className="display mt-2 text-[2.6rem] leading-[1.05] sm:text-6xl">{t('heroBig')}</h1>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/80">{t('heroText')}</p>
            <button type="button" onClick={() => browse({ sort: 'newest' })} className="btn btn-ghost mt-7 h-11 px-8">
              {t('shopNowCta')}
            </button>
          </div>
        </div>
      </section>
      <Marquee />
    </>
  )
}

// Black strip that slowly repeats one line, like the reference theme.
function Marquee() {
  const { t } = useLang()
  const items = Array.from({ length: 8 }, () => t('marqueeLine'))
  const row = (hidden) => (
    <span className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((x, i) => (
        <span key={i} className="caps flex shrink-0 items-center gap-6 px-3 text-[13px]">
          {x}
          <span aria-hidden="true">•</span>
        </span>
      ))}
    </span>
  )
  return (
    <div className="overflow-hidden bg-ink-900 py-3 text-white">
      <a href="#new" className="marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </a>
    </div>
  )
}
