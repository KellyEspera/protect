-- ============================================================
-- PROTECT: Barangay Analytics & Community Intelligence System
-- Supabase SQL Schema — run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- AUTH: Users / Officers (handled by Supabase Auth)
-- We extend it with a profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'officer' CHECK (role IN ('admin', 'officer', 'viewer')),
  barangay TEXT DEFAULT 'Kayvaluganan',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HOUSEHOLDS
-- ============================================================
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_no TEXT UNIQUE NOT NULL,
  purok TEXT NOT NULL CHECK (purok IN ('Purok 1','Purok 2','Purok 3','Purok 4','Purok 5')),
  address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  housing_type TEXT DEFAULT 'Concrete' CHECK (housing_type IN ('Concrete','Semi-concrete','Wood','Makeshift')),
  water_source TEXT DEFAULT 'Level III',
  electricity BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RESIDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS residents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_no TEXT UNIQUE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  suffix TEXT,
  date_of_birth DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male','Female')),
  civil_status TEXT DEFAULT 'Single' CHECK (civil_status IN ('Single','Married','Widowed','Separated','Annulled')),
  purok TEXT NOT NULL,
  is_household_head BOOLEAN DEFAULT FALSE,
  is_voter BOOLEAN DEFAULT FALSE,
  is_pwd BOOLEAN DEFAULT FALSE,
  pwd_type TEXT,
  is_solo_parent BOOLEAN DEFAULT FALSE,
  is_senior_citizen BOOLEAN DEFAULT FALSE,
  monthly_income NUMERIC(10,2) DEFAULT 0,
  occupation TEXT,
  educational_attainment TEXT,
  contact_number TEXT,
  philhealth_no TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Computed column helper view for age
CREATE OR REPLACE VIEW residents_with_age AS
SELECT *,
  DATE_PART('year', AGE(date_of_birth)) AS age
FROM residents;

-- ============================================================
-- BENEFICIARIES
-- ============================================================
CREATE TABLE IF NOT EXISTS assistance_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  agency TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beneficiaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES assistance_programs(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active','Pending','Completed','Suspended')),
  enrolled_at DATE DEFAULT CURRENT_DATE,
  last_release_date DATE,
  total_released NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resident_id, program_id)
);

-- ============================================================
-- INCIDENTS / CRIME
-- ============================================================
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_no TEXT UNIQUE NOT NULL,
  incident_type TEXT NOT NULL CHECK (incident_type IN (
    'Noise/Disturbance','Theft','Physical Injury','Domestic Violence',
    'Trespassing','Accident','Illegal Drugs','Others'
  )),
  purok TEXT NOT NULL,
  complainant TEXT,
  respondent TEXT,
  description TEXT,
  incident_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'Ongoing' CHECK (status IN ('Ongoing','Resolved','Escalated','Dismissed')),
  resolved_date DATE,
  officer_id UUID REFERENCES profiles(id),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QR VERIFICATIONS LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS qr_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE NOT NULL,
  purpose TEXT NOT NULL,
  officer_id UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NEEDS ASSESSMENT SURVEY
-- ============================================================
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  purok TEXT NOT NULL,
  priority_need TEXT NOT NULL CHECK (priority_need IN (
    'Health Services','Road / Infrastructure','Educational Support',
    'Livelihood Programs','Water Supply','Peace & Order','Others'
  )),
  other_need TEXT,
  comments TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Programs
INSERT INTO assistance_programs (id, name, description, agency) VALUES
  (uuid_generate_v4(), '4Ps (Pantawid Pamilya)', 'Conditional cash transfer program', 'DSWD'),
  (uuid_generate_v4(), 'Rice Subsidy', 'Monthly rice subsidy for poor households', 'NFA/LGU'),
  (uuid_generate_v4(), 'Medical Assistance', 'Financial aid for medical needs', 'LGU'),
  (uuid_generate_v4(), 'Educational Grant', 'School assistance for dependents', 'LGU/DepEd'),
  (uuid_generate_v4(), 'Livelihood Program', 'Skills and livelihood assistance', 'DOLE/LGU')
ON CONFLICT DO NOTHING;

-- Sample Households
INSERT INTO households (household_no, purok, address, latitude, longitude, housing_type) VALUES
  ('HH-001', 'Purok 1', 'Sitio Norte, Purok 1', 20.4490, 121.9685, 'Concrete'),
  ('HH-002', 'Purok 2', 'Sitio Sur, Purok 2', 20.4475, 121.9680, 'Concrete'),
  ('HH-003', 'Purok 3', 'Sitio Centro, Purok 3', 20.4462, 121.9710, 'Semi-concrete'),
  ('HH-004', 'Purok 4', 'Sitio Este, Purok 4', 20.4510, 121.9725, 'Concrete'),
  ('HH-005', 'Purok 5', 'Sitio Oeste, Purok 5', 20.4530, 121.9745, 'Wood')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistance_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read all, officers can write
CREATE POLICY "Allow read for authenticated" ON households FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated" ON households FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for authenticated" ON residents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated" ON residents FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for authenticated" ON assistance_programs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated" ON assistance_programs FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for authenticated" ON beneficiaries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated" ON beneficiaries FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for authenticated" ON incidents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated" ON incidents FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for authenticated" ON qr_verifications FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated" ON qr_verifications FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for authenticated" ON survey_responses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated" ON survey_responses FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow users to read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Allow users to update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
