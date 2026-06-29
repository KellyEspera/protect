# PROTECT — Documentation Audit & Fixes (full paper, refreshed)

Top-to-bottom audit of `PROTECT_DOCUMENTATION.docx` against the **deployed system**
(as of this session). Each item gives the location, what's wrong, and paste-ready
replacement text. Work top to bottom.

**Ground truth of the live system:**
- **Login roles:** `brgy_sec` = **Barangay Secretary** (full access / the admin) · `tanod` =
  **Barangay Tanod** (Dashboard, Crime Hotspot Map, Crime & Incident only). A new account is
  *unassigned* until given a role. **There is no "Barangay Officer" and no "Resident" login role.**
- **Residents do not log in.** They use a **public portal** (`/announcements` and the needs form)
  with no account.
- **DILG is not a user** — it is a *recipient* of the reports the barangay submits.

**Severity:** 🔴 Critical (a panelist can catch the mismatch live) · 🟠 Medium · 🟢 Minor/polish.

---

## CHAPTER I — Background

### 🔴 ① Scope → "User Roles" bullet (REPLACE)
**Old:** "User Roles: Barangay Officer and Resident with role-based access control…"

**New:**
> **User Roles:** The system enforces role-based access control across two staff roles —
> *Barangay Secretary* (full access — the system administrator) and *Barangay Tanod*
> (peace-and-order pages only: Dashboard, Crime Hotspot Map, and Crime & Incident). Residents
> are **not** system users; they interact only through a public portal (community needs survey and
> announcements) without logging in. A newly created account has no access until the Barangay
> Secretary assigns it a role.

### 🟢 ② Conceptual Framework → feature count (REPLACE the phrase)
**Old:** "delivering twelve integrated features…" / "all twelve target features"

**New:** "delivering its integrated modules — centralized dashboards, resident & household
profiling, QR verification, GIS household mapping, disaster vulnerability mapping, crime &
incident analytics, a crime hotspot heatmap, beneficiary tracking, poverty and sector analytics,
predictive population modeling, community announcements & needs assessment, and automated
DILG-compliant reporting."

### 🟢 ③ Limitations → offline bullet (REPLACE)
**Old:** "The system operates online only; offline functionality is not implemented…"

**New:**
> The system is online-first: all data operations require an internet connection. The GIS maps do
> cache their map tiles for limited offline **viewing** (via a service worker), but creating,
> editing, and reading records still requires connectivity. Full offline data synchronization is
> not implemented.

---

## CHAPTER I — Coverage gaps (whole capabilities the paper never mentions)

The fixes above correct *wrong* facts. This section is about *missing* coverage — modules and
capabilities that exist in the deployed system but are absent from Chapter I's Scope/Objectives.

**Altitude rule:** Chapter I is written at **module/capability** level, not feature level. Do NOT
add micro-refinements here (QR PNG download, drag-to-resize disaster circle, audit-log pagination,
the "Others" reason field, sitio auto-fill, photo attachments) — those belong in Chapter IV
screenshots. Only the module-level gaps below belong in Chapter I.

### 🔴 ⓐ Out-of-School Youth (OSY) omitted from vulnerable sectors
Objective 2, the Scope "Analytics Modules" bullet, and the Significance section all enumerate
"senior citizens, solo parents, PWDs" — but the system also tracks **Out-of-School Youth (OSY)**
(Sector Statistics has an OSY-by-Sitio chart) and voter status. **Add "out-of-school youth" to
every vulnerable-sector list** in Chapter I, e.g.:
> …senior citizens, solo parents, persons with disabilities (PWDs), **out-of-school youth**, and
> economically disadvantaged households…

### 🟠 ⓑ Community Announcements — missing from Scope (ADD a bullet)
> **Community Communication:** Posting of barangay announcements to a public bulletin board that
> residents can view without logging in, strengthening transparency and information dissemination.

### 🟠 ⓒ QR Scope too narrow — broaden the Resident Management bullet
**Old:** "…QR-based identity verification to protect resident identity and prevent fraudulent
assistance claims."
**New:** "…QR-based identity verification **and on-the-spot issuance of barangay documents**
(clearance, certificate of indigency/residency), with every verification logged — protecting
resident identity and preventing fraudulent assistance claims."

### 🟠 ⓓ Crime Hotspot mapping — name it under GIS
The Scope lists "crime and incident analytics" but not the **spatial heatmap**. Append to the GIS
Integration bullet: "…and a **crime hotspot heatmap** for spatial crime-pattern analysis."

