-- ============================================================
-- PROTECT — Trim unused columns (align database to actual usage)
-- Run ONCE in Supabase → SQL Editor.
-- ============================================================
-- This removes columns that exist in the schema but the application
-- never reads or writes, so the database, the ERD, and the running
-- system all match. Verified against the source code before listing.
--
-- ⚠️ DESTRUCTIVE: dropping a column deletes its data permanently.
-- If you ever want these for future features, skip this script.
-- Recommended: take a Database Backup (System & Audit) first.
-- ============================================================

-- 0. Drop the unused helper view first (the app reads `residents`
--    directly now, and the view blocks dropping resident columns).
DROP VIEW IF EXISTS residents_with_age;

-- 1. residents — remove legacy / unused fields
--    (suffix, educational_attainment, philhealth_no are no longer collected;
--     `age` is KEPT — used in Add/View Resident)
ALTER TABLE residents
  DROP COLUMN IF EXISTS suffix,
  DROP COLUMN IF EXISTS educational_attainment,
  DROP COLUMN IF EXISTS philhealth_no;
-- NOTE: `age` is kept (used in Add/View Resident).

-- 2. households — remove unused utility fields
ALTER TABLE households
  DROP COLUMN IF EXISTS water_source,
  DROP COLUMN IF EXISTS electricity;

-- 3. qr_verifications — officer_id is never set by the app
ALTER TABLE qr_verifications
  DROP COLUMN IF EXISTS officer_id;

-- 4. incidents — respondent and resolved_date are never used
ALTER TABLE incidents
  DROP COLUMN IF EXISTS respondent,
  DROP COLUMN IF EXISTS resolved_date;

-- 5. survey_responses — other_need is never used (free-text is `comments`)
ALTER TABLE survey_responses
  DROP COLUMN IF EXISTS other_need;

-- 6. population_history — app uses only year + total_population
ALTER TABLE population_history
  DROP COLUMN IF EXISTS male_count,
  DROP COLUMN IF EXISTS female_count,
  DROP COLUMN IF EXISTS household_count,
  DROP COLUMN IF EXISTS birth_count,
  DROP COLUMN IF EXISTS death_count,
  DROP COLUMN IF EXISTS migration_in,
  DROP COLUMN IF EXISTS migration_out,
  DROP COLUMN IF EXISTS source;

-- ============================================================
-- Verify the result:
--   SELECT table_name,
--          string_agg(column_name, ', ' ORDER BY ordinal_position)
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--   GROUP BY table_name ORDER BY table_name;
-- ============================================================
