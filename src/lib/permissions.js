// ============================================================================
//  permissions.js  —  Role-Based Access Control (RBAC) rules
// ----------------------------------------------------------------------------
//  Central source of truth for "who can see what" and "who can edit".
//  Two layers of access control are defined here:
//    1. PAGE access  -> ROLE_ROUTES + canAccess()  (which routes a role may open)
//    2. EDIT access  -> READONLY_ROLES + canEdit()  (may a role create/edit/delete)
//  These are enforced in the frontend (App.jsx RoleRoute + each page's canWrite).
// ============================================================================

// Human-readable labels for each role (used in User Management dropdowns/badges).
export const ROLE_LABELS = {
  admin:    'Administrator',
  officer:  'Barangay Officer',
  brgy_sec: 'Barangay Secretary',
  tanod:    'Barangay Tanod',
  viewer:   'Viewer',
}

// Every route path that exists in the app. Full-access roles get all of these.
const ALL_ROUTES = ['/', '/residents', '/qr', '/population', '/poverty', '/sectors', '/gis', '/crime-map', '/disaster', '/beneficiary', '/crime', '/predictive', '/needs', '/announcements-admin', '/reports', '/users']

// Which routes each role is allowed to open (exact path match).
export const ROLE_ROUTES = {
  admin:    ALL_ROUTES,                          // full system
  officer:  ALL_ROUTES,                          // full system
  brgy_sec: ALL_ROUTES,                          // Barangay Secretary — full system
  tanod:    ['/', '/crime-map', '/crime'],       // peace & order pages only
  viewer:   ['/', '/residents', '/qr', '/population', '/poverty', '/sectors', '/gis', '/crime-map', '/disaster', '/beneficiary', '/crime', '/predictive', '/needs'], // read-only on most pages
}

// Returns true if `role` is allowed to open `path`. Unknown roles fall back to
// the most restrictive (viewer) set, so a missing/typo role never gets full access.
export function canAccess(role, path) {
  const allowed = ROLE_ROUTES[role] ?? ROLE_ROUTES.viewer
  return allowed.includes(path)
}

// Roles that may only VIEW data — no create / edit / delete / import.
export const READONLY_ROLES = ['viewer']

// True if the role is allowed to make changes (add/edit/delete).
// Pages call this as `const canWrite = canEdit(profile?.role)` and hide their
// action buttons when it's false.
export function canEdit(role) {
  return !READONLY_ROLES.includes(role)
}