### 🟠 ⓔ System Administration & Security — missing from Scope (ADD a bullet)
Data security is the panel's top priority, yet Chapter I never mentions user management, the audit
trail, RLS, or backup. Add:
> **System Administration & Security:** Role-based user management, an automatic audit trail
> logging every record change, per-role database security (Row-Level Security), and on-demand
> database backup.

### 🟢 ⓕ Conceptual Framework (p.8) — feature count + Process box
Change "twelve integrated features" → "its integrated modules" (or update the number), and add
**Announcements & Audit Logging** to the Process box so the framework reflects all modules.

### Summary — what to add vs leave
- **Add (module-level):** OSY sector · Community Announcements · QR document issuance · Crime
  Hotspot heatmap · System Administration & Security (user mgmt + audit + RLS + backup).
- **Leave out (feature-level → Chapter IV only):** PNG/ID downloads, drag-resize circle, household
  overlay, radius slider, status dropdown, pagination, "Others" reason, sitio auto-fill, photo
  attachments.

---

## CROSS-CHAPTER — propagate the same coverage fixes everywhere the modules are listed

The paper lists PROTECT's modules in **several places**. They were all written from the same
outdated list, so the **same five additions** (OSY · Announcements · QR document issuance · Crime
Hotspot heatmap · System Admin & Security) must be applied to each. Check every one:

| Location | What to do |
|---|---|
| Ch I — Scope bullets | Items ⓐ–ⓔ above |
| Ch I — Conceptual Framework (p.8) | Item ⓕ above (count + Process box) |
| **Ch II — "Synthesis and Research Gap" (p.17)** | The sentence beginning *"PROTECT aims to address this gap by providing…"* lists the modules — add **out-of-school-youth categorization, community announcements, a crime hotspot heatmap, and an audit trail / role-based database security** to that sentence. |
| **Ch IV — B. Functional Requirements (p.33)** | ADD four missing items: **Crime Hotspot Mapping**, **Community Announcements**, **User Management**, **System & Audit (Activity Log + Database Backup)**; and rename "Senior Citizen, Solo Parent, and PWD Statistics" → **"…and Out-of-School Youth Statistics."** |
| **Ch IV — F. Data Requirements (p.35)** | ADD **Announcement content**, **QR identifiers / verification logs**, and **Audit logs** to the data list. |
| Ch IV — C. User Requirements (p.33) | (Optional) add **User & Role Management** and **Audit Log Review**. |
| Ch IV — D. Non-Functional Requirements (p.34) | (Optional) add **Accountability / Auditability** and **Data Privacy (RA 10173 compliance)**. |
| Ch IV — Design walkthrough (Figs 11–27) | Add the 4 missing module figures (see the "NEW module sections" list below). |

---

## CHAPTER II — Review of Related Literature/Systems

🟢 The literature/citations are your research — leave them. The **only** system-fact in this chapter
is the **"Synthesis and Research Gap"** paragraph (p.17), which restates PROTECT's module list with
the same gaps. Update that one sentence per the table above (add OSY, announcements, crime hotspot,
audit/RLS). Nothing else in Chapter II needs changing.

---

## UNFINISHED SECTIONS — content only you can supply (placeholders in the paper)

These are blank ("…") in the current draft — not errors, but they must be filled before submission:

- 🔴 **End-User Experience Rating** (Ch IV, p.61) — you still need to **conduct the evaluation**
  (e.g. a Likert/ISO 25010 or PSSUQ survey with the barangay end-users) and tabulate the results.
  This is usually a graded requirement; don't leave it empty.
- 🟠 **Sample Reports Generated by the System** (Appendix, p.66) — paste 1–2 exported DILG report
  PDFs (e.g. Barangay Profile, Peace & Order).
- 🟠 **User's Guide** (Appendix, p.67) — a short how-to (login, add resident, generate QR, log
  incident, run a report). The `TESTING_GUIDE` and per-module Chapter IV descriptions can seed this.
- 🟠 **One-page Curriculum Vitae** (Appendix, p.68) — team member CV(s).

---

## CHAPTER V / RECOMMENDATIONS — optional addition

🟢 The recommendations are solid and match the limitations. One optional add that ties to the
security discussion: **"Strengthen QR security with server-side cryptographic signing (HMAC)"** —
the current QR uses a SHA-256 hash that hides PII but is not forgery-proof; signing would prevent
forged codes. (Do **not** recommend an audit trail or RLS — those already exist.)

---

## CHAPTER III — Technical Background (tool list)

🔴 **Remove / replace these — they are NOT what the system uses:**

- **Remove "React-To-Print."** Printing (ID cards, certificates, reports) uses the **browser's
  native print dialog** via a hidden in-app print frame — no third-party print library.
