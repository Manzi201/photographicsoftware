-- ============================================================
-- Certificate System — Full Schema with Multi-School Auth
-- Run this in your Supabase SQL Editor
-- ============================================================

-- NOTE: Supabase handles auth.users automatically via Auth.
-- We extend it with a "schools" table (one school = one account).

-- ── SCHOOLS TABLE ─────────────────────────────────────────────
-- Each school has one account (tied to Supabase auth user)
CREATE TABLE IF NOT EXISTS schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  school_name VARCHAR(200) NOT NULL DEFAULT 'My School',
  signatory_name VARCHAR(100) DEFAULT 'Head Teacher',
  logo_url TEXT,
  stamp_url TEXT,
  signature_url TEXT,
  background_url TEXT,
  bg_preset VARCHAR(50) DEFAULT 'none',
  active_year VARCHAR(10) DEFAULT '2025',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── STUDENTS TABLE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  photo_number VARCHAR(20) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  class VARCHAR(50) NOT NULL,
  year VARCHAR(10) NOT NULL,
  photo_url TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- photo_number unique per school+year
  UNIQUE(school_id, photo_number, year)
);

-- ── CERTIFICATES TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  template VARCHAR(50) NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  printed_by UUID REFERENCES auth.users(id),
  pdf_path TEXT
);

-- ── ROW LEVEL SECURITY (RLS) ───────────────────────────────────
-- Each school can only see its own data

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Schools: user can only see/edit their own school
CREATE POLICY "school_owner_select" ON schools FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "school_owner_insert" ON schools FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "school_owner_update" ON schools FOR UPDATE USING (auth.uid() = user_id);

-- Students: user can only access students in their school
CREATE POLICY "students_school_select" ON students FOR SELECT
  USING (school_id IN (SELECT id FROM schools WHERE user_id = auth.uid()));

CREATE POLICY "students_school_insert" ON students FOR INSERT
  WITH CHECK (school_id IN (SELECT id FROM schools WHERE user_id = auth.uid()));

CREATE POLICY "students_school_update" ON students FOR UPDATE
  USING (school_id IN (SELECT id FROM schools WHERE user_id = auth.uid()));

CREATE POLICY "students_school_delete" ON students FOR DELETE
  USING (school_id IN (SELECT id FROM schools WHERE user_id = auth.uid()));

-- Certificates: same pattern
CREATE POLICY "certs_school_select" ON certificates FOR SELECT
  USING (school_id IN (SELECT id FROM schools WHERE user_id = auth.uid()));

CREATE POLICY "certs_school_insert" ON certificates FOR INSERT
  WITH CHECK (school_id IN (SELECT id FROM schools WHERE user_id = auth.uid()));

-- ── INDEXES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class);
CREATE INDEX IF NOT EXISTS idx_students_year ON students(year);
CREATE INDEX IF NOT EXISTS idx_students_photo_number ON students(photo_number);
CREATE INDEX IF NOT EXISTS idx_certificates_student_id ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_school_id ON certificates(school_id);

-- ── FUNCTION: auto-create school profile after signup ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.schools (user_id, school_name, active_year)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'school_name', 'My School'),
    COALESCE(NEW.raw_user_meta_data->>'active_year', EXTRACT(YEAR FROM NOW())::TEXT)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fires after every new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── STORAGE BUCKETS (create in dashboard or SQL below) ─────────
-- Run these if buckets don't exist yet:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true) ON CONFLICT DO NOTHING;
