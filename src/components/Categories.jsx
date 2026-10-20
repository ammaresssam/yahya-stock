import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { useCatalog } from '../lib/catalogState'
import GarmentArt from './GarmentArt'
import { ArrowIcon } from './Icons'

// Category tiles: a swipeable row on phones, a grid on larger screens.
export default function Categories() {
  const { t, pick, num } = useLang()
  const { categories, products, loading } = useData()
  const { browse } = useCatalog()
  if (!loading && !categories.length) return null

  return (
    <section className="bg-white pt-8 sm:pt-10" aria-labelledby="cat-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 id="cat-title" className="mb-4 text-2xl font-black text-ink sm:text-3xl">{t('categoriesNav')}</h2>
        <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0">
          {(loading ? [1, 2, 3] : categories).map((c, i) => {
            if (loading) return <li key={i} className="aspect-[4/3] w-[62%] shrink-0 animate-pulse rounded-[24px] bg-paper sm:w-auto" />
            const inCat = products.filter((p) => p.category === c.id)
            const photo = inCat.find((p) => p.image)?.image
            return (
              <li key={c.id} className="w-[62%] shrink-0 snap-start sm:w-auto">
                <button type="button" onClick={() => browse({ category: c.id })} className="cat-tile group relative block aspect-[4/3] w-full overflow-hidden rounded-[24px] text-start">
                  {photo ? (
                    <img src={photo} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <GarmentArt {...c.art} className="cat-art absolute inset-0 p-6 pb-14" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-ink/85 via-ink/40 to-transparent p-4 pt-12 text-white">
                    <span>
                      <span className="block text-2xl font-black leading-tight sm:text-3xl">{pick(c.name)}</span>
                      <span className="text-sm text-white/80">{t('itemsCount')(num(inCat.length))}</span>
                    </span>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink transition group-hover:bg-brand group-hover:text-white">
                      <ArrowIcon className="size-5 rtl:-scale-x-100" />
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
