-- ============================================================
-- Run in Supabase SQL Editor
-- Spreads existing incidents across the named incident types
-- (so the charts/map aren't all "Others"). Run AFTER update_crime_types.sql.
-- ============================================================

-- Randomly assign each incident one of the 7 named types.
-- Re-run it any time you want a fresh spread.
UPDATE incidents
SET incident_type = (ARRAY[
  'Public Intoxication / Disorderly Conduct',
  'Minor Physical Altercation',
  'Domestic Dispute',
  'Property Damage (Typhoon-related)',
  'Environmental / Ordinance Violation',
  'Stray Animal Complaint',
  'Noise Disturbance'
])[floor(random() * 7 + 1)::int];

-- Check the spread
SELECT incident_type, COUNT(*) AS total
FROM incidents
GROUP BY incident_type
ORDER BY total DESC;
