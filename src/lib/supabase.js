import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn(
    '[PROTECT] Supabase env vars not set. Running in demo/mock mode.\n' +
    'Copy .env.example to .env and fill in your credentials to enable live data.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL
