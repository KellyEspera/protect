// ============================================================================
//  permissions.js  —  Role-Based Access Control (RBAC) rules
// ----------------------------------------------------------------------------
//  Central source of truth for "who can see what" and "who can edit".
//  The system has TWO assignable roles:
//    • brgy_sec — Barangay Secretary: full access (the admin/operator)
//    • tanod    — Barangay Tanod: peace & order pages only
//  An account with no role yet (unassigned) gets no access beyond the Dashboard
//  until an admin assigns one. Access is enforced in the frontend
//  (App.jsx RoleRoute + each page's canWrite via canEdit()).
// ============================================================================

// Human-readable labels for each role (used in User Management dropdowns/badges).
export const ROLE_LABELS = {
  brgy_sec: 'Barangay Secretary',
  tanod:    'Barangay Tanod',
}

// Every route path that exists in the app. The full-access role gets all of these.
const ALL_ROUTES = ['/', '/residents', '/qr', '/population', '/poverty', '/sectors', '/gis', '/crime-map', '/disaster', '/beneficiary', '/crime', '/predictive', '/needs', '/announcements-admin', '/reports', '/users', '/admin-tools']

// Which routes each role is allowed to open (exact path match).
export const ROLE_ROUTES = {
  brgy_sec: ALL_ROUTES,                          // Barangay Secretary — full system (the admin)
  tanod:    ['/', '/crime-map', '/crime'],       // peace & order pages only

  // Legacy aliases — old accounts still tagged admin/officer keep full access until
  // the SQL migration converts them to brgy_sec. (Safe to remove after migrating.)
  admin:    ALL_ROUTES,
  officer:  ALL_ROUTES,
}

// Returns true if `role` is allowed to open `path`. An unknown/unassigned role
// gets NO routes (empty list), so a new or mis-tagged account can't reach any
// gated page until an admin assigns it a real role.
export function canAccess(role, path) {
  const allowed = ROLE_ROUTES[role] ?? []
  return allowed.includes(path)
}

// Roles that may only VIEW data — no create / edit / delete / import.
// (Currently none: both brgy_sec and tanod can edit within their pages. The
//  mechanism stays in place so a read-only role can be re-added later if needed.)
export const READONLY_ROLES = []

// True if the role is allowed to make changes (add/edit/delete).
// Pages call this as `const canWrite = canEdit(profile?.role)` and hide their
// action buttons when it's false. An unassigned role can't reach edit pages anyway.
export function canEdit(role) {
  return Boolean(role) && !READONLY_ROLES.includes(role)
}
