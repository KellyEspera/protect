# PROTECT System — Data Privacy & Security Review
**Compliance with RA 10173 (Data Privacy Act of 2012)**
Barangay San Joaquin · Basco, Batanes

---

## Overview

The PROTECT system handles **personally identifiable information (PII)** of barangay residents including names, dates of birth, contact numbers, income, health status (PWD, Senior Citizen), and family composition. This document outlines every technical and organizational measure in place to protect that data.

---

## 1. Authentication — Who Can Enter the System

**Implementation:** `src/store/authStore.js` → `supabase.auth.signInWithPassword()`

- All access requires a valid **email + password login** via Supabase Auth
- Passwords are **hashed using bcrypt** by Supabase — they are never stored in plain text, never sent to our servers, and are never accessible even to the admin
- Failed logins are rate-limited by Supabase Auth automatically
- **JWT tokens** are issued on login with an expiry; `onAuthStateChange` in `App.jsx` listens for token expiry and logs the user out automatically
- There is **no guest access** to resident data — anonymous users cannot read or write any table

**RA 10173 mapping:** Satisfies the requirement for *"reasonable and appropriate organizational, physical, and technical measures"* to protect personal data (Sec. 20).

---

## 2. Authorization — What Each Role Can Do

**Implementation:** `src/lib/permissions.js` + `RoleRoute` in `src/App.jsx`

The system uses **Role-Based Access Control (RBAC)** with 2 defined roles:

| Role | Access Level |
|------|-------------|
| `brgy_sec` | Full access to all pages and data — Barangay Secretary (the admin) |
| `tanod` | Limited — Dashboard, Crime Hotspot Map, Crime & Incident only |
| *(unassigned)* | A new account has no role until an admin assigns one — no access beyond the Dashboard |

- **Enforced in two layers.** The frontend wraps each route in a `<RoleRoute>` that checks `canAccess(role, path)` (UX), and the **database enforces the same rules with per-role Row-Level Security** (`rls_policies.sql`) — so the restriction holds even if the React app is bypassed.
- Unauthorized access shows "Access Restricted 🚫" — no data leaks
- Roles are stored in the `profiles` table in Supabase, not in the client — they cannot be spoofed by manipulating localStorage or cookies

**RA 10173 mapping:** Principle of *"proportionality"* — users only access data necessary for their function (Sec. 11c).

---

## 3. Row Level Security (RLS) — Database-Level Protection

**Implementation:** `rls_policies.sql` (per-role policies on every table)

All data tables have RLS enabled at the PostgreSQL level, with **per-role** policies — so the
database enforces *who can do what*, not just *who is logged in*:

```
profiles, residents, households, incidents, beneficiaries,
assistance_programs, qr_verifications, survey_responses,
announcements, disaster_risk_zones, population_history, audit_logs
```

**What this means:** Even if an API key were leaked or a request were crafted manually, the
PostgreSQL database itself enforces that:
- **Reads** are limited to authenticated **staff** (Barangay Secretary or Tanod) — an unassigned or anonymous caller gets nothing
- **Writes** are limited to the **Barangay Secretary** on every table; the **Tanod** can write only `incidents`
- A helper function `user_role()` (SECURITY DEFINER) supplies the caller's role to each policy without causing recursive-policy errors
- The `audit_logs` table is readable only by the Secretary, and is written only by the DB trigger — no one can insert directly
- The `announcements` table allows public read of **active announcements only**, and `survey_responses` allows public **insert only** — no other data is ever publicly exposed

**RA 10173 mapping:** Satisfies *"technical security measures"* — access cannot be bypassed at the application layer because the database itself enforces the rules (Sec. 20b).

---

## 4. Input Sanitization — XSS Prevention

**Implementation:** `src/lib/sanitize.js`

Every form submission in the Residents module passes through `sanitizeResidentForm()` before being sent to Supabase. This function:

