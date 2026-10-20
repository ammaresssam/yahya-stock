import { createContext } from 'react'

// Kept in their own module so hot-reloading i18n.jsx / cart.jsx / store.jsx doesn't recreate them
export const LangContext = createContext(null)
export const CartContext = createContext(null)
export const DataContext = createContext(null)
