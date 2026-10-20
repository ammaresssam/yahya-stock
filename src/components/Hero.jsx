import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
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
    <h1 className="mt-5 min-h-[8.4rem] text-[2.6rem] font-black leading-[1.15] tracking-tight sm:min-h-[10.5rem] sm:text-6xl lg:min-h-[12.5rem] lg:text-[4.4rem]">
      {/* key restarts the fade each time the title changes */}
      <span key={i % titles.length} className="title-swap block" aria-live="off">
        <span className="block">{a}</span>
        <span className="block text-brand">{b}</span>
      </span>
    </h1>
  )
}

export default function Hero() {
  const { t } = useLang()
  return (
    <section id="home" className="relative overflow-hidden bg-ink text-white">
      {/* perforated-banner texture like the shop sign */}
      <div className="pointer-events-none absolute inset-0 dots opacity-[.07]" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-semibold text-white/85">
            <PinIcon className="size-4 text-brand" />
            {t('heroKicker')}
          </p>
          <RotatingTitle />
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75 sm:text-xl">{t('heroText')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#shop" className="btn btn-red group h-14 px-7 text-lg">
              {t('heroCta')}
              <ArrowIcon className="size-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
            </a>
            <a href="#visit" className="btn h-14 border border-white/25 px-7 text-lg text-white hover:border-white hover:bg-white hover:text-ink">
              {t('heroCta2')}
            </a>
          </div>
        </div>

        {/* collage */}
        <div className="rise grid grid-cols-2 gap-3 sm:gap-4" style={{ '--d': '120ms' }} aria-hidden="true">
          <GarmentArt type="shirt" color="#ffffff" bg="#e3262d" className="hero-tile row-span-2 rounded-[28px] px-3 py-10 sm:px-5" />
          <GarmentArt type="hoodie" color="#2b2a2f" bg="#f3f1ec" className="hero-tile aspect-square rounded-[28px] p-3 sm:p-4" />
          <div className="hero-tile relative grid aspect-square place-items-center overflow-hidden rounded-[28px] bg-white">
            <BrandMark className="size-[62%]" />
            <span className="absolute bottom-3 font-logo text-sm font-extrabold italic tracking-[.25em] text-ink sm:bottom-4 sm:text-base">stock</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Marquee() {
  const { t } = useLang()
  const words = t('marquee')
  const row = [...words, ...words]
  return (
    <div className="overflow-hidden border-y-4 border-ink bg-brand py-3.5 text-white" aria-hidden="true">
      <div className="marquee flex w-max gap-8 whitespace-nowrap text-lg font-extrabold sm:text-xl">
        {[...row, ...row].map((w, i) => (
          <span key={i} className="flex items-center gap-8">
            {w}
            <span className="inline-block size-2 rounded-full bg-white/70" />
          </span>
        ))}
      </div>
    </div>
  )
}
