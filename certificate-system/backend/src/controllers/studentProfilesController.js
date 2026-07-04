const { supabase } = require('../supabase');

// ── GET /api/sms/students ─────────────────────────────────────
exports.getStudents = async (req, res) => {
  try {
    const { class_id, status, search, academic_year_id } = req.query;
    let q = supabase.from('student_profiles')
      .select(`*, current_class:classes(id,name,level), academic_year:academic_years(id,name)`)
      .eq('school_id', req.schoolId);

    if (status && status !== 'all') q = q.eq('status', status);
    else q = q.neq('status', 'deleted');
    if (class_id)          q = q.eq('current_class_id', class_id);
    if (academic_year_id)  q = q.eq('academic_year_id', academic_year_id);
    if (search) q = q.or([
      `first_name.ilike.%${search}%`,
      `last_name.ilike.%${search}%`,
      `student_id.ilike.%${search}%`,
      `parent_phone.ilike.%${search}%`,
    ].join(','));

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
      .select(`*, current_class:classes(id,name,level), academic_year:academic_years(id,name)`)
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
    // Generate student_id: YEAR/LEVEL/SEQ
    const year = new Date().getFullYear();
    const { count } = await supabase.from('student_profiles')
      .select('*', { count: 'exact', head: true }).eq('school_id', req.schoolId);
    const seq = String((count || 0) + 1).padStart(3, '0');
    const level = (body.level || 'ST').substring(0, 3).toUpperCase();
    const student_id = `${year}/${level}/${seq}`;

    // Photo upload
    let photo_url = body.photo_url || null;
    if (req.files?.photo) {
      const ph = req.files.photo;
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
      other_names:      body.other_names,
      date_of_birth:    body.date_of_birth,
      gender:           body.gender,
      nationality:      body.nationality || 'Rwandan',
      parent_name:      body.parent_name,
      parent_phone:     body.parent_phone,
      parent_email:     body.parent_email,
      parent_phone2:    body.parent_phone2,
      address:          body.address,
      current_class_id: body.current_class_id || null,
      academic_year_id: body.academic_year_id || null,
      admission_date:   body.admission_date || new Date().toISOString().split('T')[0],
      photo_url,
      status:           'active',
      level:            body.level,
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
    const { data, error } = await supabase.from('student_profiles')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('school_id', req.schoolId).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/sms/students/:id (soft delete)
exports.deleteStudent = async (req, res) => {
  try {
    await supabase.from('student_profiles')
      .update({ status: 'inactive' })
      .eq('id', req.params.id).eq('school_id', req.schoolId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
