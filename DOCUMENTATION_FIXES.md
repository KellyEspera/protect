# PROTECT — Documentation Fixes

Paste-ready corrections to align the capstone paper with the **deployed system**.
Each item says *what to change* and gives the *replacement text*. Work top to bottom.

Roles in the live system (final): **brgy_sec (Barangay Secretary — full access) · tanod · viewer**
(admin/officer were merged into brgy_sec. DILG is **not** a login role — it receives the
reports the barangay submits.)

---

## CHAPTER I — Background

### ① Scope → "User Roles" bullet (REPLACE)
**Old:** "User Roles: Barangay Officer and Resident with role-based access control…"

**New:**
> **User Roles:** The system enforces role-based access control across three roles —
> *Barangay Secretary* (full access — the system administrator); *Barangay Tanod*
> (peace-and-order pages only); and *Viewer* (read-only). Residents interact with the system
> only through a public portal (needs survey and announcements) without logging in. This
> protects sensitive data so that each user sees and edits only what their role permits.

### ② Conceptual Framework → feature count (REPLACE the phrase)
**Old:** "delivering twelve integrated features…"

**New:** "delivering its integrated modules — centralized dashboards, resident & household
profiling, QR verification, GIS household mapping, disaster vulnerability mapping, crime &
incident analytics, a crime hotspot heatmap, beneficiary tracking, poverty and sector
analytics, predictive population modeling, community announcements & needs assessment, and
automated DILG-compliant reporting."

### ③ Limitations → offline bullet (REPLACE)
**Old:** "The system operates online only; offline functionality is not implemented…"

**New:**
> The system is online-first: all data operations require an internet connection. The GIS maps
> do cache their map tiles for limited offline **viewing** (via a service worker), but creating,
> editing, and reading records still requires connectivity. Full offline data synchronization is
> not implemented.

---

## CHAPTER III — Technical Background (tool list corrections)

🔴 **Replace these two entries — they are not what the system uses:**

- **Remove "React-Qr-Scanner."** The actual camera scanner library is **html5-qrcode**.
  > **html5-qrcode** — used in PROTECT's QR Verification module to scan resident QR codes
  > with the device camera for fast, paperless identity verification.

- **Remove "React-To-Print."** Printing is handled with the **browser's native print dialog**
  (a hidden in-app print frame), not a third-party print library.

✅ **react-qr-code** (QR generation) is correct — keep it.

➕ **Add these tools you actually use (optional but accurate):**
- **jsPDF** — generates the downloadable PDF reports/exports across the analytics and DILG modules.
- **SheetJS (xlsx)** — Excel import/export for residents and beneficiaries.
- **Leaflet.heat** — renders the crime density heatmap on the Crime Hotspot Map.

---

## CHAPTER IV — Diagrams (replace with the regenerated figures)

Replace these figures with the new PNGs in the repo's `diagrams/` folder (they match the
deployed system):

| Old figure | Replace with |
|------------|--------------|
| Figure 1 — ERD | `diagrams/erd.png` (13 tables, correct relationships) |
| Figure 2 — DFD | `diagrams/dfd_context.png` + `diagrams/dfd_level1.png` |
| Figure 3 — Use Case | `diagrams/use_case.png` (3 actors, no DILG rep) |
| Figure 4 — System Flowchart | `diagrams/flowchart.png` (connector style A–K) |
| Figures 5–10 — module flows | `diagrams/modules/*.png` (11 updated sub-flowcharts) |

### ④ ERD narrative (REPLACE)
**Old:** "…consists of 10 entities with 6 relationship connectors…"

**New:**
> The ERD consists of **13 tables**. The **residents** table is the heart of the system,
> linking to **households** (each resident belongs to one household), **beneficiaries**,
> **qr_verifications**, and **survey_responses**. **beneficiaries** is a junction table
> resolving the many-to-many relationship between residents and **assistance_programs**. The
> **profiles** table extends Supabase **auth.users** one-to-one and stores each user's role.
> The **incidents**, **announcements**, and **audit_logs** tables each link to the staff user
> who created the record (officer / poster / changer). **disaster_risk_zones** and
> **population_history** are standalone reference tables — they have no foreign keys and are
> keyed by sitio and year respectively; a household's exposure to a risk zone is computed at
> runtime by distance, not stored. Deleting a resident cascades to its dependent records, while
> the standalone reference tables are unaffected.

### ⑤ Use Case narrative (REPLACE)
**Old:** "The PROTECT System has two actors: Resident and Barangay Secretary…"

**New:**
> The PROTECT System has **three actors**: the **Barangay Secretary / Officer** (full access),
> the **Barangay Tanod** (peace-and-order functions), and the **Resident / Public** (public
> portal, no login). The Secretary/Officer manages resident and household profiles, verifies
> residents via QR and issues barangay documents, tracks beneficiaries and processes
> assistance, logs and resolves incidents, marks disaster risk zones, posts announcements,
> views all analytics and the population forecast, and generates DILG-compliant reports. The
> Tanod logs crime/incident reports, updates incident status, and views the Crime Hotspot Map.
> Residents submit community needs and view public announcements without an account. The
> **DILG is not a system actor** — it is the external office that *receives* the compliance
> reports the barangay generates and submits.

---

## CHAPTER IV — Corrected screenshot captions

### ⑥ Figure 16 — Edit Resident Detail View (REPLACE)
**Old:** "…The pre-populated form requires a reason for modification. All edits are recorded in
an audit trail with timestamp, user ID, and reason."

