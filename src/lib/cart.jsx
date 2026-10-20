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

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {}
  }, [items])

  const value = useMemo(() => {
    const lines = items
      .map((i) => ({ ...i, product: products.find((p) => p.id === i.id) }))
      .filter((l) => l.product)
    return {
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      total: lines.reduce((s, l) => s + l.qty * l.product.price, 0),
      open,
      setOpen,
      add: (id, size) =>
        setItems((prev) => {
          const hit = prev.find((i) => i.id === id && i.size === size)
          if (hit) return prev.map((i) => (i === hit ? { ...i, qty: i.qty + 1 } : i))
          return [...prev, { id, size, qty: 1 }]
        }),
      setQty: (id, size, qty) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((i) => !(i.id === id && i.size === size))
            : prev.map((i) => (i.id === id && i.size === size ? { ...i, qty } : i)),
        ),
      clear: () => setItems([]),
    }
  }, [items, open, products])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
