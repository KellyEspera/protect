# PROTECT System — Feature-by-Feature Testing Guide
**Barangay San Joaquin Analytics & Community Intelligence System**
Basco, Batanes · Capstone Project

---

## Before You Start

1. Run all SQL files in **Supabase SQL Editor** in this order:
   - `supabase_schema.sql` — creates all tables
   - `seed_data.sql` — loads 60 sample residents + 20 households
   - `update_roles.sql` — enables the 5 user roles
   - `update_crime_types.sql` — expands incident type constraint
   - `add_sector_fields.sql` — adds OSY column
   - `audit_logs.sql` — enables activity logging
   - `incident_photos.sql` — adds photo upload to incidents
   - `announcements.sql` — creates announcements table

2. Start the app: `npm run dev`
3. Open `http://localhost:5173`

---

## 1. Login & Role-Based Access Control (RBAC)

**What to test:** Only the right roles can access the right pages.

**Steps:**
1. Go to `/login` — log in as `admin`
2. Confirm all sidebar items are visible
3. Log out, log in as `viewer`
4. Try navigating to `/residents` — you should see "Access Restricted"
5. Try `/reports` — viewer can see it, but cannot add residents

**Expected roles:**
| Role | Access |
|------|--------|
| admin | Everything |
| officer | Most pages except some restricted |
| tanod | Crime & Incident only |
| dilg_rep | Reports & Analytics |
| viewer | Read-only on select pages |

---

## 2. Add a Resident (Manual)

**What to test:** The add resident form saves correctly and auto-assigns a Resident No.

**Steps:**
1. Go to **Residents** page
2. Click **Add Resident**
3. Fill in: First Name, Last Name, Date of Birth, Sitio
4. Leave Resident No. blank (auto-generated)
5. Click **Save Resident**
6. Confirm the resident appears in the table with `RES-XXXX` number

---

## 3. Household Head + Auto HH Creation

**What to test:** Checking "Household Head" auto-creates a linked household.

**Steps:**
1. Click **Add Resident**
2. Fill in name, DOB, Sitio
3. Check **Household Head**
4. Notice the green notice: *"A Household No. will be auto-generated..."*
5. Click **Save Resident**
6. Go to **GIS Map** — the new household should appear in the map popup list
7. Confirm the resident's **View** modal shows a household number

---

## 4. Assign Non-HH-Head Resident to a Household

**What to test:** Family members can be linked to their household.

**Steps:**
1. Make sure at least one Household Head exists (from Step 3 or seed data)
2. Click **Add Resident** — do NOT check "Household Head"
3. Scroll to **Assign to Household** dropdown — it should list all existing households (e.g. "HH-001 — Ramon Gaje")
4. Select the household
5. Click **Save Resident**
6. Open the resident's **View** modal → Residence & Contact section shows "Household No."

---

## 5. Bulk Import Residents (CSV / Excel)

**What to test:** Upload a spreadsheet of residents.

**Steps:**
1. Download the template: Go to Residents → **Excel** export to see the column format
2. Create a small `.xlsx` file with 3 rows using these columns:
   `Resident No., Last Name, First Name, Date of Birth, Sex, Sitio, HH Head, PWD, Solo Parent, Senior Citizen, Monthly Income, Occupation, OSY`
3. Click **Import** button on Residents page
4. Select the file
5. Wait for the "Import Complete" modal showing Added / Updated / HH Records Created counts
6. Verify the residents appear in the table

**Edge cases to test:**
- Re-upload the same file → rows should be updated, not duplicated (same Resident No.)
- Upload a file with an invalid row (missing name) → that row is skipped, others succeed

---

## 6. Export Residents

**What to test:** PDF and Excel exports work.

**Steps:**
1. Go to **Residents** page (with data loaded)
2. Click **PDF** → a PDF should download with the resident table
3. Click **Excel** → an `.xlsx` file should download
4. Open the Excel file and verify all columns and resident data are present

---

## 7. QR Code Generation & Verification

**What to test:** Each resident gets a scannable QR code; scanning it shows their profile.

**Steps:**
1. Go to **QR Verification** page
2. Select any resident from the dropdown
3. A QR code appears — click **Download QR**
4. In the **Scan / Verify** section, either:
   - Use a phone camera to scan the QR code, OR
   - Paste the resident ID manually into the input field
