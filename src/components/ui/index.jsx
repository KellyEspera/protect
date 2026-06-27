// ============================================================================
//  ui/index.jsx  —  small reusable UI building blocks
// ----------------------------------------------------------------------------
//  Presentational components shared across every page so the look stays
//  consistent and pages stay short: StatCard (summary number), Badge (status
//  pill), Modal (popup dialog), SectionCard (titled white panel), plus
//  EmptyState, Loader, and PageHeader. These hold NO business logic — they
//  just take props and render markup.
// ============================================================================

// StatCard — the colored summary number cards at the top of most pages.
export function StatCard({ icon, value, label, change, changeType = 'up', color = 'teal' }) {
  const iconColors = {
    navy:   'bg-blue-50 text-[#1A3A5C]',
    teal:   'bg-teal-light text-teal',
    gold:   'bg-amber-50 text-amber-700',
    red:    'bg-red-50 text-red-700',
    blue:   'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return (
    <div className="stat-card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base mb-3 ${iconColors[color]}`}>
        {icon}
      </div>
      <div className="font-display text-2xl font-bold text-navy">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {change && (
        <div className={`text-[11px] mt-1.5 ${changeType === 'up' ? 'text-green-600' : 'text-red-500'}`}>
          {changeType === 'up' ? '↑' : '↓'} {change}
        </div>
      )}
    </div>
  )
}

// src/components/ui/Badge.jsx
export function Badge({ children, variant = 'gray' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

// Modal — a centered popup. Clicking the dark backdrop closes it; clicking the
// white box does NOT (stopPropagation stops the click bubbling up to the backdrop).
export function Modal({ open, onClose, title, children }) {
  if (!open) return null   // render nothing when closed
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-[15px] font-semibold text-navy">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// src/components/ui/EmptyState.jsx
export function EmptyState({ icon = '📭', message = 'No data found', action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-gray-400 text-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// src/components/ui/Loader.jsx
export function Loader() {
  return (
    <div className="flex items-center justify-center py-14">
      <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
}

// src/components/ui/PageHeader.jsx
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-navy">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// src/components/ui/SectionCard.jsx
export function SectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`section-card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            {title && <div className="font-display text-[14px] font-semibold text-navy">{title}</div>}
            {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
