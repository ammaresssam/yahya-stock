// One product shape for the whole storefront, whether it came from the database
// or from the demo file. Prices and stock shown here are for display only — the
// server re-checks everything at checkout.

export const LOW_STOCK = 3 // a size with this many or fewer shows "only N left"

// A variant's colour key ('' = the product has no colours). The Arabic name is the key,
// because that is what the database keeps unique (product, colour, size).
export const colorKey = (v) => v?.color?.ar ?? ''

// Find the variant for a size (and colour, when the product has colours).
export const findVariant = (p, size, color = '') => p?.variants.find((v) => v.size === size && colorKey(v) === (color ?? ''))

function finish(p) {
  const variants = p.variants
  const available = variants.filter((v) => v.stock > 0)
  const pool = available.length ? available : variants
  const cheapest = pool.reduce((a, b) => (b.price < a.price ? b : a), pool[0])
  const totalStock = variants.reduce((s, v) => s + v.stock, 0)
  // colours in the order they first appear, each with its swatch and whether any size is left
  const colors = []
  for (const v of variants) {
    if (!v.color) continue
    const hit = colors.find((c) => c.key === v.color.ar)
    if (hit) hit.stock += v.stock
    else colors.push({ key: v.color.ar, name: { ar: v.color.ar, en: v.color.en || v.color.ar }, hex: v.color.hex, stock: v.stock })
  }
  return {
    ...p,
    image: p.images[0],
    sizes: [...new Set(variants.map((v) => v.size))],
    colors,
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
    .map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color_ar ? { ar: v.color_ar, en: v.color_en || '', hex: v.color_hex || null } : null,
      price: v.price,
      compareAt: v.compare_at_price ?? undefined,
      stock: v.stock_qty,
    }))
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

// Demo file entry: the old shape (price + sizes + stock status), explicit variants,
// or colours: [{ ar, en, hex, soldOut: ['XL'] }] combined with price + sizes.
export function fromDemo(p) {
  const qty = { out: 0, low: 1 }[p.stock] ?? 5
  const variants =
    p.variants?.map((v, i) => ({ id: v.id ?? `${p.id}:${v.size}`, size: v.size, color: null, price: v.price, compareAt: v.compareAt, stock: v.stock ?? 0, position: i })) ??
    (p.colors
      ? p.colors.flatMap((c) =>
          p.sizes.map((size) => ({
            id: `${p.id}:${c.en}:${size}`,
            size,
            color: { ar: c.ar, en: c.en, hex: c.hex },
            price: p.price,
            compareAt: p.oldPrice,
            stock: c.soldOut?.includes(size) ? 0 : qty,
          })),
        )
      : p.sizes.map((size) => ({ id: `${p.id}:${size}`, size, color: null, price: p.price, compareAt: p.oldPrice, stock: qty })))
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
