import { useContext, useEffect, useMemo, useState } from 'react'
import { CartContext } from './contexts'
import { useData } from './store'

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
      const max = products.find((p) => p.id === i.id)?.variants.find((v) => v.size === i.size)?.stock ?? 0
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
    // A cart item is { id: productId, size, qty }; price and stock come from the size (variant).
    const variantOf = (id, size) => products.find((p) => p.id === id)?.variants.find((v) => v.size === size)
    const lines = items
      .map((i) => {
        const product = products.find((p) => p.id === i.id)
        const variant = product?.variants.find((v) => v.size === i.size)
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
      add: (id, size) => {
        const stock = variantOf(id, size)?.stock ?? 0
        const inCart = items.find((i) => i.id === id && i.size === size)?.qty ?? 0
        if (inCart >= stock) return false
        setItems((prev) => {
          const hit = prev.find((i) => i.id === id && i.size === size)
          if (hit) return prev.map((i) => (i === hit ? { ...i, qty: i.qty + 1 } : i))
          return [...prev, { id, size, qty: 1 }]
        })
        return true
      },
      // adds up to `qty` pieces, never more than what's left in stock; returns how many were added
      addMany: (id, size, qty) => {
        const stock = variantOf(id, size)?.stock ?? 0
        const inCart = items.find((i) => i.id === id && i.size === size)?.qty ?? 0
        const n = Math.max(0, Math.min(qty, stock - inCart))
        if (!n) return 0
        setItems((prev) => {
          const hit = prev.find((i) => i.id === id && i.size === size)
          if (hit) return prev.map((i) => (i === hit ? { ...i, qty: i.qty + n } : i))
          return [...prev, { id, size, qty: n }]
        })
        return n
      },
      inCartQty: (id, size) => items.find((i) => i.id === id && i.size === size)?.qty ?? 0,
      setQty: (id, size, qty) => {
        const stock = variantOf(id, size)?.stock ?? 0
        const next = Math.min(qty, stock)
        setItems((prev) =>
          next <= 0
            ? prev.filter((i) => !(i.id === id && i.size === size))
            : prev.map((i) => (i.id === id && i.size === size ? { ...i, qty: next } : i)),
        )
      },
      clear: () => setItems([]),
    }
  }, [items, open, products, adjusted])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
