import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { useCatalog } from '../lib/catalogState'
import GarmentArt from './GarmentArt'
import { ArrowIcon } from './Icons'

// soft neutral colours for the category drawings, so the page stays calm
const SOFT = ['#4a4642', '#b9aa9a', '#d8c7a8']

// Collection list: one tile per category, picture on top and the name underneath.
export default function Categories() {
  const { t, pick, num } = useLang()
  const { categories, products, loading } = useData()
  const { browse } = useCatalog()
  if (!loading && !categories.length) return null

  return (
    <section className="py-12 sm:py-16" aria-labelledby="cat-title">
      <div className="page-width">
        <h2 id="cat-title" className="section-title mb-8 text-center sm:mb-12">{t('categoriesNav')}</h2>
        <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0">
          {(loading ? [1, 2, 3] : categories).map((c, i) => {
            if (loading) return <li key={i} className="aspect-square w-[70%] shrink-0 animate-pulse bg-paper sm:w-auto" />
            const inCat = products.filter((p) => p.category === c.id)
            const photo = inCat.find((p) => p.image)?.image
            return (
              <li key={c.id} className="w-[70%] shrink-0 snap-start sm:w-auto">
                <button type="button" onClick={() => browse({ category: c.id })} className="cat-tile group block w-full text-start">
                  <span className="block overflow-hidden">
                    {photo ? (
                      <img src={photo} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <GarmentArt {...c.art} color={SOFT[i % SOFT.length]} bg="#efece8" className="aspect-square p-10" />
                    )}
                  </span>
                  <span className="display mt-4 flex items-center justify-center gap-2 text-xl text-ink-900 sm:text-2xl">
                    <span className="underline-offset-4 group-hover:underline">{pick(c.name)}</span>
                    <ArrowIcon className="size-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
                  </span>
                  <span className="block text-center text-sm text-muted">{t('productsCount')(num(inCat.length))}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
