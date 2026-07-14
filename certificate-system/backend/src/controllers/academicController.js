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
    const yearId   = req.params.id;
    const schoolId = req.schoolId;

    // Verify ownership
    const { data: year } = await supabase.from('academic_years')
      .select('id').eq('id', yearId).eq('school_id', schoolId).single();
    if (!year) return res.status(404).json({ success: false, error: 'Academic year not found' });

    // Get all term IDs for this year
    const { data: terms } = await supabase.from('terms')
      .select('id').eq('academic_year_id', yearId);
    const termIds = (terms || []).map(t => t.id);

    // Get all class IDs for this year
    const { data: classes } = await supabase.from('classes')
      .select('id').eq('academic_year_id', yearId);
    const classIds = (classes || []).map(c => c.id);

    // Delete marks + bulletins tied to these terms/classes
    if (termIds.length > 0) {
      await supabase.from('bulletins').delete().in('term_id', termIds);
      await supabase.from('marks')    .delete().in('term_id', termIds);
    }
    if (classIds.length > 0) {
      await supabase.from('class_subjects')   .delete().in('class_id', classIds);
      await supabase.from('promotion_history').delete().in('from_class_id', classIds);
      await supabase.from('promotion_history').delete().in('to_class_id',   classIds);
      // Nullify student FK references to these classes
      await supabase.from('student_profiles').update({ current_class_id: null })
        .in('current_class_id', classIds);
      await supabase.from('student_profiles').update({ previous_class_id: null })
        .in('previous_class_id', classIds);
    }

    // Nullify student references to this academic year
    await supabase.from('student_profiles').update({ academic_year_id: null })
      .eq('academic_year_id', yearId);
    await supabase.from('bulletins').update({ academic_year_id: null })
      .eq('academic_year_id', yearId);
    await supabase.from('fee_structure').delete().eq('academic_year_id', yearId);

    // Delete terms and classes
    if (termIds.length > 0)  await supabase.from('terms')  .delete().in('id', termIds);
    if (classIds.length > 0) await supabase.from('classes').delete().in('id', classIds);

    // Finally delete the academic year
    const { error } = await supabase.from('academic_years')
      .delete().eq('id', yearId).eq('school_id', schoolId);
    if (error) throw error;

    res.json({ success: true, message: 'Academic year and all related data deleted permanently' });
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
    if (!name) return res.status(400).json({ success: false, error: 'name required' });
    if (!academic_year_id || academic_year_id === 'undefined' || academic_year_id === '') {
      return res.status(400).json({ success: false, error: 'academic_year_id is required' });
    }
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
    const termId   = req.params.id;
    const schoolId = req.schoolId;

    // Verify ownership
    const { data: term } = await supabase.from('terms')
      .select('id').eq('id', termId).eq('school_id', schoolId).single();
    if (!term) return res.status(404).json({ success: false, error: 'Term not found' });

    // Delete all marks and bulletins for this term
    await supabase.from('bulletins').delete().eq('term_id', termId);
    await supabase.from('marks')    .delete().eq('term_id', termId);
    await supabase.from('payments') .delete().eq('term_id', termId);

    // Finally delete the term
    const { error } = await supabase.from('terms')
      .delete().eq('id', termId).eq('school_id', schoolId);
    if (error) throw error;

    res.json({ success: true, message: 'Term and all related marks/bulletins deleted permanently' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ══ CLASSES ═══════════════════════════════════════════════════
exports.getClasses = async (req, res) => {
  try {
    const { academic_year_id } = req.query;
    const staffId = req.staff?.id;
    const role    = req.role || req.staff?.role;

    // Teacher: only classes where they are assigned to teach at least one subject
    if (role === 'teacher' && staffId) {
      // Get distinct class_ids this teacher is assigned to
      const { data: assignments, error: aErr } = await supabase
        .from('class_subjects')
        .select('class_id')
        .eq('teacher_id', staffId);
      if (aErr) throw aErr;

      const classIds = [...new Set((assignments || []).map(a => a.class_id))];
      if (classIds.length === 0) return res.json({ success: true, data: [] });

      let q = supabase.from('classes')
        .select('*, class_teacher:staff(id,full_name), academic_year:academic_years(id,name)')
        .eq('school_id', req.schoolId)
        .in('id', classIds);
      if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
      const { data, error } = await q.order('level_order').order('name');
      if (error) throw error;
      return res.json({ success: true, data });
    }

    // Admin / DoS / Secretary: all classes
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
    const classId  = req.params.id;
    const schoolId = req.schoolId;

    // Verify ownership
    const { data: cls } = await supabase.from('classes')
      .select('id').eq('id', classId).eq('school_id', schoolId).single();
    if (!cls) return res.status(404).json({ success: false, error: 'Class not found' });

    // Delete all data tied to this class
    await supabase.from('bulletins')        .delete().eq('class_id', classId);
    await supabase.from('marks')            .delete().eq('class_id', classId);
    await supabase.from('class_subjects')   .delete().eq('class_id', classId);
    await supabase.from('promotion_history').delete().eq('from_class_id', classId);
    await supabase.from('promotion_history').delete().eq('to_class_id',   classId);

    // Nullify student FK references to this class
    await supabase.from('student_profiles').update({ current_class_id: null })
      .eq('current_class_id', classId);
    await supabase.from('student_profiles').update({ previous_class_id: null })
      .eq('previous_class_id', classId);

    // Finally delete the class
    const { error } = await supabase.from('classes')
      .delete().eq('id', classId).eq('school_id', schoolId);
    if (error) throw error;

    res.json({ success: true, message: 'Class and all related data deleted permanently' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ══ SUBJECTS ══════════════════════════════════════════════════
exports.getSubjects = async (req, res) => {
  try {
    const { class_id } = req.query;
    const staffId = req.staff?.id;
    const role    = req.role || req.staff?.role;

    if (class_id) {
      let q = supabase.from('class_subjects')
        .select('*, subject:subjects(*), teacher:staff(id,full_name)')
        .eq('class_id', class_id);

      // Teacher: only subjects they are assigned to teach in this class
      if (role === 'teacher' && staffId) {
        q = q.eq('teacher_id', staffId);
      }

      const { data, error } = await q;
      if (error) throw error;
      // Sort by class_subject sort_order first, then subject sort_order, then name
      const sorted = (data || []).sort((a, b) => {
        const oa = a.sort_order ?? a.subject?.sort_order ?? 999;
        const ob = b.sort_order ?? b.subject?.sort_order ?? 999;
        if (oa !== ob) return oa - ob;
        return (a.subject?.name || '').localeCompare(b.subject?.name || '');
      });
      return res.json({
        success: true,
        data: sorted.map(r => ({
          ...r.subject,
          teacher:          r.teacher,
          class_subject_id: r.id,
          sort_order:       r.sort_order ?? r.subject?.sort_order ?? 999,
          is_core:          r.is_core ?? r.subject?.is_core ?? false,
        })),
      });
    }

    // No class_id: return all subjects for the school
    // Teacher: only subjects they teach (across all classes)
    if (role === 'teacher' && staffId) {
      const { data: cs, error: csErr } = await supabase
        .from('class_subjects')
        .select('subject:subjects(*)')
        .eq('teacher_id', staffId);
      if (csErr) throw csErr;
      const seen = new Set();
      const subs = (cs || []).map(r => r.subject).filter(s => {
        if (!s || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      }).sort((a, b) => {
        const oa = a.sort_order ?? 999;
        const ob = b.sort_order ?? 999;
        if (oa !== ob) return oa - ob;
        return (a.name || '').localeCompare(b.name || '');
      });
      return res.json({ success: true, data: subs });
    }

    const { data, error } = await supabase.from('subjects')
      .select('*').eq('school_id', req.schoolId)
      .order('sort_order', { ascending: true })
      .order('name',       { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.createSubject = async (req, res) => {
  try {
    const { name, code, max_test, max_exam, passing_marks, coefficient, sort_order, is_core } = req.body;
    if (!name) return res.status(400).json({ success:false, error:'name required' });
    const mTest = parseInt(max_test)||0;
    const mExam = parseInt(max_exam)||0;
    const max_marks = mTest + mExam || 100;
    const { data, error } = await supabase.from('subjects').insert([{
      school_id: req.schoolId, name, code: code||null,
      max_marks, max_test: mTest, max_exam: mExam,
      passing_marks: parseInt(passing_marks)||50,
      coefficient: parseInt(coefficient)||1,
      sort_order: sort_order != null ? parseInt(sort_order) : 999,
      is_core: !!is_core,
    }]).select().single();
    if (error) throw error;

    // ── Auto-assign to ALL existing classes for this school ──
    // DoS creates a subject once — it becomes available in every class.
    // Per-class teachers and is_core can be adjusted later in the Assign modal.
    const { data: classes } = await supabase.from('classes')
      .select('id').eq('school_id', req.schoolId);
    if (classes && classes.length > 0) {
      const assignments = classes.map(c => ({
        class_id:   c.id,
        subject_id: data.id,
        teacher_id: null,
        sort_order: sort_order != null ? parseInt(sort_order) : 999,
        is_core:    !!is_core,
      }));
      // Use upsert so existing assignments are not duplicated
      await supabase.from('class_subjects')
        .upsert(assignments, { onConflict: 'class_id,subject_id', ignoreDuplicates: true });
    }

    res.status(201).json({
      success: true,
      data,
      assigned_to: classes?.length || 0,
      message: `Subject created and auto-assigned to ${classes?.length || 0} class${(classes?.length||0)!==1?'es':''}`,
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.updateSubject = async (req, res) => {
  try {
    const { name, code, max_test, max_exam, passing_marks, coefficient, sort_order, is_core } = req.body;
    const mTest = parseInt(max_test)||0;
    const mExam = parseInt(max_exam)||0;
    const max_marks = mTest + mExam || 100;
    const { data, error } = await supabase.from('subjects')
      .update({
        name, code: code||null, max_marks, max_test: mTest, max_exam: mExam,
        passing_marks: parseInt(passing_marks)||50,
        coefficient: parseInt(coefficient)||1,
        sort_order: sort_order != null ? parseInt(sort_order) : 999,
        is_core: !!is_core,
      })
      .eq('id', req.params.id).eq('school_id', req.schoolId)
      .select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subjectId = req.params.id;
    const schoolId  = req.schoolId;

    // Verify ownership
    const { data: subject } = await supabase.from('subjects')
      .select('id').eq('id', subjectId).eq('school_id', schoolId).single();
    if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });

    // Delete all marks for this subject, class assignments
    await supabase.from('marks')         .delete().eq('subject_id', subjectId);
    await supabase.from('class_subjects').delete().eq('subject_id', subjectId);

    // Finally delete the subject
    const { error } = await supabase.from('subjects')
      .delete().eq('id', subjectId).eq('school_id', schoolId);
    if (error) throw error;

    res.json({ success: true, message: 'Subject and all related marks/assignments deleted permanently' });
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
    const { class_id, subject_id, teacher_id, sort_order, is_core } = req.body;
    if (!class_id || !subject_id) return res.status(400).json({ success: false, error: 'class_id and subject_id required' });
    const row = {
      class_id, subject_id,
      teacher_id: teacher_id || null,
      sort_order: sort_order != null ? parseInt(sort_order) : 999,
      is_core:    is_core != null ? !!is_core : false,
    };
    const { data, error } = await supabase.from('class_subjects')
      .upsert([row], { onConflict: 'class_id,subject_id' })
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

// POST /api/sms/class-subjects/assign-all — assign a subject to ALL classes
exports.assignSubjectToAll = async (req, res) => {
  try {
    const { subject_id } = req.body;
    if (!subject_id) return res.status(400).json({ success:false, error:'subject_id required' });

    const { data: classes } = await supabase.from('classes').select('id').eq('school_id', req.schoolId);
    if (!classes || classes.length === 0) return res.json({ success:true, assigned: 0 });

    const rows = classes.map(c => ({
      class_id: c.id, subject_id, teacher_id: null,
      sort_order: 999, is_core: false,
    }));
    await supabase.from('class_subjects')
      .upsert(rows, { onConflict: 'class_id,subject_id', ignoreDuplicates: true });

    res.json({ success:true, assigned: classes.length, message:`Assigned to ${classes.length} classes` });
  } catch (err) { res.status(500).json({ success:false, error: err.message }); }
};
