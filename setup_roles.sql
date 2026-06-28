-- ============================================================
-- PROTECT — Role Setup (RUN ONCE in Supabase → SQL Editor)
-- After this, manage every user from the app's User Management page.
-- ============================================================

-- 1. Allow the 3 roles in the profiles table
--    brgy_sec = Barangay Secretary (full access / the admin), tanod, viewer.
--    (DILG is an external report recipient, not a system login.)
-- ------------------------------------------------------------
-- Reassign any legacy accounts so the new constraint applies cleanly:
--   admin/officer  -> brgy_sec   (they were all full-access)
--   dilg_rep       -> viewer
UPDATE profiles SET role = 'brgy_sec' WHERE role IN ('admin', 'officer');
UPDATE profiles SET role = 'viewer'   WHERE role = 'dilg_rep';

-- Default role for any new profile row is the most restrictive (viewer)
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'viewer';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('brgy_sec', 'tanod', 'viewer'));


-- 2. Auto-create a profile row whenever a user is added in Auth
--    (the trigger was missing — this is why new users had no role)
-- ------------------------------------------------------------
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


-- 3. Set roles for the two users you already created
--    (looks them up by email — no UID needed)
-- ------------------------------------------------------------
INSERT INTO profiles (id, full_name, role)
SELECT id, 'Barangay Secretary', 'brgy_sec'
FROM auth.users WHERE email = 'protectsystembrgysec@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'brgy_sec', full_name = 'Barangay Secretary';

INSERT INTO profiles (id, full_name, role)
SELECT id, 'Barangay Tanod', 'tanod'
FROM auth.users WHERE email = 'protectsystemtanod@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'tanod', full_name = 'Barangay Tanod';


-- 4. Verify — this should show both users with the correct role
-- ------------------------------------------------------------
SELECT u.email, p.full_name, p.role
FROM profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.role;
