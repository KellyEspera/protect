# 🛡️ PROTECT
### Integrated Barangay Analytics and Community Intelligence System
**Batanes State College — BS Information Technology Capstone 2026**
Barangay Kayvaluganan, Basco, Batanes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| State / Cache | Zustand + TanStack Query |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Charts | Chart.js + react-chartjs-2 |
| Maps | Leaflet + react-leaflet |
| QR Code | react-qr-code |
| Reports | jsPDF + jspdf-autotable + SheetJS (xlsx) |

---

## Features (All 12)

1. **Household Profiling Dashboard** — Add, edit, search residents with full demographic data
2. **Population Analytics** — Trend charts, sex distribution, purok breakdown
3. **Poverty Incidence Analytics** — Classification by income, purok poverty rates
4. **Senior Citizen, Solo Parent, PWD Statistics** — Sector registry and charts
5. **GIS-based Household Mapping** — Leaflet + OpenStreetMap with purok color-coding
6. **Disaster Vulnerability Mapping** — Risk overlays (typhoon, flood, landslide)
7. **Assistance Beneficiary Tracking** — Program enrollment, status tracking, distribution trends
8. **Crime and Incident Analytics** — Log incidents, view trends, update status
9. **Predictive Population Growth** — Linear regression model with projection to 2035
10. **Community Needs Assessment Dashboard** — Survey form + priority ranking
11. **QR-based Resident Verification** — Generate QR cards, simulate scan, log verifications
12. **Automated Report Generation** — Export PDF and Excel for all DILG report types

---

## Setup Instructions

### 1. Clone / Copy the project folder

Place the `protect/` folder wherever you keep your projects.

### 2. Install dependencies

```bash
cd protect
npm install
```

### 3. Configure Supabase

```bash
cp .env.example .env
```

Open `.env` and fill in your credentials from **Supabase Dashboard → Project Settings → API**:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set up the database

1. Go to **Supabase Dashboard → SQL Editor**
2. Open `DATABASE_SETUP.sql` from this project
3. Paste the entire contents and click **Run**

This creates all tables, RLS policies, seed data, and triggers automatically.

### 5. Create your first user (Barangay Officer)

1. Go to **Supabase Dashboard → Authentication → Users**
2. Click **Add User** → fill in email and password
3. That user can now log in to PROTECT

Or use the Supabase Auth API to sign up:
```js
await supabase.auth.signUp({ email: 'officer@kayvaluganan.gov.ph', password: 'your-password' })
```

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Offline / Demo Mode

The system automatically falls back to **mock template data** (Barangay Kayvaluganan sample data) if Supabase is unreachable or returns empty results. This means you can demo all 12 features even without a live database connection.

Mock data is in `src/lib/mockData.js` — you can edit it to match your actual barangay data.

---

## Project Structure

```
protect/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── DATABASE_SETUP.sql        ← Run this in Supabase SQL Editor
├── .env.example              ← Copy to .env and fill credentials
└── src/
    ├── App.jsx               ← Routes + auth guard
    ├── main.jsx              ← Entry point
    ├── index.css             ← Tailwind + global styles
    ├── lib/
    │   ├── supabase.js       ← Supabase client
    │   ├── mockData.js       ← Template data for demo
    │   └── exportUtils.js    ← PDF / Excel export helpers
    ├── hooks/
    │   └── useSupabaseQuery.js ← Reusable data hooks
    ├── store/
    │   └── authStore.js      ← Zustand auth state
    ├── components/
    │   ├── layout/
    │   │   └── Layout.jsx    ← Sidebar + topbar shell
    │   └── ui/
    │       └── index.jsx     ← StatCard, Badge, Modal, etc.
    └── pages/
        ├── LoginPage.jsx
        ├── Dashboard.jsx
        ├── Residents.jsx
        ├── QRVerification.jsx
        ├── PopulationAnalytics.jsx ← Population charts
        ├── PovertyIncidence.jsx    ← Poverty statistics
        ├── SectorStatistics.jsx    ← PWD / senior / solo-parent counts
        ├── GISMap.jsx
        ├── DisasterVulnerability.jsx
        ├── BeneficiaryTracking.jsx ← Assistance program enrollment
        ├── CrimeIncident.jsx       ← Log & analyze incidents
        ├── PredictiveGrowth.jsx    ← Population forecast
        ├── NeedsAssessment.jsx     ← Community survey results
        └── DILGReports.jsx         ← Government report generation
```

> Each page is its own file. The three analytics pages share one data hook,
> `src/hooks/useResidents.js`, so residents are fetched once and cached.

---

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Deploy to Vercel, Netlify, or any static host.

### Deploy to Vercel (recommended, free)

```bash
npm install -g vercel
vercel
```

Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel's environment variables.

---

## Data Privacy (RA 10173 Compliance Notes)

- All data is stored in Supabase (PostgreSQL) hosted on secure cloud infrastructure
- Row Level Security (RLS) is enabled on all tables — only authenticated users can access data
- Supabase Auth handles passwords with bcrypt hashing — plaintext passwords are never stored
- QR codes contain only non-sensitive identifiers (resident_no, name, purok)
- For full RA 10173 compliance, document a Privacy Impact Assessment (PIA) and appoint a Data Protection Officer (DPO) per NPC Advisory

---

## Capstone Team

- Balderas
- Espera
- Villegas

**Adviser:** Batanes State College, College of Computing and Information Sciences
**AY 2025–2026**
