-- ================================================================
-- SCHOOL MANAGEMENT SYSTEM — Complete Database Setup
-- Version: 2.0  |  Updated: 2026
-- ================================================================
-- HOW TO RUN:
--   Go to Supabase Dashboard → SQL Editor → New Query
--   Paste ALL of this file and click RUN
--   It is safe to run multiple times (uses IF NOT EXISTS / IF EXISTS)
-- ================================================================


-- ================================================================
-- PART 1 — TABLES
-- ================================================================

-- Schools (one per registered account)
CREATE TABLE IF NOT EXISTS schools (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  school_name        VARCHAR(200) NOT NULL DEFAULT 'My School',
  signatory_name     VARCHAR(100) DEFAULT 'Head Teacher',
  logo_url           TEXT,
  stamp_url          TEXT,
  signature_url      TEXT,
  background_url     TEXT,
  bg_preset          VARCHAR(50)  DEFAULT 'none',
  active_year        VARCHAR(10)  DEFAULT '2025',
  city               VARCHAR(100) DEFAULT 'Kigali',
  phone              VARCHAR(30),
  address            TEXT,
  -- Certificate text templates
  cert_line1         TEXT DEFAULT 'Has completed {class} at',
  cert_line2         TEXT DEFAULT 'in Academic year {year}',
  cert_purpose       TEXT DEFAULT 'This certificate is given for whichever purpose it may serve',
  cert_done_text     TEXT DEFAULT 'Done at {city} on {date}',
  cert_template_url  TEXT,
  cert_template_mode VARCHAR(20) DEFAULT 'landscape',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Certificate students (photo-based, legacy)
CREATE TABLE IF NOT EXISTS students (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id    UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  photo_number VARCHAR(20) NOT NULL,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100) NOT NULL,
  class        VARCHAR(50)  NOT NULL,
  year         VARCHAR(10)  NOT NULL DEFAULT '2025',
  photo_url    TEXT,
  status       VARCHAR(20)  DEFAULT 'active',
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(school_id, photo_number, year)
);

-- Certificates generated
CREATE TABLE IF NOT EXISTS certificates (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id   UUID REFERENCES students(id) ON DELETE CASCADE,
  school_id    UUID REFERENCES schools(id)  ON DELETE CASCADE,
  template     VARCHAR(50) NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  printed_by   UUID REFERENCES auth.users(id),
  pdf_path     TEXT
);

-- Staff accounts (all roles: admin/dos/teacher/secretary/finance)
CREATE TABLE IF NOT EXISTS staff (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id     UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name     VARCHAR(200) NOT NULL,
  email         VARCHAR(200),
  phone         VARCHAR(30),
  role          VARCHAR(30)  NOT NULL DEFAULT 'teacher',
  username      VARCHAR(50),
  password_hash TEXT,
  last_login    TIMESTAMPTZ,
  permissions   JSONB   DEFAULT '{}',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, username)
);

-- Staff login sessions
CREATE TABLE IF NOT EXISTS staff_sessions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id   UUID REFERENCES staff(id)   ON DELETE CASCADE NOT NULL,
  school_id  UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Academic years per school
CREATE TABLE IF NOT EXISTS academic_years (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id  UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  name       VARCHAR(50) NOT NULL,
  start_date DATE,
  end_date   DATE,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Terms (Trimester 1/2/3 etc.)
CREATE TABLE IF NOT EXISTS terms (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id)        ON DELETE CASCADE NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  name             VARCHAR(30) NOT NULL,
  number           INT NOT NULL,
  start_date       DATE,
  end_date         DATE,
  is_current       BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Classes (P1A, P2B, S3, etc.)
CREATE TABLE IF NOT EXISTS classes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id)        ON DELETE CASCADE NOT NULL,
  name             VARCHAR(50) NOT NULL,
  level            VARCHAR(50),
  level_order      INT DEFAULT 1,
  section          VARCHAR(5) DEFAULT 'A',
  capacity         INT DEFAULT 40,
  max_students     INT DEFAULT 50,
  academic_year_id UUID REFERENCES academic_years(id),
  class_teacher_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id     UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  name          VARCHAR(100) NOT NULL,
  code          VARCHAR(20),
  max_marks     INT DEFAULT 100,
  passing_marks INT DEFAULT 50,
  coefficient   INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Class ↔ Subject assignments (with teacher)
