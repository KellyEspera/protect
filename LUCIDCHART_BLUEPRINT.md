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

**First, what a DFD is (and how it differs from the flowchart):** a DFD shows how **data moves**
around the system — *who sends data, what the system does to it, and where it is stored*. It does
**not** show step-by-step order or decisions (that's the System Flowchart). A DFD uses only **four
symbols**:

- **External entity** — a *rectangle*. A person or office **outside** the system that sends or
  receives data (Barangay Staff, Resident/Public, DILG).
- **Process** — a *circle* (or rounded box). Something the system **does** to data
  (e.g., "Manage Residents"). In Level 1 each process gets a number (1.0, 2.0, …).
- **Data store** — an *open-ended rectangle* (two parallel lines). Where data is **kept** — i.e., a
  database table.
- **Data flow** — a *labeled arrow*. Shows **what** data moves and **which direction** it goes.

---

### Context Diagram (Level 0) — the whole system as ONE bubble

Draw one big circle, **PROTECT System**, in the middle. Put the three external entities around it
and connect them with labeled arrows. That's the entire diagram — it just shows what goes in and out.

```
                          (resident, household, incident,
                           beneficiary, announcement data)
   ┌──────────────────┐  ───────────────────────────────▶   ╭──────────────╮
   │  Barangay Staff  │                                      │              │   (compliance
   │ (Secretary/Tanod)│  ◀───────────────────────────────   │   PROTECT    │    reports)     ┌────────────────┐
   └──────────────────┘   (dashboards, maps, certificates,   │    System    │ ───────────────▶│ DILG/Government │
                            reports)                         │              │                 └────────────────┘
   ┌──────────────────┐  ───(community needs survey)──────▶  │              │
   │ Resident/Public  │                                      │              │
   └──────────────────┘  ◀──(public announcements)────────   ╰──────────────╯
```

**In plain words:** Staff type data IN and get dashboards/maps/reports OUT. Residents submit their
needs and read announcements. The barangay sends compliance reports to DILG. One picture, the whole
system.

---

### Level 1 Diagram — the ONE bubble "exploded" into 7 processes

Level 1 takes that single PROTECT bubble and opens it up to show the **7 things the system actually
does**, plus the **database tables** each one reads from or writes to. The same three external
entities stay on the edges.

**The 7 processes (draw each as a numbered circle):**

| # | Process | Triggered by | Reads / writes these data stores |
|---|---|---|---|
| 1.0 | Authenticate & Authorize | Staff | writes/reads **D1 profiles** |
| 2.0 | Manage Residents & Households / GIS | Staff | reads + writes **D2 residents · households** |
| 3.0 | Log Incidents & Map Crime | Staff | reads + writes **D3 incidents · disaster_risk_zones** |
| 4.0 | Manage Beneficiaries & Assistance | Staff | reads + writes **D4 beneficiaries · assistance_programs** |
| 5.0 | QR Verification & Documents | Staff | reads **D2**, writes **D5 qr_verifications**, updates **D4** (assistance release) |
| 6.0 | Announcements & Needs Survey | Staff **and** Public | reads + writes **D6 announcements · survey_responses**; sends announcements out to Public |
| 7.0 | Analytics & DILG Reports | Staff | reads **D2, D3, D4, D7**; sends compliance reports out to DILG |

**The 7 data stores (draw each as an open-ended rectangle):**

| ID | Data store (database tables) |
|---|---|
| D1 | profiles |
| D2 | residents · households |
| D3 | incidents · disaster_risk_zones |
| D4 | beneficiaries · assistance_programs |
| D5 | qr_verifications |
| D6 | announcements · survey_responses |
| D7 | population_history · audit_logs |

**How to read/draw the arrows (the key to understanding it):**
- Arrow **from an entity → a process** = that person is *sending data in* (e.g., Staff → 2.0 = staff enters a resident).
- Arrow **from a process → a data store** = the system is *saving* data (e.g., 2.0 → D2 = save the resident).
- Arrow **from a data store → a process** = the system is *reading* saved data (e.g., D2 → 7.0 = analytics reads residents).
- Arrow **from a process → an entity** = the system is *sending output out* (e.g., 7.0 → DILG = a report).

So for each process you typically draw: **entity → process**, **process ↔ its data store(s)**, and
(for 6.0 and 7.0) **process → an external entity** for the output.

---

## 4) USE CASE DIAGRAM

Three actors, one system boundary, use cases grouped into four packages in a **2×2 grid** (keeps it
balanced — not a tall ribbon). Actors on the sides; ovals = use cases; lines = associations.

```
 [Barangay Secretary]        ┌──────────────── PROTECT System ────────────────┐
  (actor, left)              │  ┌── Resident Services ──┐ ┌── Community & Needs ──┐
                             │  │ ( Manage Profiles )   │ │ ( Manage Announcements)│
 [Barangay Tanod]            │  │ ( QR / Issue Docs )   │ │ ( Submit Needs ) *─────┼─▶ [Resident /
  (actor, left)              │  │ ( Track Beneficiaries)│ │ ( View Announcements)* │    Public]
                             │  └───────────────────────┘ └───────────────────────┘   (actor, right)
                             │  ┌── Analytics, Maps & Prediction ┐ ┌── Safety, Reporting & Admin ┐
                             │  │ ( View Dashboard )             │ │ ( Log Incident )            │
                             │  │ ( View Analytics )             │ │ ( Update Incident Status )  │
                             │  │ ( View GIS & Disaster Maps )   │ │ ( Generate DILG Reports )   │
                             │  │ ( View Crime Hotspot Map )     │ │ ( Manage Users & Roles )    │
                             │  │ ( View Predictive Growth )     │ │ ( Review Audit Log & Backup)│
                             │  └────────────────────────────────┘ │ ( Authenticate / Login )    │
                             │                                      └─────────────────────────────┘
                             └──────────────────────────────────────────────────────────────────┘
```

**Associations (who connects to which use case):**
- **Barangay Secretary** → every use case **except** the two resident-only ones.
- **Barangay Tanod** → only: View Community Dashboard, View Crime Hotspot Map, Log Incident,
  Update Incident Status, Authenticate/Login.
- **Resident / Public** → only the two marked `*`: Submit Needs Assessment, View Public Announcements.

**Colors (match the legend):** Resident=green · Analytics/Maps=purple · Incident=tan ·
Reporting/Prediction=blue · Needs/Community=pink · Administration/Security=lavender.

---

## Lucidchart tips
- ERD: use the built-in **ERD shape library** (Database category) so PK/FK columns render cleanly.
- Keep crow's-foot cardinality consistent (one = bar, many = crow's foot).
- For the SFC, lay the main flow top-to-bottom and put each sub-flowchart on its own row connected
  by the lettered circles (A–K, return at R) — matches the paper's Figures 4–10.
- For the DFD, number processes `1.0`–`7.0` and stores `D1`–`D7` exactly so the figure caption
  references line up.
