# PROTECT — Testing Guide / QA Checklist

Work top to bottom. Tick each box when the **Expected result** matches.
If something fails, note: the page, what you clicked, and the exact error
(red toast text, or the red error in the browser console — press **F12**).

---

## 0. Prerequisites (do these BEFORE testing)

- [ ] Ran **`DATABASE_SETUP.sql`** in Supabase → SQL Editor (no red errors)
- [ ] Storage buckets exist: **`incident-photos`** and **`announcement-photos`**
- [ ] (Optional, for charts) Ran `seed_sector_data.sql` so OSY / PWD charts have data
- [ ] `population_history` has ≥ 2 years (for Predictive Growth) — included in `DATABASE_SETUP.sql`
- [ ] On Vercel: env vars **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** are set
- [ ] (Security) Ran **`rls_policies.sql`** for per-role database enforcement — then re-test that brgy_sec and tanod can still do their normal actions (if a write suddenly fails with "row-level security policy", that's RLS working — tell me and I'll tune it)
- [ ] You have one login per role to test with: **brgy_sec** (Barangay Secretary) and **tanod**

> If a feature fails and a prerequisite above is unchecked, fix the prerequisite first —
> it's almost always a database-sync issue, not a code bug.

---

## 1. Authentication & Security

- [ ] **Login (valid)** → correct email/password logs in and lands on the Dashboard
- [ ] **Login (wrong password)** → red toast "Incorrect credentials. N attempts remaining"
- [ ] **Lockout** → 5 wrong attempts on the same email → "Account locked… 15 minutes", form disabled, countdown ticks
- [ ] **Logout** → sidebar user menu → logout → returns to /login; can't go back to a page without re-login
- [ ] **Direct URL while logged out** → visiting any page redirects to /login

---

## 2. Role-Based Access (log in as EACH role)

**brgy_sec — Barangay Secretary (full access / the admin)**
- [ ] Sidebar shows **all** groups (Main, Analytics, GIS & Safety, Community, Admin)
- [ ] Can add/edit/delete on every page
- [ ] Admin group shows **User Management** + **System & Audit**

**tanod**
- [ ] Sidebar shows **only**: Dashboard, Crime Hotspot Map, Crime & Incident
- [ ] Typing a blocked URL (e.g. `/residents` or `/admin-tools`) shows "Access Restricted"
- [ ] Can log incidents + change status (tanod is NOT read-only on its own pages)

---

## 3. Dashboard
- [ ] Summary cards show real counts (total residents, seniors, PWDs, active beneficiaries)
- [ ] Charts render (sex distribution, age groups, residents by sitio)
- [ ] Recent incidents list shows the latest cases
- [ ] **Export PDF** downloads a PDF with the barangay header

## 4. Resident Profiling
- [ ] **Add Resident** → fill form → saves; new resident appears in the table and after refresh
- [ ] Mark **Household Head** + "Create a new household" → a household (HH-000X) is auto-created
- [ ] Mark **Household Head** + pick an **existing** household → resident becomes that household's head; the previous head is demoted to a member (no duplicate household)
- [ ] **Edit** a resident → change saves and shows in the table
- [ ] **Search / filter** by name, sitio, sector → table narrows correctly
- [ ] **Sort** by a column header → order changes
- [ ] **PII masking** → contact / PhilHealth show as `•••••••1234`; "Reveal" shows the full value
- [ ] **CSV/XLSX import** → upload the template → rows import (check the import summary)
- [ ] **Export PDF / Excel** → files download with the resident data

## 5. QR Verification
- [ ] Select a resident → a **QR code** renders
- [ ] **Scan the QR with a generic phone app** (Google Lens) → shows **gibberish hex**, NOT the name (PII protected ✅)
- [ ] **Simulate Scan** (with a resident selected) → identifies the correct resident + shows Head/Member + sector badges
- [ ] **Start Scanner** on `http://localhost:5173` (or HTTPS) → camera opens; scanning the QR identifies the resident
- [ ] Choose **Barangay Clearance** → **Issue & Print** → preview modal shows the filled document → **Print** opens the print dialog
- [ ] Choose **Assistance Claim** for a household head who is a beneficiary → enter amount → **Record release** → toast confirms; beneficiary's last release date / total update
- [ ] **Recent Verifications** list updates after each scan/issue

## 6. Population Analytics
- [ ] Cards show total population, male ratio, under-18, seniors
- [ ] Sex (pie), Age group (doughnut), Population by sitio (bar) all render
- [ ] **Export PDF** works

## 7. Poverty Incidence
- [ ] Cards: Poverty Incidence %, Poor Households (< ₱10,000), Avg **Family** Income, People in Poverty
- [ ] "Poverty Rate by Sitio" and "Income Classification" charts render
- [ ] Household Heads Below Poverty Line table lists the poor households
- [ ] **Export PDF** works