| Function | What it prevents |
|----------|-----------------|
| `sanitizeString()` | Strips `<`, `>`, `&`, `"`, `'`, `/` — prevents HTML/script injection (XSS) |
| `sanitizeContactNumber()` | Validates Philippine mobile format (09XXXXXXXXX or +639XXXXXXXXX) — rejects garbage input |
| `sanitizeIncome()` | Ensures non-negative number — prevents type coercion attacks |
| `sanitizeDateOfBirth()` | Rejects future dates and years before 1900 — prevents invalid records |

The incident form uses `sanitizeIncidentForm()` and the survey form uses `sanitizeSurveyForm()` — all free-text user inputs are sanitized before storage.

**RA 10173 mapping:** Protects **data integrity** — stored data cannot be corrupted or weaponized by malicious input (Sec. 20).

---

## 5. Encryption in Transit

**Implementation:** Supabase-managed (automatic)

- All communication between the React app and Supabase uses **HTTPS with TLS 1.2/1.3**
- The Supabase JavaScript client (`@supabase/supabase-js`) enforces HTTPS — HTTP requests are rejected
- API keys (`VITE_SUPABASE_ANON_KEY`) are **anonymous-tier keys** — they can only do what RLS policies allow, nothing more
- The service role key (full admin access) is **never exposed to the frontend** — it exists only in Supabase's server environment

**RA 10173 mapping:** Data is protected *"during transmission"* via industry-standard encryption (Sec. 20b).

---

## 6. Encryption at Rest

**Implementation:** Supabase-managed (automatic)

- Supabase (hosted on AWS) encrypts all PostgreSQL data at rest using **AES-256**
- Uploaded files in Supabase Storage (incident photos) are also encrypted at rest
- Backup files downloaded by the admin are stored on the admin's local machine — the admin is responsible for keeping the `.json` backup in a secure location (documented in the app)

**RA 10173 mapping:** Personal data is encrypted at rest per *"reasonable and appropriate technical measures"* (Sec. 20b).

---

## 6a. Hashed QR Payload — no PII in the QR code

**Implementation:** `QRVerification.jsx` (SHA-256 via the Web Crypto API)

A resident's QR code does **not** contain their name, sitio, or any readable
personal information. Instead it carries only a **SHA-256 hash** of the resident
number (a 64-character hex fingerprint). When scanned with any generic QR app it
reveals nothing about the person; only the PROTECT system can match the hash back
to a resident (by hashing each resident number and comparing).

- **Goal:** prevent casual PII exposure if a resident's QR/ID is seen or scanned
  by an outsider.
- **Honest scope:** SHA-256 is a one-way *hash*, not a digital *signature*. It
  protects against reading the PII, not against a determined attacker forging a
  code. Server-side signing (HMAC) is noted as future work.

**RA 10173 mapping:** Data minimization and *"appropriate technical measures"* —
the QR exposes no personal data by default.

---

## 7. Audit Trail — Accountability

**Implementation:** `audit_logs.sql` + Activity Log in System & Audit (Admin)

The system records every INSERT, UPDATE, and DELETE on the three most sensitive tables:

- `residents` — any addition, edit, or removal of a person's profile
- `households` — household record changes
- `incidents` — crime/incident record changes

Each log entry captures:
- **Who** did it (`changed_by` — linked to the authenticated user)
- **What** happened (`INSERT`, `UPDATE`, `DELETE`)
- **Which record** was affected (`record_id`)
- **Before and after** data (`old_data`, `new_data` as JSONB)
- **When** (`changed_at` timestamp)

This audit trail satisfies RA 10173's requirement for **accountability** — if data is wrongfully modified or deleted, the action is traceable to a specific user.

**RA 10173 mapping:** Supports the *"accountability principle"* — the Personal Information Controller can demonstrate compliance and investigate incidents (Sec. 11f, Sec. 20d).

---

## 8. Public Data Separation

The system deliberately separates **public-facing features** from **private resident data**:

| Feature | Authentication Required | Data Exposed |
|---------|------------------------|-------------|
| Resident Profiling | ✅ Yes | Full PII |
| QR Verification | ✅ Yes | Profile lookup |
| DILG Reports | ✅ Yes | Aggregated only |
| Needs Assessment Form | ❌ No | Survey responses only (no PII) |
| Public Announcements | ❌ No | Announcement text only |

