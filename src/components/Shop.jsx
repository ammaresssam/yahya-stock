import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useData } from '../lib/store'
import { useCatalog } from '../lib/catalogState'
import { PRICE_RANGES, activeFilterCount, allSizes, applyCatalog, isOnSale } from '../lib/catalog'
import ProductCard from './ProductCard'
import { CloseIcon, FilterIcon, SearchIcon } from './Icons'

const SORT_KEYS = [
  ['featured', 'sortFeatured'],
  ['newest', 'sortNewest'],
  ['price-asc', 'sortLow'],
  ['price-desc', 'sortHigh'],
  ['discount', 'sortDiscount'],
]

export default function Shop() {
  const { t, num } = useLang()
  const { products, loading, error, reload } = useData()
  const { filters, update, reset } = useCatalog()
  const [sheet, setSheet] = useState(false)

  const { categories } = useData()
  const { pick } = useLang()
  const list = useMemo(() => applyCatalog(products, filters), [products, filters])
  const active = activeFilterCount(filters)
  // the page title follows what is being browsed, like a collection page
  const cat = categories.find((c) => c.id === filters.category)
  const title = filters.onSale ? t('navOffers') : cat ? pick(cat.name) : t('shopTitle')

  return (
    <section id="shop" className="bg-page pb-14" aria-labelledby="shop-title">
      <div className="border-b border-line py-8 sm:py-10">
        <div className="page-width">
          <h1 id="shop-title" className="section-title text-center sm:text-[2.4rem]">{title}</h1>
        </div>
      </div>
      <div className="page-width pt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">{loading ? ' ' : t('results')(num(list.length))}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSheet(true)} className="btn btn-outline h-10 px-4 text-sm lg:hidden">
              <FilterIcon className="size-4" />
              {t('filters')}
              {active > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] leading-5 text-white">{num(active)}</span>}
            </button>
            <label className="flex items-center gap-2 text-sm font-semibold text-muted">
              <span className="hidden sm:inline">{t('sortLabel')}</span>
              <select aria-label={t('sortLabel')} value={filters.sort} onChange={(e) => update({ sort: e.target.value })} className="h-10 rounded-md border border-ink/25 bg-white px-3 font-semibold text-ink focus:border-ink">
                {SORT_KEYS.map(([k, label]) => <option key={k} value={k}>{t(label)}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
          <aside className="hidden lg:block" aria-label={t('filterTitle')}>
            <div className="sticky top-28"><FilterPanel /></div>
          </aside>

          <div>
            <ActiveChips />

            {loading ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3" aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[4/6.4] animate-pulse rounded-lg bg-paper" />)}
              </div>
            ) : error ? (
              <div className="rounded-lg bg-paper p-10 text-center">
                <p className="text-muted">{t('loadError')}</p>
                <button type="button" onClick={reload} className="btn btn-ink mt-4 h-11 px-6">{t('retry')}</button>
              </div>
            ) : list.length ? (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3">
                {list.map((p) => <li key={p.id} className="flex"><ProductCard product={p} className="w-full" /></li>)}
              </ul>
            ) : (
              <div className="rounded-lg bg-paper px-6 py-12 text-center">
                <SearchIcon className="mx-auto size-10 text-muted" />
                <p className="mt-3 text-lg font-bold text-ink">{t('noResults')}</p>
                <p className="mt-1 text-muted">{t('noResultsHint')}</p>
                {active > 0 && <button type="button" onClick={reset} className="btn btn-ink mt-5 h-11 px-6">{t('clearAll')}</button>}
              </div>
            )}
          </div>
        </div>
      </div>

      {sheet && <FilterSheet count={list.length} onClose={() => setSheet(false)} />}
    </section>
  )
}

