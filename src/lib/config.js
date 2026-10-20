export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// When both values are set the site reads products from the database,
// otherwise it falls back to the sample data in src/data/products.js
export const dbConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)
