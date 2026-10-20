import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DataContext } from './contexts'
import { categories as localCategories, products as localProducts } from '../data/products'
import { site } from '../data/site'
import { SUPABASE_KEY, SUPABASE_URL, dbConfigured } from './config'
import { fromDemo, fromRow } from './product'

// Database rows → the shape the components already use
export const rowToCategory = (r) => ({
  id: r.id,
  name: { ar: r.name_ar, en: r.name_en || r.name_ar },
  art: { type: r.art_type, color: r.art_color, bg: r.art_bg },
})

const demoProducts = localProducts.map(fromDemo)

// Each product comes with its sizes (price + stock) and photos embedded.
// Row Level Security already hides inactive sizes and hidden products from visitors.
const PRODUCTS_QUERY =
  'products?select=*,product_variants(id,size,price,compare_at_price,stock_qty,position,active),product_images(url,position)' +
  '&active=eq.true&order=created_at.desc'

// The public site only needs read access, so it talks to the REST API directly
// instead of loading the whole Supabase library.
async function rest(path) {
  const headers = { apikey: SUPABASE_KEY }
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function DataProvider({ children }) {
  const [state, setState] = useState({
    loading: dbConfigured,
    error: false,
    products: dbConfigured ? [] : demoProducts,
    categories: dbConfigured ? [] : localCategories,
  })

  const load = useCallback(async () => {
    if (!dbConfigured) return
    setState((s) => ({ ...s, loading: true, error: false }))
    try {
      const [cats, prods] = await Promise.all([
        rest('categories?select=*&order=created_at.asc'),
        rest(PRODUCTS_QUERY),
      ])
      setState({ loading: false, error: false, categories: cats.map(rowToCategory), products: prods.map(fromRow).filter((p) => p.variants.length) })
    } catch {
      setState({ loading: false, error: true, categories: [], products: [] })
    }
  }, [])

  useEffect(() => { load() }, [load])

  const value = useMemo(
    () => ({
      ...state,
      reload: load,
      source: dbConfigured ? 'db' : 'local',
      // real data from the database means the demo labels go away
      live: site.isLive || dbConfigured,
    }),
    [state, load],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