**No resident PII is ever accessible without login.** The public survey form collects only `purok` and `priority_need` — no name, no contact number, no ID.

**RA 10173 mapping:** Principle of *"proportionality"* — only minimum necessary data is collected via public forms (Sec. 11c).

---

## 9. Data Minimization in Collection

The system only collects resident data that serves a clear barangay function:

| Data Field | Purpose |
|-----------|---------|
| Name, DOB, Sex, Civil Status | Basic demographic profiling |
| Sitio / Purok | Geographic analysis, GIS mapping |
| Monthly Income | Poverty incidence calculation |
| Occupation | Workforce/employment analysis |
| Contact Number | Emergency communications |
| Is Senior Citizen / PWD / Solo Parent | Targeted assistance programs |
| Is OSY | Youth intervention programs |
| Is Voter | Electoral preparation |

No data is collected beyond what is needed for barangay governance and social services.

**RA 10173 mapping:** *"Proportionality principle"* — data collected is adequate, relevant, and not excessive (Sec. 11c).

---

## 10. Session & Token Security

- Login sessions are managed entirely by **Supabase Auth** — no custom session cookies
- The frontend stores the auth token in **memory only** (Zustand store) — not in `localStorage` or `sessionStorage`
- `localStorage` in the app only stores **non-sensitive metadata**: last backup date and backup record counts — never actual resident records
- On logout (`supabase.auth.signOut()`), the token is invalidated server-side

---

## Summary Table — RA 10173 Compliance

| RA 10173 Requirement | Implementation in PROTECT |
|---------------------|--------------------------|
| Sec. 11a — Transparency | Login page identifies the system and its purpose |
| Sec. 11b — Legitimate Purpose | Data collected only for barangay governance functions |
| Sec. 11c — Proportionality | Minimum data collected; RBAC limits access to what each role needs |
| Sec. 11f — Accountability | Audit log traces every data change to the responsible user |
| Sec. 20a — Organizational measures | RBAC with 5 defined roles enforced at both UI and DB level |
| Sec. 20b — Technical measures | TLS in transit, AES-256 at rest, RLS at DB level, XSS sanitization |
| Sec. 20c — Physical measures | Data hosted on Supabase/AWS with enterprise-grade physical security |
| Sec. 20d — Breach detection | Audit log provides full activity history for incident investigation |

---

## Panel Defense — Quick Answers

**Q: How do you prevent unauthorized access to resident data?**
> The system uses Supabase Row Level Security with **per-role policies** — even if someone had the API key and bypassed the app, the database itself only lets staff read, only the Barangay Secretary write most tables, and the Tanod write only incident records. RBAC at the UI level restricts pages by role on top of that.

**Q: Are passwords stored securely?**
> Passwords are never stored in our database. Supabase Auth handles authentication and stores only bcrypt hashes — we never see the actual password.

**Q: What happens if someone tries to inject malicious code?**
> All text inputs pass through `sanitize.js` which strips HTML tags and escapes special characters before saving to the database. This prevents XSS and script injection.

**Q: Is the data encrypted?**
> Yes — in transit via HTTPS/TLS 1.2+, and at rest via AES-256 managed by Supabase (hosted on AWS). Uploaded photos in Supabase Storage are also encrypted at rest. On top of that, sensitive PII (the contact number) is **masked in the resident profile view** — it shows as `•••••••1234` until a user explicitly clicks "Reveal PII", so it isn't exposed at a glance over someone's shoulder.

**Q: How do you comply with RA 10173?**
> Through three layers: organizational (role-based access control), technical (encryption, RLS, input sanitization, audit logging), and data minimization (only collecting what's needed for barangay governance).

**Q: How would you know if data was tampered with?**
> The audit log records every insert, update, and delete with the timestamp and the user who made the change. Any unauthorized modification is immediately traceable.

---

*PROTECT System v1.0 — Capstone Project · BSIT / BSCS · 2026*
