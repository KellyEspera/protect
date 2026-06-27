export const ROLE_LABELS = {
  admin:    'Administrator',
  officer:  'Barangay Officer',
  brgy_sec: 'Barangay Secretary',
  tanod:    'Barangay Tanod',
  viewer:   'Viewer',
}

const ALL_ROUTES = ['/', '/residents', '/qr', '/population', '/poverty', '/sectors', '/gis', '/crime-map', '/disaster', '/beneficiary', '/crime', '/predictive', '/needs', '/announcements-admin', '/reports', '/users']

// Routes accessible per role (use exact path strings)
export const ROLE_ROUTES = {
  admin:    ALL_ROUTES,
  officer:  ALL_ROUTES,
  brgy_sec: ALL_ROUTES,
  tanod:    ['/', '/crime-map', '/crime'],
  viewer:   ['/', '/residents', '/qr', '/population', '/poverty', '/sectors', '/gis', '/crime-map', '/disaster', '/beneficiary', '/crime', '/predictive', '/needs'],
}

export function canAccess(role, path) {
  const allowed = ROLE_ROUTES[role] ?? ROLE_ROUTES.viewer
  return allowed.includes(path)
}

// Roles that may only VIEW data — no create / edit / delete / import.
export const READONLY_ROLES = ['viewer']

// True if the role is allowed to make changes (add/edit/delete).
export function canEdit(role) {
  return !READONLY_ROLES.includes(role)
}