CREATE TABLE IF NOT EXISTS class_subjects (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id   UUID REFERENCES classes(id)  ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES staff(id)    ON DELETE SET NULL,
  UNIQUE(class_id, subject_id)
);

-- Full student profiles (SMS students — richer than cert students)
CREATE TABLE IF NOT EXISTS student_profiles (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id         UUID REFERENCES schools(id)   ON DELETE CASCADE NOT NULL,
  cert_student_id   UUID REFERENCES students(id)  ON DELETE SET NULL,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  other_names       VARCHAR(100),
  date_of_birth     DATE,
  gender            VARCHAR(10),
  nationality       VARCHAR(50) DEFAULT 'Rwandan',
  parent_name       VARCHAR(200),
  parent_phone      VARCHAR(30),
  parent_phone2     VARCHAR(30),
  parent_email      VARCHAR(200),
  address           TEXT,
  student_id        VARCHAR(30),
  admission_date    DATE DEFAULT CURRENT_DATE,
  current_class_id  UUID REFERENCES classes(id) ON DELETE SET NULL,
  previous_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  academic_year_id  UUID REFERENCES academic_years(id),
  photo_url         TEXT,
  previous_marks    JSONB,
  fee_balance       DECIMAL(10,2) DEFAULT 0,
  fee_status        VARCHAR(20) DEFAULT 'unpaid',
  status            VARCHAR(20) DEFAULT 'active',
  promotion_status  VARCHAR(20) DEFAULT 'active',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, student_id)
);

-- Marks per student per subject per term
CREATE TABLE IF NOT EXISTS marks (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id)          ON DELETE CASCADE NOT NULL,
  student_id       UUID REFERENCES student_profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id       UUID REFERENCES subjects(id)         ON DELETE CASCADE NOT NULL,
  class_id         UUID REFERENCES classes(id)          ON DELETE SET NULL,
  term_id          UUID REFERENCES terms(id)            ON DELETE SET NULL,
  academic_year_id UUID REFERENCES academic_years(id),
  cat1             DECIMAL(5,2),
  cat2             DECIMAL(5,2),
  exam             DECIMAL(5,2),
  total            DECIMAL(5,2),
  percentage       DECIMAL(5,2),
  grade            VARCHAR(5),
  remarks          VARCHAR(100),
  entered_by       UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, term_id)
);

-- Report cards / bulletins
CREATE TABLE IF NOT EXISTS bulletins (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id)          ON DELETE CASCADE NOT NULL,
  student_id       UUID REFERENCES student_profiles(id) ON DELETE CASCADE NOT NULL,
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
  generated_at     TIMESTAMPTZ,
  generated_by     UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, term_id)
);

-- Fee structure per class/level/term
CREATE TABLE IF NOT EXISTS fee_structure (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id),
  class_level      VARCHAR(50),
  term_id          UUID REFERENCES terms(id),
  fee_type         VARCHAR(100) NOT NULL,
  amount           DECIMAL(10,2) NOT NULL,
  is_mandatory     BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Fee payments
CREATE TABLE IF NOT EXISTS payments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id)          ON DELETE CASCADE NOT NULL,
  student_id       UUID REFERENCES student_profiles(id) ON DELETE CASCADE NOT NULL,
  term_id          UUID REFERENCES terms(id),
  academic_year_id UUID REFERENCES academic_years(id),
  amount           DECIMAL(10,2) NOT NULL,
  payment_method   VARCHAR(30) DEFAULT 'cash',
  reference        VARCHAR(100),
  notes            TEXT,
  received_by      UUID REFERENCES staff(id) ON DELETE SET NULL,
  payment_date     TIMESTAMPTZ DEFAULT NOW(),
  receipt_number   VARCHAR(50),
  status           VARCHAR(20) DEFAULT 'confirmed',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Student promotion history
