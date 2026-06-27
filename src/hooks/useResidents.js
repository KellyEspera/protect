import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Shared by the three analytics pages (Population, Poverty, Sector).
// They all read the full residents list, so they share one cached query.
export function useResidents() {
  return useQuery({
    queryKey: ['residents-analytics'],
    queryFn: async () => {
      const { data } = await supabase.from('residents').select('*')
      return data || []
    },
  })
}
