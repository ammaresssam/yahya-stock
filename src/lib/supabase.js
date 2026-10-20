import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL, dbConfigured } from './config'

// Used only by the admin panel (loaded lazily, so customers never download it).
// In development, "#/admin?mock" swaps in an in-memory fake so the panel can be tried without a database.
let client = null
if (import.meta.env.DEV && location.hash.includes('mock')) {
  client = (await import('../dev/mockSupabase.js')).createMock()
} else if (dbConfigured) {
  client = createClient(SUPABASE_URL, SUPABASE_KEY)
}

export default client