5. Click **Verify** — the resident's profile card should appear
6. Test with an invalid ID — expect "Resident not found" error

---

## 8. Sector Statistics (Senior Citizens, PWD, Solo Parents, OSY, Working)

**What to test:** All 5 sector categories display correctly with charts and tables.

**Steps:**
1. Go to **Sectors** page (or the analytics route with sector stats)
2. Verify 5 stat cards appear: Senior Citizens, PWD, Solo Parents, OSY, Working
3. Scroll down — verify 4 charts: SC by Age Group, PWD by Disability Type, OSY by Sitio, Working by Sitio
4. Scroll to the **Sector Registry** table — all 5 categories listed with counts

**To test OSY:**
1. Go to Residents → Edit any resident
2. Check **Out-of-School Youth (OSY)**
3. Save, then go back to Sectors — the OSY count should increase by 1
4. The resident should now show a red **OSY** badge in the residents table

**To test Working:**
- Any resident with a non-empty **Occupation** field is counted as "Working" automatically

---

## 9. GIS Map

**What to test:** The map loads, shows household pins, and popups work.

**Steps:**
1. Go to **GIS Map**
2. The map should center on Basco, Batanes
3. Colored circles appear for each household — color = housing type
4. Click a pin → popup shows household number, head name, members, income
5. Use the **Sitio filter** buttons to filter by Sitio Hunan / Hagu / Tuva
6. Check the 5 stat cards at the top (Total HH, Concrete, Semi-concrete, Wood, Makeshift)

---

## 10. Offline Map Tile Caching

**What to test:** Map tiles are saved for offline use via Service Worker.

**Steps:**
1. Go to **GIS Map**
2. Look for the **"Save Offline"** (💾) button in the map card header
3. Click it — a progress bar appears: *"Caching X / Y tiles..."*
4. Wait for **"Offline ready!"** toast
5. The 5th stat card now shows tile count (e.g. "342 tiles")
6. Turn off your internet (airplane mode or disable network)
7. Refresh the page — the map should still load tiles from cache
8. The status card should show **Offline** in red

**To clear cache:**
- Click the 🗑️ button next to "Save Offline" — tile count resets to 0

---

## 11. Beneficiary Tracking

**What to test:** Enroll residents in assistance programs and track distribution.

**Steps:**
1. Go to **Beneficiary Tracking**
2. Click **+ Enroll** → you'll be directed to use the Residents page to enroll
3. Check the **Beneficiary Registry** table for any seed data entries
4. Test **Bulk Import**: download the template, fill in resident nos. and program names, upload
5. Verify the chart "Assistance by Program" updates with the new data
6. Check the 4 stat cards: Active Beneficiaries, Total Distributed, Active Programs, Pending Claims

---

## 12. Crime & Incident Reporting

**What to test:** Log an incident and update its status.

**Steps:**
1. Go to **Crime & Incident**
2. In **Log New Incident**: select type (e.g. Theft), sitio, set date & time, add complainant name
3. Click **+ Submit Report**
4. Verify the incident appears in the **Incident Log** with status "Ongoing"
5. Click **Mark Resolved** → status changes to "Resolved"
6. Check the charts: Incident Type Breakdown and Monthly Trend update
7. Check stat cards: Resolution Rate should change

---

## 13. Crime Incident Photo Upload

**What to test:** Attach a photo to an incident report.

> **Prerequisite:** Run `incident_photos.sql` in Supabase first.

**Steps:**
1. Go to **Crime & Incident** → **Log New Incident** form
2. Click **📷 Attach Photo** — select any image from your device
3. A thumbnail preview appears — verify file name shows below
4. Fill in the other fields and click **+ Submit Report**
5. In the **Incident Log** table, the new row should show a small thumbnail in the **Photo** column
6. Click the thumbnail → it should open the full image in a new tab

**To test removal:**
- Click ✕ on the preview before submitting — photo clears, incident saves without photo

---

## 14. Predictive Population Growth

**What to test:** The linear regression model generates a 10-year population projection.

**Steps:**
1. Go to **Predictive Growth**
2. If seed data has residents from multiple years, you'll see historical + projected lines on the chart
3. Verify 3 stat cards: Projected 10-year population, Annual Growth Rate, R² model fit
4. Scroll down — check the **Projection Table** (10 years) with confidence levels
5. Check the **Model Parameters** table: slope, intercept, R², data points

