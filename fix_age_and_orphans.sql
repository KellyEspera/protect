-- ============================================================
-- PROTECT — Restore `age` + clean up orphan households
-- Run in Supabase → SQL Editor.
-- ============================================================
-- Fixes two issues caused by the earlier trim:
--   1. `residents.age` was dropped but you still want it.
--   2. Failed resident-adds left orphan households (empty HH pins,
--      e.g. the duplicate "Jack Jackfruit" HH-0010..HH-0013).
-- ============================================================

-- 1. Restore the age column (nullable; the app computes age from
--    date_of_birth when it's null, so existing rows still show age).
ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS age INT;

-- (Optional) backfill age for existing residents from their birthdate:
UPDATE residents
SET age = DATE_PART('year', AGE(date_of_birth))
WHERE date_of_birth IS NOT NULL;

-- 2. Preview the orphan households first (households with NO residents
--    linked to them). Run this SELECT to see what will be deleted:
--    SELECT household_no, purok, head_name FROM households h
--    WHERE NOT EXISTS (SELECT 1 FROM residents r WHERE r.household_id = h.id)
--    ORDER BY household_no;

-- 3. Delete orphan households (no members). This removes the duplicate
--    empty pins left by the failed adds. Households that actually have
--    residents are kept.
DELETE FROM households h
WHERE NOT EXISTS (
  SELECT 1 FROM residents r WHERE r.household_id = h.id
);
