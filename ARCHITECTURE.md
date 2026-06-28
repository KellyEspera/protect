# PROTECT — System Architecture (Defense Study Guide)

A plain-language map of how the system is built. Read top to bottom.

---

## 1. The big picture

PROTECT is a **Single Page Application (SPA)**:

- **Frontend:** React + Vite (the website the user sees)
- **Backend:** Supabase (the database + login system — no custom server code)
- **Data fetching:** TanStack Query (`@tanstack/react-query`)
- **Styling:** Tailwind CSS
- **Charts:** Chart.js

There is **no separate backend you wrote**. The React app talks **directly** to Supabase. Supabase handles the database (PostgreSQL), user login (Auth), and security rules (RLS).

```
[ Browser: React app ]  <-->  [ Supabase: Database + Auth + Security ]
```

---

## 2. How a user request flows (memorize this for defense)

1. User opens the app → **[main.jsx](src/main.jsx)** starts React
2. **[App.jsx](src/App.jsx)** checks: is the user logged in? (asks Supabase)
3. If not logged in → **[LoginPage.jsx](src/pages/LoginPage.jsx)**
4. On login → it reads the user's **role** from the `profiles` table
5. The role decides **which pages and menu items** the user sees
6. User clicks a page → that page asks Supabase for data → shows it in tables/charts

---

## 3. Folder structure

```
src/
├── main.jsx              ← entry point, boots React
├── App.jsx               ← routing + access control (the "traffic controller")
│
├── pages/                ← one file = one screen the user sees
├── components/
│   ├── layout/Layout.jsx ← sidebar + topbar wrapper around every page
│   └── ui/index.jsx      ← reusable building blocks (Card, Badge, Modal, etc.)
│
├── store/authStore.js    ← remembers who is logged in (global state)
│
├── lib/                  ← helper code (not screens)
│   ├── supabase.js       ← connection to the database
│   ├── permissions.js    ← THE RBAC RULES (who can see what)
│   ├── sanitize.js       ← cleans user input (security)
│   ├── exportUtils.js    ← PDF/Excel export
│   └── ...
│
└── hooks/                ← reusable data-fetching logic
```

---

## 4. The 4 most important files (know these cold)

### A. [App.jsx](src/App.jsx) — the traffic controller
- Lists every page and its URL (e.g. `/crime` → CrimeIncident page)
- `PrivateRoute` = "you must be logged in"
- `RoleRoute` = "your role must be allowed here, or you see Access Restricted"

### B. [permissions.js](src/lib/permissions.js) — the RBAC brain
This is the heart of your Role-Based Access Control. It's a simple lookup table:

```js
ROLE_ROUTES = {
  brgy_sec: [all pages],                        // Barangay Secretary — full access (the admin)
  tanod:    ['/', '/crime-map', '/crime'],      // peace & order only
  // (no role assigned yet → no access beyond the Dashboard)
}
```

`canAccess(role, path)` just checks: *is this path in this role's list?* Used in **two** places:
1. **[Layout.jsx](src/components/layout/Layout.jsx)** — to hide menu items
2. **[App.jsx](src/App.jsx)** — to block the page itself (defense in depth)

### C. [authStore.js](src/store/authStore.js) — who is logged in
Uses Zustand (a small global-state library). Holds `user`, `profile`, and the
`signIn` / `signOut` / `fetchProfile` functions. When you log in, `fetchProfile`
reads your role from the database.

### D. [Layout.jsx](src/components/layout/Layout.jsx) — the frame
The sidebar + top bar that wraps every page. It filters the menu by role, so a
tanod literally never sees the menu items they can't open.

---

## 5. One page = one file

Every screen lives in its own file under `src/pages/`, named after the feature.
When you open `BeneficiaryTracking.jsx`, you see the Beneficiary Tracking code —
nothing hidden, nothing redirected.

```js
// src/pages/BeneficiaryTracking.jsx
export default function BeneficiaryTracking() {
  // ...the whole page lives right here...
}
```

**The one shared piece:** the three analytics pages (Population, Poverty,
Sector) all read the same list of residents, so they share a single data hook:

```js
// src/hooks/useResidents.js — fetched once, cached, reused by all three
export function useResidents() { ... }
```

Defense line: *"Each screen is its own file named after the feature. The three
analytics pages share one residents hook so the data is fetched once and cached."*

---

## 6. Page-by-page (what each screen does)

| Page                  | File                    | Purpose                              |
|-----------------------|-------------------------|--------------------------------------|
| Dashboard             | Dashboard.jsx           | Summary stats, overview              |
| Resident Profiling    | Residents.jsx           | Add/edit residents & households      |
| QR Verification       | QRVerification.jsx      | Scan/verify resident QR codes        |
| Population Analytics   | PopulationAnalytics.jsx | Population charts                     |
| Poverty Incidence     | PovertyIncidence.jsx    | Poverty statistics                   |
| Sector Statistics     | SectorStatistics.jsx    | PWD, senior, solo-parent counts      |
| GIS Household Map      | GISMap.jsx              | Map of household locations           |
| Crime Hotspot Map      | CrimeHotspotMap.jsx     | Map of incident hotspots             |
| Disaster Vulnerability | DisasterVulnerability.jsx | Hazard/risk zones map              |
| Beneficiary Tracking   | BeneficiaryTracking.jsx | Assistance program enrollment        |
| Crime & Incident      | CrimeIncident.jsx       | Log & analyze incidents              |
| Predictive Growth      | PredictiveGrowth.jsx    | Population forecast                   |
| Needs Assessment      | NeedsAssessment.jsx     | Community survey results             |
| DILG Reports          | DILGReports.jsx         | Generate government reports          |
| User Management       | UserManagement.jsx      | Admin creates users & assigns roles  |

---

## 7. How roles + login actually work (the part you debugged)

1. You create a user in **Supabase → Authentication** (email + password)
2. A database **trigger** auto-creates a row in the `profiles` table (role = unassigned/NULL)
3. Admin opens **User Management** → changes that user's role
4. User logs in → app reads `profiles.role` → shows only their allowed pages

**Security note for defense:** access is enforced at **two layers** —
the menu hides forbidden links (UI), AND `RoleRoute` blocks the page even if
someone types the URL directly (logic). Plus Supabase **RLS** protects the data
at the database level. That's "defense in depth."

---

## 8. Likely defense questions & short answers

- **"What is RBAC and where is it?"** → Role-Based Access Control, in
  `permissions.js`. A table mapping each role to allowed pages.
- **"How do you stop a tanod from opening admin pages?"** → `RoleRoute` in
  App.jsx checks `canAccess()`; if not allowed, shows Access Restricted.
- **"Where is your backend?"** → Supabase. It's the database, auth, and
  security. The React app talks to it directly using a secure key.
- **"How is data kept safe?"** → Row Level Security (RLS) policies in Supabase
  + input sanitization (`sanitize.js`) + role checks in the app.
- **"Why one file for several pages?"** → Related features share imports and
  chart config; grouping reduces duplication. Each still loads independently via
  a one-line re-export.
