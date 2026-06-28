# PROTECT — System Diagrams

**Barangay San Joaquin, Basco, Batanes**

Three diagrams for the capstone documentation, derived from the actual system:

1. **ERD** — see [`DATA_MODEL.md`](DATA_MODEL.md) §4 (entities, fields, relationships)
2. **System Flowchart** — below (with off-page connectors A–K + module sub-flowcharts)
3. **Data Flow Diagram (DFD)** — below (Context / Level 0 + Level 1)
4. **Use Case Diagram** — [`diagrams/use_case.png`](diagrams/use_case.png) — 4 actors × what each role can do

### Use Case — actor → access summary

| Actor | Can do |
|-------|--------|
| **Barangay Secretary** (full access / the admin) | Everything — resident/household profiling, GIS, QR + documents, beneficiaries + assistance, announcements, incidents + status, hotspot + disaster maps, analytics, predictive, needs, DILG reports, user management, system & audit |
| **Barangay Tanod** | Login, Log Crime/Incident, Update Incident Status, View Crime Hotspot Map |
| **Resident / Public** (no login) | Submit Community Needs, View Public Announcements |

> The **DILG / Government** is *not* a system user — it's the external office that **receives**
> the compliance reports the barangay generates and submits. It appears in the DFD as an
> external entity, not as a login role.

> All diagrams use **Mermaid**. They render automatically on GitHub. To export an
> image for your paper, paste a block into <https://mermaid.live> and download as PNG/SVG.
>
> **Pre-rendered PNG images** are in the [`diagrams/`](diagrams/) folder:
> [`flowchart.png`](diagrams/flowchart.png) ·
> [`dfd_context.png`](diagrams/dfd_context.png) ·
> [`dfd_level1.png`](diagrams/dfd_level1.png) ·
> [`erd.png`](diagrams/erd.png) — drag these straight into your document.

---

## 1. System Flowchart

How a user moves through the system: login → role check → permitted modules → actions
(with the read-only / edit permission branch).

```mermaid
flowchart TD
    Start([Start]) --> Open[User opens PROTECT]
    Open --> Access{Public link or staff login?}

    %% Public (no login)
    Access -- Public --> Pub[Public Announcements / Needs portal] --> J((J))

    %% Staff login with rate limiting
    Access -- Staff login --> Fail{5+ failed attempts?}
    Fail -- Yes --> Lock[Locked 15 mins]
    Fail -- No --> Auth{Supabase Auth valid?}
    Auth -- Invalid --> Fail
    Auth -- Yes --> Dash[Community Dashboard]

    %% Module selection (filtered by role) -> off-page connectors
    Dash --> Sel{Select module from dashboard<br/>menu filtered by role}
    Sel --> M1[Resident Profiling] --> A((A))
    Sel --> M2[QR Verification] --> B((B))
    Sel --> M3[GIS Household Map] --> C((C))
    Sel --> M4[Disaster Vulnerability] --> D((D))
    Sel --> M5[Crime & Incident] --> E((E))
    Sel --> M6[Crime Hotspot Map] --> F((F))
    Sel --> M7[Beneficiary Tracking] --> G((G))
    Sel --> M8[Analytics Dashboards] --> H((H))
    Sel --> M9[Predictive Growth] --> I((I))
    Sel --> M10[Announcements & Needs] --> J
    Sel --> M11[DILG Reports] --> K((K))

    %% Shared return connector from every sub-flowchart
    R((R)) --> Backend[Supabase Backend — PostgreSQL · Row Level Security · Auth · Real-time]
    Backend --> Cont{Continue session?}
    Cont -- Yes --> Dash
    Cont -- No --> Out([User logs out])
```

---

## 2. Data Flow Diagram — Context Diagram (Level 0)

The whole system as one process, showing the external entities and what flows in/out.

```mermaid
flowchart LR
    Staff[Barangay Staff<br/>admin / secretary / tanod]
    DILG[DILG / Government<br/>oversight office]
    Public[Resident / Public]

    System(((PROTECT<br/>System)))

    Staff -- resident, household, incident,<br/>beneficiary, announcement data --> System
    System -- dashboards, maps, certificates,<br/>reports --> Staff

    System -- compliance reports<br/>(submitted by the barangay) --> DILG

    Public -- community needs survey --> System
    System -- public announcements --> Public
```

---

## 3. Data Flow Diagram — Level 1

The major processes, the data stores they use, and the flows between them.
(Data stores map to the database tables in `DATA_MODEL.md`.)

