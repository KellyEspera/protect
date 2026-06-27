-- ============================================================================
--  PROTECT SYSTEM — COMPLETE DATABASE SETUP  (Barangay San Joaquin, Basco)
-- ----------------------------------------------------------------------------
--  Run this ONE file in Supabase  →  SQL Editor  →  New query  →  Run.
--  It is safe to run on a fresh database AND safe to re-run (idempotent).
--
--  PREREQUISITE: the base schema must already exist (schema.sql / the tables
--  Supabase created for residents, households, incidents, profiles, etc.).
--  This file then adds every migration, role, policy, bucket and the demo data.
--
--  Sections, in run order:
--    PART 1  Roles, auto-profile trigger, and profile security (RLS)
--    PART 2  Schema additions (columns, new tables, constraints)
--    PART 3  Storage buckets for photos
--    PART 4  Demo data (households, residents, incidents w/ map pins, etc.)
--    PART 5  Post-seed touch-ups (4-digit HH numbers, sector flags)
--
--  Optional extra (NOT included on purpose): distribute_crime_types.sql
--  randomly re-shuffles incident types. The demo data below already has
--  realistic, matching types, so you do NOT need it.
-- ============================================================================


-- ############################################################################
-- ## PART 1 — ROLES & PROFILE SECURITY
-- ############################################################################

-- ============================================================
-- PROTECT — Role Setup (RUN ONCE in Supabase → SQL Editor)
-- After this, manage every user from the app's User Management page.
-- ============================================================

-- 1. Allow all 6 roles in the profiles table
-- ------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'officer', 'brgy_sec', 'tanod', 'dilg_rep', 'viewer'));


-- 2. Auto-create a profile row whenever a user is added in Auth
--    (the trigger was missing — this is why new users had no role)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- 3. Set roles for the two users you already created
--    (looks them up by email — no UID needed)
-- ------------------------------------------------------------
INSERT INTO profiles (id, full_name, role)
SELECT id, 'Barangay Secretary', 'brgy_sec'
FROM auth.users WHERE email = 'protectsystembrgysec@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'brgy_sec', full_name = 'Barangay Secretary';

INSERT INTO profiles (id, full_name, role)
SELECT id, 'Barangay Tanod', 'tanod'
FROM auth.users WHERE email = 'protectsystemtanod@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'tanod', full_name = 'Barangay Tanod';


-- 4. Verify — this should show both users with the correct role
-- ------------------------------------------------------------
SELECT u.email, p.full_name, p.role
FROM profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.role;


-- ============================================================
-- PROTECT — Fix profiles RLS (RUN ONCE in Supabase → SQL Editor)
-- Removes the recursive policy that made every user show as "Viewer".
-- ============================================================

-- 1. Drop ALL existing policies on profiles (clears the broken recursive one)
DROP POLICY IF EXISTS "Allow users to read own profile"     ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profile"   ON profiles;
DROP POLICY IF EXISTS "Users can view own profile"          ON profiles;
DROP POLICY IF EXISTS "Managers can view all profiles"      ON profiles;
DROP POLICY IF EXISTS "Managers can update profiles"        ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile"        ON profiles;
DROP POLICY IF EXISTS "authenticated read profiles"         ON profiles;
DROP POLICY IF EXISTS "authenticated update profiles"       ON profiles;
DROP POLICY IF EXISTS "authenticated insert profiles"       ON profiles;

-- 2. Simple, NON-recursive policies
--    Any logged-in user can read profiles (needed for login role + User Mgmt list)
CREATE POLICY "authenticated read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

--    Logged-in users can update profiles (lets admins change roles from the app)
CREATE POLICY "authenticated update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (true);

--    Allow inserts (used by the auto-profile trigger / app)
CREATE POLICY "authenticated insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Verify policies are clean
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';


-- ############################################################################
-- ## PART 2 — SCHEMA ADDITIONS (columns, tables, constraints)
-- ############################################################################

-- ---- Out-of-School Youth field ----
-- ============================================================
-- Run in Supabase SQL Editor
-- Adds Out-of-School Youth field to residents table
-- ============================================================

ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS is_out_of_school_youth BOOLEAN DEFAULT FALSE;

-- ---- Crime/incident types (Batanes set) — must run before the demo incidents ----
-- ============================================================
-- Run in Supabase SQL Editor
-- Replaces the incident_type list with the Batanes / San Joaquin set
-- ============================================================

-- 1. Re-label any existing incidents that use an old type, so the new
--    constraint applies without errors. Old types become 'Others'.
UPDATE incidents
SET incident_type = 'Others'
WHERE incident_type NOT IN (
  'Public Intoxication / Disorderly Conduct',
  'Minor Physical Altercation',
  'Domestic Dispute',
  'Property Damage (Typhoon-related)',
  'Environmental / Ordinance Violation',
  'Stray Animal Complaint',
  'Noise Disturbance',
  'Others'
);

-- 2. Apply the new constraint
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_incident_type_check;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_incident_type_check
  CHECK (incident_type IN (
    'Public Intoxication / Disorderly Conduct',
    'Minor Physical Altercation',
    'Domestic Dispute',
    'Property Damage (Typhoon-related)',
    'Environmental / Ordinance Violation',
    'Stray Animal Complaint',
    'Noise Disturbance',
    'Others'
  ));

-- ---- Announcements table ----
-- ============================================================
-- PROTECT System — Community Announcements
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'General' CHECK (category IN ('General','Health','Safety','Event','Disaster','Others')),
  posted_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage announcements
DO $$ BEGIN
  CREATE POLICY "announcements_all_auth" ON announcements
    FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public can read active announcements (no login needed)
DO $$ BEGIN
  CREATE POLICY "announcements_public_read" ON announcements
    FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Audit log table + triggers ----
-- ============================================================
-- PROTECT System — Audit Log Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create the audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name  TEXT        NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  changed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index for fast DESC fetch by time
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs (changed_at DESC);

-- 3. Row Level Security — only authenticated users can read; no direct inserts (trigger only)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "audit_logs_select" ON audit_logs
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Trigger function — runs as DB owner (SECURITY DEFINER) so it bypasses RLS
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Extract the logged-in user's ID from the Supabase JWT claims
  BEGIN
    v_user_id := (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  INSERT INTO audit_logs (table_name, action, record_id, old_data, new_data, changed_by)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_user_id
  );

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- 5. Attach triggers (drop first to avoid duplicates on re-run)
DROP TRIGGER IF EXISTS trg_audit_residents  ON residents;
DROP TRIGGER IF EXISTS trg_audit_households ON households;
DROP TRIGGER IF EXISTS trg_audit_incidents  ON incidents;

