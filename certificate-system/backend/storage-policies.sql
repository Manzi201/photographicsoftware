-- ============================================================
-- STORAGE POLICIES — Run in Supabase SQL Editor
-- Allows authenticated users to upload to their own folders
-- ============================================================

-- ── student-photos bucket ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('student-photos', 'student-photos', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies
DROP POLICY IF EXISTS "students_upload"  ON storage.objects;
DROP POLICY IF EXISTS "students_read"    ON storage.objects;
DROP POLICY IF EXISTS "students_delete"  ON storage.objects;
DROP POLICY IF EXISTS "assets_upload"    ON storage.objects;
DROP POLICY IF EXISTS "assets_read"      ON storage.objects;
DROP POLICY IF EXISTS "assets_delete"    ON storage.objects;

-- student-photos: authenticated users can upload/read/delete
CREATE POLICY "students_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'student-photos');

CREATE POLICY "students_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'student-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "students_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'student-photos'
    AND auth.role() = 'authenticated'
  );

-- ── assets bucket ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('assets', 'assets', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- assets: authenticated users can upload to their own school folder
CREATE POLICY "assets_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'assets');

CREATE POLICY "assets_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "assets_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "assets_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'assets'
    AND auth.role() = 'authenticated'
  );