- **Remove "React-Qr-Scanner."** The actual camera scanner is **html5-qrcode**:
  > **html5-qrcode** — used in PROTECT's QR Verification module to scan resident QR codes with the
  > device camera for fast, paperless identity verification.

✅ **react-qr-code** (QR generation) is correct — keep it.

🟢 **Lucidchart** — keep only if you actually drew the final ERD/DFD/Use Case there. (If the
diagrams were generated another way, replace with the tool you used.)

🟠 **Add the tools you actually use** (accurate and worth crediting):
- **jsPDF (+ jspdf-autotable)** — generates the downloadable PDF reports/exports.
- **SheetJS (xlsx)** — Excel import/export for residents and beneficiaries.
- **Leaflet.heat** — renders the crime density heatmap on the Crime Hotspot Map.
- **Zustand** — lightweight client state (auth/session).
- **TanStack React Query** — server-state fetching/caching for every data page.
- **Web Crypto API (SHA-256)** — hashes the QR payload so the QR carries no readable PII.

---

## CHAPTER IV — Requirement Documentation (diagrams)

### 🔴 ④ ERD narrative + Figure 1 (REPLACE narrative; REGENERATE figure)
The paper says "10 entities with 6 relationship connectors." The live database has **13 tables**.
The ERD figure is also missing three tables (**announcements, population_history, audit_logs**).

**New narrative:**
> The ERD models the PROTECT database, which consists of **13 tables**. `residents` is the heart of
> the system, linking to `households` (each resident may belong to one household; a household has one
> head), `beneficiaries` (residents enrolled in `assistance_programs`), `qr_verifications` (each scan
> event), and `survey_responses` (public needs submissions). `incidents` records crime/incident
> reports logged by staff. `profiles` holds each system user's role and links to Supabase's
> `auth.users`. `audit_logs` records every insert/update/delete on residents, households, and
> incidents. `announcements`, `disaster_risk_zones`, and `population_history` are standalone tables
> (no foreign keys) used for the bulletin board, hazard mapping, and population forecasting
> respectively. Deleting a resident who is a household head cascades to remove the linked household
> (enforced by a database trigger); standalone tables are unaffected.

**Figure 1:** Replace with the regenerated ERD that shows all 13 tables **with relationship lines**
(no floating tables). Use `diagrams/erd.png`.

### 🟠 ⑤ DFD narrative (one wording fix)
**Old:** "Managed by the authorized Barangay Officer, the system adheres to national reporting
standards…"

**New:** "Managed by the authorized **Barangay Secretary**, the system adheres to national reporting
standards…" (Also ensure the DFD figure's actor reads **Barangay Secretary**, and DILG/Government
is shown as an external *recipient*, not a user.)

### 🔴 ⑥ Use Case narrative + Figure 3 (REPLACE narrative; REDRAW figure)
The paper gives the **Resident** abilities they don't have (viewing analytics, GIS/disaster maps,
predictive growth, scanning QR). Residents have **no login**. It also omits the **Tanod** actor.

**New narrative:**
> The PROTECT System has three actors: **Barangay Secretary**, **Barangay Tanod**, and **Resident
> (public)**. The Barangay Secretary has full access — managing resident and household profiles,
> generating QR codes, verifying residents, tracking beneficiaries, logging crime/incident reports,
> viewing all analytics and GIS/disaster maps, running predictive population growth, posting
> announcements, managing users, reviewing the activity log, and generating DILG reports. The
> Barangay Tanod has peace-and-order access only — viewing the dashboard and crime hotspot map and
> logging/updating incident reports. The Resident is a public actor who does not log in; a resident
> can only **submit a community needs assessment** and **view public announcements** through the
> public portal.

**Figure 3 (redraw):** Resident connects **only** to *Submit Needs Assessment* and *View Public
Announcements*. Add a **Barangay Tanod** actor connected to *View Dashboard*, *View Crime Hotspot
Map*, and *Log/Update Incident*. Keep the Barangay Secretary connected to everything.

### 🟢 ⑦ System Flowchart figures (small wording)
- Figure 9 (GIS Mapping): the Disaster branch marks **hazard/risk zones**, not "safe zones."
  Change "Safe Zone" → "Mark Risk Zone."
- Figure 6 (QR Verification): optionally note the QR encodes a **hashed ID** (no PII). The flow
  (Select Resident → Generate QR → Print/Download → Log verification) is otherwise correct.

---

## CHAPTER IV — Screenshot captions / descriptions

### 🟢 Figure 13 — "Household Profiling Dashboard"
The page is labeled **Resident Profiling** in the system. Either rename the caption to
"Resident Profiling Dashboard" or note that "Household Profiling" is the section title.

