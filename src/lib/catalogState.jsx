import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DEFAULT_FILTERS } from './catalog'

const CatalogContext = createContext(null)

// Search + filters shared by the header, category tiles, offers and the catalogue.
export function CatalogProvider({ children }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  // Go to the shop page (from any page); if already there, back to its top.
  const showCatalog = useCallback(() => {
    const h = window.location.hash
    if (h === '#/shop' || h === '#shop') window.scrollTo({ top: 0, behavior: 'smooth' })
    else window.location.hash = '#/shop'
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
