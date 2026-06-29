-- ============================================================
-- Run in Supabase SQL Editor
-- Replaces the incident_type list with the Batanes / San Joaquin set
-- ============================================================

-- 1. Re-label any existing incidents that use an old type, so the new
--    constraint applies without errors. Old types become 'Others'.
UPDATE incidents
SET incident_type = 'Others'
WHERE incident_type NOT IN (
  'Public Intoxication / Disorderly Conduct',
  'Minor Physical Altercation',
  'Domestic Dispute',
  'Property Damage (Typhoon-related)',
  'Environmental / Ordinance Violation',
  'Stray Animal Complaint',
  'Noise Disturbance',
  'Others'
);

-- 2. Apply the new constraint
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_incident_type_check;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_incident_type_check
  CHECK (incident_type IN (
    'Public Intoxication / Disorderly Conduct',
    'Minor Physical Altercation',
    'Domestic Dispute',
    'Property Damage (Typhoon-related)',
    'Environmental / Ordinance Violation',
    'Stray Animal Complaint',
    'Noise Disturbance',
    'Others'
  ));
