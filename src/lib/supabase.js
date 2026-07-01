import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_KEY env vars')
}

export const supabase = createClient(url || '', key || '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
