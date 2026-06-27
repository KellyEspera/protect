// ============================================================================
//  supabase.js  —  the single Supabase client used by the whole app
// ----------------------------------------------------------------------------
//  Supabase is our backend: hosted PostgreSQL database + Auth + file Storage.
//  This file creates ONE client instance that every page/store imports to read
//  and write data. The URL and anon key come from environment variables so the
//  secrets are never hard-coded (they live in .env locally / Vercel in prod).
// ============================================================================

import { createClient } from '@supabase/supabase-js'

// Read the project URL + public "anon" key injected by Vite at build time.
// `?? ''` falls back to an empty string if the variable is missing.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// True only when BOTH env vars are present. Used to decide real vs demo mode.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// If the keys are missing (e.g. someone forgot to set them on Vercel), warn in
// the console instead of crashing — the app loads but can't reach the database.
if (!isSupabaseConfigured) {
  console.warn(
    '[PROTECT] Supabase env vars not set. Running in demo/mock mode.\n' +
    'Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env or Vercel dashboard and redeploy.'
  )
}

// Create the client. When unconfigured we pass harmless placeholders so the
// import never throws; real calls just won't succeed until the keys are set.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key'
)
