import { useContext, useEffect, useMemo, useState } from 'react'
import { CartContext } from './contexts'
import { useData } from './store'
import { findVariant } from './product'

const KEY = 'ys-cart'

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const { products } = useData()
  const [items, setItems] = useState(load)
  const [open, setOpen] = useState(false)

  const [adjusted, setAdjusted] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {}
  }, [items])

  // When fresh stock arrives, shrink cart lines that exceed it (and drop sold-out / removed ones).
  useEffect(() => {
    if (!products.length) return
    let changed = false
    const next = items.flatMap((i) => {
      const max = findVariant(products.find((p) => p.id === i.id), i.size, i.color)?.stock ?? 0
      if (i.qty <= max) return [i]
      changed = true
      return max > 0 ? [{ ...i, qty: max }] : []
    })
    if (changed) {
      setItems(next)
      setAdjusted(true)
    }
  }, [products]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => {
    // A cart item is { id: productId, size, color, qty } (color '' = no colours);
    // price and stock come from that colour + size (the variant).
    const variantOf = (id, size, color) => findVariant(products.find((p) => p.id === id), size, color)
    const same = (i, id, size, color) => i.id === id && i.size === size && (i.color ?? '') === (color ?? '')
    const lines = items
      .map((i) => {
        const product = products.find((p) => p.id === i.id)
        const variant = findVariant(product, i.size, i.color)
        return { ...i, product, variant, unitPrice: variant?.price ?? 0, available: variant?.stock ?? 0 }
      })
      .filter((l) => l.product && l.variant)
    return {
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      total: lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
      adjusted,
      clearAdjusted: () => setAdjusted(false),
      open,
      setOpen,
      // returns false when the size is sold out or the cart already holds all available pieces
      add: (id, size, color = '') => {
        const stock = variantOf(id, size, color)?.stock ?? 0
        const inCart = items.find((i) => same(i, id, size, color))?.qty ?? 0
        if (inCart >= stock) return false
        setItems((prev) => {
          const hit = prev.find((i) => same(i, id, size, color))
          if (hit) return prev.map((i) => (i === hit ? { ...i, qty: i.qty + 1 } : i))
          return [...prev, { id, size, color, qty: 1 }]
        })
        return true
      },
      // adds up to `qty` pieces, never more than what's left in stock; returns how many were added
      addMany: (id, size, qty, color = '') => {
        const stock = variantOf(id, size, color)?.stock ?? 0
        const inCart = items.find((i) => same(i, id, size, color))?.qty ?? 0
        const n = Math.max(0, Math.min(qty, stock - inCart))
        if (!n) return 0
        setItems((prev) => {
          const hit = prev.find((i) => same(i, id, size, color))
          if (hit) return prev.map((i) => (i === hit ? { ...i, qty: i.qty + n } : i))
          return [...prev, { id, size, color, qty: n }]
        })
        return n
      },
      inCartQty: (id, size, color = '') => items.find((i) => same(i, id, size, color))?.qty ?? 0,
      setQty: (id, size, qty, color = '') => {
        const stock = variantOf(id, size, color)?.stock ?? 0
        const next = Math.min(qty, stock)
        setItems((prev) =>
          next <= 0
            ? prev.filter((i) => !same(i, id, size, color))
            : prev.map((i) => (same(i, id, size, color) ? { ...i, qty: next } : i)),
        )
      },
      clear: () => setItems([]),
    }
  }, [items, open, products, adjusted])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
