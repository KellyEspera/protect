# PROTECT — Code Defense Guide

Study material for defending the codebase. Memorize Part 1–2; use Part 3 (Q&A) to rehearse.

---

## PART 1 — The architecture (say this verbatim)

> PROTECT is a **React single-page application** built with **Vite**, talking directly to
> **Supabase** (hosted PostgreSQL database + Auth + Storage), deployed on **Vercel**. There is
> **no custom backend server** — the React frontend uses the Supabase JavaScript client to read
> and write data, and Supabase enforces security with **Row-Level Security (RLS)** and **JWT
> authentication**. Client state uses **Zustand** (auth) and **React Query** (server data).

**Why this stack (the "why" answers):**
- **React** — component-based, reusable UI; the whole dashboard is composed of page + UI components.
- **Vite** — fast dev server and optimized production builds.
- **Supabase** — gives a Postgres database, authentication, file storage, and auto-generated APIs
  without writing/maintaining a backend server — ideal for a small team and a barangay budget.
- **Tailwind CSS** — utility classes for a consistent, government-appropriate look.
- **Leaflet** — open-source maps (no API key/billing like Google Maps) for GIS + hotspot + disaster.
- **Chart.js (react-chartjs-2)** — all analytics charts.
- **Vercel** — zero-config deploy from GitHub over HTTPS.

---

## PART 2 — How it works (the request lifecycle)

### Boot (`main.jsx`)
Wraps the app in: `QueryClientProvider` (React Query cache, `staleTime` 5 min), `BrowserRouter`
(routing), `ToastContainer` (toasts), `React.StrictMode`.

### Auth bootstrap (`App.jsx` + `authStore.js`)
- On load, `supabase.auth.getSession()` checks for an existing session.
- `onAuthStateChange` subscribes so login/logout updates the app instantly.
- The logged-in user goes into **Zustand** (`authStore`); `fetchProfile(userId)` reads the
  `profiles` table to get the user's **role**.

### Routing & access (`App.jsx`)
- Public routes (no login): `/login`, `/resident-needs`, `/announcements`.
- Everything else is wrapped in **`PrivateRoute`** → redirects to `/login` if not authenticated.
- Each protected page is wrapped in **`RoleRoute`** → calls `canAccess(role, path)`; if false,
  shows the "Access Restricted" screen.

### Data flow (every page)
- **Read:** `useQuery({ queryKey, queryFn })` → `supabase.from('table').select()`.
  React Query caches by `queryKey` and dedupes identical requests.
- **Write:** `useMutation` → `supabase.from('table').insert/update/delete()` →
  on success, `queryClient.invalidateQueries([key])` refetches so the UI updates.
- Writes to `residents` / `households` / `incidents` fire a **database trigger** that records an
  `audit_logs` row (table, action, before/after JSON, user, timestamp).

### Two-layer RBAC (`permissions.js`)
1. **Page access** — `ROLE_ROUTES[role]` lists allowed paths; `canAccess()` gates `RoleRoute`.
2. **Edit gating** — `canEdit(role)` returns `false` for any role in `READONLY_ROLES`; pages hide
   their add/edit/delete buttons when `canEdit` is false (`const canWrite = canEdit(profile?.role)`).
   The mechanism stays in place for the future, though no current role is read-only.

Roles: `brgy_sec` (Barangay Secretary — full access / the admin) · `tanod` (peace & order pages).
An account with no role yet is *unassigned* — it gets no access beyond the Dashboard until an admin
assigns one.

---

## PART 3 — Security (know the difference, be honest)

| Layer | What it does | Where |
|-------|--------------|-------|
| **Authentication** | Supabase Auth issues a **JWT**; only logged-in users get a valid token | `supabase.auth.signInWithPassword` |
| **RLS (server-side)** | **Per-role** database policies enforce authorization at the DB: staff-only reads, `brgy_sec`-only writes (tanod writes only `incidents`), public limited to active announcements + survey insert | `rls_policies.sql` |
| **Authorization / roles (frontend)** | Which pages a role sees + edit gating — the UX layer on top of RLS | `permissions.js` |
| **XSS prevention** | Escapes HTML in form input before saving | `sanitize.js` |
| **Brute-force** | 5 failed logins → 15-min lockout per email | `rateLimiter.js` |
| **PII masking** | Contact # / PhilHealth shown masked, reveal on click | `Residents.jsx` |
| **Audit trail** | Auto-logs INSERT/UPDATE/DELETE on key tables | DB triggers (`audit_logs.sql`) |
| **Data privacy** | RA 10173 compliance noted; access restricted to authorized staff | `DATA_PRIVACY.md` |

