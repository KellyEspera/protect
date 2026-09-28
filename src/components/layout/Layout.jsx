// ============================================================================
//  Layout.jsx  —  the shell around every logged-in page
// ----------------------------------------------------------------------------
//  Renders the left sidebar (navigation), the top bar (page title + user), and
//  an <Outlet/> where the current page is injected by the router. The sidebar
//  is ROLE-AWARE: it only shows links the user's role can access (canAccess),
//  so a Tanod literally never sees the Resident Profiling or Reports links.
// ============================================================================

import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { canAccess, ROLE_LABELS } from '../../lib/permissions'
import { supabase } from '../../lib/supabase'
import protectLogo from '../../assets/protect-logo1-cropped.png'
import { toast } from 'react-toastify'
import {
  LayoutDashboard, Users, QrCode, TrendingUp, HeartHandshake,
  Accessibility, Map, AlertTriangle, Flame, Gift, Shield, BrainCircuit,
  ClipboardList, FileText, LogOut, Bell, Menu, X, UserCog, Megaphone, Database,
  ChevronDown, ScrollText
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
      { to: '/ordinances-admin', icon: ScrollText, label: 'Ordinance Archive' },
      { to: '/reports',     icon: FileText,      label: 'DILG Reports' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/users', icon: UserCog, label: 'User Management' },
      { to: '/admin-tools', icon: Database, label: 'System & Audit' },
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
  '/ordinances-admin': 'Barangay Ordinance Archive',
  '/reports': 'DILG Report Generation',
  '/users':   'User Management',
  '/admin-tools': 'System & Audit',
}

export default function Layout() {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState({})   // which sidebar groups are collapsed
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(() => navigator.onLine ? 'checking' : 'offline')
  const queryClient = useQueryClient()
  const toggleGroup = (label) => setCollapsed(c => ({ ...c, [label]: !c[label] }))

  useEffect(() => {
    let disposed = false
    let checking = false
    let activeController = null

    const checkConnection = async () => {
      if (!navigator.onLine) {
        setConnectionStatus('offline')
        return
      }
      if (checking) return

      checking = true
      const controller = new AbortController()
      activeController = controller
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(`${window.location.origin}/?connectivity=${Date.now()}`, {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!disposed) setConnectionStatus(response.status > 0 ? 'online' : 'offline')
      } catch {
        if (!disposed) setConnectionStatus('offline')
      } finally {
        clearTimeout(timeout)
        if (activeController === controller) activeController = null
        checking = false
      }
    }

    const handleOffline = () => {
      activeController?.abort()
      setConnectionStatus('offline')
    }
    const handleOnline = () => {
      setConnectionStatus('checking')
      checkConnection()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkConnection()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    checkConnection()
    const interval = setInterval(checkConnection, 5000)

    return () => {
      disposed = true
      clearInterval(interval)
      activeController?.abort()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const role = profile?.role || 'unassigned'
  const notificationQueryKey = ['notifications', user?.id, role]
  const { data: notificationData, isError: notificationsUnavailable } = useQuery({
    queryKey: notificationQueryKey,
    enabled: Boolean(user && ['brgy_sec', 'tanod'].includes(role)),
    queryFn: async () => {
      const [latestResult, unreadResult] = await Promise.all([
        supabase.from('notifications')
          .select('id, notification_type, title, message, href, created_at, read_at')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase.from('notifications')
          .select('id', { count: 'exact', head: true })
          .is('read_at', null),
      ])
      if (latestResult.error) throw latestResult.error
      if (unreadResult.error) throw unreadResult.error
      return { items: latestResult.data || [], unreadCount: unreadResult.count || 0 }
    },
    refetchInterval: 15000,
  })
  const notifications = notificationData?.items || []
  const unreadCount = notificationData?.unreadCount || 0
  const markNotificationRead = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
    onError: () => toast.error('Could not update notification. Check the notifications SQL migration.'),
  })
  const markAllNotificationsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_notifications_read')
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
    onError: () => toast.error('Could not update notifications. Check the notifications SQL migration.'),
  })
  const openNotification = (notification) => {
    setNotificationsOpen(false)
    if (!notification.read_at) markNotificationRead.mutate(notification.id)
    if (notification.href) navigate(notification.href)
  }

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
            <img src={protectLogo} alt="PROTECT" className="w-8 h-8" />
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
          {filteredGroups.map((group) => {
            const isCollapsed = collapsed[group.label]
            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 pt-3 pb-1 text-[10px] text-white/50 uppercase tracking-widest font-semibold hover:text-white/80 transition-colors"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    size={13}
                    style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }}
                  />
                </button>
                {!isCollapsed && group.items.map(({ to, icon: Icon, label }) => (
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
            )
          })}
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
              <div className="text-[10px] text-white/40">{ROLE_LABELS[role] ?? 'Unassigned'}</div>
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

          <div className="ml-auto relative flex items-center gap-2 md:gap-3 flex-shrink-0">
            <span className={`badge ${connectionStatus === 'online' ? 'badge-teal' : connectionStatus === 'offline' ? 'badge-red' : 'badge-gold'} text-[10px] hidden sm:flex items-center`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${connectionStatus === 'online' ? 'bg-teal-600' : connectionStatus === 'offline' ? 'bg-red-600' : 'bg-amber-500'}`}></span>
              {connectionStatus === 'online' ? 'Online' : connectionStatus === 'offline' ? 'Offline' : 'Checking'}
            </span>
            <button
              type="button"
              className="btn btn-ghost px-2 py-2 text-gray-500 relative"
              aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
              aria-expanded={notificationsOpen}
              title="Notifications"
              onClick={() => setNotificationsOpen(open => !open)}
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[9px] font-bold text-white bg-red-500 rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <section className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl" aria-label="Notifications">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-navy">Notifications</h2>
                    <p className="text-[11px] text-gray-500">{unreadCount} unread</p>
                  </div>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-teal disabled:text-gray-300"
                    disabled={!unreadCount || markAllNotificationsRead.isPending}
                    onClick={() => markAllNotificationsRead.mutate()}
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[min(24rem,65vh)] overflow-y-auto">
                  {notificationsUnavailable ? (
                    <p className="px-4 py-6 text-center text-xs text-gray-500">Notifications need the Supabase migration to be installed.</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-gray-500">You’re all caught up.</p>
                  ) : notifications.map(notification => (
                    <button
                      type="button"
                      key={notification.id}
                      className={`block w-full border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-gray-50 ${notification.read_at ? '' : 'bg-teal-50/60'}`}
                      onClick={() => openNotification(notification)}
                    >
                      <span className="flex items-start gap-2">
                        {!notification.read_at && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-teal" />}
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-navy">{notification.title}</span>
                          <span className="mt-0.5 block text-xs text-gray-600">{notification.message}</span>
                          <span className="mt-1 block text-[10px] text-gray-400">
                            {new Date(notification.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
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