### 🔴 ⑧ Figure 15 — Resident Detail View (REPLACE description)
**Old:** "…Socioeconomic (Occupation, Monthly Income, Educational Attainment)."

**New:**
> …and **Socioeconomic** (Occupation, Monthly Income). The detail view shows only the fields the
> barangay actively uses; unused fields (e.g. PhilHealth number, educational attainment) were
> removed to keep the profile focused and avoid collecting data without a clear purpose
> (data minimization under RA 10173).

(Retake the Figure 15 screenshot — the old PhilHealth/Education rows no longer appear.)

### 🔴 ⑨ Figure 16 — Edit Resident Detail View (REPLACE description)
The system has **no "reason for modification" field.** Remove that claim.

**New:**
> Figure 16 shows the Edit Resident form, which lets the Barangay Secretary update an existing
> resident. The form is pre-populated and all inputs are sanitized before saving. Every change is
> automatically recorded in the audit log with the action (insert/update/delete), the before-and-
> after data, the user who made it, and a timestamp — providing a complete, tamper-evident change
> history (viewable under System & Audit → Activity Log).

### 🔴 ⑩ Figure 17 — QR Verification (REPLACE description)
The QR no longer encodes name/sitio, and there is **no resident photo**.

**New:**
> Figure 17 shows the QR Verification module. For privacy, the QR code carries only a **SHA-256 hash**
> of the resident's ID — no name, sitio, or readable personal data — so scanning it with a generic
> phone app reveals only meaningless characters; only PROTECT can match the hash back to a resident.
> The Barangay Secretary selects a resident to generate their Barangay ID with QR, then **prints the
> ID card**, **downloads the QR as a PNG**, or **downloads the full ID card as a PNG**. On the scan
> side, the user chooses a **Purpose of Verification** (e.g. Barangay Clearance, Certificate of
> Indigency, Assistance Claim, or *Others* with a free-text reason), then scans with the camera or
> uses Simulate Scan. Each verification is logged with its purpose in the Recent Verifications list.

(Note: the ID card shows a "PHOTO HERE" placeholder — the system does not store resident photos.
Do not claim a photo is displayed.)

### 🟢 Figure 18 — Population Analytics
Wording fix: it says "two interactive features" then lists three charts. Change to **"three charts:
a Sex Distribution pie chart, an Age Group doughnut chart, and a Population by Sitio bar chart."**

### 🟠 Figure 20 — Sector Statistics (extend description)
Add that, besides the SC/Solo Parent/PWD cards, the page also charts **PWD by Disability Type**,
**Out-of-School Youth (OSY) by Sitio**, and **Working Residents by Sitio**, plus a Sector Registry
table. (OSY is now a tracked sector.)

### 🟠 Figure 22 — Disaster Vulnerability Map (REPLACE description)
**New:**
> Figure 22 shows the Disaster Vulnerability Map (Leaflet.js + OpenStreetMap). Summary cards show
> total risk zones and counts per level. The Barangay Secretary clicks the map to place a zone, then
> sets hazard type (**Typhoon, Flood, Landslide, Storm Surge, Earthquake, Fire**), risk level (High,
> Medium, Low), affected sitio, radius, and notes. The zone appears as an **editable preview circle
> with two drag handles** — a blue pin to move it and a red pin to resize it — and the radius can
> also be set with a slider (default 150 m). Risk zones render as colored circles (**red = High,
> amber = Medium, teal = Low**) with a diamond center marker; the circles are non-interactive so a
> large zone never blocks clicks. A read-only **household overlay** can be toggled on to show which
> households fall inside a zone (exposed = red dot, safe = teal dot), and the "households exposed"
> count is computed at runtime by Haversine distance. Zone data is stored in `disaster_risk_zones`.

### 🟠 Figure 24 — Crime & Incident Analytics (REPLACE description)
The incident types and the "Mark Resolved" button are outdated.

**New:**
> Figure 24 shows the Crime & Incident Analytics module. Three cards show total incidents, ongoing
> cases, and resolution rate. A bar chart breaks down the **Batanes-appropriate incident types**:
> Public Intoxication / Disorderly Conduct, Minor Physical Altercation, Domestic Dispute, Property
> Damage (Typhoon-related), Environmental / Ordinance Violation, Stray Animal Complaint, Noise
> Disturbance, and Others. A form logs a new incident by type, sitio, date/time, complainant, an
> optional photo, and an exact map location (mini-map pin). The incident log lists case number, type,
> sitio, date, complainant, and status, with a **status dropdown** to set each case to Ongoing,
> Resolved, Escalated, or Dismissed. Records are stored in the `incidents` table and linked to the
> staff member via `officer_id`. (The Barangay Tanod can also log and update incidents here.)

