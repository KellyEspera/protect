// ============================================================================
//  App.jsx  —  the app's router and access-control gatekeeper
// ----------------------------------------------------------------------------
//  Defines every route and wraps them in two guards:
//    • PrivateRoute — must be logged in (else redirect to /login)
//    • RoleRoute    — must have permission for that page (else "Access Restricted")
//  It also runs the auth bootstrap on startup: checks for an existing session
//  and subscribes to login/logout events so the UI reacts instantly.
// ============================================================================

import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import { canAccess } from './lib/permissions'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import ResidentNeedsForm from './pages/ResidentNeedsForm'
import Dashboard from './pages/Dashboard'
import Residents from './pages/Residents'
import QRVerification from './pages/QRVerification'
import PopulationAnalytics from './pages/PopulationAnalytics'
import PovertyIncidence from './pages/PovertyIncidence'
import SectorStatistics from './pages/SectorStatistics'
import GISMap from './pages/GISMap'
import CrimeHotspotMap from './pages/CrimeHotspotMap'
import DisasterVulnerability from './pages/DisasterVulnerability'
import BeneficiaryTracking from './pages/BeneficiaryTracking'
import CrimeIncident from './pages/CrimeIncident'
import PredictiveGrowth from './pages/PredictiveGrowth'
import NeedsAssessment from './pages/NeedsAssessment'
import DILGReports from './pages/DILGReports'
import PublicAnnouncements from './pages/PublicAnnouncements'
import Announcements from './pages/Announcements'
import UserManagement from './pages/UserManagement'

// Gate 1: authentication. Shows a loading splash while the session is being
// checked, then either renders the children (logged in) or redirects to /login.
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

// Gate 2: authorization. Checks the user's role against permissions.js. If the
// role can't open this path, it renders an "Access Restricted" message instead.
function RoleRoute({ path, children }) {
  const { profile } = useAuthStore()
  const role = profile?.role ?? 'viewer'   // default to the most restrictive role
  if (!canAccess(role, path)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">🚫</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Access Restricted</h2>
          <p className="text-sm text-gray-500">Your role <span className="font-medium text-gray-700">({role})</span> does not have permission to view this page.</p>
        </div>
      </div>
    )
  }
  return children
}

export default function App() {
  const { setUser, setLoading, fetchProfile } = useAuthStore()

  // Auth bootstrap — runs once on mount.
  useEffect(() => {
    // 1) On first load, check if there's already a saved session (e.g. page refresh).
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)   // load their role
      setLoading(false)
    })

    // 2) Subscribe to future auth changes (login/logout) so the UI updates live.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // 3) Clean up the subscription when the component unmounts (prevents leaks).
    return () => subscription.unsubscribe()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/resident-needs/*" element={<ResidentNeedsForm />} />
      <Route path="/announcements" element={<PublicAnnouncements />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="residents"  element={<RoleRoute path="/residents"><Residents /></RoleRoute>} />
        <Route path="qr"         element={<RoleRoute path="/qr"><QRVerification /></RoleRoute>} />
        <Route path="population" element={<RoleRoute path="/population"><PopulationAnalytics /></RoleRoute>} />
        <Route path="poverty"    element={<RoleRoute path="/poverty"><PovertyIncidence /></RoleRoute>} />
        <Route path="sectors"    element={<RoleRoute path="/sectors"><SectorStatistics /></RoleRoute>} />
        <Route path="gis"        element={<RoleRoute path="/gis"><GISMap /></RoleRoute>} />
        <Route path="crime-map"  element={<RoleRoute path="/crime-map"><CrimeHotspotMap /></RoleRoute>} />
        <Route path="disaster"   element={<RoleRoute path="/disaster"><DisasterVulnerability /></RoleRoute>} />
        <Route path="beneficiary"element={<RoleRoute path="/beneficiary"><BeneficiaryTracking /></RoleRoute>} />
        <Route path="crime"      element={<RoleRoute path="/crime"><CrimeIncident /></RoleRoute>} />
        <Route path="predictive" element={<RoleRoute path="/predictive"><PredictiveGrowth /></RoleRoute>} />
        <Route path="needs"      element={<RoleRoute path="/needs"><NeedsAssessment /></RoleRoute>} />
        <Route path="announcements-admin" element={<RoleRoute path="/announcements-admin"><Announcements /></RoleRoute>} />
        <Route path="reports"    element={<RoleRoute path="/reports"><DILGReports /></RoleRoute>} />
        <Route path="users"      element={<RoleRoute path="/users"><UserManagement /></RoleRoute>} />
      </Route>
    </Routes>
  )
}