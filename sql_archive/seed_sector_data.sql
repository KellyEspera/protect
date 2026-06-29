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
