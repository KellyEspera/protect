-- ============================================================
-- PROTECT System — Announcement Image Support
-- Run this in your Supabase SQL Editor (one time)
-- ============================================================

-- 1. Add image_url column to announcements
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create the storage bucket (public so images load without login)
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-photos', 'announcement-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies
DO $$ BEGIN
  CREATE POLICY "announcement_photos_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'announcement-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "announcement_photos_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'announcement-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "announcement_photos_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'announcement-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
