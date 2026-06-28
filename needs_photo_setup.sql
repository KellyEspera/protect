-- ============================================================
-- Community Needs — photo attachment support
-- Run in Supabase → SQL Editor (one time)
-- ============================================================
-- Lets residents attach an optional photo (e.g. a broken pipe) when
-- they submit the public Community Needs form at /announcements.

-- 1) Add the column that stores the photo's public URL
ALTER TABLE survey_responses
  ADD COLUMN IF NOT EXISTS photo_url text;

-- 2) Create a PUBLIC storage bucket for these photos.
--    The form is submitted by residents WITHOUT logging in, so uploads
--    come from the anonymous role — the bucket must allow that.
INSERT INTO storage.buckets (id, name, public)
VALUES ('needs-photos', 'needs-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3) Storage policies for the needs-photos bucket
--    (public bucket = anyone can READ; we also allow anon UPLOAD here)
DROP POLICY IF EXISTS "needs_photos_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "needs_photos_public_insert" ON storage.objects;

CREATE POLICY "needs_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'needs-photos');

CREATE POLICY "needs_photos_public_insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'needs-photos');