### 🟠 Figure 26 — Community Needs Assessment (extend description)
Add: "Residents may also **attach a photo** (e.g. a broken pipe or damaged road) when submitting a
need; staff see each submission — with its sitio, priority need, comment, and photo thumbnail — in
a Recent Submissions list."

### 🔴 Figure 27 — DILG Report Generation (FIX export format)
**Old:** "…exportable to PDF or DOCX with the official barangay letterhead."

**New:** "…**exportable to PDF** (via jsPDF) with the official barangay letterhead." (There is no
DOCX export.) The six report cards in the figure — Barangay Profile, CBMS Statistical, Peace &
Order, Assistance & Beneficiary, Vulnerable Sector, and Disaster Risk Assessment — are correct.

---

## CHAPTER IV — NEW module sections to ADD (with screenshots)

The walkthrough is missing four shipped modules. Add a numbered subsection + screenshot for each:

### ➕ Crime Hotspot Map
> The Crime Hotspot Map visualizes where incidents concentrate. By default it shows a **density
> heatmap** (Leaflet.heat) — red where incidents cluster — and can toggle to **numbered pins** per
> sitio for exact counts. Date-range and crime-type filters re-render the map, and side panels rank
> sitios by incident count and list recent incidents. (Accessible to both the Barangay Secretary and
> the Barangay Tanod.)

### ➕ Community Announcements (admin) + Public Bulletin Board
> The Announcements module lets the Barangay Secretary post announcements with a title, body,
> category, and image, and toggle their visibility. Active announcements appear on a **public bulletin
> board** at `/announcements` that residents can view **without logging in** — the same public portal
> that hosts the community needs form.

### ➕ User Management (admin)
> User Management lists all system accounts with their name, role badge, and creation date. The
> Barangay Secretary can edit a user's name and assign a role — the dropdown offers only **Barangay
> Secretary** and **Barangay Tanod**. Roles are stored server-side in the `profiles` table and
> enforced by database Row-Level Security, so they cannot be spoofed from the browser.

### ➕ System & Audit (admin)
> The System & Audit page holds two administrative tools. The **Activity Log** is a live, paginated
> viewer of the audit trail (10 entries per page) showing every add/edit/delete on residents,
> households, and incidents — with the action, the affected record, the user, and the time. The
> **Database Backup** tool downloads a full JSON backup of all barangay data for safekeeping.

---

## Figures to retake (because the UI changed this session)
- **Figure 1** — ERD (use the regenerated 13-table version with relationship lines)
- **Figure 3** — Use Case (add Tanod actor; reduce Resident to needs-submission + public announcements)
- **Figure 15 / 16** — Resident Detail / Edit (PhilHealth & Education rows removed; no "reason" field)
- **Figure 17** — QR Verification (now shows Purpose incl. "Others", Download QR/ID buttons)
- **Figure 22** — Disaster Vulnerability (drag-handle circle, diamond markers, household overlay)
- **Figure 24** — Crime & Incident (Batanes types in chart; status dropdown instead of "Mark Resolved")
- **Figure 26** — Community Needs (photo attachment field)
- **NEW** — Crime Hotspot Map, Community Announcements (+ public page), User Management, System & Audit

---

## Quick checklist
- [ ] 🔴 Scope user roles → Secretary + Tanod (no "Officer"/"Resident" login)
- [ ] 🔴 Use Case narrative + figure → 3 actors; Resident = public only; add Tanod
- [ ] 🔴 ERD narrative → 13 tables; regenerate figure with relationships
- [ ] 🔴 Fig 24 crime types → Batanes set; "Mark Resolved" → status dropdown
- [ ] 🔴 Fig 17 QR → hashed payload, no PII, no photo; add download options
- [ ] 🔴 Fig 16 edit → remove "reason for modification" claim
- [ ] 🔴 Fig 15 → remove Educational Attainment / PhilHealth
- [ ] 🔴 Fig 27 → PDF only (no DOCX)
- [ ] 🔴 Ch III tools → remove React-To-Print & React-Qr-Scanner; add html5-qrcode etc.
- [ ] 🟠 Fig 22 disaster → new behaviors + correct colors (red/amber/teal) + Earthquake
- [ ] 🟠 DFD → "Barangay Secretary" not "Officer"
- [ ] 🟠 Add 4 new module sections (Hotspot, Announcements, User Mgmt, System & Audit)
- [ ] 🟢 Conceptual framework "twelve features" wording; Fig 18 "three charts"; GIS "risk zone" wording
