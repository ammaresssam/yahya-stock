import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { useCatalog } from '../lib/catalogState'
import GarmentArt from './GarmentArt'
import { ArrowIcon } from './Icons'

// soft neutral colours for the category drawings, so the page stays calm
const SOFT = ['#4a4642', '#b9aa9a', '#d8c7a8']

// Collection list: one tile per category (Men, Women, Kids...) plus a last "Shop all" tile.
// Picture on top and the name underneath.
export default function Categories() {
  const { t, pick, num } = useLang()
  const { categories, products, loading } = useData()
  const { browse } = useCatalog()
  if (!loading && !categories.length) return null

  return (
    <section className="py-12 sm:py-16" aria-labelledby="cat-title">
      <div className="page-width">
        <h2 id="cat-title" className="section-title mb-8 text-center sm:mb-12">{t('categoriesNav')}</h2>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-6 lg:grid-cols-4">
          {(loading ? [1, 2, 3, 4] : categories).map((c, i) => {
            if (loading) return <li key={i} className="aspect-square animate-pulse bg-paper" />
            const inCat = products.filter((p) => p.category === c.id)
            const photo = inCat.find((p) => p.image)?.image
            return (
              <li key={c.id}>
                <button type="button" onClick={() => browse({ category: c.id })} className="cat-tile group block w-full text-start">
                  <span className="block overflow-hidden">
                    {photo ? (
                      <img src={photo} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <GarmentArt {...c.art} color={SOFT[i % SOFT.length]} bg="#efece8" className="aspect-square p-6 sm:p-10" />
                    )}
                  </span>
                  <span className="display mt-4 flex items-center justify-center gap-2 text-lg text-ink-900 sm:text-2xl">
                    <span className="underline-offset-4 group-hover:underline">{pick(c.name)}</span>
                    <ArrowIcon className="size-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
                  </span>
                  <span className="block text-center text-sm text-muted">{t('productsCount')(num(inCat.length))}</span>
                </button>
              </li>
            )
          })}
          {!loading && <ShopAllTile products={products} />}
        </ul>
      </div>
    </section>
  )
}

// "Shop all": a small 2×2 collage from different products, opens the shop with no filter.
function ShopAllTile({ products }) {
  const { t, num } = useLang()
  const { browse } = useCatalog()
  // one item from each section first, so the collage shows men, women and kids together
  const firsts = products.filter((p, i) => products.findIndex((q) => q.category === p.category) === i)
  const picks = [...firsts, ...products.filter((p) => !firsts.includes(p))].slice(0, 4)
  return (
    <li>
      <button type="button" onClick={() => browse({})} className="cat-tile group block w-full text-start">
        <span className="grid aspect-square grid-cols-2 gap-1 overflow-hidden bg-paper p-1">
          {picks.map((p, i) =>
            p.image ? (
              <img key={p.id} src={p.image} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            ) : (
              <GarmentArt key={p.id} {...p.art} color={SOFT[i % SOFT.length]} bg="#efece8" className="size-full p-4" />
            ),
          )}
        </span>
        <span className="display mt-4 flex items-center justify-center gap-2 text-lg text-ink-900 sm:text-2xl">
          <span className="underline-offset-4 group-hover:underline">{t('navShopAll')}</span>
          <ArrowIcon className="size-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
        </span>
        <span className="block text-center text-sm text-muted">{t('productsCount')(num(products.length))}</span>
      </button>
    </li>
  )
}