## 8. Sector Statistics
- [ ] Cards: Senior Citizens, Solo Parents, PWDs (with % of population)
- [ ] "Senior Citizens by Age Group", "PWD by Disability Type", "OSY by Sitio" charts render (run `seed_sector_data.sql` if empty)
- [ ] **Export PDF** works

## 9. GIS Household Map
- [ ] Map loads centered on San Joaquin with color-coded pins per sitio
- [ ] **Click an existing pin** → popup shows residents living there + sector flags + Edit/Remove
- [ ] **Click empty map** → drop a pin → select a household head → save
- [ ] Pinning a head who **already has a household** → it **updates that household's location** (no duplicate HH number, no error)
- [ ] Click an entry in the **Pinned Households** list → map flies to it
- [ ] (tanod) → GIS Map is not in the sidebar / URL shows "Access Restricted"

## 10. Crime Hotspot Map
- [ ] Map loads with incidents
- [ ] **Heatmap** view → red where incidents cluster (Hagu hottest with seed data)
- [ ] **Pins** toggle → numbered markers per sitio
- [ ] **Date range** and **Crime type** filters re-render the map
- [ ] Click an incident dot → details popup
- [ ] Sitio Ranking + Recent Incidents panels populate

## 11. Disaster Vulnerability
- [ ] Map loads with existing risk zones (red/orange/green circles)
- [ ] **Click map** → place a zone → fill hazard type / level / radius → save
- [ ] Zone popup shows **households exposed** count
- [ ] **Household overlay**: pins appear on the map — red = exposed (inside a zone), teal = safe; clicking one lists its residents + sector flags (read-only); the "Show households" checkbox hides/shows them
- [ ] Risk Summary by Sitio populates
- [ ] (tanod) → Disaster Vulnerability is not in the sidebar / "Access Restricted"

## 12. Beneficiary Tracking
- [ ] Cards: active beneficiaries, total distributed, active programs, pending claims
- [ ] **Enroll** a beneficiary (resident + program + status + last release date + total) → saves
- [ ] **Edit** / **Remove** a beneficiary → works
- [ ] **Manage Programs** → add a program / deactivate one → reflected in the list
- [ ] Hover **Active Programs** card → tooltip lists the programs
- [ ] **Import XLSX** → rows import

## 13. Crime & Incident
- [ ] Cards: total incidents, ongoing, resolution rate
- [ ] Incident type breakdown chart shows the **Batanes types**
- [ ] **Log incident** → type, sitio, date, complainant, optional photo, pick location on mini-map → saves
- [ ] **Update Status dropdown** → change a case to Resolved / Escalated / Dismissed → badge updates, toast confirms
- [ ] (tanod) → CAN log incidents + change status (this is a tanod page)

## 14. Predictive Growth
- [ ] Forecast chart shows historical line + dashed 10-year projection
- [ ] Cards: current population, avg annual growth, projected (year+10), R²
- [ ] 10-Year Projection Table + Model Parameters populate
- [ ] (If "not enough data") → confirm `population_history` has ≥ 2 rows

## 15. Needs Assessment (staff)
- [ ] Cards: survey responses, top priority need, sitios covered
- [ ] Priority Needs ranking populates from submitted surveys

## 16. Announcements (admin) + Public page
- [ ] **Post announcement** with title, body, category, **image** → saves (no "bucket not found")
- [ ] **Hide / Show** toggles visibility; **Delete** removes it
- [ ] Open **`/announcements`** (no login) → active announcements show on the bulletin board with images
- [ ] Public **Submit Your Needs** form → submits → appears in Needs Assessment

## 17. DILG Reports
- [ ] Each report card compiles figures and **exports a PDF** with letterhead

## 18. User Management (admin)
- [ ] Lists all users with name, role badge, created date
- [ ] **Edit** a user → change name and **role** (dropdown shows only: **Barangay Secretary, Barangay Tanod**) → saves
- [ ] Changing a role then logging in as that user reflects the new access

## 18a. System & Audit (admin)
- [ ] **Activity Log** shows recent audit entries (add/edit/delete)
- [ ] **Database Backup** downloads a `.json`
- [ ] A **tanod** cannot see the System & Audit page (not in sidebar; URL shows "Access Restricted")

---

## 19. Cross-cutting / regression
- [ ] After any add/edit, the change **persists after a page refresh** (confirms it saved to Supabase, not just local state)
- [ ] Audit: after editing a resident/incident, an entry appears in System & Audit → Activity Log
- [ ] Responsive: open on a phone-width window → sidebar collapses to a hamburger; pages stay usable
- [ ] No red errors in the browser console (F12) during normal use

---

### How to report a failure to the developer
Page + action + exact error. Example:
> *"Crime & Incident → clicked Submit Report → red toast: 'new row violates row-level security policy'."*
That triad is enough to pinpoint and fix it.
