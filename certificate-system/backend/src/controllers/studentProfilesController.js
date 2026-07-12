const { supabase } = require('../supabase');

// ── Explicit join hints to avoid ambiguous FK (current_class_id vs previous_class_id)
const STUDENT_SELECT = `
  *,
  current_class:classes!student_profiles_current_class_id_fkey(id,name,level),
  academic_year:academic_years(id,name)
`.trim();

// ── GET /api/sms/students ─────────────────────────────────────
exports.getStudents = async (req, res) => {
  try {
    const { class_id, status, search, academic_year_id } = req.query;
    let q = supabase.from('student_profiles')
      .select(STUDENT_SELECT)
      .eq('school_id', req.schoolId);

    if (status && status !== 'all') q = q.eq('status', status);
    else q = q.neq('status', 'deleted');

    if (class_id)         q = q.eq('current_class_id', class_id);
    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    if (search) {
      q = q.or([
        `first_name.ilike.%${search}%`,
        `last_name.ilike.%${search}%`,
        `student_id.ilike.%${search}%`,
        `parent_phone.ilike.%${search}%`,
      ].join(','));
    }

    const { data, error } = await q.order('last_name').order('first_name');
    if (error) throw error;
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/sms/students/:id
exports.getStudent = async (req, res) => {
  try {
    const { data, error } = await supabase.from('student_profiles')
      .select(STUDENT_SELECT)
      .eq('school_id', req.schoolId).eq('id', req.params.id).single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch {
    res.status(404).json({ success: false, error: 'Student not found' });
  }
};

// POST /api/sms/students
exports.createStudent = async (req, res) => {
  try {
    const body = req.body;

    // Generate student_id: YEAR/SEQ
    const year = new Date().getFullYear();
    const { count } = await supabase.from('student_profiles')
      .select('*', { count: 'exact', head: true }).eq('school_id', req.schoolId);
    const seq        = String((count || 0) + 1).padStart(4, '0');
    const student_id = `${year}/${seq}`;

    // Photo upload
    let photo_url = body.photo_url || null;
    if (req.files?.photo) {
      const ph    = req.files.photo;
      const fname = `${req.schoolId}/students/${student_id.replace(/\//g,'_')}.jpg`;
      await supabase.storage.from('assets').upload(fname, ph.data, { contentType: ph.mimetype, upsert: true });
      const { data: u } = supabase.storage.from('assets').getPublicUrl(fname);
      photo_url = u.publicUrl;
    }

    const { data, error } = await supabase.from('student_profiles').insert([{
      school_id:        req.schoolId,
      student_id,
      first_name:       body.first_name?.trim(),
      last_name:        body.last_name?.trim(),
      other_names:      body.other_names   || null,
      date_of_birth:    body.date_of_birth || null,
      gender:           body.gender        || 'M',
      nationality:      body.nationality   || 'Rwandan',
      parent_name:      body.parent_name   || null,
      parent_phone:     body.parent_phone  || null,
      parent_email:     body.parent_email  || null,
      parent_phone2:    body.parent_phone2 || null,
      address:          body.address       || null,
      current_class_id: body.current_class_id || null,
      academic_year_id: body.academic_year_id || null,
      admission_date:   body.admission_date   || new Date().toISOString().split('T')[0],
      photo_url,
      status: 'active',
    }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/sms/students/:id
exports.updateStudent = async (req, res) => {
  try {
    // Strip relational/computed fields not in DB schema
    const { current_class, academic_year, level, ...body } = req.body;
    const { data, error } = await supabase.from('student_profiles')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('school_id', req.schoolId).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/sms/students/:id — hard delete with all related data
exports.deleteStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    const schoolId  = req.schoolId;

    // Verify ownership first
    const { data: student } = await supabase.from('student_profiles')
      .select('id').eq('id', studentId).eq('school_id', schoolId).single();
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    // Delete all related data in dependency order
    await supabase.from('bulletins')          .delete().eq('student_id', studentId);
    await supabase.from('marks')              .delete().eq('student_id', studentId);
    await supabase.from('payments')           .delete().eq('student_id', studentId);
    await supabase.from('notifications')      .delete().eq('student_id', studentId);
    await supabase.from('promotion_history')  .delete().eq('student_id', studentId);

    // Finally delete the student profile itself
    const { error } = await supabase.from('student_profiles')
      .delete().eq('id', studentId).eq('school_id', schoolId);
    if (error) throw error;

    res.json({ success: true, message: 'Student and all related data deleted permanently' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/sms/students/stats
exports.getStats = async (req, res) => {
  try {
    const { data: students } = await supabase.from('student_profiles')
      .select('id,gender,status,fee_status')
      .eq('school_id', req.schoolId).eq('status', 'active');
    const total       = students?.length || 0;
    const boys        = students?.filter(s => s.gender === 'M').length || 0;
    const girls       = students?.filter(s => s.gender === 'F').length || 0;
    const feesPaid    = students?.filter(s => s.fee_status === 'paid').length    || 0;
    const feesPartial = students?.filter(s => s.fee_status === 'partial').length || 0;
    const feesUnpaid  = students?.filter(s => s.fee_status === 'unpaid').length  || 0;
    res.json({ success: true, data: { total, boys, girls, feesPaid, feesPartial, feesUnpaid } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/sms/students/import — bulk import from Excel ────
// Expected columns (case-insensitive, order flexible):
//   last_name*, first_name*, other_names, date_of_birth, gender,
//   nationality, parent_name, parent_phone, parent_phone2,
//   parent_email, address, class (name), academic_year (name)
exports.importStudents = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');

    if (!req.files?.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded. Field name must be "file".' });
    }

    const schoolId = req.schoolId;
    const buf      = req.files.file.data;

    // ── Parse Excel ─────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    if (!ws) return res.status(400).json({ success: false, error: 'Excel file has no worksheets' });

    // Read header row (row 1) — normalise to lowercase_snake
    const headerRow = ws.getRow(1);
    const headers   = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
      const raw = String(cell.value || '').trim().toLowerCase()
        .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      headers[col] = raw;
    });

    // Map common header aliases
    const alias = {
      firstname: 'first_name', lastname: 'last_name', surname: 'last_name',
      othername: 'other_names', othernames: 'other_names',
      dob: 'date_of_birth', birthdate: 'date_of_birth', birth_date: 'date_of_birth',
      sex: 'gender',
      phone: 'parent_phone', parent_tel: 'parent_phone', tel: 'parent_phone',
      phone2: 'parent_phone2', phone_2: 'parent_phone2',
      email: 'parent_email',
      class: 'class_name', classname: 'class_name', class_name: 'class_name',
      year: 'academic_year_name', academic_year: 'academic_year_name',
      nationalite: 'nationality',
    };

    // Load classes + years for name→id lookup
    const [{ data: classes }, { data: years }] = await Promise.all([
      supabase.from('classes').select('id,name').eq('school_id', schoolId),
      supabase.from('academic_years').select('id,name,is_current').eq('school_id', schoolId),
    ]);
    const classMap = {};
    (classes || []).forEach(c => { classMap[c.name.toLowerCase()] = c.id; });
    const yearMap = {};
    (years || []).forEach(y => { yearMap[y.name.toLowerCase()] = y.id; });
    const currentYear = (years || []).find(y => y.is_current);

    // Get current count for ID generation
    const { count: existing } = await supabase.from('student_profiles')
      .select('*', { count: 'exact', head: true }).eq('school_id', schoolId);
    let seq = (existing || 0) + 1;
    const year = new Date().getFullYear();

    const rows = [];
    const errors = [];

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return; // skip header

      // Build object from row
      const obj = {};
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const h = headers[col];
        if (!h) return;
        const key = alias[h] || h;
        let val = cell.value;
        // Handle ExcelJS date objects
        if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        } else if (val && typeof val === 'object' && val.text) {
          val = val.text; // rich text
        } else if (val != null) {
          val = String(val).trim();
        }
        if (val !== '' && val != null) obj[key] = val;
      });

      // Skip truly empty rows
      if (!obj.first_name && !obj.last_name) return;

      const missing = [];
      if (!obj.first_name) missing.push('first_name');
      if (!obj.last_name)  missing.push('last_name');
      if (missing.length > 0) {
        errors.push({ row: rowNum, error: `Missing: ${missing.join(', ')}` });
        return;
      }

      // Resolve class
      const classId = obj.class_name
        ? classMap[(obj.class_name || '').toLowerCase()] || null
        : null;

      // Resolve year
      const yearId = obj.academic_year_name
        ? yearMap[(obj.academic_year_name || '').toLowerCase()] || currentYear?.id || null
        : currentYear?.id || null;

      // Normalise gender
      const gRaw = (obj.gender || 'M').toUpperCase();
      const gender = gRaw === 'F' || gRaw === 'FEMALE' || gRaw === 'FILLE' ? 'F' : 'M';

      rows.push({
        school_id:        schoolId,
        student_id:       `${year}/${String(seq++).padStart(4, '0')}`,
        first_name:       obj.first_name.trim(),
        last_name:        obj.last_name.trim(),
        other_names:      obj.other_names   || null,
        date_of_birth:    obj.date_of_birth || null,
        gender,
        nationality:      obj.nationality   || 'Rwandan',
        parent_name:      obj.parent_name   || null,
        parent_phone:     obj.parent_phone  || null,
        parent_phone2:    obj.parent_phone2 || null,
        parent_email:     obj.parent_email  || null,
        address:          obj.address       || null,
        current_class_id: classId,
        academic_year_id: yearId,
        admission_date:   new Date().toISOString().split('T')[0],
        status:           'active',
      });
    });

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid student rows found in file.',
        row_errors: errors,
      });
    }

    // Insert in chunks of 50 to avoid payload limits
    const CHUNK = 50;
    let inserted = 0;
    const insertErrors = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { data, error } = await supabase.from('student_profiles').insert(chunk).select('id');
      if (error) {
        insertErrors.push(error.message);
      } else {
        inserted += (data || []).length;
      }
    }

    res.json({
      success:       true,
      inserted,
      skipped:       rows.length - inserted,
      row_errors:    errors,
      insert_errors: insertErrors,
      message:       `${inserted} student(s) imported successfully.${errors.length ? ` ${errors.length} row(s) skipped.` : ''}`,
    });
  } catch (err) {
    console.error('importStudents error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
