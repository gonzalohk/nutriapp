import { inject } from 'vitest'

// The app's Supabase client reads these at import time, so set them before any test file imports it.
// The token is a JWT for the integration user; PostgREST treats it exactly like a Supabase session.
;(import.meta.env as Record<string, string>).VITE_SUPABASE_URL = inject('stackUrl')
;(import.meta.env as Record<string, string>).VITE_SUPABASE_ANON_KEY = inject('stackToken')