```mermaid
flowchart TD
    %% ---- External entities ----
    Staff[Barangay Staff]
    DILG[DILG / Government]
    Public[Resident / Public]

    %% ---- Processes ----
    P1([1.0 Authenticate<br/>& Authorize])
    P2([2.0 Manage Residents<br/>& Households / GIS])
    P3([3.0 Log Incidents<br/>& Map Crime])
    P4([4.0 Manage Beneficiaries<br/>& Assistance])
    P5([5.0 QR Verification<br/>& Documents])
    P6([6.0 Announcements<br/>& Needs Survey])
    P7([7.0 Analytics<br/>& DILG Reports])

    %% ---- Data stores ----
    D1[(D1 profiles)]
    D2[(D2 residents · households)]
    D3[(D3 incidents · disaster_risk_zones)]
    D4[(D4 beneficiaries · assistance_programs)]
    D5[(D5 qr_verifications)]
    D6[(D6 announcements · survey_responses)]
    D7[(D7 population_history · audit_logs)]

    %% ---- Auth ----
    Staff --> P1
    P1 --> D1

    %% ---- Residents / households ----
    Staff --> P2
    P2 --> D2
    D2 --> P2

    %% ---- Incidents ----
    Staff --> P3
    P3 --> D3
    D3 --> P3

    %% ---- Beneficiaries ----
    Staff --> P4
    P4 --> D4
    D4 --> P4

    %% ---- QR / documents ----
    Staff --> P5
    D2 --> P5
    P5 --> D5
    P5 --> D4

    %% ---- Announcements / survey ----
    Staff --> P6
    Public --> P6
    P6 --> D6
    D6 --> P6
    D6 --> Public

    %% ---- Analytics / reports ----
    Staff --> P7
    D2 --> P7
    D3 --> P7
    D4 --> P7
    D7 --> P7
    P7 --> DILG
```

### Process ↔ data store key

| Process | Reads / writes | App screens |
|---------|----------------|-------------|
| 1.0 Authenticate & Authorize | D1 profiles | Login, User Management |
| 2.0 Manage Residents & Households | D2 residents, households | Resident Profiling, GIS Household Map |
| 3.0 Log Incidents & Map Crime | D3 incidents, disaster_risk_zones | Crime & Incident, Crime Hotspot Map, Disaster Vulnerability |
| 4.0 Manage Beneficiaries & Assistance | D4 beneficiaries, assistance_programs | Beneficiary Tracking |
| 5.0 QR Verification & Documents | D2 (read), D5 qr_verifications, D4 (release) | QR Verification |
| 6.0 Announcements & Needs Survey | D6 announcements, survey_responses | Announcements (admin), Public Announcements, Needs Assessment |
| 7.0 Analytics & DILG Reports | D2, D3, D4, D7 (read) | Dashboard, Poverty/Sector/Population Analytics, Predictive Growth, DILG Reports |

---

## 4. Module Sub-Flowcharts

Per-module control flow, each matching the deployed system. Sources in
[`diagrams/modules/`](diagrams/modules/) (`.mmd` editable, `.png` ready to paste).

| Module | Image |
|--------|-------|
| Resident Profiling | [resident_profiling.png](diagrams/modules/resident_profiling.png) |
| QR Verification | [qr_verification.png](diagrams/modules/qr_verification.png) |
| GIS Household Map | [gis_household_map.png](diagrams/modules/gis_household_map.png) |
| Disaster Vulnerability Map | [disaster_vulnerability.png](diagrams/modules/disaster_vulnerability.png) |
| Crime & Incident | [crime_incident.png](diagrams/modules/crime_incident.png) |
| Crime Hotspot Map | [crime_hotspot_map.png](diagrams/modules/crime_hotspot_map.png) |
| Beneficiary Tracking | [beneficiary_tracking.png](diagrams/modules/beneficiary_tracking.png) |
| Analytics Dashboards (Population/Poverty/Sector) | [analytics_dashboards.png](diagrams/modules/analytics_dashboards.png) |
| Predictive Growth | [predictive_growth.png](diagrams/modules/predictive_growth.png) |
| Announcements & Needs | [announcements_needs.png](diagrams/modules/announcements_needs.png) |
| DILG Reports | [dilg_reports.png](diagrams/modules/dilg_reports.png) |

---

## Notes for your documentation

- **Symbols:** in the DFD, rounded boxes = **processes**, plain boxes = **external entities**,
  cylinders `[( )]` = **data stores**. If your school requires Gane-Sarson notation
  (numbered rectangles + open-ended store bars), redraw these in your diagram tool using
  this structure — the *flows and labels* are what matter and they're all here.
- **Data stores = tables:** each `Dn` groups related tables from `DATA_MODEL.md`, so your
  DFD and ERD stay consistent.
- **Audit logging is automatic:** writes from processes 2.0 and 3.0 also drop a record in
  `audit_logs` via a database trigger — shown flowing into D7.
