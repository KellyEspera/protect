-- ============================================================
-- PROTECT — Fix profiles RLS (RUN ONCE in Supabase → SQL Editor)
-- Removes the recursive policy that made every user show as "Viewer".
-- ============================================================

-- 1. Drop ALL existing policies on profiles (clears the broken recursive one)
DROP POLICY IF EXISTS "Allow users to read own profile"     ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profile"   ON profiles;
DROP POLICY IF EXISTS "Users can view own profile"          ON profiles;
DROP POLICY IF EXISTS "Managers can view all profiles"      ON profiles;
DROP POLICY IF EXISTS "Managers can update profiles"        ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile"        ON profiles;
DROP POLICY IF EXISTS "authenticated read profiles"         ON profiles;
DROP POLICY IF EXISTS "authenticated update profiles"       ON profiles;
DROP POLICY IF EXISTS "authenticated insert profiles"       ON profiles;

-- 2. Simple, NON-recursive policies
--    Any logged-in user can read profiles (needed for login role + User Mgmt list)
CREATE POLICY "authenticated read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

--    Logged-in users can update profiles (lets admins change roles from the app)
CREATE POLICY "authenticated update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (true);

--    Allow inserts (used by the auto-profile trigger / app)
CREATE POLICY "authenticated insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Verify policies are clean
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';
