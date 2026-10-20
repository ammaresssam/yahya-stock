import { useMemo, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import ProductCard from './ProductCard'
import SectionHeading from './SectionHeading'

const stockRank = { in: 0, low: 1, out: 2 }

export default function Shop({ category, setCategory }) {
  const { t, pick, num } = useLang()
  const { categories, products, loading, error, reload } = useData()
  const [sort, setSort] = useState('featured')

  const list = useMemo(() => {
    const filtered = products.filter((p) => category === 'all' || p.category === category)
    const sorted = [...filtered]
    if (sort === 'low') sorted.sort((a, b) => a.price - b.price)
    else if (sort === 'high') sorted.sort((a, b) => b.price - a.price)
    else sorted.sort((a, b) => stockRank[a.stock] - stockRank[b.stock] || (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    return sorted
  }, [products, category, sort])

  const tabs = [{ id: 'all', label: t('filterAll'), count: products.length }].concat(
    categories.map((c) => ({ id: c.id, label: pick(c.name), count: products.filter((p) => p.category === c.id).length })),
  )

  return (
    <section id="shop" className="scroll-mt-28 py-16 sm:py-20" aria-labelledby="shop-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="shop-title" kicker={t('shopKicker')} title={t('shopTitle')} />

        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label={t('catTitle')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={category === tab.id}
                onClick={() => setCategory(tab.id)}
                className="filter-tab"
              >
                {tab.label}
                <span className="filter-count">{num(tab.count)}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-muted">
            {t('sortLabel')}
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-full border border-line bg-white px-4 font-bold text-ink focus:border-ink">
              <option value="featured">{t('sortFeatured')}</option>
              <option value="low">{t('sortLow')}</option>
              <option value="high">{t('sortHigh')}</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="aspect-[4/6.2] animate-pulse rounded-[24px] bg-paper" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-paper p-10 text-center">
            <p className="text-muted">{t('loadError')}</p>
            <button type="button" onClick={reload} className="btn btn-ink mt-4 h-11 px-6">{t('retry')}</button>
          </div>
        ) : list.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {list.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <p className="rounded-3xl bg-paper p-10 text-center text-muted">{t('noProducts')}</p>
        )}
      </div>
    </section>
  )
}
