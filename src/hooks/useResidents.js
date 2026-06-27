// ============================================================================
//  useResidents.js  —  shared "fetch all residents" data hook
// ----------------------------------------------------------------------------
//  A custom React hook wrapping React Query's useQuery. The three analytics
//  pages (Population, Poverty, Sector) all need the full residents list, so
//  they share THIS one hook. React Query caches the result under the queryKey
//  'residents-analytics', meaning the data is fetched once and reused — the
//  second and third page load instantly from cache instead of re-querying.
// ============================================================================

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useResidents() {
  return useQuery({
    // queryKey = the cache identity. Same key = same cached data shared across pages.
    queryKey: ['residents-analytics'],
    // queryFn = how to actually fetch the data when the cache is empty/stale.
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('*')
      return data || []   // never return null, so consumers can safely call .filter()
    },
  })
}
