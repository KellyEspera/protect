-- ============================================================
-- Run in Supabase SQL Editor
-- Makes all household numbers uniform 4-digit format:
--   HH-020  ->  HH-0020   (and HH-1 -> HH-0001, etc.)
-- Residents link to households by ID, so this is safe — no other table changes.
-- ============================================================

-- Collision-safe: only renames a household to its 4-digit form when no OTHER
-- household already holds that number (e.g. an app-created HH-0007 vs a demo HH-007).
UPDATE households AS h
SET household_no = 'HH-' || LPAD(REGEXP_REPLACE(h.household_no, '\D', '', 'g'), 4, '0')
WHERE h.household_no ~ '\d'
  AND h.household_no <> 'HH-' || LPAD(REGEXP_REPLACE(h.household_no, '\D', '', 'g'), 4, '0')
  AND NOT EXISTS (
    SELECT 1 FROM households o
    WHERE o.id <> h.id
      AND o.household_no = 'HH-' || LPAD(REGEXP_REPLACE(h.household_no, '\D', '', 'g'), 4, '0')
  );

-- Check the result
SELECT household_no, purok, head_name
FROM households
ORDER BY household_no;
