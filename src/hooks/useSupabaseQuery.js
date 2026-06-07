// src/hooks/useSupabaseQuery.js
// Reusable hooks for all PROTECT data fetching

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  mockResidents, mockIncidents, mockBeneficiaries,
  mockHouseholds, populationByYear, surveyNeeds
} from '../lib/mockData'

// ── Residents ─────────────────────────────────────────────────
export function useResidents() {
  return useQuery({
    queryKey: ['residents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residents_with_age')
        .select('*')
        .order('last_name')
      if (error || !data?.length) return mockResidents
      return data
    },
  })
}

export function useAddResident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('residents').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['residents']),
  })
}

export function useUpdateResident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const { error } = await supabase.from('residents').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['residents']),
  })
}

export function useDeleteResident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('residents').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['residents']),
  })
}

// ── Households ────────────────────────────────────────────────
export function useHouseholds() {
  return useQuery({
    queryKey: ['households'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('households')
        .select('*')
        .order('household_no')
      if (error || !data?.length) return mockHouseholds
      return data
    },
  })
}

// ── Incidents ─────────────────────────────────────────────────
export function useIncidents() {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('incident_date', { ascending: false })
      if (error || !data?.length) return mockIncidents
      return data
    },
  })
}

export function useAddIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('incidents').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['incidents']),
  })
}

export function useUpdateIncidentStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('incidents').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['incidents']),
  })
}

// ── Beneficiaries ─────────────────────────────────────────────
export function useBeneficiaries() {
  return useQuery({
    queryKey: ['beneficiaries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beneficiaries')
        .select(`
          *,
          residents ( resident_no, first_name, last_name, purok ),
          assistance_programs ( name )
        `)
        .order('enrolled_at', { ascending: false })
      if (error || !data?.length) return mockBeneficiaries
      return data
    },
  })
}

export function useEnrollBeneficiary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('beneficiaries').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['beneficiaries']),
  })
}

// ── Assistance Programs ────────────────────────────────────────
export function usePrograms() {
  return useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assistance_programs')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) return []
      return data
    },
  })
}

// ── QR Verifications ──────────────────────────────────────────
export function useQRVerifications() {
  return useQuery({
    queryKey: ['qr-verifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qr_verifications')
        .select(`*, residents ( resident_no, first_name, last_name, purok )`)
        .order('verified_at', { ascending: false })
        .limit(20)
      if (error) return []
      return data
    },
  })
}

export function useLogQRVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ resident_id, purpose }) => {
      const { error } = await supabase.from('qr_verifications').insert({ resident_id, purpose })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['qr-verifications']),
  })
}

// ── Survey Responses ──────────────────────────────────────────
export function useSurveyResponses() {
  return useQuery({
    queryKey: ['survey-responses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .order('submitted_at', { ascending: false })
      if (error) return []
      return data
    },
  })
}

export function useSubmitSurvey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('survey_responses').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['survey-responses']),
  })
}

// ── Analytics helpers ──────────────────────────────────────────
export function useResidentStats() {
  return useQuery({
    queryKey: ['resident-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residents')
        .select('purok, sex, is_pwd, is_solo_parent, is_senior_citizen, monthly_income')
      if (error || !data?.length) {
        // Compute from mock data
        return {
          total: mockResidents.length,
          byPurok: { 'Sitio Hunan': 287, 'Sitio Hagu': 265, 'Sitio Tuva': 241 },
          male: 636, female: 648,
          pwd: mockResidents.filter(r => r.is_pwd).length,
          soloParent: mockResidents.filter(r => r.is_solo_parent).length,
          seniorCitizen: mockResidents.filter(r => r.is_senior_citizen).length,
          avgIncome: 8240,
        }
      }
      const byPurok = data.reduce((acc, r) => {
        acc[r.purok] = (acc[r.purok] || 0) + 1
        return acc
      }, {})
      return {
        total: data.length,
        byPurok,
        male: data.filter(r => r.sex === 'Male').length,
        female: data.filter(r => r.sex === 'Female').length,
        pwd: data.filter(r => r.is_pwd).length,
        soloParent: data.filter(r => r.is_solo_parent).length,
        seniorCitizen: data.filter(r => r.is_senior_citizen).length,
        avgIncome: Math.round(data.reduce((s, r) => s + (r.monthly_income || 0), 0) / data.length),
      }
    },
  })
}