CREATE TABLE IF NOT EXISTS promotion_history (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id)          ON DELETE CASCADE,
  student_id       UUID REFERENCES student_profiles(id) ON DELETE CASCADE NOT NULL,
  from_class_id    UUID REFERENCES classes(id)          ON DELETE SET NULL,
  to_class_id      UUID REFERENCES classes(id)          ON DELETE SET NULL,
  academic_year_id UUID REFERENCES academic_years(id),
  action           VARCHAR(20) NOT NULL,  -- 'promoted' | 'repeated' | 'transferred'
  final_percentage DECIMAL(5,2),
  rank_in_class    INT,
  done_by          UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- SMS & email notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id  UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  type       VARCHAR(20) NOT NULL,   -- 'sms' | 'email'
  recipient  VARCHAR(200) NOT NULL,
  subject    VARCHAR(200),
  message    TEXT NOT NULL,
  status     VARCHAR(20) DEFAULT 'sent',
  student_id UUID REFERENCES student_profiles(id) ON DELETE SET NULL,
  sent_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Document folders (Secretary)
CREATE TABLE IF NOT EXISTS document_folders (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id  UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  name       VARCHAR(200) NOT NULL,
  description TEXT,
  color      VARCHAR(20) DEFAULT '#2563eb',
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- School documents (uploaded files)
CREATE TABLE IF NOT EXISTS school_documents (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id   UUID REFERENCES schools(id)          ON DELETE CASCADE NOT NULL,
  folder_id   UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  name        VARCHAR(300) NOT NULL,
  file_url    TEXT NOT NULL,
  file_type   VARCHAR(50),
  file_size   BIGINT,
  uploaded_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ================================================================
-- PART 2 — INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_schools_user_id        ON schools(user_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id     ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_photo_number  ON students(photo_number);
CREATE INDEX IF NOT EXISTS idx_certs_school_id        ON certificates(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_school           ON staff(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_username         ON staff(username);
CREATE INDEX IF NOT EXISTS idx_sessions_token         ON staff_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_staff         ON staff_sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_sp_school              ON student_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_sp_class               ON student_profiles(current_class_id);
CREATE INDEX IF NOT EXISTS idx_sp_student_id          ON student_profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_student          ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_term             ON marks(term_id);
CREATE INDEX IF NOT EXISTS idx_marks_class            ON marks(class_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_student      ON bulletins(student_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_term         ON bulletins(term_id);
CREATE INDEX IF NOT EXISTS idx_payments_student       ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_school        ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_school     ON document_folders(school_id);
CREATE INDEX IF NOT EXISTS idx_docs_folder            ON school_documents(folder_id);


-- ================================================================
-- PART 3 — SAFE MIGRATIONS (add columns to existing tables)
-- ================================================================

ALTER TABLE schools ADD COLUMN IF NOT EXISTS phone   VARCHAR(30);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS city    VARCHAR(100) DEFAULT 'Kigali';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_line1        TEXT DEFAULT 'Has completed {class} at';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_line2        TEXT DEFAULT 'in Academic year {year}';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_purpose      TEXT DEFAULT 'This certificate is given for whichever purpose it may serve';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_done_text    TEXT DEFAULT 'Done at {city} on {date}';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_template_url  TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_template_mode VARCHAR(20) DEFAULT 'landscape';

ALTER TABLE staff ADD COLUMN IF NOT EXISTS username      VARCHAR(50);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_login    TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permissions   JSONB DEFAULT '{}';

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS previous_class_id UUID REFERENCES classes(id);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS promotion_status  VARCHAR(20) DEFAULT 'active';
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS previous_marks    JSONB;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS other_names       VARCHAR(100);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS parent_phone2     VARCHAR(30);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS level_order INT DEFAULT 1;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS capacity    INT DEFAULT 40;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS section     VARCHAR(5) DEFAULT 'A';

-- Add UNIQUE constraint on staff(school_id, username) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_school_id_username_key'
  ) THEN
    ALTER TABLE staff ADD CONSTRAINT staff_school_id_username_key UNIQUE (school_id, username);
  END IF;
END $$;


-- ================================================================
-- PART 4 — ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE schools           ENABLE ROW LEVEL SECURITY;
ALTER TABLE students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff             ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years    ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulletins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_folders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_documents  ENABLE ROW LEVEL SECURITY;

-- Schools: authenticated owner only
DROP POLICY IF EXISTS "schools_owner"       ON schools;
DROP POLICY IF EXISTS "schools_select"      ON schools;
DROP POLICY IF EXISTS "schools_insert"      ON schools;
DROP POLICY IF EXISTS "schools_update"      ON schools;
DROP POLICY IF EXISTS "schools_delete"      ON schools;
DROP POLICY IF EXISTS "school_owner_select" ON schools;
DROP POLICY IF EXISTS "school_owner_insert" ON schools;
DROP POLICY IF EXISTS "school_owner_update" ON schools;
DROP POLICY IF EXISTS "school_owner_delete" ON schools;

CREATE POLICY "schools_owner" ON schools
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- All other tables: fully open (backend uses service_role key which bypasses RLS)
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'students','certificates','staff','staff_sessions',
    'academic_years','terms','classes','subjects','class_subjects',
    'student_profiles','marks','bulletins','fee_structure','payments',
    'promotion_history','notifications','document_folders','school_documents'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "open_%s" ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "open_%s" ON %I FOR ALL USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;


-- ================================================================
-- PART 5 — TRIGGER: auto-create school on signup
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.schools (user_id, school_name, active_year, city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'school_name', 'My School'),
    COALESCE(NEW.raw_user_meta_data->>'active_year',  EXTRACT(YEAR FROM NOW())::TEXT),
    COALESCE(NEW.raw_user_meta_data->>'city',         'Kigali')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ================================================================
-- PART 6 — STORAGE BUCKETS
-- ================================================================

INSERT INTO storage.buckets (id, name, public)
  VALUES ('student-photos', 'student-photos', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('assets', 'assets', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('documents', 'documents', true)
  ON CONFLICT (id) DO UPDATE SET public = true;


-- ================================================================
-- PART 7 — STORAGE POLICIES
-- ================================================================

-- Drop all old policies first
DROP POLICY IF EXISTS "sp_read"       ON storage.objects;
DROP POLICY IF EXISTS "sp_upload"     ON storage.objects;
DROP POLICY IF EXISTS "sp_update"     ON storage.objects;
DROP POLICY IF EXISTS "sp_delete"     ON storage.objects;
DROP POLICY IF EXISTS "assets_read"   ON storage.objects;
DROP POLICY IF EXISTS "assets_upload" ON storage.objects;
DROP POLICY IF EXISTS "assets_update" ON storage.objects;
DROP POLICY IF EXISTS "assets_delete" ON storage.objects;
DROP POLICY IF EXISTS "docs_read"     ON storage.objects;
DROP POLICY IF EXISTS "docs_upload"   ON storage.objects;
DROP POLICY IF EXISTS "docs_update"   ON storage.objects;
DROP POLICY IF EXISTS "docs_delete"   ON storage.objects;

-- student-photos bucket
CREATE POLICY "sp_read"   ON storage.objects FOR SELECT USING (bucket_id = 'student-photos');
CREATE POLICY "sp_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'student-photos');
CREATE POLICY "sp_update" ON storage.objects FOR UPDATE USING (bucket_id = 'student-photos');
CREATE POLICY "sp_delete" ON storage.objects FOR DELETE USING (bucket_id = 'student-photos');

-- assets bucket (logos, signatures, stamps)
CREATE POLICY "assets_read"   ON storage.objects FOR SELECT USING (bucket_id = 'assets');
CREATE POLICY "assets_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets');
CREATE POLICY "assets_update" ON storage.objects FOR UPDATE USING (bucket_id = 'assets');
CREATE POLICY "assets_delete" ON storage.objects FOR DELETE USING (bucket_id = 'assets');

-- documents bucket (school documents)
CREATE POLICY "docs_read"   ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "docs_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
CREATE POLICY "docs_update" ON storage.objects FOR UPDATE USING (bucket_id = 'documents');
CREATE POLICY "docs_delete" ON storage.objects FOR DELETE USING (bucket_id = 'documents');


-- ================================================================
-- DONE — Verify tables created
-- ================================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