**SQL injection?** — *"Not applicable in the usual sense: I never build SQL strings. The Supabase
client sends parameterized queries, so user input is always treated as data, never executable SQL."*

**Defense-of-depth answer:** *"Authorization is enforced in TWO layers. The frontend
(`permissions.js`) controls which pages/buttons a role sees — that's UX. The real enforcement is
**per-role Row-Level Security in the database** (`rls_policies.sql`): even if someone bypassed the
React app and called the Supabase API directly, the database itself only lets staff read, only the
Barangay Secretary write most tables, and the Tanod write only incidents. Authentication and
authorization are both server-side."*

---

## PART 4 — Per-feature talking points

- **Resident Profiling** (`Residents.jsx`) — search/filter/sort, CSV/XLSX import (SheetJS),
  PII masking, sanitized forms. Marking a resident "Household Head" auto-creates a household
  with the next 4-digit number (`HH-0001`).
- **GIS Household Map** (`GISMap.jsx`) — Leaflet + OpenStreetMap; click to pin; clicking a head
  who already has a household **updates** that household's location instead of inserting a
  duplicate. Service worker caches map tiles for offline viewing.
- **QR Verification** (`QRVerification.jsx`) — `react-qr-code` generates, `html5-qrcode` scans;
  scan → issue document (print-ready preview) or process assistance release; every scan logged.
- **Crime Hotspot Map** (`CrimeHotspotMap.jsx`) — `leaflet.heat` density heatmap from each
  incident's lat/lng; toggle to numbered pins; date/type filters.
- **Disaster Vulnerability** (`DisasterVulnerability.jsx`) — risk-zone circles; households exposed
  computed at runtime by **Haversine distance** (not stored).
- **Poverty Incidence** (`PovertyIncidence.jsx`) — uses **family income** (sum of a household's
  members' income) vs the ₱10,000 line.
- **Predictive Growth** (`PredictiveGrowth.jsx`) — **linear regression** (least squares) on
  `population_history`; computes slope/intercept and **R²** (goodness of fit), projects 10 years.
- **Beneficiary Tracking** (`BeneficiaryTracking.jsx`) — junction of residents × programs;
  enroll/edit/remove, manage programs, record releases.
- **DILG Reports** (`DILGReports.jsx`) — compiles live figures and exports **PDF (jsPDF)**.

---

## PART 5 — Likely panelist questions (rehearse out loud)

1. **"Walk me through what happens when a user logs in."**
   → signInWithPassword → Supabase returns a JWT session → `onAuthStateChange` fires →
   user saved to Zustand → `fetchProfile` reads role → router renders allowed pages.

2. **"How do you stop a Tanod from opening Resident Profiling?"**
   → `RoleRoute` calls `canAccess('tanod', '/residents')`; `/residents` isn't in the tanod's
   `ROLE_ROUTES`, so it renders "Access Restricted." Also the sidebar only lists allowed links.

3. **"Why no backend server?"**
   → Supabase provides the database, auth, storage, and a secure API layer. A custom server would
   add cost and maintenance with no benefit for this scope.

4. **"How is the predictive model computed?"**
   → Least-squares linear regression on historical yearly population; slope = residents/year,
   R² measures fit; I project the line 10 years forward.

5. **"How does the crime heatmap know where crimes are?"**
   → Each incident stores latitude/longitude (picked on a mini-map when logging). `leaflet.heat`
   sums nearby points into a density gradient.

6. **"What if the internet goes down?"**
   → It's online-first; map tiles cache for offline viewing, but data operations need a connection.
   Documented as a limitation; offline sync is future work.

7. **"How do you prevent duplicate/fraudulent assistance claims?"**
   → QR identifies the household head; releases are recorded against the beneficiary
   (`last_release_date`, `total_released`) and logged in `qr_verifications`.

8. **"Where's the validation?"**
   → `sanitize.js` escapes XSS and validates phone (PH format), income (non-negative), and DOB
   (no future/garbage dates) before any save; the database also has CHECK constraints.

9. **"What happens to a record when you edit it?"**
   → A SECURITY DEFINER trigger writes an `audit_logs` row with before/after JSON, the user, and
   timestamp — an immutable change history.

10. **"Which part are you most proud of / hardest?"**
    → (Pick one — e.g. the GIS household-head/pin logic or the QR document workflow — and explain
    the problem and how you solved it.)
