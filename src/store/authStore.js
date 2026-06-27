// ============================================================================
//  authStore.js  —  global authentication state (Zustand store)
// ----------------------------------------------------------------------------
//  Zustand is a tiny state-management library. This store holds the logged-in
//  user, their profile (which contains the ROLE), and a loading flag — all
//  accessible from any component via useAuthStore(). It also exposes the
//  sign-in / sign-out / fetch-profile actions that talk to Supabase Auth.
// ============================================================================

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// create() returns a hook (useAuthStore) holding state + actions.
export const useAuthStore = create((set) => ({
  // ---- State ----
  user: null,      // the Supabase Auth user (null when logged out)
  profile: null,   // the matching row from the `profiles` table (has the role)
  loading: true,   // true until the initial session check finishes

  // ---- Simple setters used by App.jsx during the auth bootstrap ----
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  // ---- Log in with email + password via Supabase Auth ----
  signIn: async (email, password) => {
    // Guard: if the env keys aren't set we can't reach Supabase at all.
    if (!isSupabaseConfigured) {
      throw new Error('Live Supabase login is disabled. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
    }
    // Supabase verifies the credentials and, on success, returns a JWT session.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error   // bubble the error up so LoginPage can show it
    return data
  },

  // ---- Log out: clear the Supabase session and wipe local state ----
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  // ---- Load the user's profile row (to know their role) after login ----
  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)   // profiles.id == auth.users.id (1-to-1)
      .single()           // expect exactly one row
    set({ profile: data })
  },
}))
