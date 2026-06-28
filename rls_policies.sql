-- ============================================================================
--  PROTECT — Row-Level Security (RLS) policies
-- ----------------------------------------------------------------------------
--  Run in Supabase → SQL Editor AFTER the roles exist (DATABASE_SETUP.sql).
--  This enforces role-based AUTHORIZATION at the DATABASE level, so the rules
--  hold even if someone bypasses the React frontend and calls the API directly.
--
--  Model:
--    • Reads  : authenticated STAFF only (brgy_sec or tanod)
--    • Writes : brgy_sec on all tables; tanod only on incidents
--    • Public : may read ACTIVE announcements and INSERT a needs survey — nothing else
--    • audit_logs : readable only by brgy_sec; written only by the audit trigger
--
--  SAFE TO RE-RUN. If anything breaks, see the EMERGENCY ROLLBACK at the bottom.
-- ============================================================================

-- ── Helper: the caller's role, read WITHOUT triggering RLS recursion ─────────
-- SECURITY DEFINER runs as the function owner, so it bypasses RLS on profiles
-- (this is what avoids the "infinite recursion" error on the profiles table).
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

-- ── Wipe ALL existing policies on the tables below, for a clean slate ────────
-- (Removes any leftover "authenticated can do everything" policies that would
--  otherwise OR with ours and defeat the restrictions.)
DO $$
DECLARE pol record;
DECLARE tbls text[] := ARRAY[
  'profiles','residents','households','incidents','beneficiaries',
  'assistance_programs','qr_verifications','survey_responses',
  'announcements','disaster_risk_zones','population_history','audit_logs'
];
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(tbls)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Make sure RLS is ON for every table (denies everything until a policy allows it)
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistance_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_verifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disaster_risk_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.population_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- The residents_with_age VIEW must respect the caller's RLS (Postgres 15+),
-- otherwise it would read the residents table as its owner and bypass RLS.
ALTER VIEW public.residents_with_age SET (security_invoker = true);

-- ── PROFILES ────────────────────────────────────────────────────────────────
-- Any authenticated user can READ profiles (needed for the login role lookup and
-- the User Management list). Only the secretary can change them. The signup
-- trigger inserts profiles as SECURITY DEFINER, so it bypasses these policies.
CREATE POLICY "profiles_read_auth" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_write_sec" ON public.profiles
  FOR ALL TO authenticated
  USING (public.user_role() = 'brgy_sec')
  WITH CHECK (public.user_role() = 'brgy_sec');

-- ── STAFF-READ + SECRETARY-WRITE tables ─────────────────────────────────────
-- residents, households, beneficiaries, assistance_programs, disaster_risk_zones,
-- population_history: both staff roles can READ (the dashboard/maps/reports need
-- it); only the secretary can create/edit/delete.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['residents','households','beneficiaries','assistance_programs','disaster_risk_zones','population_history']
  LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_read_staff" ON public.%1$s
        FOR SELECT TO authenticated
        USING (public.user_role() IN ('brgy_sec','tanod'));
      CREATE POLICY "%1$s_write_sec" ON public.%1$s
        FOR ALL TO authenticated
        USING (public.user_role() = 'brgy_sec')
        WITH CHECK (public.user_role() = 'brgy_sec');
    $f$, t);
  END LOOP;
END $$;

-- ── INCIDENTS — both staff roles read AND write (tanod's core job) ───────────
CREATE POLICY "incidents_read_staff" ON public.incidents
  FOR SELECT TO authenticated USING (public.user_role() IN ('brgy_sec','tanod'));
CREATE POLICY "incidents_write_staff" ON public.incidents
  FOR ALL TO authenticated
  USING (public.user_role() IN ('brgy_sec','tanod'))
  WITH CHECK (public.user_role() IN ('brgy_sec','tanod'));

-- ── QR VERIFICATIONS — secretary only (QR page is secretary-only) ───────────
CREATE POLICY "qr_all_sec" ON public.qr_verifications
  FOR ALL TO authenticated
  USING (public.user_role() = 'brgy_sec')
  WITH CHECK (public.user_role() = 'brgy_sec');

-- ── ANNOUNCEMENTS — public reads ACTIVE ones; secretary manages all ─────────
CREATE POLICY "announcements_public_read" ON public.announcements
  FOR SELECT USING (is_active = true);                 -- anon + authenticated
CREATE POLICY "announcements_staff_read_all" ON public.announcements
  FOR SELECT TO authenticated
  USING (public.user_role() IN ('brgy_sec','tanod'));  -- staff also see hidden ones
CREATE POLICY "announcements_write_sec" ON public.announcements
  FOR ALL TO authenticated
  USING (public.user_role() = 'brgy_sec')
  WITH CHECK (public.user_role() = 'brgy_sec');

-- ── SURVEY RESPONSES — public may SUBMIT; staff read; secretary manages ──────
CREATE POLICY "survey_public_insert" ON public.survey_responses
  FOR INSERT WITH CHECK (true);                        -- public needs form
CREATE POLICY "survey_staff_read" ON public.survey_responses
  FOR SELECT TO authenticated
  USING (public.user_role() IN ('brgy_sec','tanod'));
CREATE POLICY "survey_manage_sec" ON public.survey_responses
  FOR ALL TO authenticated
  USING (public.user_role() = 'brgy_sec')
  WITH CHECK (public.user_role() = 'brgy_sec');

-- ── AUDIT LOGS — secretary reads; only the trigger writes (SECURITY DEFINER) ─
CREATE POLICY "audit_read_sec" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.user_role() = 'brgy_sec');

-- ── Verify what's in place ──────────────────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
--  EMERGENCY ROLLBACK (uncomment and run ONLY if the app breaks after this).
--  This re-opens every table to any logged-in user (the previous behaviour):
--
--  DO $$
--  DECLARE t text;
--  BEGIN
--    FOREACH t IN ARRAY ARRAY['profiles','residents','households','incidents',
--      'beneficiaries','assistance_programs','qr_verifications','survey_responses',
--      'announcements','disaster_risk_zones','population_history','audit_logs']
--    LOOP
--      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
--    END LOOP;
--  END $$;
-- ============================================================================
