-- ============================================================
-- Certificate System — Complete Database Setup
-- Paste this entire file into:
-- Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================
-- SAFE to run on a fresh database OR an existing one.
-- All statements use IF NOT EXISTS / IF EXISTS guards.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- PART 1: CREATE / MIGRATE TABLES
-- ══════════════════════════════════════════════════════════════

-- ── SCHOOLS table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  school_name    VARCHAR(200) NOT NULL DEFAULT 'My School',
  signatory_name VARCHAR(100) DEFAULT 'Head Teacher',
  logo_url       TEXT,
  stamp_url      TEXT,
  signature_url  TEXT,
  background_url TEXT,
  bg_preset      VARCHAR(50) DEFAULT 'none',
  active_year    VARCHAR(10) DEFAULT '2025',
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Migrate old single-row settings table → schools (if exists) ─
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'settings'
  ) THEN
    IF (SELECT COUNT(*) FROM schools) = 0 THEN
      INSERT INTO schools (school_name, signatory_name, logo_url, stamp_url, background_url)
      SELECT
        COALESCE(school_name, 'My School'),
        COALESCE(signatory_name, 'Head Teacher'),
        logo_url,
        stamp_url,
        background_url
      FROM settings
      LIMIT 1;
    END IF;
  END IF;
END $$;


-- ── STUDENTS table ────────────────────────────────────────────

-- Create fresh if it doesn't exist at all
CREATE TABLE IF NOT EXISTS students (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_number VARCHAR(20) NOT NULL,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100) NOT NULL,
  class        VARCHAR(50) NOT NULL,
  year         VARCHAR(10) NOT NULL DEFAULT '2025',
  photo_url    TEXT,
  status       VARCHAR(20) DEFAULT 'active',
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add school_id column if missing (old schema had text "school" instead)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'school_id'
  ) THEN
    ALTER TABLE students ADD COLUMN school_id UUID;
    RAISE NOTICE 'Added school_id column to students';
  END IF;
END $$;

-- Rename old text "school" column to school_name_old (keep as backup)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'school'
  ) THEN
    ALTER TABLE students RENAME COLUMN school TO school_name_old;
    RAISE NOTICE 'Renamed school → school_name_old in students';
  END IF;
END $$;

-- Add year column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'year'
  ) THEN
    ALTER TABLE students ADD COLUMN year VARCHAR(10) DEFAULT '2025';
  END IF;
END $$;

-- Add status column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'status'
  ) THEN
    ALTER TABLE students ADD COLUMN status VARCHAR(20) DEFAULT 'active';
  END IF;
END $$;

-- Add photo_url if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE students ADD COLUMN photo_url TEXT;
  END IF;
END $$;

-- Add unique constraint on (school_id, photo_number, year) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'students'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'students_school_id_photo_number_year_key'
  ) THEN
    -- Only add if school_id is NOT NULL capable
    BEGIN
      ALTER TABLE students
        ADD CONSTRAINT students_school_id_photo_number_year_key
        UNIQUE (school_id, photo_number, year);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not add unique constraint: %', SQLERRM;
    END;
  END IF;
END $$;


-- ── CERTIFICATES table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id   UUID REFERENCES students(id) ON DELETE CASCADE,
  template     VARCHAR(50) NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  printed_by   UUID REFERENCES auth.users(id),
  pdf_path     TEXT
);

-- Add school_id to certificates if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'certificates' AND column_name = 'school_id'
  ) THEN
    ALTER TABLE certificates ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added school_id to certificates';
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- PART 2: ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════

ALTER TABLE schools      ENABLE ROW LEVEL SECURITY;
ALTER TABLE students     ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies so we start clean
DO $$
DECLARE
  pol  TEXT;
  tbl  TEXT;
BEGIN
  FOR tbl IN VALUES ('schools'), ('students'), ('certificates') LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Schools: each user only accesses their own school row
CREATE POLICY "school_owner_select" ON schools
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "school_owner_insert" ON schools
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "school_owner_update" ON schools
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "school_owner_delete" ON schools
  FOR DELETE USING (auth.uid() = user_id);

-- Students: open policies — backend uses service key (bypasses RLS anyway)
CREATE POLICY "students_select" ON students FOR SELECT USING (true);
CREATE POLICY "students_insert" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "students_update" ON students FOR UPDATE USING (true);
CREATE POLICY "students_delete" ON students FOR DELETE USING (true);

-- Certificates: open policies
CREATE POLICY "certs_select" ON certificates FOR SELECT USING (true);
CREATE POLICY "certs_insert" ON certificates FOR INSERT WITH CHECK (true);
CREATE POLICY "certs_update" ON certificates FOR UPDATE USING (true);
CREATE POLICY "certs_delete" ON certificates FOR DELETE USING (true);


-- ══════════════════════════════════════════════════════════════
-- PART 3: INDEXES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_schools_user_id         ON schools(user_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id      ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class          ON students(class);
CREATE INDEX IF NOT EXISTS idx_students_year           ON students(year);
CREATE INDEX IF NOT EXISTS idx_students_photo_number   ON students(photo_number);
CREATE INDEX IF NOT EXISTS idx_certificates_student_id ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_school_id  ON certificates(school_id);


-- ══════════════════════════════════════════════════════════════
-- PART 4: TRIGGER — auto-create school row after signup
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.schools (user_id, school_name, active_year)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'school_name', 'My School'),
    COALESCE(NEW.raw_user_meta_data->>'active_year', EXTRACT(YEAR FROM NOW())::TEXT)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ══════════════════════════════════════════════════════════════
-- PART 5: STORAGE BUCKETS
-- ══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
  VALUES ('student-photos', 'student-photos', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('assets', 'assets', true)
  ON CONFLICT (id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- PART 6: VERIFY — shows all public tables after running
-- ══════════════════════════════════════════════════════════════

SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c
   WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;