**New:**
> Figure 16 shows the Edit Resident Detail View, which lets authorized users update an existing
> resident's information through a pre-populated form. Every change is automatically recorded in
> the **audit log** by a database trigger that captures the affected record, the before/after
> values, the user who made the change, and the timestamp — providing a complete, tamper-evident
> change history without extra data entry.

### ⑦ Figure 17 — QR Verification (REPLACE)
**Old:** "…Scanning a QR code instantly retrieves and displays the resident's complete profile
and photo, preventing fraudulent claims…"

**New:**
> Figure 17 shows the QR Verification module, which enables fast, paperless verification of
> residents. Each resident has a QR code encoding their resident number, name, and sitio. After
> scanning (or selecting a resident), the system identifies the person, flags whether they are a
> **household head or member**, and shows their sector badges. The officer then chooses a
> purpose: **issue a barangay document** (Clearance, Indigency, Residency, or Business Permit) —
> which opens a filled, print-ready document for the Punong Barangay to sign — **or process a
> household assistance release**, which records the release against the beneficiary and prevents
> double-claiming. Every verification is logged for accountability.

### ⑧ Figure 19 — Poverty Incidence Analytics (REPLACE the card description)
**Old:** "…poverty incidence rate among household heads, the count of household heads below the
poverty threshold, average monthly income of residents, and total number of registered
household heads."

**New:**
> Figure 19 shows the Poverty Incidence Analytics dashboard, which identifies economic
> vulnerability using **family income** (the combined income of all members of a household).
> Four summary cards display the **Poverty Incidence rate** (share of households below the
> ₱10,000/month family-income line), the number of **Poor Households** (below that line), the
> **Average Family Income**, and the total **People in Poverty** (residents living in poor
> households). A "Poverty Rate by Sitio" chart and an "Income Classification" breakdown relative
> to the poverty line complete the view.

### ⑨ Figure 24 — Crime & Incident Analytics (REPLACE)
**Old:** lists "Noise/Disturbance, Theft, Physical Injury, Domestic Violence, Trespassing,
Accident, Illegal Drugs, Others" and "a Mark Resolved button."

**New:**
> Figure 24 shows the Crime & Incident Analytics module. Three summary cards display total
> incidents, ongoing cases, and resolution rate. A bar chart breaks down incidents by type using
> a set tailored to Barangay San Joaquin: **Public Intoxication / Disorderly Conduct, Minor
> Physical Altercation, Domestic Dispute, Property Damage (Typhoon-related), Environmental /
> Ordinance Violation, Stray Animal Complaint, Noise Disturbance, and Others**. A form logs new
> incidents by type, sitio, date/time, complainant, optional evidence photo, and exact map
> location. The incident log table lists each case with its status, which staff can change
> through a **status dropdown** (Ongoing, Resolved, Escalated, or Dismissed). All records are
> stored in Supabase's incidents table and linked to the logging officer.

---

## CHAPTER IV — New module sections to ADD (with screenshots)

> Take a screenshot of each module on the live site and insert it; the descriptions below match
> the current build. Renumber the figures to fit your sequence.

### ⑩ NEW — Crime Hotspot Map
> **Figure NN. Crime Hotspot Map**
>
> Figure NN shows the Crime Hotspot Map, which visualizes **where** incidents concentrate across
> Barangay San Joaquin using Leaflet.js with OpenStreetMap. Summary cards show total incidents,
> the crime-hotspot sitio, cases resolved, and the most common incident type. The map offers two
> views via a toggle: a **Heatmap** that renders a density gradient (green → red) driven by each
> incident's real GPS location, so the busiest areas glow red; and a **Pins** view that shows a
> numbered marker per sitio. Filters for date range and crime type re-render the map for the
> selected subset. A Sitio Ranking panel and a Recent Incidents list accompany the map, and
> clicking any incident dot opens its details.

### ⑪ NEW — Community Announcements
> **Figure NN. Community Announcements**
>
> Figure NN shows the Announcements module, where barangay staff post community announcements
> with a title, body, category (General, Health, Safety, Event, Disaster, Others), and an
> optional image uploaded to Supabase Storage. Each announcement can be hidden/shown or deleted.
> Active announcements appear on a **public bulletin-board page** (`/announcements`) that
> residents can open without logging in — styled as a corkboard of pinned notices — alongside a
> "Submit Your Needs" form that feeds the Community Needs Assessment. This gives the barangay a
> one-way public communication channel while keeping posting controls staff-only.

### ⑫ NEW — User Management
> **Figure NN. User Management**
>
> Figure NN shows the User Management module (admin), which lists all system accounts with their
> name, role, and creation date. An administrator can edit a user's display name and **assign
> their role** (Barangay Secretary, Barangay Tanod, or Viewer)
> from a dropdown; a Role Access Guide explains what each role can access. New accounts are
> created in Supabase Authentication, and a database trigger automatically creates the matching
> profile row, after which the administrator sets the appropriate role here. Role assignment is
> what drives the role-based access control enforced throughout the system.

---

## Quick checklist

- [ ] Ch I Scope — roles bullet
- [ ] Ch I Conceptual Framework — feature wording
- [ ] Ch I Limitations — offline wording
- [ ] Ch III — html5-qrcode (not React-Qr-Scanner); drop React-To-Print; add jsPDF/xlsx/leaflet.heat
- [ ] Replace Figures 1, 2, 3, 4 and 5–10 with the new PNGs
- [ ] ERD narrative — 13 tables
- [ ] Use Case narrative — 3 actors, DILG is external
- [ ] Fix captions: Figures 16, 17, 19, 24
- [ ] Add sections: Crime Hotspot Map, Announcements, User Management
