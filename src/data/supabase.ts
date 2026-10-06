import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False when the two `VITE_` variables are missing; the app then shows a setup message. */
export const isConfigured = Boolean(url && anonKey)

// The anon key is public by design: Row Level Security protects the data. The service-role key
// must never be used in this app.
export const supabase = createClient<Database>(url ?? 'http://localhost:54321', anonKey ?? 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