CREATE TRIGGER trg_audit_residents
  AFTER INSERT OR UPDATE OR DELETE ON residents
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_households
  AFTER INSERT OR UPDATE OR DELETE ON households
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_incidents
  AFTER INSERT OR UPDATE OR DELETE ON incidents
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- ---- Population history table + historical figures ----
-- Population history table for Barangay San Joaquin, Basco, Batanes
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS population_history (
  id              uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  year            integer NOT NULL UNIQUE,
  total_population integer NOT NULL,
  male_count      integer,
  female_count    integer,
  household_count integer,
  birth_count     integer,
  death_count     integer,
  migration_in    integer,
  migration_out   integer,
  source          text,
  created_at      timestamptz DEFAULT now()
);

-- Enable RLS and allow read access
ALTER TABLE population_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "population_history_read"  ON population_history;
DROP POLICY IF EXISTS "population_history_admin" ON population_history;
CREATE POLICY "population_history_read" ON population_history FOR SELECT USING (true);
CREATE POLICY "population_history_admin" ON population_history FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'officer'))
);

-- Historical seed data — Barangay San Joaquin, Basco, Batanes
INSERT INTO population_history
  (year, total_population, male_count, female_count, household_count, birth_count, death_count, migration_in, migration_out, source)
VALUES
  (2013, 231, 118, 113, 53, 6,  2, 4, 3, 'Barangay Health Center Records'),
  (2014, 242, 123, 119, 56, 8,  1, 5, 1, 'Barangay Health Center Records'),
  (2015, 256, 130, 126, 59, 9,  2, 6, 1, 'NSO Community Census'),
  (2016, 269, 137, 132, 63, 10, 1, 4, 0, 'Barangay Survey'),
  (2017, 283, 144, 139, 66, 11, 2, 5, 0, 'Barangay Survey'),
  (2018, 298, 152, 146, 70, 12, 1, 4, 0, 'Barangay Survey'),
  (2019, 311, 158, 153, 73, 10, 2, 5, 0, 'Barangay Survey'),
  (2020, 318, 162, 156, 75, 8,  3, 4, 2, 'PSA Census 2020'),
  (2021, 326, 166, 160, 77, 9,  1, 3, 3, 'Barangay Survey'),
  (2022, 339, 173, 166, 80, 11, 2, 5, 1, 'Barangay Survey'),
  (2023, 352, 179, 173, 83, 12, 1, 4, 2, 'Barangay Survey'),
  (2024, 367, 187, 180, 87, 13, 2, 5, 1, 'Barangay Survey'),
  (2025, 381, 194, 187, 90, 12, 1, 4, 1, 'Current Year Estimate')
ON CONFLICT (year) DO NOTHING;


-- ############################################################################
-- ## PART 3 — STORAGE BUCKETS (photos)
-- ############################################################################

