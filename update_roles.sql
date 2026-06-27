-- ============================================================
-- Run this in Supabase SQL Editor
-- Adds tanod and dilg_rep to the profiles role constraint
-- ============================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'officer', 'tanod', 'dilg_rep', 'viewer'));