**Note:** If all residents were added in the same year, you'll see "Not enough data" — this is expected.

---

## 15. Needs Assessment (Public Survey Form)

**What to test:** Residents submit needs without logging in; results appear in the dashboard.

**Steps:**
1. Go to **Needs Assessment** page
2. Copy the **Resident Form URL** (or click **Copy Link**)
3. Open a private/incognito browser tab and paste the URL → you should reach the form without logging in
4. Submit a response (select a priority need + sitio)
5. Go back to Needs Assessment in the admin app
6. The **Priority Needs Ranking** chart should show the new response
7. Verify the response count stat card increases

---

## 16. Community Announcements (Public Link)

**What to test:** Post an announcement that's visible to the public without login.

> **Prerequisite:** Run `announcements.sql` in Supabase first.

**Steps:**
1. Go to **Needs Assessment** page — the **Announcements** panel is at the top
2. Click **+ New Announcement**
3. Fill in: Title (e.g. "Barangay Assembly — July 15"), Category (Event), Message body
4. Click **📢 Post Announcement**
5. The announcement appears in the table with status **Live**
6. Click **Copy Public Link** → paste into an incognito window
7. The `/announcements` page loads without login — your announcement is visible
8. Back in the admin panel, click **Hide** → announcement disappears from the public page

---

## 17. DILG Report Generation

**What to test:** Reports auto-populate from live data and can be exported.

**Steps:**
1. Go to **DILG Reports**
2. Click **Barangay Profile Report** — a preview appears with live figures (total population, sex breakdown, seniors, PWDs, etc.)
3. Click **Export PDF** — a PDF downloads with the formatted report
4. Click ✕ Close, then open **Peace & Order Report** — confirm incident counts match the Crime page
5. Open **CBMS Statistical Report** and **Assistance & Beneficiary Report** — verify data is consistent

---

## 18. Database Backup

**What to test:** Download a full JSON backup; system tracks last backup date.

**Steps:**
1. Go to **DILG Reports** → scroll to **Database Backup** section
2. If no backup has been done, the badge shows **"Never backed up"** (red)
3. Click **⬇️ Download Backup**
4. A `.json` file downloads: `protect-backup-YYYY-MM-DD.json`
5. Open the file — verify it contains `residents`, `households`, `incidents`, `beneficiaries`, etc.
6. The badge now shows **"Backed up today"** (green)
7. The **Recent Backups** table shows the entry with date and record count

**To test overdue warning:**
- Manually set your system clock forward 8 days, refresh → badge turns red "Overdue — 8d ago"

---

## 19. Audit / Activity Log

**What to test:** Every data change is recorded in the Activity Log.

> **Prerequisite:** Run `audit_logs.sql` in Supabase first.

**Steps:**
1. Go to **DILG Reports** → scroll to **Activity Log** section
2. Add a new resident (go to Residents, add one, come back)
3. Click **🔄 Refresh** in the Activity Log
4. A new row appears: `just now | Added | Resident | Juan Dela Cruz (RES-XXXX) | [your name]`
5. Edit that resident (change the occupation) → refresh → see `Updated` row
6. Log a new incident → refresh → see `Added | Incident | INC-2026-XXX — Theft`
7. Verify timestamps show "just now", "5m ago", etc.
8. Hover over the timestamp to see the exact date and time

---

## Common Issues & Fixes

| Problem | Fix |
|---------|-----|
| Residents table shows mock data | Seed data not run yet — run `seed_data.sql` in Supabase |
| Household dropdown shows only 1 entry | Same — run seed data; households need to exist in DB |
| Activity Log is empty | Run `audit_logs.sql` to install the DB triggers |
| Photo upload fails | Run `incident_photos.sql`; check Supabase Storage bucket exists |
| Announcements page 404 | Normal — run `announcements.sql` and make sure the app has the new route |
| Map doesn't load | Check internet; tiles need network on first load before caching |
| OSY column error | Run `add_sector_fields.sql` to add the column |

---

*Generated for PROTECT v1.0 Capstone Demo — Barangay San Joaquin, Basco, Batanes*
