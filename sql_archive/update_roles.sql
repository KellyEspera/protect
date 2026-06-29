-- ============================================================
-- Run this in Supabase SQL Editor
-- Adds tanod to the profiles role constraint
-- ============================================================

UPDATE profiles SET role = 'viewer' WHERE role = 'dilg_rep';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'officer', 'brgy_sec', 'tanod', 'viewer'));