function FilterPanel() {
  const { t, pick, price, num } = useLang()
  const { categories, products } = useData()
  const { filters, update, reset } = useCatalog()
  const sizes = useMemo(() => allSizes(products), [products])
  const hasSale = products.some(isOnSale)
  const active = activeFilterCount(filters)

  const rangeLabel = (r) =>
    r.key === 'all' ? t('priceAll') : r.min === 0 ? t('priceUnder')(price(r.max + 1)) : r.max === Infinity ? t('priceOver')(price(r.min)) : t('priceBetween')(num(r.min), price(r.max + 1))

  const toggleSize = (s) => update({ sizes: filters.sizes.includes(s) ? filters.sizes.filter((x) => x !== s) : [...filters.sizes, s] })

  return (
    <div className="grid gap-6">
      <Group title={t('filterCategory')}>
        <div className="flex flex-wrap gap-1.5">
          {[{ id: 'all', name: { ar: t('navAll'), en: t('navAll') } }, ...categories].map((c) => (
            <button key={c.id} type="button" aria-pressed={filters.category === c.id} onClick={() => update({ category: c.id })} className="pill">
              {pick(c.name)}
            </button>
          ))}
        </div>
      </Group>

      {sizes.length > 0 && (
        <Group title={t('filterSize')}>
          <div className="flex flex-wrap gap-1.5" dir="ltr">
            {sizes.map((s) => (
              <button key={s} type="button" aria-pressed={filters.sizes.includes(s)} onClick={() => toggleSize(s)} className="size-chip">{s}</button>
            ))}
          </div>
        </Group>
      )}

      <Group title={t('filterPrice')}>
        <div className="grid gap-1">
          {PRICE_RANGES.map((r) => (
            <label key={r.key} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-paper">
              <input type="radio" name="price-range" className="size-4 accent-[#e3262d]" checked={filters.price === r.key} onChange={() => update({ price: r.key })} />
              <span className="font-semibold text-ink">{rangeLabel(r)}</span>
            </label>
          ))}
        </div>
      </Group>

      <Group title={t('filters')}>
        <Toggle label={t('filterInStock')} checked={filters.inStock} onChange={(v) => update({ inStock: v })} />
        {hasSale && <Toggle label={t('filterOnSale')} checked={filters.onSale} onChange={(v) => update({ onSale: v })} />}
      </Group>

      {active > 0 && <button type="button" onClick={reset} className="justify-self-start text-sm font-semibold text-ink underline underline-offset-4">{t('clearAll')}</button>}
    </div>
  )
}

function ActiveChips() {
  const { t, pick, num } = useLang()
  const { categories } = useData()
  const { filters, update, reset } = useCatalog()
  const chips = [
    filters.q.trim() && { key: 'q', label: `“${filters.q.trim()}”`, clear: () => update({ q: '' }) },
    filters.category !== 'all' && { key: 'cat', label: pick(categories.find((c) => c.id === filters.category)?.name ?? { ar: filters.category, en: filters.category }), clear: () => update({ category: 'all' }) },
    ...filters.sizes.map((s) => ({ key: `s-${s}`, label: `${t('size')} ${s}`, clear: () => update({ sizes: filters.sizes.filter((x) => x !== s) }) })),
    filters.price !== 'all' && { key: 'price', label: t('filterPrice'), clear: () => update({ price: 'all' }) },
    filters.inStock && { key: 'stock', label: t('filterInStock'), clear: () => update({ inStock: false }) },
    filters.onSale && { key: 'sale', label: t('filterOnSale'), clear: () => update({ onSale: false }) },
  ].filter(Boolean)
  if (!chips.length) return null
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button key={c.key} type="button" onClick={c.clear} className="inline-flex h-8 items-center gap-1 rounded-full border border-ink/25 bg-white px-3 text-sm font-semibold text-ink hover:border-ink" aria-label={`${t('remove')} ${c.label}`}>
          {c.label}
          <CloseIcon className="size-3.5" />
        </button>
      ))}
      {chips.length > 1 && <button type="button" onClick={reset} className="px-2 text-sm font-bold text-muted underline underline-offset-4 hover:text-ink">{t('clearAll')} ({num(chips.length)})</button>}
    </div>
  )
}

function FilterSheet({ count, onClose }) {
  const { t, num } = useLang()
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:hidden" role="dialog" aria-modal="true" aria-label={t('filterTitle')}>
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <div className="relative flex max-h-[88dvh] w-full flex-col rounded-t-xl bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-xl font-bold text-ink">{t('filterTitle')}</h3>
          <button type="button" onClick={onClose} aria-label={t('closeMenu')} className="grid size-10 place-items-center rounded-full hover:bg-paper"><CloseIcon className="size-6" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5"><FilterPanel /></div>
        <div className="border-t border-line p-4">
          <button type="button" onClick={onClose} className="btn btn-ink h-12 w-full text-lg">{t('showResults')(num(count))}</button>
        </div>
      </div>
    </div>
  )
}

function Group({ title, children }) {
  return (
    <fieldset>
      <legend className="mb-3 w-full border-b border-line pb-2 text-base font-bold text-ink">{title}</legend>
      {children}
    </fieldset>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-paper">
      <span className="font-semibold text-ink">{label}</span>
      <input type="checkbox" role="switch" className="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
