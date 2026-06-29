-- ============================================================
-- PROTECT System — Incident Photo Storage Setup
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add photo_url column to incidents table
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Create the storage bucket (public so thumbnails load without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-photos', 'incident-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies
DO $$ BEGIN
  CREATE POLICY "incident_photos_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'incident-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "incident_photos_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'incident-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "incident_photos_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'incident-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
