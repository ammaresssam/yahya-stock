// One product shape for the whole storefront, whether it came from the database
// or from the demo file. Prices and stock shown here are for display only — the
// server re-checks everything at checkout.

export const LOW_STOCK = 3 // a size with this many or fewer shows "only N left"

function finish(p) {
  const variants = p.variants
  const available = variants.filter((v) => v.stock > 0)
  const pool = available.length ? available : variants
  const cheapest = pool.reduce((a, b) => (b.price < a.price ? b : a), pool[0])
  const totalStock = variants.reduce((s, v) => s + v.stock, 0)
  return {
    ...p,
    image: p.images[0],
    sizes: variants.map((v) => v.size),
    price: cheapest?.price ?? 0,
    oldPrice: cheapest?.compareAt,
    priceVaries: new Set(pool.map((v) => v.price)).size > 1,
    totalStock,
    stock: totalStock === 0 ? 'out' : available.every((v) => v.stock <= LOW_STOCK) ? 'low' : 'in',
  }
}

// Database row with embedded product_variants / product_images
export function fromRow(r) {
  const variants = (r.product_variants || [])
    .filter((v) => v.active !== false)
    .sort((a, b) => a.position - b.position)
    .map((v) => ({ id: v.id, size: v.size, price: v.price, compareAt: v.compare_at_price ?? undefined, stock: v.stock_qty }))
  const images = (r.product_images || []).sort((a, b) => a.position - b.position).map((i) => i.url)
  return finish({
    id: r.id,
    name: { ar: r.name_ar, en: r.name_en || r.name_ar },
    category: r.category,
    isNew: !!r.is_new,
    featured: !!r.featured,
    art: { type: r.art_type, color: r.art_color, bg: r.art_bg },
    variants,
    images,
  })
}

// Demo file entry: either the old shape (price + sizes + stock status) or explicit variants
export function fromDemo(p) {
  const qty = { out: 0, low: 1 }[p.stock] ?? 5
  const variants =
    p.variants?.map((v, i) => ({ id: v.id ?? `${p.id}:${v.size}`, size: v.size, price: v.price, compareAt: v.compareAt, stock: v.stock ?? 0, position: i })) ??
    p.sizes.map((size) => ({ id: `${p.id}:${size}`, size, price: p.price, compareAt: p.oldPrice, stock: qty }))
  return finish({
    id: p.id,
    name: p.name,
    category: p.category,
    isNew: !!p.isNew,
    featured: !!p.featured,
    art: p.art,
    variants,
    images: p.images ?? (p.image ? [p.image] : []),
  })
}
