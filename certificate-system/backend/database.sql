-- ============================================================
-- SCHOOL MANAGEMENT SYSTEM — Database Setup
-- Run in Supabase SQL Editor
-- ============================================================
-- ⚠️  RUN IN 3 SEPARATE STEPS TO AVOID DEADLOCKS:
--   STEP 1: Run lines below up to "END STEP 1"
--   STEP 2: Run lines below up to "END STEP 2"
--   STEP 3: Run the rest
-- OR just run each step in a new query tab
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- STEP 1 — CREATE ALL TABLES
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schools (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  school_name       VARCHAR(200) NOT NULL DEFAULT 'My School',
  signatory_name    VARCHAR(100) DEFAULT 'Head Teacher',
  logo_url          TEXT,
  stamp_url         TEXT,
  signature_url     TEXT,
  background_url    TEXT,
  bg_preset         VARCHAR(50) DEFAULT 'none',
  active_year       VARCHAR(10) DEFAULT '2025',
  city              VARCHAR(100) DEFAULT 'Kigali',
  cert_line1        TEXT DEFAULT 'Has completed in {class} at',
  cert_line2        TEXT DEFAULT 'in Academic year of {year}',
  cert_purpose      TEXT DEFAULT 'This certificate is given for whichever purpose it may serve',
  cert_done_text    TEXT DEFAULT 'Done at {city} on {date}',
  cert_template_url TEXT,
  cert_template_mode VARCHAR(20) DEFAULT 'landscape',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id    UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  photo_number VARCHAR(20) NOT NULL,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100) NOT NULL,
  class        VARCHAR(50) NOT NULL,
  year         VARCHAR(10) NOT NULL DEFAULT '2025',
  photo_url    TEXT,
  status       VARCHAR(20) DEFAULT 'active',
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(school_id, photo_number, year)
);

CREATE TABLE IF NOT EXISTS certificates (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id   UUID REFERENCES students(id) ON DELETE CASCADE,
  school_id    UUID REFERENCES schools(id) ON DELETE CASCADE,
  template     VARCHAR(50) NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  printed_by   UUID REFERENCES auth.users(id),
  pdf_path     TEXT
);

