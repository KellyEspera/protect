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
INSERT INTO incidents (case_no, incident_type, purok, complainant, respondent, description, incident_date, status, resolved_date) VALUES
('INC-2025-001','Noise/Disturbance','Sitio Hunan','Ramon Gaje','Unknown neighbor',
 'Loud music and drinking past midnight near the creek area.',
 '2025-08-14 22:30:00+08','Resolved','2025-08-15'),

('INC-2025-002','Domestic Violence','Sitio Hagu','Erlinda Pagutayao','Emmanuel Pagutayao',
 'Complainant reported verbal and physical abuse inside their residence.',
 '2025-09-02 19:45:00+08','Resolved','2025-09-05'),

('INC-2025-003','Theft','Sitio Tuva','Antonio Pilarte','Unknown suspect',
 'Missing GI sheets and construction materials from the building site.',
 '2025-09-18 06:00:00+08','Escalated',NULL),

('INC-2025-004','Trespassing','Sitio Hunan','Roberto Sacayan','Mariano Vitug',
 'Respondent repeatedly enters complainant''s property without permission.',
 '2025-10-05 14:00:00+08','Resolved','2025-10-12'),

('INC-2025-005','Physical Injury','Sitio Hagu','Danilo Narag','Jayson Flores',
 'Altercation during a basketball game resulting in physical injuries.',
 '2025-10-22 16:20:00+08','Resolved','2025-11-03'),

('INC-2025-006','Noise/Disturbance','Sitio Tuva','Corazon Torres','Unknown group',
 'Karaoke noise complaint from neighboring household until 2am.',
 '2025-11-01 23:00:00+08','Dismissed',NULL),

('INC-2025-007','Illegal Drugs','Sitio Hagu','Anonymous','Unidentified person',
 'Tip received about suspected drug activity near the river bank.',
 '2025-11-10 20:00:00+08','Escalated',NULL),

('INC-2025-008','Accident','Sitio Tuva','Alberto Fernandez','No respondent',
 'Resident slipped on broken pavement near Purok 4, sustained minor injuries.',
 '2025-11-20 08:30:00+08','Resolved','2025-11-20'),

('INC-2025-009','Theft','Sitio Hunan','Eduardo Sabado','Unknown suspect',
 'Fishing nets and equipment stolen from the storage shed near the shore.',
 '2025-12-03 04:00:00+08','Ongoing',NULL),

('INC-2025-010','Domestic Violence','Sitio Tuva','Norma Palconit','Former partner',
 'Ex-partner threatened and harassed complainant at her residence.',
 '2025-12-10 21:00:00+08','Ongoing',NULL),

('INC-2025-011','Noise/Disturbance','Sitio Hagu','Carmen Santos','Unknown teenager',
 'Group of teenagers creating disturbance in front of the chapel.',
 '2026-01-08 22:00:00+08','Resolved','2026-01-09'),

('INC-2025-012','Physical Injury','Sitio Hunan','Renato Ismaquel','Unknown assailant',
 'Victim was allegedly pushed and fell near the market area.',
 '2026-01-15 17:00:00+08','Ongoing',NULL),

('INC-2025-013','Others','Sitio Tuva','Marie Fernandez','Unknown',
 'Stray dogs attacking residents walking along the main road.',
 '2026-02-02 07:15:00+08','Resolved','2026-02-10'),

('INC-2025-014','Trespassing','Sitio Hagu','Pedro Narag','Unknown person',
 'Farmland and crops damaged by trespassers during harvest season.',
 '2026-02-20 06:00:00+08','Ongoing',NULL),

('INC-2025-015','Accident','Sitio Hunan','Fernando Chua','No respondent',
 'Minor vehicular accident along the barangay road, no serious injuries.',
 '2026-03-05 13:45:00+08','Resolved','2026-03-05')

ON CONFLICT (case_no) DO NOTHING;

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
