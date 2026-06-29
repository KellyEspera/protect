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
