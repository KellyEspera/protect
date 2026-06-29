-- ============================================================================
--  PROTECT — Stronger resident ↔ household link (cascade on head delete)
-- ----------------------------------------------------------------------------
--  Run in Supabase → SQL Editor. Safe to re-run.
--
--  Problem: deleting a resident who is a HOUSEHOLD HEAD left the household row
--  behind (an "orphan pin" with a head_name but no real resident).
--
--  Fix: a database trigger so that whenever a household head is deleted, their
--  household is deleted too — automatically, whether the delete happens in the
--  app or directly in the Supabase table editor. Other members of that household
--  are NOT deleted; their household_id is set to NULL by the existing foreign key.
-- ============================================================================

-- 1) Trigger function: when a head is deleted, remove their household.
CREATE OR REPLACE FUNCTION public.cleanup_household_on_head_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_household_head AND OLD.household_id IS NOT NULL THEN
    -- Deleting the household cascades household_id -> NULL on any other members
    -- via the residents_household_id_fkey (ON DELETE SET NULL).
    DELETE FROM public.households WHERE id = OLD.household_id;
  END IF;
  RETURN OLD;
END;
$$;

-- 2) Attach it (drop first so re-running doesn't duplicate the trigger).
DROP TRIGGER IF EXISTS trg_cleanup_household_on_head_delete ON public.residents;
CREATE TRIGGER trg_cleanup_household_on_head_delete
  AFTER DELETE ON public.residents
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_household_on_head_delete();

-- ----------------------------------------------------------------------------
-- 3) ONE-TIME CLEANUP of households that are ALREADY orphaned (like HH-1000 /
--    HH-1002 you saw). This removes households that have NO linked residents.
--    ⚠ It will also remove any household you pinned but haven't added residents
--    to yet, so review the SELECT first, then run the DELETE.
-- ----------------------------------------------------------------------------

-- Preview which households have no linked residents:
SELECT h.household_no, h.purok, h.head_name
FROM households h
WHERE NOT EXISTS (SELECT 1 FROM residents r WHERE r.household_id = h.id)
ORDER BY h.household_no;

-- After reviewing the list above, uncomment and run this to delete them:
-- DELETE FROM households h
-- WHERE NOT EXISTS (SELECT 1 FROM residents r WHERE r.household_id = h.id);

-- Or delete just the specific orphans by number:
-- DELETE FROM households WHERE household_no IN ('HH-1000', 'HH-1002');
