-- ============================================================================
--  PROTECT — CLEAN SLATE  (delete all operational/placeholder data)
-- ----------------------------------------------------------------------------
--  ⚠️  IRREVERSIBLE. Back up first:  System & Audit → Database Backup → Download.
--
--  Run in Supabase → SQL Editor. This empties every operational table so you can
--  start entering REAL data.
--
--  DELETED : residents, households, incidents, beneficiaries, assistance_programs,
--            qr_verifications, survey_responses, disaster_risk_zones, audit_logs
--  KEPT    : population_history (Predictive Growth needs it)
--            profiles + auth.users (your logins/roles — so you stay logged in)
--
--  TRUNCATE is used instead of DELETE: it clears the tables WITHOUT firing the
--  per-row triggers, so it won't generate a wave of "deleted" audit entries and
--  won't trip the cascade-on-head-delete trigger. CASCADE resolves the foreign
--  keys among these tables automatically; profiles and population_history are not
--  referenced by them, so they are left untouched.
-- ============================================================================

TRUNCATE
  public.qr_verifications,
  public.beneficiaries,
  public.survey_responses,
  public.incidents,
  public.residents,
  public.households,
  public.assistance_programs,
  public.disaster_risk_zones,
  public.audit_logs
RESTART IDENTITY CASCADE;

-- Community announcements: also placeholder? Uncomment to wipe them too.
-- (Leave commented if you posted any real announcements you want to keep.)
-- TRUNCATE public.announcements RESTART IDENTITY CASCADE;

-- ── Verify everything is empty (should all read 0, except the kept tables) ──
SELECT 'residents'           AS table, COUNT(*) FROM residents
UNION ALL SELECT 'households',            COUNT(*) FROM households
UNION ALL SELECT 'incidents',            COUNT(*) FROM incidents
UNION ALL SELECT 'beneficiaries',        COUNT(*) FROM beneficiaries
UNION ALL SELECT 'assistance_programs',  COUNT(*) FROM assistance_programs
UNION ALL SELECT 'qr_verifications',     COUNT(*) FROM qr_verifications
UNION ALL SELECT 'survey_responses',     COUNT(*) FROM survey_responses
UNION ALL SELECT 'disaster_risk_zones',  COUNT(*) FROM disaster_risk_zones
UNION ALL SELECT 'audit_logs',           COUNT(*) FROM audit_logs
UNION ALL SELECT 'announcements (kept?)',COUNT(*) FROM announcements
UNION ALL SELECT 'population_history (KEPT)', COUNT(*) FROM population_history
UNION ALL SELECT 'profiles (KEPT)',      COUNT(*) FROM profiles
ORDER BY 1;

-- ----------------------------------------------------------------------------
--  Optional: the uploaded photo FILES in Storage (incident-photos /
--  announcement-photos) are NOT removed by SQL. To clear them, go to
--  Supabase → Storage → open each bucket → select all → delete. The buckets
--  themselves (and their policies) stay, so new uploads still work.
-- ----------------------------------------------------------------------------
