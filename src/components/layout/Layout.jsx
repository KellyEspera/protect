// ============================================================================
//  Layout.jsx  —  the shell around every logged-in page
// ----------------------------------------------------------------------------
//  Renders the left sidebar (navigation), the top bar (page title + user), and
//  an <Outlet/> where the current page is injected by the router. The sidebar
//  is ROLE-AWARE: it only shows links the user's role can access (canAccess),
//  so a Tanod literally never sees the Resident Profiling or Reports links.
// ============================================================================

import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { canAccess, ROLE_LABELS } from '../../lib/permissions'
import {
  LayoutDashboard, Users, QrCode, TrendingUp, HeartHandshake,
  Accessibility, Map, AlertTriangle, Flame, Gift, Shield, BrainCircuit,
  ClipboardList, FileText, LogOut, Bell, Menu, X, UserCog, Megaphone
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
      { to: '/gis',       icon: Map,          label: 'GIS Household Map' },
      { to: '/crime-map', icon: Flame,         label: 'Crime Hotspot Map' },
      { to: '/disaster',  icon: AlertTriangle, label: 'Disaster Vulnerability' },
    ],
  },
  {
    label: 'Community',
    items: [
      { to: '/beneficiary', icon: Gift,         label: 'Beneficiary Tracking' },
      { to: '/crime',       icon: Shield,        label: 'Crime & Incident' },
      { to: '/predictive',  icon: BrainCircuit,  label: 'Predictive Growth' },
      { to: '/needs',       icon: ClipboardList, label: 'Needs Assessment' },
      { to: '/announcements-admin', icon: Megaphone, label: 'Announcements' },
      { to: '/reports',     icon: FileText,      label: 'DILG Reports' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/users', icon: UserCog, label: 'User Management' },
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
  '/crime-map': 'Crime Hotspot Map',
  '/disaster': 'Disaster Vulnerability Map',
  '/beneficiary': 'Assistance Beneficiary Tracking',
  '/crime': 'Crime & Incident Analytics',
  '/predictive': 'Predictive Population Growth',
  '/needs': 'Community Needs Assessment',
  '/announcements-admin': 'Community Announcements',
  '/reports': 'DILG Report Generation',
  '/users':   'User Management',
}

export default function Layout() {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const role = profile?.role ?? 'viewer'
  // Build the sidebar for THIS role: keep only the links the role can access,
  // then drop any group (e.g. "Admin") that ends up with zero visible links.
  const filteredGroups = navGroups
    .map(group => ({ ...group, items: group.items.filter(item => canAccess(role, item.to)) }))
    .filter(group => group.items.length > 0)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'BO'

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 bg-navy flex flex-col flex-shrink-0 overflow-y-auto
        transform transition-transform duration-200 ease-in-out
        md:static md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal rounded-lg flex items-center justify-center text-base">🛡️</div>
            <div>
              <div className="font-display text-[15px] font-bold text-white tracking-wide">PROTECT</div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest">Basco · Batanes</div>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            className="md:hidden text-white/50 hover:text-white transition-colors"
            onClick={closeSidebar}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 pt-3 pb-1 text-[10px] text-white/50 uppercase tracking-widest font-semibold">
                {group.label}
              </div>
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={closeSidebar}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
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
              <div className="text-[10px] text-white/40">{ROLE_LABELS[role] ?? 'Officer'}</div>
            </div>
            <button onClick={handleSignOut} className="text-white/40 hover:text-white transition-colors" title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-14 md:h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-3 flex-shrink-0">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden text-gray-500 hover:text-navy transition-colors flex-shrink-0"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            <h1 className="font-display text-[15px] md:text-[17px] font-semibold text-navy truncate">
              {pageTitles[location.pathname] || 'PROTECT'}
            </h1>
            <p className="text-[10px] md:text-[11px] text-gray-400 mt-0.5 hidden sm:block">
              Barangay San Joaquin, Basco, Batanes &bull; As of June 2026
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2 md:gap-3 flex-shrink-0">
            <span className="badge badge-teal text-[10px] hidden sm:flex items-center">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-600 mr-1"></span>
              Online
            </span>
            <button className="btn btn-ghost px-2 py-2 text-gray-400">
              <Bell size={15} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-3 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
