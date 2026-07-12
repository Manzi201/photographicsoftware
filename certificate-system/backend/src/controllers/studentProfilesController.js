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