-- ---- Incident photos (adds incidents.photo_url + bucket) ----
-- ============================================================
-- PROTECT System — Incident Photo Storage Setup
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add photo_url column to incidents table
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Create the storage bucket (public so thumbnails load without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-photos', 'incident-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies
DO $$ BEGIN
  CREATE POLICY "incident_photos_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'incident-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "incident_photos_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'incident-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "incident_photos_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'incident-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Announcement photos (adds announcements.image_url + bucket) ----
-- ============================================================
-- PROTECT System — Announcement Image Support
-- Run this in your Supabase SQL Editor (one time)
-- ============================================================

-- 1. Add image_url column to announcements
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create the storage bucket (public so images load without login)
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-photos', 'announcement-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies
DO $$ BEGIN
  CREATE POLICY "announcement_photos_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'announcement-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "announcement_photos_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'announcement-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "announcement_photos_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'announcement-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ############################################################################
-- ## PART 4 — DEMO DATA (households, residents, incidents, survey, hazards)
-- ############################################################################

-- ============================================================
-- PROTECT System — Sample Data Seed Script
-- Run this in your Supabase SQL Editor
-- Safe to re-run: uses ON CONFLICT DO NOTHING where applicable
-- Delete this data anytime via the app or DELETE statements
-- ============================================================

-- ============================================================
-- DISASTER RISK ZONES TABLE (create if not yet exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS disaster_risk_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hazard_type TEXT NOT NULL CHECK (hazard_type IN ('Typhoon','Flood','Landslide','Storm Surge','Earthquake','Fire')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('High','Medium','Low')),
  purok TEXT NOT NULL,
  description TEXT,
  radius NUMERIC DEFAULT 100,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE disaster_risk_zones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow read for authenticated" ON disaster_risk_zones
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow write for authenticated" ON disaster_risk_zones
    FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- ADDITIONAL HOUSEHOLDS (HH-006 to HH-020)
-- ============================================================
INSERT INTO households (household_no, purok, address, latitude, longitude, housing_type, water_source, electricity) VALUES
  ('HH-006', 'Sitio Hunan', 'Purok 1-A, Sitio Hunan',  20.4493, 121.9687, 'Concrete',     'Level III', true),
  ('HH-007', 'Sitio Hunan', 'Purok 2-A, Sitio Hunan',  20.4497, 121.9691, 'Semi-concrete', 'Level II',  true),
  ('HH-008', 'Sitio Hunan', 'Purok 3-A, Sitio Hunan',  20.4500, 121.9694, 'Concrete',     'Level III', true),
  ('HH-009', 'Sitio Hunan', 'Purok 4-A, Sitio Hunan',  20.4503, 121.9697, 'Wood',         'Level I',   false),
  ('HH-010', 'Sitio Hunan', 'Purok 5-A, Sitio Hunan',  20.4507, 121.9701, 'Semi-concrete', 'Level II',  true),
  ('HH-011', 'Sitio Hagu',  'Purok 1-A, Sitio Hagu',   20.4477, 121.9683, 'Concrete',     'Level III', true),
  ('HH-012', 'Sitio Hagu',  'Purok 2-A, Sitio Hagu',   20.4481, 121.9684, 'Concrete',     'Level III', true),
  ('HH-013', 'Sitio Hagu',  'Purok 3-A, Sitio Hagu',   20.4471, 121.9677, 'Semi-concrete', 'Level II',  true),
  ('HH-014', 'Sitio Hagu',  'Purok 4-A, Sitio Hagu',   20.4467, 121.9674, 'Wood',         'Level I',   true),
  ('HH-015', 'Sitio Hagu',  'Purok 5-A, Sitio Hagu',   20.4464, 121.9671, 'Makeshift',    'Level I',   false),
  ('HH-016', 'Sitio Tuva',  'Purok 1-A, Sitio Tuva',   20.4459, 121.9709, 'Concrete',     'Level III', true),
  ('HH-017', 'Sitio Tuva',  'Purok 2-A, Sitio Tuva',   20.4456, 121.9713, 'Semi-concrete', 'Level II',  true),
  ('HH-018', 'Sitio Tuva',  'Purok 3-A, Sitio Tuva',   20.4454, 121.9716, 'Wood',         'Level I',   true),
  ('HH-019', 'Sitio Tuva',  'Purok 4-A, Sitio Tuva',   20.4451, 121.9719, 'Concrete',     'Level III', true),
  ('HH-020', 'Sitio Tuva',  'Purok 5-A, Sitio Tuva',   20.4447, 121.9721, 'Makeshift',    'Level I',   false)
ON CONFLICT (household_no) DO NOTHING;

-- ============================================================
-- RESIDENTS (60 records)
-- ============================================================
INSERT INTO residents (
  resident_no, household_id,
  first_name, last_name, middle_name,
  date_of_birth, sex, civil_status, purok,
  is_household_head, is_voter,
  is_pwd, pwd_type, is_solo_parent, is_senior_citizen,
  monthly_income, occupation, educational_attainment, contact_number
) VALUES

-- HH-001 Sitio Hunan (Concrete)
('RES-001',(SELECT id FROM households WHERE household_no='HH-001'),
 'Ramon','Gaje','Santos','1972-03-15','Male','Married','Sitio Hunan',
 true,true,false,NULL,false,false,15000,'Fisherman','High School Graduate','09171234501'),

('RES-002',(SELECT id FROM households WHERE household_no='HH-001'),
 'Lourdes','Gaje','Reyes','1975-07-22','Female','Married','Sitio Hunan',
 false,true,false,NULL,false,false,8000,'Housewife','Elementary Graduate','09171234502'),

('RES-003',(SELECT id FROM households WHERE household_no='HH-001'),
 'Mark Anthony','Gaje','Santos','2003-11-10','Male','Single','Sitio Hunan',
 false,true,false,NULL,false,false,5000,'Student','College Level',NULL),

('RES-004',(SELECT id FROM households WHERE household_no='HH-001'),
 'Kristine','Gaje','Santos','2008-05-18','Female','Single','Sitio Hunan',
 false,true,false,NULL,false,false,0,'Student','High School Level',NULL),

-- HH-002 Sitio Hagu (Concrete)
('RES-005',(SELECT id FROM households WHERE household_no='HH-002'),
 'Pedro','Narag','Ismaquel','1958-09-12','Male','Married','Sitio Hagu',
 true,true,false,NULL,false,true,5000,'Farmer','Elementary Graduate','09181234501'),

('RES-006',(SELECT id FROM households WHERE household_no='HH-002'),
 'Felicitas','Narag','Cruz','1960-04-25','Female','Married','Sitio Hagu',
 false,true,false,NULL,false,true,0,'Housewife','Elementary Graduate','09181234502'),

('RES-007',(SELECT id FROM households WHERE household_no='HH-002'),
 'Danilo','Narag','Ismaquel','1988-08-30','Male','Married','Sitio Hagu',
 false,true,false,NULL,false,false,12000,'Tricycle Driver','High School Graduate','09181234503'),

-- HH-003 Sitio Tuva (Semi-concrete)
('RES-008',(SELECT id FROM households WHERE household_no='HH-003'),
 'Antonio','Pilarte','Bautista','1965-12-05','Male','Married','Sitio Tuva',
 true,true,false,NULL,false,false,18000,'Government Employee','College Graduate','09191234501'),

('RES-009',(SELECT id FROM households WHERE household_no='HH-003'),
 'Maribel','Pilarte','Flores','1968-06-18','Female','Married','Sitio Tuva',
 false,true,false,NULL,false,false,6000,'Sari-sari Store Owner','High School Graduate','09191234502'),

('RES-010',(SELECT id FROM households WHERE household_no='HH-003'),
 'Ana Marie','Pilarte','Bautista','1995-02-14','Female','Single','Sitio Tuva',
 false,true,false,NULL,false,false,10000,'Teacher','College Graduate','09191234503'),

-- HH-004 Sitio Hunan (Concrete)
('RES-011',(SELECT id FROM households WHERE household_no='HH-004'),
 'Roberto','Sacayan','Vitug','1980-07-08','Male','Married','Sitio Hunan',
 true,true,false,NULL,false,false,22000,'Barangay Official','College Graduate','09201234501'),

('RES-012',(SELECT id FROM households WHERE household_no='HH-004'),
 'Cristina','Sacayan','Palconit','1983-11-20','Female','Married','Sitio Hunan',
 false,true,false,NULL,false,false,9000,'Dressmaker','High School Graduate','09201234502'),

('RES-013',(SELECT id FROM households WHERE household_no='HH-004'),
 'Jose Miguel','Sacayan','Vitug','2010-03-25','Male','Single','Sitio Hunan',
 false,false,false,NULL,false,false,0,'Student','Elementary Level',NULL),

('RES-014',(SELECT id FROM households WHERE household_no='HH-004'),
 'Maria Sofia','Sacayan','Vitug','2012-09-14','Female','Single','Sitio Hunan',
 false,false,false,NULL,false,false,0,'Student','Elementary Level',NULL),

-- HH-005 Sitio Hagu (Wood)
('RES-015',(SELECT id FROM households WHERE household_no='HH-005'),
 'Erlinda','Pagutayao','Sabado','1970-01-30','Female','Widowed','Sitio Hagu',
 true,true,false,NULL,true,false,4500,'Vendor','Elementary Graduate','09211234501'),

('RES-016',(SELECT id FROM households WHERE household_no='HH-005'),
 'Emmanuel','Pagutayao','Sabado','1999-06-12','Male','Single','Sitio Hagu',
 false,true,false,NULL,false,false,0,'Unemployed','High School Graduate','09211234502'),

-- HH-006 Sitio Hunan (Concrete)
('RES-017',(SELECT id FROM households WHERE household_no='HH-006'),
 'Fernando','Chua','Garcia','1978-04-22','Male','Married','Sitio Hunan',
 true,true,false,NULL,false,false,25000,'Engineer','College Graduate','09221234501'),

('RES-018',(SELECT id FROM households WHERE household_no='HH-006'),
 'Teresita','Chua','Torres','1980-09-15','Female','Married','Sitio Hunan',
 false,true,false,NULL,false,false,12000,'Nurse','College Graduate','09221234502'),

('RES-019',(SELECT id FROM households WHERE household_no='HH-006'),
 'Carlos','Chua','Garcia','2006-12-03','Male','Single','Sitio Hunan',
 false,true,false,NULL,false,false,0,'Student','High School Level',NULL),

-- HH-007 Sitio Hunan (Semi-concrete)
('RES-020',(SELECT id FROM households WHERE household_no='HH-007'),
 'Alfredo','Perona','Morales','1955-08-17','Male','Married','Sitio Hunan',
 true,true,false,NULL,false,true,3500,'Retired','High School Graduate','09231234501'),

('RES-021',(SELECT id FROM households WHERE household_no='HH-007'),
 'Nora','Perona','Valdez','1958-02-28','Female','Married','Sitio Hunan',
 false,true,false,NULL,false,true,0,'Housewife','Elementary Graduate','09231234502'),

-- HH-008 Sitio Hunan (Concrete)
('RES-022',(SELECT id FROM households WHERE household_no='HH-008'),
 'Eduardo','Sabado','Pascua','1990-05-10','Male','Married','Sitio Hunan',
 true,true,false,NULL,false,false,16000,'Construction Worker','High School Graduate','09241234501'),

('RES-023',(SELECT id FROM households WHERE household_no='HH-008'),
 'Gloria','Sabado','Salanio','1992-11-05','Female','Married','Sitio Hunan',
 false,true,false,NULL,false,false,7000,'Laundrywoman','High School Graduate','09241234502'),

('RES-024',(SELECT id FROM households WHERE household_no='HH-008'),
 'Leo','Sabado','Pascua','2015-07-19','Male','Single','Sitio Hunan',
 false,false,false,NULL,false,false,0,'Student','Elementary Level',NULL),

-- HH-009 Sitio Hunan (Wood)
('RES-025',(SELECT id FROM households WHERE household_no='HH-009'),
 'Renato','Ismaquel','Narag','1968-10-08','Male','Married','Sitio Hunan',
 true,true,true,'Physical Disability',false,false,6000,'Fisherman','Elementary Graduate','09251234501'),

('RES-026',(SELECT id FROM households WHERE household_no='HH-009'),
 'Remedios','Ismaquel','Gaje','1970-03-21','Female','Married','Sitio Hunan',
 false,true,false,NULL,false,false,3000,'Housewife','Elementary Graduate','09251234502'),

-- HH-010 Sitio Hunan (Semi-concrete)
('RES-027',(SELECT id FROM households WHERE household_no='HH-010'),
 'Mariano','Vitug','Pilarte','1985-01-14','Male','Separated','Sitio Hunan',
 true,true,false,NULL,false,false,9500,'Carpenter','High School Graduate','09261234501'),

-- HH-011 Sitio Hagu (Concrete)
('RES-028',(SELECT id FROM households WHERE household_no='HH-011'),
 'Cesar','Santos','Pagutayao','1975-06-30','Male','Married','Sitio Hagu',
 true,true,false,NULL,false,false,20000,'Teacher','College Graduate','09271234501'),

('RES-029',(SELECT id FROM households WHERE household_no='HH-011'),
 'Carmen','Santos','Perona','1978-12-10','Female','Married','Sitio Hagu',
 false,true,false,NULL,false,false,8000,'Sari-sari Store Owner','High School Graduate','09271234502'),

('RES-030',(SELECT id FROM households WHERE household_no='HH-011'),
 'Rhea','Santos','Pagutayao','2001-04-05','Female','Single','Sitio Hagu',
 false,true,false,NULL,false,false,6000,'Helper','High School Graduate',NULL),

-- HH-012 Sitio Hagu (Concrete)
('RES-031',(SELECT id FROM households WHERE household_no='HH-012'),
 'Ricardo','Ramirez','Chua','1982-08-25','Male','Married','Sitio Hagu',
 true,true,false,NULL,false,false,30000,'OFW (on leave)','College Graduate','09281234501'),

('RES-032',(SELECT id FROM households WHERE household_no='HH-012'),
 'Leonora','Ramirez','Sabado','1984-02-18','Female','Married','Sitio Hagu',
 false,true,false,NULL,false,false,0,'Housewife','High School Graduate','09281234502'),

('RES-033',(SELECT id FROM households WHERE household_no='HH-012'),
 'Ricardo Jr.','Ramirez','Chua','2009-10-12','Male','Single','Sitio Hagu',
 false,false,false,NULL,false,false,0,'Student','Elementary Level',NULL),

-- HH-013 Sitio Hagu (Semi-concrete)
('RES-034',(SELECT id FROM households WHERE household_no='HH-013'),
 'Virgilio','Flores','Fernandez','1960-11-18','Male','Married','Sitio Hagu',
 true,true,false,NULL,false,true,7000,'Farmer','Elementary Graduate','09291234501'),

('RES-035',(SELECT id FROM households WHERE household_no='HH-013'),
 'Resurreccion','Flores','Torres','1963-05-08','Female','Married','Sitio Hagu',
 false,true,false,NULL,false,true,0,'Housewife','Elementary Graduate',NULL),

('RES-036',(SELECT id FROM households WHERE household_no='HH-013'),
 'Jayson','Flores','Fernandez','1993-07-20','Male','Single','Sitio Hagu',
 false,true,false,NULL,false,false,9000,'Motorcycle Mechanic','High School Graduate','09291234503'),

-- HH-014 Sitio Hagu (Wood)
('RES-037',(SELECT id FROM households WHERE household_no='HH-014'),
 'Bernardo','Cruz','Reyes','1973-04-02','Male','Married','Sitio Hagu',
 true,true,true,'Visual Impairment',false,false,5000,'Fisherman','Elementary Graduate','09301234501'),

('RES-038',(SELECT id FROM households WHERE household_no='HH-014'),
 'Fe','Cruz','Morales','1975-09-16','Female','Married','Sitio Hagu',
 false,true,false,NULL,false,false,0,'Housewife','Elementary Graduate','09301234502'),

('RES-039',(SELECT id FROM households WHERE household_no='HH-014'),
 'Jhun','Cruz','Reyes','2017-03-08','Male','Single','Sitio Hagu',
 false,false,false,NULL,false,false,0,'Student','Elementary Level',NULL),

-- HH-015 Sitio Hagu (Makeshift)
('RES-040',(SELECT id FROM households WHERE household_no='HH-015'),
 'Domingo','Garcia','Valdez','1950-07-14','Male','Widowed','Sitio Hagu',
 true,true,true,'Physical Disability',false,true,2500,'Retired','Elementary Graduate','09311234501'),

-- HH-016 Sitio Tuva (Concrete)
('RES-041',(SELECT id FROM households WHERE household_no='HH-016'),
 'Miguel','Torres','Garcia','1987-03-19','Male','Married','Sitio Tuva',
 true,true,false,NULL,false,false,19000,'Police Officer','College Graduate','09321234501'),

('RES-042',(SELECT id FROM households WHERE household_no='HH-016'),
 'Corazon','Torres','Santos','1989-10-07','Female','Married','Sitio Tuva',
 false,true,false,NULL,false,false,10000,'Teacher','College Graduate','09321234502'),

('RES-043',(SELECT id FROM households WHERE household_no='HH-016'),
 'Nico','Torres','Garcia','2018-01-25','Male','Single','Sitio Tuva',
 false,false,false,NULL,false,false,0,'Student','Elementary Level',NULL),

-- HH-017 Sitio Tuva (Semi-concrete)
('RES-044',(SELECT id FROM households WHERE household_no='HH-017'),
 'Francisco','Bautista','Chua','1962-06-08','Male','Married','Sitio Tuva',
 true,true,false,NULL,false,true,5500,'Farmer','High School Graduate','09331234501'),

('RES-045',(SELECT id FROM households WHERE household_no='HH-017'),
 'Elvira','Bautista','Narag','1965-01-20','Female','Married','Sitio Tuva',
 false,true,false,NULL,false,true,3000,'Laundrywoman','Elementary Graduate','09331234502'),

('RES-046',(SELECT id FROM households WHERE household_no='HH-017'),
 'Benjamin','Bautista','Chua','1998-08-14','Male','Single','Sitio Tuva',
 false,true,false,NULL,false,false,7500,'Jeepney Driver','High School Graduate','09331234503'),

-- HH-018 Sitio Tuva (Wood)
('RES-047',(SELECT id FROM households WHERE household_no='HH-018'),
 'Norma','Palconit','Sacayan','1977-12-28','Female','Separated','Sitio Tuva',
 true,true,false,NULL,true,false,6000,'Vendor','High School Graduate','09341234501'),

('RES-048',(SELECT id FROM households WHERE household_no='HH-018'),
 'Sarah','Palconit','Sacayan','2004-05-30','Female','Single','Sitio Tuva',
 false,true,false,NULL,false,false,4500,'Helper','High School Graduate',NULL),

('RES-049',(SELECT id FROM households WHERE household_no='HH-018'),
 'Kevin','Palconit','Sacayan','2011-09-22','Male','Single','Sitio Tuva',
 false,false,false,NULL,false,false,0,'Student','Elementary Level',NULL),

-- HH-019 Sitio Tuva (Concrete)
('RES-050',(SELECT id FROM households WHERE household_no='HH-019'),
 'Alberto','Fernandez','Pilarte','1970-02-05','Male','Married','Sitio Tuva',
 true,true,false,NULL,false,false,14000,'Barangay Tanod','High School Graduate','09351234501'),

('RES-051',(SELECT id FROM households WHERE household_no='HH-019'),
 'Ester','Fernandez','Santos','1973-08-18','Female','Married','Sitio Tuva',
 false,true,false,NULL,false,false,5000,'Housewife','Elementary Graduate','09351234502'),

('RES-052',(SELECT id FROM households WHERE household_no='HH-019'),
 'Marie','Fernandez','Pilarte','2000-11-13','Female','Single','Sitio Tuva',
 false,true,false,NULL,false,false,8000,'Office Clerk','College Graduate','09351234503'),

-- HH-020 Sitio Tuva (Makeshift)
('RES-053',(SELECT id FROM households WHERE household_no='HH-020'),
 'Juan','Morales','Cruz','1945-04-18','Male','Widowed','Sitio Tuva',
 true,true,true,'Physical Disability',false,true,1500,'Retired','Elementary Graduate',NULL),

('RES-054',(SELECT id FROM households WHERE household_no='HH-020'),
 'Luz','Morales','Flores','1980-07-02','Female','Single','Sitio Tuva',
 false,true,false,NULL,true,false,4000,'Farmer','Elementary Graduate','09361234501'),

-- Boarders / No fixed household
('RES-055',NULL,'Benjamin','Salanio','Reyes','1995-09-10','Male','Single','Sitio Hunan',
 false,true,false,NULL,false,false,8500,'Carpenter','High School Graduate','09371234501'),

('RES-056',NULL,'Cora','Pascua','Ismaquel','1988-03-24','Female','Married','Sitio Hagu',
 false,true,false,NULL,false,false,6500,'Vendor','High School Graduate','09381234501'),

('RES-057',NULL,'Rolando','Valdez','Sacayan','2001-11-15','Male','Single','Sitio Tuva',
 false,true,false,NULL,false,false,5000,'Laborer','High School Graduate',NULL),

('RES-058',NULL,'Melinda','Santos','Torres','1957-06-05','Female','Widowed','Sitio Hagu',
 false,true,true,'Hearing Impairment',false,true,2000,'Retired','Elementary Graduate','09391234501'),

('RES-059',NULL,'Rodel','Reyes','Garcia','2005-04-28','Male','Single','Sitio Hunan',
 false,true,false,NULL,false,false,0,'Student','High School Level',NULL),

('RES-060',NULL,'Teresa','Bautista','Perona','1993-08-12','Female','Single','Sitio Tuva',
 false,true,false,NULL,false,false,9000,'Caregiver','College Level','09401234501')

ON CONFLICT (resident_no) DO NOTHING;

-- ============================================================
-- BENEFICIARIES
-- ============================================================
INSERT INTO beneficiaries (resident_id, program_id, status, enrolled_at, last_release_date, total_released, notes)
SELECT r.id, p.id, 'Active', '2022-01-15', '2025-12-15', 42000, 'Regular beneficiary'
FROM residents r, assistance_programs p
WHERE r.resident_no='RES-005' AND p.name='4Ps (Pantawid Pamilya)'
ON CONFLICT (resident_id, program_id) DO NOTHING;

INSERT INTO beneficiaries (resident_id, program_id, status, enrolled_at, last_release_date, total_released, notes)
SELECT r.id, p.id, 'Active', '2021-06-01', '2025-11-30', 36000, 'Household with minors'
FROM residents r, assistance_programs p
WHERE r.resident_no='RES-015' AND p.name='4Ps (Pantawid Pamilya)'
ON CONFLICT (resident_id, program_id) DO NOTHING;

INSERT INTO beneficiaries (resident_id, program_id, status, enrolled_at, last_release_date, total_released, notes)
SELECT r.id, p.id, 'Active', '2023-03-10', '2025-12-10', 21000, 'Solo parent beneficiary'
FROM residents r, assistance_programs p
WHERE r.resident_no='RES-047' AND p.name='4Ps (Pantawid Pamilya)'
ON CONFLICT (resident_id, program_id) DO NOTHING;

INSERT INTO beneficiaries (resident_id, program_id, status, enrolled_at, last_release_date, total_released, notes)
SELECT r.id, p.id, 'Active', '2023-07-20', '2025-12-20', 18000, 'Solo parent, low income'
FROM residents r, assistance_programs p
WHERE r.resident_no='RES-054' AND p.name='4Ps (Pantawid Pamilya)'
ON CONFLICT (resident_id, program_id) DO NOTHING;

INSERT INTO beneficiaries (resident_id, program_id, status, enrolled_at, last_release_date, total_released, notes)
SELECT r.id, p.id, 'Pending', '2025-08-01', NULL, 0, 'Newly endorsed'
FROM residents r, assistance_programs p
WHERE r.resident_no='RES-040' AND p.name='4Ps (Pantawid Pamilya)'
ON CONFLICT (resident_id, program_id) DO NOTHING;

-- Rice Subsidy
INSERT INTO beneficiaries (resident_id, program_id, status, enrolled_at, last_release_date, total_released, notes)
SELECT r.id, p.id, v.status::TEXT, v.enrolled::DATE, v.last_release::DATE, v.total, v.note
FROM (VALUES
  ('RES-005','2021-01-01','2025-12-01',7200,'Active','Monthly rice release'),
  ('RES-015','2021-01-01','2025-12-01',7200,'Active','Solo parent household'),
  ('RES-025','2022-04-01','2025-12-01',4800,'Active','PWD household'),
  ('RES-034','2020-09-01','2025-11-01',9600,'Active','Senior citizen farmer'),
  ('RES-037','2022-01-01','2025-12-01',5600,'Active','PWD, low income'),
  ('RES-040','2019-01-01','2025-12-01',16800,'Active','Senior, widowed, PWD'),
  ('RES-044','2021-06-01','2025-11-01',6000,'Active','Senior farmer'),
  ('RES-053','2018-01-01','2025-12-01',19200,'Active','Oldest resident'),
  ('RES-058','2023-02-01','2025-12-01',2400,'Active','Senior, hearing impaired')
) AS v(res_no, enrolled, last_release, total, status, note)
JOIN residents r ON r.resident_no = v.res_no
JOIN assistance_programs p ON p.name = 'Rice Subsidy'
ON CONFLICT (resident_id, program_id) DO NOTHING;

-- Medical Assistance
INSERT INTO beneficiaries (resident_id, program_id, status, enrolled_at, last_release_date, total_released, notes)
SELECT r.id, p.id, v.status::TEXT, v.enrolled::DATE, v.last_release::DATE, v.total, v.note
FROM (VALUES
  ('RES-025','2023-01-10','2025-10-15',15000,'Active','Physical disability, maintenance meds'),
  ('RES-037','2023-05-20','2025-09-20',12000,'Active','Visual impairment, eye check-ups'),
  ('RES-040','2020-01-01','2025-11-10',45000,'Active','Multiple conditions, regular hospital visits'),
  ('RES-053','2019-06-01','2025-12-01',60000,'Active','Elderly, chronic illness'),
  ('RES-058','2023-03-15','2025-08-15',8000,'Active','Hearing impairment device'),
  ('RES-020','2024-01-01','2025-06-01',5000,'Pending','Senior citizen, pending assessment'),
  ('RES-021','2024-02-01',NULL,0,'Pending','New application')
) AS v(res_no, enrolled, last_release, total, status, note)
JOIN residents r ON r.resident_no = v.res_no
JOIN assistance_programs p ON p.name = 'Medical Assistance'
ON CONFLICT (resident_id, program_id) DO NOTHING;

-- Educational Grant
INSERT INTO beneficiaries (resident_id, program_id, status, enrolled_at, last_release_date, total_released, notes)
SELECT r.id, p.id, v.status::TEXT, v.enrolled::DATE, v.last_release::DATE, v.total, v.note
FROM (VALUES
  ('RES-003','2022-06-01','2025-11-01',18000,'Active','College student'),
  ('RES-004','2023-06-01','2025-11-01',6000,'Active','High school student'),
  ('RES-019','2023-06-15','2025-11-01',6000,'Active','High school, low income'),
  ('RES-030','2024-01-10','2025-11-01',4000,'Active','College dropout, re-enrolling'),
  ('RES-048','2024-06-01',NULL,0,'Pending','Application under review')
) AS v(res_no, enrolled, last_release, total, status, note)
JOIN residents r ON r.resident_no = v.res_no
JOIN assistance_programs p ON p.name = 'Educational Grant'
ON CONFLICT (resident_id, program_id) DO NOTHING;

-- Livelihood Program
INSERT INTO beneficiaries (resident_id, program_id, status, enrolled_at, last_release_date, total_released, notes)
SELECT r.id, p.id, v.status::TEXT, v.enrolled::DATE, v.last_release::DATE, v.total, v.note
FROM (VALUES
  ('RES-016','2024-03-01','2025-09-01',10000,'Active','Skills training, unemployed youth'),
  ('RES-036','2023-08-01','2025-08-01',15000,'Active','Motorcycle repair livelihood kit'),
  ('RES-046','2024-01-15','2025-07-15',12000,'Active','Transport livelihood aid'),
  ('RES-057','2025-01-10',NULL,0,'Pending','Livelihood assessment pending'),
  ('RES-055','2023-11-01','2025-06-01',8000,'Completed','Carpentry tool grant completed')
) AS v(res_no, enrolled, last_release, total, status, note)
JOIN residents r ON r.resident_no = v.res_no
JOIN assistance_programs p ON p.name = 'Livelihood Program'
ON CONFLICT (resident_id, program_id) DO NOTHING;

-- ============================================================
-- INCIDENTS / CRIME RECORDS
-- ============================================================
-- Each incident carries a latitude/longitude near its sitio centre so it
-- drops an individual pin on the Crime Hotspot Map. Points are offset so
-- they scatter instead of stacking on the same spot.
--   Sitio Hunan ~ 20.44531, 121.98450
--   Sitio Tuva  ~ 20.44600, 121.99050
--   Sitio Hagu  ~ 20.44150, 121.98850
INSERT INTO incidents (case_no, incident_type, purok, complainant, respondent, description, incident_date, status, resolved_date, latitude, longitude) VALUES
('INC-2025-001','Noise Disturbance','Sitio Hunan','Ramon Gaje','Unknown neighbor',
 'Loud music and drinking past midnight near the creek area.',
 '2025-08-14 22:30:00+08','Resolved','2025-08-15', 20.4456000, 121.9841000),

('INC-2025-002','Domestic Dispute','Sitio Hagu','Erlinda Pagutayao','Emmanuel Pagutayao',
 'Complainant reported a heated family argument inside their residence; settled at the barangay.',
 '2025-09-02 19:45:00+08','Resolved','2025-09-05', 20.4418000, 121.9882000),

('INC-2025-003','Property Damage (Typhoon-related)','Sitio Tuva','Antonio Pilarte','No respondent',
 'GI roofing sheets torn off and construction materials scattered after a strong typhoon.',
 '2025-09-18 06:00:00+08','Escalated',NULL, 20.4463000, 121.9902000),

('INC-2025-004','Environmental / Ordinance Violation','Sitio Hunan','Roberto Sacayan','Mariano Vitug',
 'Open burning of household waste, violating the barangay sanitation ordinance.',
 '2025-10-05 14:00:00+08','Resolved','2025-10-12', 20.4450000, 121.9850000),

('INC-2025-005','Minor Physical Altercation','Sitio Hagu','Danilo Narag','Jayson Flores',
 'Scuffle during a basketball game resulting in minor injuries; both parties reconciled.',
 '2025-10-22 16:20:00+08','Resolved','2025-11-03', 20.4412000, 121.9889000),

('INC-2025-006','Noise Disturbance','Sitio Tuva','Corazon Torres','Unknown group',
 'Karaoke noise complaint from neighboring household until 2am.',
 '2025-11-01 23:00:00+08','Dismissed',NULL, 20.4458000, 121.9909000),

('INC-2025-007','Public Intoxication / Disorderly Conduct','Sitio Hagu','Anonymous','Unidentified person',
 'Intoxicated individual causing a disturbance and shouting near the river bank.',
 '2025-11-10 20:00:00+08','Escalated',NULL, 20.4420000, 121.9887000),

('INC-2025-008','Stray Animal Complaint','Sitio Tuva','Alberto Fernandez','No respondent',
 'Stray livestock wandering onto the road near Purok 4, posing a hazard to passersby.',
 '2025-11-20 08:30:00+08','Resolved','2025-11-20', 20.4465000, 121.9907000),

('INC-2025-009','Others','Sitio Hunan','Eduardo Sabado','Unknown suspect',
 'Fishing nets and equipment reported missing from the storage shed near the shore.',
 '2025-12-03 04:00:00+08','Ongoing',NULL, 20.4458000, 121.9848000),

('INC-2025-010','Domestic Dispute','Sitio Tuva','Norma Palconit','Former partner',
 'Ex-partner caused a disturbance and harassed complainant at her residence.',
 '2025-12-10 21:00:00+08','Ongoing',NULL, 20.4461000, 121.9911000),

('INC-2025-011','Noise Disturbance','Sitio Hagu','Carmen Santos','Unknown teenager',
 'Group of teenagers creating a disturbance in front of the chapel.',
 '2026-01-08 22:00:00+08','Resolved','2026-01-09', 20.4414000, 121.9891000),

('INC-2025-012','Minor Physical Altercation','Sitio Hunan','Renato Ismaquel','Unknown assailant',
 'Complainant was allegedly pushed and fell near the market area.',
 '2026-01-15 17:00:00+08','Ongoing',NULL, 20.4451000, 121.9842000),

('INC-2025-013','Stray Animal Complaint','Sitio Tuva','Marie Fernandez','No respondent',
 'Stray dogs reported chasing residents walking along the main road.',
 '2026-02-02 07:15:00+08','Resolved','2026-02-10', 20.4456000, 121.9903000),

('INC-2025-014','Property Damage (Typhoon-related)','Sitio Hagu','Pedro Narag','No respondent',
 'Fencing and standing crops damaged by strong winds during a storm.',
 '2026-02-20 06:00:00+08','Ongoing',NULL, 20.4410000, 121.9883000),

('INC-2025-015','Others','Sitio Hunan','Fernando Chua','No respondent',
 'Minor vehicular accident along the barangay road, no serious injuries.',
 '2026-03-05 13:45:00+08','Resolved','2026-03-05', 20.4454000, 121.9839000)

ON CONFLICT (case_no) DO NOTHING;

-- If incidents were already seeded WITHOUT coordinates, this back-fills the
-- pins (ON CONFLICT above skips existing rows, so the INSERT alone won't).
UPDATE incidents SET latitude = v.lat, longitude = v.lng
FROM (VALUES
  ('INC-2025-001', 20.4456000, 121.9841000),
  ('INC-2025-002', 20.4418000, 121.9882000),
  ('INC-2025-003', 20.4463000, 121.9902000),
  ('INC-2025-004', 20.4450000, 121.9850000),
  ('INC-2025-005', 20.4412000, 121.9889000),
  ('INC-2025-006', 20.4458000, 121.9909000),
  ('INC-2025-007', 20.4420000, 121.9887000),
  ('INC-2025-008', 20.4465000, 121.9907000),
  ('INC-2025-009', 20.4458000, 121.9848000),
  ('INC-2025-010', 20.4461000, 121.9911000),
  ('INC-2025-011', 20.4414000, 121.9891000),
  ('INC-2025-012', 20.4451000, 121.9842000),
  ('INC-2025-013', 20.4456000, 121.9903000),
  ('INC-2025-014', 20.4410000, 121.9883000),
  ('INC-2025-015', 20.4454000, 121.9839000)
) AS v(case_no, lat, lng)
WHERE incidents.case_no = v.case_no
  AND (incidents.latitude IS NULL OR incidents.longitude IS NULL);

-- ============================================================
-- SURVEY RESPONSES (Community Needs Assessment)
-- ============================================================
INSERT INTO survey_responses (resident_id, purok, priority_need, comments) VALUES
((SELECT id FROM residents WHERE resident_no='RES-001'),'Sitio Hunan','Road / Infrastructure','The road leading to the shore is heavily deteriorated and becomes impassable during rainy season.'),
((SELECT id FROM residents WHERE resident_no='RES-005'),'Sitio Hagu','Water Supply','We only have a shallow well. We need a proper waterline in our sitio.'),
((SELECT id FROM residents WHERE resident_no='RES-008'),'Sitio Tuva','Health Services','A community health worker visits only once a month. We need more frequent medical missions.'),
((SELECT id FROM residents WHERE resident_no='RES-011'),'Sitio Hunan','Peace & Order','Street lighting is poor at night which increases risk of accidents and crime.'),
((SELECT id FROM residents WHERE resident_no='RES-015'),'Sitio Hagu','Livelihood Programs','As a widowed solo parent, I need livelihood assistance to support my children.'),
((SELECT id FROM residents WHERE resident_no='RES-017'),'Sitio Hunan','Road / Infrastructure','The bridge near our area needs urgent repair before the next typhoon season.'),
((SELECT id FROM residents WHERE resident_no='RES-022'),'Sitio Hunan','Livelihood Programs','We need additional livelihood opportunities for skilled workers in the community.'),
((SELECT id FROM residents WHERE resident_no='RES-025'),'Sitio Hunan','Health Services','PWD residents need accessible health services and medicine assistance.'),
((SELECT id FROM residents WHERE resident_no='RES-028'),'Sitio Hagu','Educational Support','A scholarship program for college students from poor families is greatly needed.'),
((SELECT id FROM residents WHERE resident_no='RES-031'),'Sitio Hagu','Livelihood Programs','Returning OFWs like myself need reintegration and livelihood support.'),
((SELECT id FROM residents WHERE resident_no='RES-034'),'Sitio Hagu','Water Supply','Our irrigation system is broken. Crops are suffering during dry season.'),
((SELECT id FROM residents WHERE resident_no='RES-037'),'Sitio Hagu','Health Services','PWD residents cannot travel far for check-ups. We need a sitio-level health post.'),
((SELECT id FROM residents WHERE resident_no='RES-040'),'Sitio Hagu','Health Services','Senior citizens and PWDs need free medicines and regular check-up at home.'),
((SELECT id FROM residents WHERE resident_no='RES-041'),'Sitio Tuva','Peace & Order','We request additional barangay tanod patrols especially at night.'),
((SELECT id FROM residents WHERE resident_no='RES-044'),'Sitio Tuva','Livelihood Programs','Farmers need access to affordable seeds, fertilizers, and equipment.'),
((SELECT id FROM residents WHERE resident_no='RES-047'),'Sitio Tuva','Livelihood Programs','Solo parents need sustainable livelihood assistance, not just one-time aid.'),
((SELECT id FROM residents WHERE resident_no='RES-050'),'Sitio Tuva','Road / Infrastructure','The concrete path to Purok 4 is cracked and slippery during rain.'),
((SELECT id FROM residents WHERE resident_no='RES-052'),'Sitio Tuva','Educational Support','Youth in this sitio need a reading/study center and internet access.'),
((SELECT id FROM residents WHERE resident_no='RES-053'),'Sitio Tuva','Health Services','Elderly residents with mobility issues need home visits from health workers.'),
(NULL,'Sitio Hunan','Water Supply','Anonymous: Water pressure is very low in the mornings. Please fix the mainline.'),
(NULL,'Sitio Hagu','Road / Infrastructure','Anonymous: The road near the elementary school floods every typhoon.'),
(NULL,'Sitio Tuva','Peace & Order','Anonymous: Stray animals are a health hazard in our area.'),
(NULL,'Sitio Hunan','Educational Support','Anonymous: We need more scholarship slots for high school graduates going to college.'),
(NULL,'Sitio Hagu','Livelihood Programs','Anonymous: Fishing communities need boat repair assistance and equipment subsidy.'),
(NULL,'Sitio Tuva','Others','Anonymous: We need a designated solid waste collection point in our sitio.');

-- ============================================================
-- DISASTER RISK ZONES
-- ============================================================
INSERT INTO disaster_risk_zones (hazard_type, risk_level, purok, description, radius, latitude, longitude) VALUES
('Typhoon',    'High',   'Sitio Hunan', 'Coastal area directly exposed to typhoon winds and storm-driven rain. Households near shoreline are most vulnerable.',                           250, 20.4490, 121.9685),
('Flood',      'High',   'Sitio Hagu',  'Low-lying area adjacent to the creek. Floodwaters rise rapidly during heavy rains and can submerge roads and homes within hours.',           180, 20.4475, 121.9680),
('Landslide',  'Medium', 'Sitio Tuva',  'Hillside barangay with steep slopes. Heavy rains cause soil erosion and occasional rockfall along the upper road.',                           120, 20.4462, 121.9710),
('Storm Surge','High',   'Sitio Hunan', 'Near-shore households are at high risk from storm surges during typhoons. Evacuation is required for Category 2 and above.',                  200, 20.4510, 121.9725),
('Earthquake', 'Medium', 'Sitio Hagu',  'Area sits in proximity to a minor fault line. Structures without earthquake-resistant design are vulnerable during seismic events.',           300, 20.4530, 121.9745),
('Fire',       'Low',    'Sitio Tuva',  'Cluster of wood and makeshift homes with limited water access. Risk increases during dry season due to cooking fires and electrical faults.', 80,  20.4452, 121.9718);

-- ============================================================
-- DONE
-- ============================================================
-- Summary of inserted records:
--   Households:        15 new (HH-006 to HH-020) + 5 existing = 20 total
--   Residents:         60 (RES-001 to RES-060)
--   Beneficiaries:     ~30 records across 5 programs
--   Incidents:         15 (INC-2025-001 to INC-2025-015)
--   Survey Responses:  25
--   Disaster Zones:    6
-- ============================================================


-- ############################################################################
-- ## PART 5 — POST-SEED TOUCH-UPS
-- ############################################################################

-- ---- Make all household numbers uniform 4-digit (HH-0001) ----
-- ============================================================
-- Run in Supabase SQL Editor
-- Makes all household numbers uniform 4-digit format:
--   HH-020  ->  HH-0020   (and HH-1 -> HH-0001, etc.)
-- Residents link to households by ID, so this is safe — no other table changes.
-- ============================================================

UPDATE households
SET household_no = 'HH-' || LPAD(REGEXP_REPLACE(household_no, '\D', '', 'g'), 4, '0')
WHERE household_no ~ '\d';

-- Check the result
SELECT household_no, purok, head_name
FROM households
ORDER BY household_no;

-- ---- Populate Out-of-School Youth + PWD-by-type charts ----
-- ============================================================
-- Run in Supabase SQL Editor
-- Populates the two empty charts in Sector Statistics:
--   1. Out-of-School Youth by Sitio
--   2. PWD by Disability Type
--
-- It FLAGS existing residents (no fake people are created), so the
-- charts reflect your real registry. Safe to re-run.
-- ============================================================

-- Make sure the OSY column exists (in case add_sector_fields.sql
-- hasn't been run yet).
ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS is_out_of_school_youth BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------
-- 1) OUT-OF-SCHOOL YOUTH BY SITIO
-- Flag up to 3 youths (aged 16-24) in EACH sitio as OSY, so all
-- three bars (Hunan / Hagu / Tuva) have data.
-- ------------------------------------------------------------
WITH youth AS (
  SELECT id, purok,
         ROW_NUMBER() OVER (PARTITION BY purok ORDER BY date_of_birth DESC) AS rn
  FROM residents
  WHERE date_of_birth >  (CURRENT_DATE - INTERVAL '25 years')   -- younger than 25
    AND date_of_birth <= (CURRENT_DATE - INTERVAL '16 years')   -- at least 16
)
UPDATE residents r
SET is_out_of_school_youth = TRUE
FROM youth y
WHERE r.id = y.id
  AND y.rn <= 3;

-- ------------------------------------------------------------
-- 2a) PWD TYPES — fill in disability type for residents that are
-- already marked PWD but have no type yet (cycles through the 5
-- types the chart expects).
-- ------------------------------------------------------------
WITH p AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM residents
  WHERE is_pwd = TRUE
    AND (pwd_type IS NULL OR pwd_type = '')
)
UPDATE residents r
SET pwd_type = (ARRAY['Physical','Visual','Hearing','Intellectual','Psychosocial'])[((p.rn - 1) % 5) + 1]
FROM p
WHERE r.id = p.id;

-- ------------------------------------------------------------
-- 2b) Guarantee every disability type appears on the chart:
-- flag 5 not-yet-PWD residents, one per type. (Skip this block
-- if you already have PWDs covering all five types.)
-- ------------------------------------------------------------
WITH cand AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM residents
  WHERE is_pwd = FALSE
)
UPDATE residents r
SET is_pwd    = TRUE,
    pwd_type  = (ARRAY['Physical','Visual','Hearing','Intellectual','Psychosocial'])[cand.rn]
FROM cand
WHERE r.id = cand.id
  AND cand.rn <= 5;

-- ------------------------------------------------------------
-- Verify the results
-- ------------------------------------------------------------
SELECT 'OSY by Sitio' AS chart, purok AS bucket, COUNT(*) AS count
FROM residents
WHERE is_out_of_school_youth = TRUE
GROUP BY purok

UNION ALL

SELECT 'PWD by Type' AS chart, pwd_type AS bucket, COUNT(*) AS count
FROM residents
WHERE is_pwd = TRUE AND pwd_type IS NOT NULL
GROUP BY pwd_type

ORDER BY chart, bucket;
