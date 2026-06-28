# PROTECT — Lucidchart Blueprint (ERD · SFC · DFD)

A draw-by-numbers spec for recreating the three diagrams in **Lucidchart**, accurate to the
deployed system. Use the rendered PNGs in `diagrams/` as visual reference; use this for the exact
entities, fields, relationships, nodes, and data flows.

**Roles (live):** Barangay Secretary (`brgy_sec`, full) · Barangay Tanod (`tanod`, peace & order).
Residents use a public portal (no login). DILG is an external report *recipient*, not a user.

---

## 1) ENTITY RELATIONSHIP DIAGRAM (ERD) — 13 tables

In Lucidchart use **Entity Relationship** shapes (the table shape with rows). Mark PK/FK in the
key column. Cardinality uses crow's foot: `||` = one, `o{` = zero-or-many.

### Tables & key fields
(You don't have to list every column — these are the important ones; PK = primary key, FK = foreign key.)

1. **auth_users** *(Supabase-managed)* — `id` PK, `email`, `encrypted_password`
2. **profiles** — `id` PK (= auth_users.id), `full_name`, `role` (`brgy_sec` / `tanod`)
3. **households** — `id` PK, `household_no` UK (HH-0001), `purok`, `head_name`, `latitude`, `longitude`
4. **residents** — `id` PK, `resident_no`, `household_id` FK→households, `first_name`, `last_name`,
   `date_of_birth`, `purok`, `sex`, `civil_status`, `is_household_head`, `is_pwd`, `pwd_type`,
   `is_senior_citizen`, `is_solo_parent`, `is_out_of_school_youth`, `is_voter`, `monthly_income`,
   `occupation`, `contact_number`
5. **assistance_programs** — `id` PK, `name`, `agency`, `description`, `is_active`
6. **beneficiaries** — `id` PK, `resident_id` FK→residents, `program_id` FK→assistance_programs,
   `status`, `enrolled_at`, `last_release_date`, `total_released`, `notes`
7. **qr_verifications** — `id` PK, `resident_id` FK→residents, `purpose`, `verified_at`
8. **survey_responses** — `id` PK, `resident_id` FK→residents *(nullable)*, `purok`, `priority_need`,
   `comments`, `photo_url` *(optional)*, `submitted_at`
9. **incidents** — `id` PK, `case_no`, `incident_type`, `purok`, `complainant`, `respondent`,
   `description`, `incident_date`, `status`, `resolved_date`, `officer_id` FK→auth_users,
   `latitude`, `longitude`, `photo_url`
10. **disaster_risk_zones** — `id` PK, `hazard_type`, `risk_level`, `purok`, `description`,
    `radius`, `latitude`, `longitude` *(standalone — no FK)*
11. **announcements** — `id` PK, `title`, `body`, `category`, `image_url`, `is_active`,
    `posted_by` FK→auth_users
12. **population_history** — `id` PK, `year` UK, `total_population` *(standalone — no FK)*
13. **audit_logs** — `id` PK, `table_name`, `action`, `record_id`, `old_data` (jsonb),
    `new_data` (jsonb), `changed_by` FK→auth_users, `changed_at`

### Relationships (draw these lines)
- auth_users **||—||** profiles — "has role" (one-to-one)
- households **||—o{** residents — "houses" (one household, many residents)
- residents **||—o{** beneficiaries — "enrolled in"
- assistance_programs **||—o{** beneficiaries — "grants"
- residents **||—o{** qr_verifications — "scanned"
- residents **||—o{** survey_responses — "submits" (optional)
- auth_users **||—o{** incidents — "logs (officer_id)"
- auth_users **||—o{** announcements — "posts (posted_by)"
- auth_users **||—o{** audit_logs — "records (changed_by)"
- **disaster_risk_zones** and **population_history** — **no lines** (standalone tables)

### Narrative note (for the figure caption)
`residents` is the hub. Deleting a resident who is a household head cascades to remove the linked
household (DB trigger). Standalone tables (disaster_risk_zones, population_history) are unaffected
by resident deletions.

---

## 2) SYSTEM FLOWCHART (SFC)

Standard flowchart shapes: **rounded rectangle** = start/end, **rectangle** = process,
**diamond** = decision, **small circle** = off-page connector.

### Main flow
1. **(Start)**
2. [User opens PROTECT]
3. **{Public link or staff login?}**
   - **Public** → [Public Announcements / Needs portal] → connector **(J)**
   - **Staff login** → step 4
4. **{5+ failed attempts?}**
   - **Yes** → [Locked 15 mins] *(loops back / ends attempt)*
   - **No** → step 5
5. **{Supabase Auth valid?}**
   - **Invalid** → back to step 4
   - **Yes** → [Community Dashboard]
6. [Community Dashboard] → **{Select module from dashboard (menu filtered by role)}** → branches to:
   - [Resident Profiling] → **(A)**
   - [QR Verification] → **(B)**
   - [GIS Household Map] → **(C)**
   - [Disaster Vulnerability] → **(D)**
   - [Crime & Incident] → **(E)**
   - [Crime Hotspot Map] → **(F)**
   - [Beneficiary Tracking] → **(G)**
   - [Analytics Dashboards] → **(H)**
   - [Predictive Growth] → **(I)**
   - [Announcements & Needs] → **(J)**
   - [DILG Reports] → **(K)**
7. **Return path:** every sub-flowchart ends at connector **(R)** →
   [Supabase Backend — PostgreSQL · Row-Level Security · Auth · Real-time] →
   **{Continue session?}** — **Yes** → back to Community Dashboard · **No** → **(User logs out)**

### Module sub-flowcharts (each starts at its connector letter, ends at (R) or (G))
- **(A) Resident Profiling:** [Search/View residents] → **{Action?}** → *Add/Edit* → [Fill form & sanitize] → [Save to Supabase]; *Open Detail* → [Show resident detail] → (R)
- **(B) QR Verification:** [Select resident] → [Generate QR (hashed ID, no PII)] → [Print/Download ID or QR] → [Scan & choose purpose] → [Log verification] → (R)
- **(C) GIS Household Map:** [Load Leaflet] → [Click map to pin / click pin to edit] → [Save household coordinates] → (R)
- **(D) Disaster Vulnerability:** [Load map] → [Click to place risk zone] → [Set hazard/level/radius (drag pins)] → [Save risk zone] → (R)
- **(E) Crime & Incident:** [Load incidents] → [Log incident OR change status] → [Save to Supabase] → (R)
- **(F) Crime Hotspot Map:** [Load incidents] → [Heatmap / Pins toggle + filters] → (R)
- **(G) Beneficiary Tracking:** [Load beneficiaries] → [Enroll/Edit/Record release] → [Save] → (R)
- **(H) Analytics Dashboards:** [Query residents] → [Compute stats] → [Render charts] → (R)
- **(I) Predictive Growth:** [Load population_history] → [Linear regression + R²] → [Render forecast] → (R)
- **(J) Announcements & Needs:** [Staff posts / Public submits] → [Save] → [Public views active items] → (R)
- **(K) DILG Reports:** [Pick report] → [Compile live figures] → [Export PDF] → (R)

---

## 3) DATA FLOW DIAGRAM (DFD)

### Context Diagram (Level 0)
**External entities** (rectangles): **Barangay Staff** (Secretary / Tanod), **Resident / Public**,
**DILG / Government**. **One process** (circle/rounded): **PROTECT System**.

Data flows (arrows):
- Barangay Staff → System: *resident, household, incident, beneficiary, announcement data*
- System → Barangay Staff: *dashboards, maps, certificates, reports*
- System → DILG / Government: *compliance reports (submitted by the barangay)*
- Resident / Public → System: *community needs survey*
- System → Resident / Public: *public announcements*

### Level 1 Diagram
**External entities:** Barangay Staff · Resident/Public · DILG/Government
**Processes (numbered circles):**
- 1.0 Authenticate & Authorize
- 2.0 Manage Residents & Households / GIS
- 3.0 Log Incidents & Map Crime
- 4.0 Manage Beneficiaries & Assistance
- 5.0 QR Verification & Documents
- 6.0 Announcements & Needs Survey
- 7.0 Analytics & DILG Reports

**Data stores (open-ended rectangles):**
- D1 profiles
- D2 residents · households
- D3 incidents · disaster_risk_zones
- D4 beneficiaries · assistance_programs
- D5 qr_verifications
- D6 announcements · survey_responses
- D7 population_history · audit_logs

**Flows:**
- Staff → 1.0 → D1
- Staff ↔ 2.0 ↔ D2
- Staff ↔ 3.0 ↔ D3
- Staff ↔ 4.0 ↔ D4
- Staff → 5.0; D2 → 5.0; 5.0 → D5; 5.0 → D4 *(assistance release)*
- Staff → 6.0; Public → 6.0; 6.0 ↔ D6; D6 → Public *(public announcements)*
- Staff → 7.0; D2, D3, D4, D7 → 7.0; 7.0 → DILG *(compliance reports)*

---

## Lucidchart tips
- ERD: use the built-in **ERD shape library** (Database category) so PK/FK columns render cleanly.
- Keep crow's-foot cardinality consistent (one = bar, many = crow's foot).
- For the SFC, lay the main flow top-to-bottom and put each sub-flowchart on its own row connected
  by the lettered circles (A–K, return at R) — matches the paper's Figures 4–10.
- For the DFD, number processes `1.0`–`7.0` and stores `D1`–`D7` exactly so the figure caption
  references line up.
