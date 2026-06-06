import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  LayoutDashboard, Users, QrCode, TrendingUp, HeartHandshake,
  Accessibility, Map, AlertTriangle, Gift, Shield, BrainCircuit,
  ClipboardList, FileText, LogOut, Bell
} from 'lucide-react'

const navGroups = [
  {
    label: 'Main',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/residents', icon: Users, label: 'Resident Profiling' },
      { to: '/qr', icon: QrCode, label: 'QR Verification' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/population', icon: TrendingUp, label: 'Population Analytics' },
      { to: '/poverty', icon: HeartHandshake, label: 'Poverty Incidence' },
      { to: '/sectors', icon: Accessibility, label: 'Sector Statistics' },
    ],
  },
  {
    label: 'GIS & Safety',
    items: [
      { to: '/gis', icon: Map, label: 'GIS Household Map' },
      { to: '/disaster', icon: AlertTriangle, label: 'Disaster Vulnerability' },
    ],
  },
  {
    label: 'Community',
    items: [
      { to: '/beneficiary', icon: Gift, label: 'Beneficiary Tracking' },
      { to: '/crime', icon: Shield, label: 'Crime & Incident' },
      { to: '/predictive', icon: BrainCircuit, label: 'Predictive Growth' },
      { to: '/needs', icon: ClipboardList, label: 'Needs Assessment' },
      { to: '/reports', icon: FileText, label: 'DILG Reports' },
    ],
  },
]

const pageTitles = {
  '/': 'Community Dashboard',
  '/residents': 'Household Profiling',
  '/qr': 'QR Verification',
  '/population': 'Population Analytics',
  '/poverty': 'Poverty Incidence Analytics',
  '/sectors': 'Sector Statistics',
  '/gis': 'GIS Household Map',
  '/disaster': 'Disaster Vulnerability Map',
  '/beneficiary': 'Assistance Beneficiary Tracking',
  '/crime': 'Crime & Incident Analytics',
  '/predictive': 'Predictive Population Growth',
  '/needs': 'Community Needs Assessment',
  '/reports': 'DILG Report Generation',
}

export default function Layout() {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'BO'

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-navy flex flex-col flex-shrink-0 overflow-y-auto">
        {/* Brand */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-8 h-8 bg-teal rounded-lg flex items-center justify-center text-base">🛡️</div>
            <div>
              <div className="font-display text-[15px] font-bold text-white tracking-wide">PROTECT</div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest">Basco · Batanes</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 pt-3 pb-1 text-[10px] text-white/30 uppercase tracking-widest font-semibold">
                {group.label}
              </div>
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'active' : ''}`
                  }
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal rounded-full flex items-center justify-center text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-white font-medium truncate">
                {profile?.full_name || user?.email || 'Brgy. Officer'}
              </div>
              <div className="text-[10px] text-white/40 capitalize">{profile?.role || 'officer'}</div>
            </div>
            <button onClick={handleSignOut} className="text-white/40 hover:text-white transition-colors" title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 flex-shrink-0">
          <div>
            <h1 className="font-display text-[17px] font-semibold text-navy">
              {pageTitles[location.pathname] || 'PROTECT'}
            </h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Barangay Kayvaluganan, Basco, Batanes &bull; As of June 2026
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="badge badge-teal text-[10px]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-600 mr-1"></span>
              System Online
            </span>
            <button className="btn btn-ghost px-3 py-2 text-gray-400">
              <Bell size={15} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
