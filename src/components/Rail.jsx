import { useRef } from 'react'
import { useLang } from '../lib/i18n'
import ProductCard from './ProductCard'
import { ChevronIcon } from './Icons'

// A horizontal row of product cards: swipe on phones, arrow buttons on larger screens.
export default function Rail({ id, kicker, title, text, products, onViewAll, tone = 'light' }) {
  const { t } = useLang()
  const track = useRef(null)
  if (!products.length) return null
  const dark = tone === 'dark'

  const scrollBy = (dir) => {
    const el = track.current
    if (!el) return
    const rtl = getComputedStyle(el).direction === 'rtl'
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <section id={id} className={`scroll-mt-32 py-10 sm:py-12 ${dark ? 'bg-ink text-white' : 'bg-paper'}`} aria-labelledby={`${id}-title`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-brand">{kicker}</p>
            <h2 id={`${id}-title`} className={`text-2xl font-black sm:text-3xl ${dark ? 'text-white' : 'text-ink'}`}>{title}</h2>
            {text && <p className={`mt-1 ${dark ? 'text-white/65' : 'text-muted'}`}>{text}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onViewAll && (
              <button type="button" onClick={onViewAll} className={`text-sm font-bold underline-offset-4 hover:underline ${dark ? 'text-white' : 'text-ink'}`}>
                {t('viewAll')}
              </button>
            )}
            <div className="hidden gap-1.5 md:flex">
              <button type="button" onClick={() => scrollBy(-1)} aria-label={t('scrollPrev')} className={`grid size-10 place-items-center rounded-full ring-1 ${dark ? 'ring-white/20 hover:bg-white/10' : 'bg-white ring-line hover:ring-ink'}`}>
                <ChevronIcon className="size-5 -scale-x-100 rtl:scale-x-100" />
              </button>
              <button type="button" onClick={() => scrollBy(1)} aria-label={t('scrollNext')} className={`grid size-10 place-items-center rounded-full ring-1 ${dark ? 'ring-white/20 hover:bg-white/10' : 'bg-white ring-line hover:ring-ink'}`}>
                <ChevronIcon className="size-5 rtl:-scale-x-100" />
              </button>
            </div>
          </div>
        </div>
        <ul ref={track} className="no-scrollbar relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          {products.map((p) => (
            <li key={p.id} className="flex w-[68%] shrink-0 snap-start sm:w-[40%] md:w-[30%] lg:w-[23.5%]">
              <ProductCard product={p} className="w-full" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
