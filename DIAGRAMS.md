# PROTECT — System Diagrams

**Barangay San Joaquin, Basco, Batanes**

Three diagrams for the capstone documentation, derived from the actual system:

1. **ERD** — see [`DATA_MODEL.md`](DATA_MODEL.md) §4 (entities, fields, relationships)
2. **System Flowchart** — below
3. **Data Flow Diagram (DFD)** — below (Context / Level 0 + Level 1)

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
    Start([User opens PROTECT]) --> Mode{Logged in?}

    %% ---------- PUBLIC PORTAL (no login) ----------
    Mode -- "No · public link" --> Pub[/Public Announcements portal/]
    Pub --> PubAct{What do they do?}
    PubAct -- Read --> PubRead[View active announcements]
    PubAct -- Submit needs --> PubForm[Fill Community Needs form]
    PubForm --> SaveSurvey[(Save to survey_responses)]
    PubRead --> PubEnd([Leave site])
    SaveSurvey --> PubEnd

    %% ---------- STAFF LOGIN ----------
    Mode -- "Staff login" --> Login[Login page]
    Login --> Auth[Supabase Auth verifies email & password]
    Auth --> Valid{Credentials valid?}
    Valid -- No --> Login
    Valid -- Yes --> LoadRole[Load profile and role]

    LoadRole --> Route{Role-based menu}
    Route -- "admin / officer / brgy_sec" --> RAll[All modules]
    Route -- tanod --> RT[Dashboard · Crime Hotspot · Crime & Incident]
    Route -- dilg_rep --> RD[Dashboard · DILG Reports · Needs Assessment<br/>read-only]
    Route -- viewer --> RV[Read-only dashboards]

    RAll --> Module
    RT --> Module
    RD --> Module
    RV --> Module

    Module[/Open a module/] --> Which{Which module?}
    Which -- Resident Profiling --> Res[Add / edit / search residents,<br/>CSV import, PII masking]
    Which -- GIS Household Map --> Gis[Pin household,<br/>view members & sector flags]
    Which -- Crime & Incident --> Inc[Log incident + photo,<br/>update status:<br/>Ongoing / Resolved / Escalated / Dismissed]
    Which -- "Hotspot / Disaster maps" --> Maps[View crime heatmap,<br/>pins, risk zones]
    Which -- Beneficiary Tracking --> Ben[Enroll, edit, record aid release,<br/>manage programs]
    Which -- QR Verification --> Qr[Scan resident QR code]
    Which -- Announcements --> Ann[Post / hide announcement<br/>+ image upload]
    Which -- "Analytics / Predictive" --> Cht[View charts & population forecast]
    Which -- DILG Reports --> Rep[Compile barangay report]

    %% ---------- QR SUB-FLOW ----------
    Qr --> QrType{Purpose?}
    QrType -- Document request --> Doc[Preview filled barangay document]
    Doc --> Print[Print for Punong Barangay signature]
    QrType -- Assistance claim --> Rel[Verify household head,<br/>record aid release]

    %% ---------- WRITE / PERMISSION GATE ----------
    Res --> Gate
    Gis --> Gate
    Inc --> Gate
    Ben --> Gate
    Ann --> Gate
    Rel --> Gate
    Gate{Create / edit / delete?}
    Gate -- "Yes · canEdit role" --> Write[Write to Supabase]
    Gate -- "No · read-only role" --> Block[Edit controls hidden / blocked]
    Write --> Audit[(DB trigger writes audit_log)]
    Write --> Refresh[Refresh cache, re-render UI]

    %% ---------- READ / OUTPUT ----------
    Rep --> Export{Export PDF?}
    Export -- Yes --> Pdf[Generate PDF report]
    Export -- No --> Show
    Pdf --> Show
    Maps --> Show
    Cht --> Show
    Print --> Show
    Refresh --> Show
    Block --> Show
    Show([Information displayed / action complete])

    Show --> Logout{Log out?}
    Logout -- No --> Module
    Logout -- Yes --> End([Session ends])
```

---

## 2. Data Flow Diagram — Context Diagram (Level 0)

The whole system as one process, showing the external entities and what flows in/out.

```mermaid
flowchart LR
    Staff[Barangay Staff<br/>admin / secretary / tanod]
    DILGrep[DILG Representative]
    Public[Resident / Public]

    System(((PROTECT<br/>System)))

    Staff -- resident, household, incident,<br/>beneficiary, announcement data --> System
    System -- dashboards, maps, certificates,<br/>reports --> Staff

    DILGrep -- report & review requests --> System
    System -- DILG reports, needs data<br/>read-only --> DILGrep

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
    DILGrep[DILG Rep]
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
    DILGrep --> P1
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
    DILGrep --> P7
    D2 --> P7
    D3 --> P7
    D4 --> P7
    D7 --> P7
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

## Notes for your documentation

- **Symbols:** in the DFD, rounded boxes = **processes**, plain boxes = **external entities**,
  cylinders `[( )]` = **data stores**. If your school requires Gane-Sarson notation
  (numbered rectangles + open-ended store bars), redraw these in your diagram tool using
  this structure — the *flows and labels* are what matter and they're all here.
- **Data stores = tables:** each `Dn` groups related tables from `DATA_MODEL.md`, so your
  DFD and ERD stay consistent.
- **Audit logging is automatic:** writes from processes 2.0 and 3.0 also drop a record in
  `audit_logs` via a database trigger — shown flowing into D7.
