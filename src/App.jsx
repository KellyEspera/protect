import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import Residents from './pages/Residents'
import QRVerification from './pages/QRVerification'
import PopulationAnalytics from './pages/PopulationAnalytics'
import PovertyIncidence from './pages/PovertyIncidence'
import SectorStatistics from './pages/SectorStatistics'
import GISMap from './pages/GISMap'
import DisasterVulnerability from './pages/DisasterVulnerability'
import BeneficiaryTracking from './pages/BeneficiaryTracking'
import CrimeIncident from './pages/CrimeIncident'
import PredictiveGrowth from './pages/PredictiveGrowth'
import NeedsAssessment from './pages/NeedsAssessment'
import DILGReports from './pages/DILGReports'

function PrivateRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 bg-teal rounded-xl flex items-center justify-center mx-auto mb-3 text-2xl">🛡️</div>
        <p className="text-gray-500 text-sm">Loading PROTECT...</p>
      </div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { setUser, setLoading, fetchProfile } = useAuthStore()

  useEffect(() => {
    // Demo mode — no Supabase configured, skip auth and go straight in
    if (!isSupabaseConfigured) {
      setUser({ id: 'demo', email: 'demo@protect.local' })
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="residents" element={<Residents />} />
        <Route path="qr" element={<QRVerification />} />
        <Route path="population" element={<PopulationAnalytics />} />
        <Route path="poverty" element={<PovertyIncidence />} />
        <Route path="sectors" element={<SectorStatistics />} />
        <Route path="gis" element={<GISMap />} />
        <Route path="disaster" element={<DisasterVulnerability />} />
        <Route path="beneficiary" element={<BeneficiaryTracking />} />
        <Route path="crime" element={<CrimeIncident />} />
        <Route path="predictive" element={<PredictiveGrowth />} />
        <Route path="needs" element={<NeedsAssessment />} />
        <Route path="reports" element={<DILGReports />} />
      </Route>
    </Routes>
  )
}