CREATE TABLE IF NOT EXISTS staff (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id     UUID REFERENCES schools(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name     VARCHAR(200) NOT NULL,
  email         VARCHAR(200),
  phone         VARCHAR(30),
  role          VARCHAR(30) NOT NULL DEFAULT 'teacher',
  username      VARCHAR(50),
  password_hash TEXT,
  last_login    TIMESTAMP WITH TIME ZONE,
  permissions   JSONB DEFAULT '{}',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_sessions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id    UUID REFERENCES staff(id) ON DELETE CASCADE,
  school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_years (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,
  start_date  DATE, end_date DATE,
  is_current  BOOLEAN DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS terms (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id),
  name             VARCHAR(30) NOT NULL,
  number           INT NOT NULL,
  start_date       DATE, end_date DATE,
  is_current       BOOLEAN DEFAULT false,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
  name             VARCHAR(50) NOT NULL,
  level            VARCHAR(50),
  level_order      INT DEFAULT 1,
  section          VARCHAR(5) DEFAULT 'A',
  capacity         INT DEFAULT 40,
  academic_year_id UUID REFERENCES academic_years(id),
  class_teacher_id UUID REFERENCES staff(id),
  max_students     INT DEFAULT 50,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS class_subjects (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id   UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES staff(id),
  UNIQUE(class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id         UUID REFERENCES schools(id) ON DELETE CASCADE,
  cert_student_id   UUID REFERENCES students(id) ON DELETE SET NULL,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  other_names       VARCHAR(100),
  date_of_birth     DATE,
  gender            VARCHAR(10),
  nationality       VARCHAR(50) DEFAULT 'Rwandan',
  parent_name       VARCHAR(200),
  parent_phone      VARCHAR(30),
  parent_email      VARCHAR(200),
  parent_phone2     VARCHAR(30),
  address           TEXT,
  student_id        VARCHAR(30) UNIQUE,
  admission_date    DATE DEFAULT CURRENT_DATE,
  current_class_id  UUID REFERENCES classes(id),
  previous_class_id UUID REFERENCES classes(id),
  academic_year_id  UUID REFERENCES academic_years(id),
  photo_url         TEXT,
  previous_marks    JSONB,
  fee_balance       DECIMAL(10,2) DEFAULT 0,
  fee_status        VARCHAR(20) DEFAULT 'unpaid',
  status            VARCHAR(20) DEFAULT 'active',
  promotion_status  VARCHAR(20) DEFAULT 'active',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marks (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES subjects(id) ON DELETE CASCADE,
  class_id         UUID REFERENCES classes(id),
  term_id          UUID REFERENCES terms(id),
  academic_year_id UUID REFERENCES academic_years(id),
  cat1 DECIMAL(5,2), cat2 DECIMAL(5,2), exam DECIMAL(5,2),
  total DECIMAL(5,2), percentage DECIMAL(5,2),
  grade VARCHAR(5), remarks VARCHAR(100),
  entered_by UUID REFERENCES staff(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, subject_id, term_id)
);

CREATE TABLE IF NOT EXISTS bulletins (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  term_id          UUID REFERENCES terms(id),
  academic_year_id UUID REFERENCES academic_years(id),
  class_id         UUID REFERENCES classes(id),
  total_marks DECIMAL(6,2), max_possible DECIMAL(6,2),
  percentage DECIMAL(5,2), rank_in_class INT, class_size INT,
  grade VARCHAR(5), conduct VARCHAR(50) DEFAULT 'Good',
  teacher_remarks TEXT, head_remarks TEXT,
  days_present INT DEFAULT 0, days_absent INT DEFAULT 0,
  pdf_url TEXT, generated_at TIMESTAMP WITH TIME ZONE,
  generated_by UUID REFERENCES staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, term_id)
);

CREATE TABLE IF NOT EXISTS fee_structure (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id),
  class_level VARCHAR(50), term_id UUID REFERENCES terms(id),
  fee_type VARCHAR(100) NOT NULL, amount DECIMAL(10,2) NOT NULL,
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  term_id UUID REFERENCES terms(id),
  academic_year_id UUID REFERENCES academic_years(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(30) DEFAULT 'cash',
  reference VARCHAR(100), notes TEXT,
  received_by UUID REFERENCES staff(id),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  receipt_number VARCHAR(50), status VARCHAR(20) DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotion_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id),
  student_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  from_class_id UUID REFERENCES classes(id),
  to_class_id   UUID REFERENCES classes(id),
  academic_year_id UUID REFERENCES academic_years(id),
  action VARCHAR(20) NOT NULL,
  final_percentage DECIMAL(5,2), rank_in_class INT,
  done_by UUID REFERENCES staff(id), notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, recipient VARCHAR(200) NOT NULL,
  subject VARCHAR(200), message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  student_id UUID REFERENCES student_profiles(id),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL, description TEXT,
  color VARCHAR(20) DEFAULT '#2563eb',
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  name VARCHAR(300) NOT NULL, file_url TEXT NOT NULL,
  file_type VARCHAR(50), file_size BIGINT,
  uploaded_by UUID REFERENCES staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_schools_user_id         ON schools(user_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id      ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_photo_number   ON students(photo_number);
CREATE INDEX IF NOT EXISTS idx_certificates_school_id  ON certificates(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_school            ON staff(school_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token          ON staff_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sp_school               ON student_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_sp_class                ON student_profiles(current_class_id);
CREATE INDEX IF NOT EXISTS idx_marks_student           ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_term              ON marks(term_id);
CREATE INDEX IF NOT EXISTS idx_payments_student        ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_student       ON bulletins(student_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_school      ON document_folders(school_id);
CREATE INDEX IF NOT EXISTS idx_docs_folder             ON school_documents(folder_id);

-- ── MIGRATION — add missing columns to existing dbs ──────────
ALTER TABLE schools ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Kigali';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_line1 TEXT DEFAULT 'Has completed in {class} at';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_line2 TEXT DEFAULT 'in Academic year of {year}';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_purpose TEXT DEFAULT 'This certificate is given for whichever purpose it may serve';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_done_text TEXT DEFAULT 'Done at {city} on {date}';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_template_url TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cert_template_mode VARCHAR(20) DEFAULT 'landscape';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS username VARCHAR(50);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS previous_class_id UUID REFERENCES classes(id);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS promotion_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS previous_marks JSONB;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS level_order INT DEFAULT 1;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 40;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS section VARCHAR(5) DEFAULT 'A';

-- ════════════════════════════════════════════════════════════
-- STEP 2 — RLS POLICIES (run separately if Step 1 succeeded)
-- ════════════════════════════════════════════════════════════

ALTER TABLE schools            ENABLE ROW LEVEL SECURITY;
ALTER TABLE students           ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff              ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years     ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulletins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_folders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_documents   ENABLE ROW LEVEL SECURITY;

-- Schools: owner only
DROP POLICY IF EXISTS "schools_owner"  ON schools;
DROP POLICY IF EXISTS "schools_select" ON schools;
DROP POLICY IF EXISTS "schools_insert" ON schools;
DROP POLICY IF EXISTS "schools_update" ON schools;
DROP POLICY IF EXISTS "schools_delete" ON schools;
DROP POLICY IF EXISTS "school_owner_select" ON schools;
DROP POLICY IF EXISTS "school_owner_insert" ON schools;
DROP POLICY IF EXISTS "school_owner_update" ON schools;
DROP POLICY IF EXISTS "school_owner_delete" ON schools;

CREATE POLICY "schools_owner" ON schools
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- All other tables: open (backend uses service key)
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
    EXECUTE format('CREATE POLICY "open_%s" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════
-- STEP 3 — TRIGGER + STORAGE BUCKETS
-- ════════════════════════════════════════════════════════════

-- Auto-create school after signup
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

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('assets',         'assets',         true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents',      'documents',      true) ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies (drop old first to avoid duplicates)
DROP POLICY IF EXISTS "sp_read"    ON storage.objects;
DROP POLICY IF EXISTS "sp_upload"  ON storage.objects;
DROP POLICY IF EXISTS "sp_update"  ON storage.objects;
DROP POLICY IF EXISTS "sp_delete"  ON storage.objects;
DROP POLICY IF EXISTS "assets_read"   ON storage.objects;
DROP POLICY IF EXISTS "assets_upload" ON storage.objects;
DROP POLICY IF EXISTS "assets_update" ON storage.objects;
DROP POLICY IF EXISTS "assets_delete" ON storage.objects;
DROP POLICY IF EXISTS "docs_read"   ON storage.objects;
DROP POLICY IF EXISTS "docs_upload" ON storage.objects;
DROP POLICY IF EXISTS "docs_delete" ON storage.objects;

CREATE POLICY "sp_read"    ON storage.objects FOR SELECT USING (bucket_id = 'student-photos');
CREATE POLICY "sp_upload"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'student-photos' AND auth.role() = 'authenticated');
CREATE POLICY "sp_update"  ON storage.objects FOR UPDATE USING (bucket_id = 'student-photos' AND auth.role() = 'authenticated');
CREATE POLICY "sp_delete"  ON storage.objects FOR DELETE USING (bucket_id = 'student-photos' AND auth.role() = 'authenticated');
CREATE POLICY "assets_read"   ON storage.objects FOR SELECT USING (bucket_id = 'assets');
CREATE POLICY "assets_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');
CREATE POLICY "assets_update" ON storage.objects FOR UPDATE USING (bucket_id = 'assets' AND auth.role() = 'authenticated');
CREATE POLICY "assets_delete" ON storage.objects FOR DELETE USING (bucket_id = 'assets' AND auth.role() = 'authenticated');
CREATE POLICY "docs_read"   ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "docs_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
CREATE POLICY "docs_delete" ON storage.objects FOR DELETE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Verify
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
