import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DEFAULT_FILTERS } from './catalog'

const CatalogContext = createContext(null)

// Search + filters shared by the header, category tiles, offers and the catalogue.
export function CatalogProvider({ children }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  // Go to the catalogue (from any page) and scroll it into view.
  const showCatalog = useCallback(() => {
    if (window.location.hash !== '#shop') window.location.hash = '#shop'
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
  }, [])

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      update: (patch) => setFilters((f) => ({ ...f, ...patch })),
      reset: () => setFilters(DEFAULT_FILTERS),
      // used by header search, category tiles and "see offers" buttons
      browse: (patch) => {
        setFilters({ ...DEFAULT_FILTERS, ...patch })
        showCatalog()
      },
      showCatalog,
    }),
    [filters, showCatalog],
  )
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export const useCatalog = () => useContext(CatalogContext)
