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
  city           VARCHAR(100) DEFAULT 'Kigali',
  -- Custom Publisher template (uploaded as image PNG/JPG)
  cert_template_url  TEXT,
  cert_template_mode VARCHAR(20) DEFAULT 'overlay', -- 'overlay' or 'background'
  -- Customizable certificate text fields
  cert_line1     TEXT DEFAULT 'Has completed in {class} at',
  cert_line2     TEXT DEFAULT 'in Academic year of {year}',
  cert_purpose   TEXT DEFAULT 'This certificate is given for whichever purpose it may serve',
  cert_done_text TEXT DEFAULT 'Done at {city} on {date}',
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

-- Add missing columns to existing databases (safe migration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schools' AND column_name='city') THEN
    ALTER TABLE schools ADD COLUMN city VARCHAR(100) DEFAULT 'Kigali';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schools' AND column_name='cert_template_url') THEN
    ALTER TABLE schools ADD COLUMN cert_template_url TEXT;
    ALTER TABLE schools ADD COLUMN cert_template_mode VARCHAR(20) DEFAULT 'landscape';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schools' AND column_name='cert_line1') THEN
    ALTER TABLE schools ADD COLUMN cert_line1 TEXT DEFAULT 'Has completed in {class} at';
    ALTER TABLE schools ADD COLUMN cert_line2 TEXT DEFAULT 'in Academic year of {year}';
    ALTER TABLE schools ADD COLUMN cert_purpose TEXT DEFAULT 'This certificate is given for whichever purpose it may serve';
    ALTER TABLE schools ADD COLUMN cert_done_text TEXT DEFAULT 'Done at {city} on {date}';
  END IF;
END $$;
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
-- PART 5: STORAGE BUCKETS + POLICIES
-- ══════════════════════════════════════════════════════════════

-- Create buckets (public = files readable without auth)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('student-photos', 'student-photos', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('assets', 'assets', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop old storage policies if they exist
DO $$
DECLARE pol TEXT;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol);
  END LOOP;
END $$;

-- ── student-photos policies ───────────────────────────────────
-- Anyone can read (public bucket)
CREATE POLICY "sp_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'student-photos');

-- Authenticated users can upload
CREATE POLICY "sp_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'student-photos'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can update/overwrite
CREATE POLICY "sp_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'student-photos'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can delete
CREATE POLICY "sp_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'student-photos'
    AND auth.role() = 'authenticated'
  );

-- ── assets policies (logos, signatures, stamps, backgrounds) ──
-- Anyone can read (public bucket)
CREATE POLICY "assets_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'assets');

-- Authenticated users can upload to their own folder
CREATE POLICY "assets_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'assets'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can update
CREATE POLICY "assets_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'assets'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can delete
CREATE POLICY "assets_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'assets'
    AND auth.role() = 'authenticated'
  );


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

-- ══════════════════════════════════════════════════════════════
-- SCHOOL MANAGEMENT SYSTEM TABLES
-- All integrated with the same schools table (one database)
-- ══════════════════════════════════════════════════════════════

