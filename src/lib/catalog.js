// Pure search / filter / sort logic for the catalogue (unit-tested in tests/catalog.test.js).
// Works on the product shape from src/lib/product.js.

export const DEFAULT_FILTERS = {
  q: '',
  category: 'all',
  sizes: [], // any of these sizes
  price: 'all', // a key from PRICE_RANGES
  inStock: false,
  onSale: false,
  sort: 'featured',
}

export const PRICE_RANGES = [
  { key: 'all', min: 0, max: Infinity },
  { key: 'u200', min: 0, max: 199 },
  { key: '200-399', min: 200, max: 399 },
  { key: '400-599', min: 400, max: 599 },
  { key: '600+', min: 600, max: Infinity },
]

export const SORTS = ['featured', 'newest', 'price-asc', 'price-desc', 'discount']

// Arabic letters that are commonly typed interchangeably, plus diacritics and tatweel.
const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()

/** Discount in whole percent for one size, or 0. Only real "before" prices count. */
export const discountOf = (v) => (v.compareAt && v.compareAt > v.price ? Math.round((1 - v.price / v.compareAt) * 100) : 0)

/** Biggest real discount on a product (across sizes that are in stock, or all if none are). */
export function maxDiscount(p) {
  const pool = p.variants.some((v) => v.stock > 0) ? p.variants.filter((v) => v.stock > 0) : p.variants
  return pool.reduce((m, v) => Math.max(m, discountOf(v)), 0)
}

export const isOnSale = (p) => p.variants.some((v) => v.stock > 0 && discountOf(v) > 0)

/** Every size that appears in the catalogue, in a sensible order (S < M < L…, then numbers). */
export function allSizes(products) {
  const ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'FREE SIZE']
  const set = new Map()
  for (const p of products) for (const v of p.variants) set.set(v.size.toUpperCase(), v.size)
  return [...set.values()].sort((a, b) => {
    const ia = ORDER.indexOf(a.toUpperCase())
    const ib = ORDER.indexOf(b.toUpperCase())
    const na = parseFloat(a)
    const nb = parseFloat(b)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
    if (!Number.isNaN(na)) return -1
    if (!Number.isNaN(nb)) return 1
    return a.localeCompare(b)
  })
}

export function matches(p, f) {
  if (f.category !== 'all' && p.category !== f.category) return false

  if (f.q) {
    const words = normalize(f.q).split(' ').filter(Boolean)
    const hay = normalize(`${p.name.ar} ${p.name.en}`)
    if (!words.every((w) => hay.includes(w))) return false
  }

  // sizes the customer could actually buy under the current filters
  const sizeOk = (v) => !f.sizes.length || f.sizes.some((s) => s.toLowerCase() === v.size.toLowerCase())
  const range = PRICE_RANGES.find((r) => r.key === f.price) ?? PRICE_RANGES[0]
  const priceOk = (v) => v.price >= range.min && v.price <= range.max
  const candidates = p.variants.filter((v) => sizeOk(v) && priceOk(v) && (!f.inStock || v.stock > 0) && (!f.onSale || (v.stock > 0 && discountOf(v) > 0)))
  return candidates.length > 0
}

const stockRank = (p) => (p.totalStock === 0 ? 1 : 0)

export function sortProducts(list, sort) {
  const out = [...list]
  const by = {
    featured: (a, b) => stockRank(a) - stockRank(b) || (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a._index - b._index,
    newest: (a, b) => stockRank(a) - stockRank(b) || a._index - b._index,
    'price-asc': (a, b) => stockRank(a) - stockRank(b) || a.price - b.price,
    'price-desc': (a, b) => stockRank(a) - stockRank(b) || b.price - a.price,
    discount: (a, b) => stockRank(a) - stockRank(b) || maxDiscount(b) - maxDiscount(a) || a.price - b.price,
  }[sort] ?? (() => 0)
  return out.sort(by)
}

/** products are expected newest-first (the order the store provides them in). */
export function applyCatalog(products, f) {
  const indexed = products.map((p, i) => ({ ...p, _index: i }))
  return sortProducts(indexed.filter((p) => matches(p, f)), f.sort)
}

export const activeFilterCount = (f) =>
  (f.category !== 'all') + f.sizes.length + (f.price !== 'all') + f.inStock + f.onSale + (f.q.trim() ? 1 : 0)
