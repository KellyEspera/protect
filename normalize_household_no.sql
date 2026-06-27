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
