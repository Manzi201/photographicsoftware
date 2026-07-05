const { supabase } = require('../supabase');

// ══ ACADEMIC YEARS ════════════════════════════════════════════
exports.getAcademicYears = async (req, res) => {
  try {
    const { data, error } = await supabase.from('academic_years')
      .select('*').eq('school_id', req.schoolId).order('name', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.createAcademicYear = async (req, res) => {
  try {
    const { name, start_date, end_date, is_current } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name required' });
    if (is_current) {
      await supabase.from('academic_years').update({ is_current: false }).eq('school_id', req.schoolId);
    }
    const { data, error } = await supabase.from('academic_years').insert([{
      school_id: req.schoolId, name, start_date: start_date || null,
      end_date: end_date || null, is_current: !!is_current,
    }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.updateAcademicYear = async (req, res) => {
  try {
    const { name, start_date, end_date, is_current } = req.body;
    if (is_current) {
      await supabase.from('academic_years').update({ is_current: false }).eq('school_id', req.schoolId);
    }
    const { data, error } = await supabase.from('academic_years')
      .update({ name, start_date: start_date || null, end_date: end_date || null, is_current: !!is_current })
      .eq('id', req.params.id).eq('school_id', req.schoolId).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deleteAcademicYear = async (req, res) => {
  try {
    await supabase.from('academic_years').delete().eq('id', req.params.id).eq('school_id', req.schoolId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ══ TERMS ═════════════════════════════════════════════════════
exports.getTerms = async (req, res) => {
  try {
    const { academic_year_id } = req.query;
    let q = supabase.from('terms').select('*, academic_year:academic_years(name)')
      .eq('school_id', req.schoolId);
    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    const { data, error } = await q.order('number');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.createTerm = async (req, res) => {
  try {
    const { name, number, academic_year_id, start_date, end_date, is_current } = req.body;
    if (!name || !academic_year_id) return res.status(400).json({ success: false, error: 'name and academic_year_id required' });
    if (is_current) {
      await supabase.from('terms').update({ is_current: false }).eq('school_id', req.schoolId);
    }
    const { data, error } = await supabase.from('terms').insert([{
      school_id: req.schoolId, name, number: number || 1, academic_year_id,
      start_date: start_date || null, end_date: end_date || null, is_current: !!is_current,
    }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.updateTerm = async (req, res) => {
  try {
    const { name, number, start_date, end_date, is_current } = req.body;
    if (is_current) {
      await supabase.from('terms').update({ is_current: false }).eq('school_id', req.schoolId);
    }
    const { data, error } = await supabase.from('terms')
      .update({ name, number, start_date: start_date || null, end_date: end_date || null, is_current: !!is_current })
      .eq('id', req.params.id).eq('school_id', req.schoolId).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deleteTerm = async (req, res) => {
  try {
    await supabase.from('terms').delete().eq('id', req.params.id).eq('school_id', req.schoolId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ══ CLASSES ═══════════════════════════════════════════════════
exports.getClasses = async (req, res) => {
  try {
    const { academic_year_id } = req.query;
    let q = supabase.from('classes')
      .select('*, class_teacher:staff(id,full_name), academic_year:academic_years(id,name)')
      .eq('school_id', req.schoolId);
    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    const { data, error } = await q.order('level_order').order('name');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.createClass = async (req, res) => {
  try {
    const { name, level, level_order, section, capacity, academic_year_id, class_teacher_id } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Class name required' });
    const { data, error } = await supabase.from('classes').insert([{
      school_id: req.schoolId, name, level: level || null, level_order: level_order || 1,
      section: section || 'A', capacity: capacity || 40,
      academic_year_id: academic_year_id || null,
      class_teacher_id: class_teacher_id || null,
    }]).select('*, class_teacher:staff(id,full_name), academic_year:academic_years(id,name)').single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.updateClass = async (req, res) => {
  try {
    const { name, level, level_order, section, capacity, academic_year_id, class_teacher_id } = req.body;
    const { data, error } = await supabase.from('classes')
      .update({
        name, level: level || null, level_order: level_order || 1,
        section: section || 'A', capacity: capacity || 40,
        academic_year_id: academic_year_id || null,
        class_teacher_id: class_teacher_id || null,
      })
      .eq('id', req.params.id).eq('school_id', req.schoolId)
      .select('*, class_teacher:staff(id,full_name), academic_year:academic_years(id,name)').single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deleteClass = async (req, res) => {
  try {
    await supabase.from('classes').delete().eq('id', req.params.id).eq('school_id', req.schoolId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ══ SUBJECTS ══════════════════════════════════════════════════
exports.getSubjects = async (req, res) => {
  try {
    const { class_id } = req.query;
    if (class_id) {
      const { data, error } = await supabase.from('class_subjects')
        .select('*, subject:subjects(*), teacher:staff(id,full_name)')
        .eq('class_id', class_id);
      if (error) throw error;
      return res.json({ success: true, data: data.map(r => ({ ...r.subject, teacher: r.teacher, class_subject_id: r.id })) });
    }
    const { data, error } = await supabase.from('subjects')
      .select('*').eq('school_id', req.schoolId).order('name');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.createSubject = async (req, res) => {
  try {
    const { data, error } = await supabase.from('subjects').insert([{
      school_id: req.schoolId, ...req.body
    }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deleteSubject = async (req, res) => {
  try {
    await supabase.from('subjects').delete().eq('id', req.params.id).eq('school_id', req.schoolId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ══ STAFF ═════════════════════════════════════════════════════
exports.getStaff = async (req, res) => {
  try {
    const { data, error } = await supabase.from('staff')
      .select('id,full_name,role').eq('school_id', req.schoolId).eq('is_active', true).order('full_name');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.createStaff = async (req, res) => {
  try {
    const { data, error } = await supabase.from('staff').insert([{
      school_id: req.schoolId, ...req.body
    }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.updateStaff = async (req, res) => {
  try {
    const { data, error } = await supabase.from('staff')
      .update(req.body).eq('id', req.params.id).eq('school_id', req.schoolId).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ══ CLASS-SUBJECTS ════════════════════════════════════════════
exports.getClassSubjects = async (req, res) => {
  try {
    const { class_id } = req.query;
    let q = supabase.from('class_subjects').select('*, subject:subjects(*), teacher:staff(id,full_name)');
    if (class_id) q = q.eq('class_id', class_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.assignSubject = async (req, res) => {
  try {
    const { class_id, subject_id, teacher_id } = req.body;
    if (!class_id || !subject_id) return res.status(400).json({ success: false, error: 'class_id and subject_id required' });
    const { data, error } = await supabase.from('class_subjects')
      .upsert([{ class_id, subject_id, teacher_id: teacher_id || null }], { onConflict: 'class_id,subject_id' })
      .select('*, subject:subjects(*), teacher:staff(id,full_name)').single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.unassignSubject = async (req, res) => {
  try {
    await supabase.from('class_subjects').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
