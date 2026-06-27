-- ============================================================
-- Run in Supabase SQL Editor
-- Adds Out-of-School Youth field to residents table
-- ============================================================

ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS is_out_of_school_youth BOOLEAN DEFAULT FALSE;
