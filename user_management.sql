-- ============================================================
-- PROTECT — User Management Setup
-- Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Update role constraint to include all current roles
-- -------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'officer', 'brgy_sec', 'tanod', 'dilg_rep', 'viewer'));


-- 2. Auto-create a profile row when a new user is created in Supabase Auth
-- -------------------------------------------------------------------------
-- This trigger fires whenever you add a user in the Supabase Auth dashboard.
-- It creates a profiles row with role = 'viewer' by default.
-- You (or an admin) then update the role via the User Management page.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- 3. RLS policies for profiles
-- -------------------------------------------------------------------------
-- ⚠️ DO NOT add a SELECT/UPDATE policy that reads `profiles` inside its own
--    USING clause (e.g. "SELECT role FROM profiles WHERE id = auth.uid()").
--    Postgres throws "infinite recursion detected" and EVERY profile read
--    fails — which makes every user show up as "Viewer" in the app.
--    The correct, non-recursive policies live in fix_profiles_rls.sql.
--    Run THAT file for RLS, not this section.

-- The clean, non-recursive policies (same as fix_profiles_rls.sql):
DROP POLICY IF EXISTS "Users can view own profile"     ON profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can update profiles"   ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile"   ON profiles;
DROP POLICY IF EXISTS "authenticated read profiles"    ON profiles;
DROP POLICY IF EXISTS "authenticated update profiles"  ON profiles;
DROP POLICY IF EXISTS "authenticated insert profiles"  ON profiles;

CREATE POLICY "authenticated read profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated update profiles"
  ON profiles FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated insert profiles"
  ON profiles FOR INSERT TO authenticated WITH CHECK (true);