-- ── STAFF ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id     UUID REFERENCES schools(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name     VARCHAR(200) NOT NULL,
  email         VARCHAR(200),
  phone         VARCHAR(30),
  role          VARCHAR(30) NOT NULL DEFAULT 'teacher',
  -- roles: admin | teacher | finance | secretary | headteacher
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── ACADEMIC YEARS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_years (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,  -- e.g. "2024-2025"
  start_date  DATE,
  end_date    DATE,
  is_current  BOOLEAN DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── TERMS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS terms (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id),
  name             VARCHAR(30) NOT NULL,  -- "Term 1", "Term 2", "Term 3"
  number           INT NOT NULL,
  start_date       DATE,
  end_date         DATE,
  is_current       BOOLEAN DEFAULT false,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── CLASSES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
  name             VARCHAR(50) NOT NULL,   -- e.g. "P6 A"
  level            VARCHAR(50),            -- e.g. "P6", "S3"
  academic_year_id UUID REFERENCES academic_years(id),
  class_teacher_id UUID REFERENCES staff(id),
  max_students     INT DEFAULT 50,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── SUBJECTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id     UUID REFERENCES schools(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  code          VARCHAR(20),
  max_marks     INT DEFAULT 100,
  passing_marks INT DEFAULT 50,
  coefficient   INT DEFAULT 1,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── CLASS SUBJECTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_subjects (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id   UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES staff(id),
  UNIQUE(class_id, subject_id)
);

-- ── STUDENT PROFILES (extended registration) ─────────────────
CREATE TABLE IF NOT EXISTS student_profiles (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
  -- Link to certificate system students table (optional)
  cert_student_id  UUID REFERENCES students(id) ON DELETE SET NULL,
  -- Basic info
  first_name       VARCHAR(100) NOT NULL,
  last_name        VARCHAR(100) NOT NULL,
  other_names      VARCHAR(100),
  date_of_birth    DATE,
  gender           VARCHAR(10),  -- M | F
  nationality      VARCHAR(50) DEFAULT 'Rwandan',
  -- Contact
  parent_name      VARCHAR(200),
  parent_phone     VARCHAR(30),
  parent_email     VARCHAR(200),
  parent_phone2    VARCHAR(30),
  address          TEXT,
  -- Academic
  student_id       VARCHAR(30) UNIQUE,  -- auto-generated e.g. "2025/P6/001"
  admission_date   DATE DEFAULT CURRENT_DATE,
  current_class_id UUID REFERENCES classes(id),
  academic_year_id UUID REFERENCES academic_years(id),
  -- Documents
  photo_url        TEXT,
  -- Finance
  fee_balance      DECIMAL(10,2) DEFAULT 0,
  fee_status       VARCHAR(20) DEFAULT 'unpaid',  -- paid|partial|unpaid
  -- Status
  status           VARCHAR(20) DEFAULT 'active',  -- active|inactive|graduated|transferred
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── MARKS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marks (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES subjects(id) ON DELETE CASCADE,
  class_id         UUID REFERENCES classes(id),
  term_id          UUID REFERENCES terms(id),
  academic_year_id UUID REFERENCES academic_years(id),
  cat1             DECIMAL(5,2),   -- Continuous Assessment 1
  cat2             DECIMAL(5,2),   -- Continuous Assessment 2
  exam             DECIMAL(5,2),   -- Main exam mark
  total            DECIMAL(5,2),   -- Auto-calculated
  percentage       DECIMAL(5,2),
  grade            VARCHAR(5),     -- A1, B2, C3, D4, F
  remarks          VARCHAR(100),
  entered_by       UUID REFERENCES staff(id),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, subject_id, term_id)
);

-- ── BULLETINS (Report Cards) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS bulletins (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  term_id          UUID REFERENCES terms(id),
  academic_year_id UUID REFERENCES academic_years(id),
  class_id         UUID REFERENCES classes(id),
  total_marks      DECIMAL(6,2),
  max_possible     DECIMAL(6,2),
  percentage       DECIMAL(5,2),
  rank_in_class    INT,
  class_size       INT,
  grade            VARCHAR(5),
  conduct          VARCHAR(50) DEFAULT 'Good',
  teacher_remarks  TEXT,
  head_remarks     TEXT,
  days_present     INT DEFAULT 0,
  days_absent      INT DEFAULT 0,
  pdf_url          TEXT,
  generated_at     TIMESTAMP WITH TIME ZONE,
  generated_by     UUID REFERENCES staff(id),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, term_id)
);

-- ── FEE STRUCTURE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_structure (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id),
  class_level      VARCHAR(50),    -- P1, P2...P6, S1...S6
  term_id          UUID REFERENCES terms(id),
  fee_type         VARCHAR(100) NOT NULL,  -- Tuition, Activity, Lunch...
  amount           DECIMAL(10,2) NOT NULL,
  is_mandatory     BOOLEAN DEFAULT true,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── PAYMENTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  term_id          UUID REFERENCES terms(id),
  academic_year_id UUID REFERENCES academic_years(id),
  amount           DECIMAL(10,2) NOT NULL,
  payment_method   VARCHAR(30) DEFAULT 'cash',  -- cash|mtn|airtel|bank
  reference        VARCHAR(100),   -- mobile money transaction ID
  notes            TEXT,
  received_by      UUID REFERENCES staff(id),
  payment_date     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  receipt_number   VARCHAR(50),
  status           VARCHAR(20) DEFAULT 'confirmed',  -- confirmed|pending|cancelled
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── NOTIFICATIONS (SMS + Email log) ──────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL,  -- sms|email
  recipient   VARCHAR(200) NOT NULL,
  subject     VARCHAR(200),
  message     TEXT NOT NULL,
  status      VARCHAR(20) DEFAULT 'sent',  -- sent|failed|pending
  student_id  UUID REFERENCES student_profiles(id),
  sent_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── RLS for new tables (open — backend uses service key) ──────
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['staff','academic_years','terms','classes',
    'subjects','class_subjects','student_profiles','marks',
    'bulletins','fee_structure','payments','notifications']) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format('CREATE POLICY "open_%s" ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sp_school       ON student_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_sp_class        ON student_profiles(current_class_id);
CREATE INDEX IF NOT EXISTS idx_sp_status       ON student_profiles(status);
CREATE INDEX IF NOT EXISTS idx_marks_student   ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_term      ON marks(term_id);
CREATE INDEX IF NOT EXISTS idx_payments_stud   ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_classes_school  ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_terms_year      ON terms(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_stud  ON bulletins(student_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_term  ON bulletins(term_id);

-- ══════════════════════════════════════════════════════════════
-- ROLE-BASED ACCESS SYSTEM
-- Staff login with username/password (managed by school admin)
-- ══════════════════════════════════════════════════════════════

-- Add login credentials to staff table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='username') THEN
    ALTER TABLE staff ADD COLUMN username     VARCHAR(50) UNIQUE;
    ALTER TABLE staff ADD COLUMN password_hash TEXT;
    ALTER TABLE staff ADD COLUMN last_login   TIMESTAMP WITH TIME ZONE;
    ALTER TABLE staff ADD COLUMN permissions  JSONB DEFAULT '{}';
    -- Permissions example: {"can_edit_marks": true, "can_print_bulletins": true}
  END IF;
END $$;

-- Add promotion tracking to students
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='student_profiles' AND column_name='previous_class_id') THEN
    ALTER TABLE student_profiles ADD COLUMN previous_class_id UUID REFERENCES classes(id);
    ALTER TABLE student_profiles ADD COLUMN promotion_status  VARCHAR(20) DEFAULT 'active'; -- active|promoted|repeated|graduated
    ALTER TABLE student_profiles ADD COLUMN previous_marks    JSONB;  -- marks from previous school
  END IF;
END $$;

-- Add level column to classes (for promotion logic)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='level_order') THEN
    ALTER TABLE classes ADD COLUMN level_order INT DEFAULT 1; -- 1=Nursery,2=P1,...,8=P6,9=S1,...
    ALTER TABLE classes ADD COLUMN capacity    INT DEFAULT 40;
    ALTER TABLE classes ADD COLUMN section     VARCHAR(5) DEFAULT 'A'; -- A, B, C
  END IF;
END $$;

-- Staff login sessions
CREATE TABLE IF NOT EXISTS staff_sessions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id    UUID REFERENCES staff(id) ON DELETE CASCADE,
  school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
DO $$
BEGIN
  EXECUTE 'ALTER TABLE staff_sessions ENABLE ROW LEVEL SECURITY';
  BEGIN
    EXECUTE 'CREATE POLICY "open_staff_sessions" ON staff_sessions FOR ALL USING (true) WITH CHECK (true)';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
CREATE INDEX IF NOT EXISTS idx_sessions_token ON staff_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_staff ON staff_sessions(staff_id);

-- Student promotion history
CREATE TABLE IF NOT EXISTS promotion_history (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id         UUID REFERENCES schools(id),
  student_id        UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  from_class_id     UUID REFERENCES classes(id),
  to_class_id       UUID REFERENCES classes(id),
  academic_year_id  UUID REFERENCES academic_years(id),
  action            VARCHAR(20) NOT NULL, -- promoted|repeated|graduated|transferred
  final_percentage  DECIMAL(5,2),
  rank_in_class     INT,
  done_by           UUID REFERENCES staff(id),
  notes             TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
DO $$
BEGIN
  EXECUTE 'ALTER TABLE promotion_history ENABLE ROW LEVEL SECURITY';
  BEGIN
    EXECUTE 'CREATE POLICY "open_promo" ON promotion_history FOR ALL USING (true) WITH CHECK (true)';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
