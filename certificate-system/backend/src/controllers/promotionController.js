const { supabase } = require('../supabase');

// ── GET class report with promotion suggestions ───────────────
exports.getPromotionReport = async (req, res) => {
  try {
    const { class_id, term_id, academic_year_id, next_year_id } = req.query;

    // Get students in class
    const { data: students } = await supabase.from('student_profiles')
      .select('*').eq('current_class_id', class_id).eq('status','active').eq('school_id', req.schoolId);

    // Get bulletins (final percentages) for these students
    const { data: bulletins } = await supabase.from('bulletins')
      .select('student_id,percentage,rank_in_class,class_size,grade')
      .eq('class_id', class_id).eq('term_id', term_id);

    // Get target classes for next year (same level or next level)
    const { data: currentClass } = await supabase.from('classes')
      .select('*').eq('id', class_id).single();

    // Find next level classes
    const { data: nextClasses } = await supabase.from('classes')
      .select('*').eq('school_id', req.schoolId)
      .eq('level_order', (currentClass?.level_order || 1) + 1)
      .eq('academic_year_id', next_year_id || academic_year_id)
      .order('name');

    // Build report — auto-suggest based on percentage (>=50% = promote, <50% = repeat)
    const report = (students || []).map(st => {
      const b = bulletins?.find(x => x.student_id === st.id);
      const pct = b?.percentage || 0;
      const suggestion = pct >= 50 ? 'promote' : 'repeat';
      return {
        student: st, percentage: pct, rank: b?.rank_in_class,
        grade: b?.grade, suggestion,
        assigned_class_id: null, // admin/DoS will assign
      };
    }).sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

    res.json({ success: true, data: { report, currentClass, nextClasses } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── POST /api/sms/promotion/apply — apply promotion decisions ──
exports.applyPromotion = async (req, res) => {
  try {
    const { decisions, academic_year_id, term_id } = req.body;
    // decisions = [{ student_id, action: 'promote'|'repeat'|'graduate', to_class_id, percentage }]
    if (!Array.isArray(decisions)) return res.status(400).json({ success: false, error: 'decisions must be array' });

    let promoted = 0, repeated = 0, graduated = 0, failed = 0;

    for (const d of decisions) {
      try {
        const { student_id, action, to_class_id, percentage } = d;

        // Get current student
        const { data: student } = await supabase.from('student_profiles')
          .select('current_class_id').eq('id', student_id).single();

        // Record history
        await supabase.from('promotion_history').insert([{
          school_id: req.schoolId, student_id,
          from_class_id: student.current_class_id, to_class_id,
          academic_year_id, action, final_percentage: percentage,
          done_by: req.staff?.id || null,
        }]);

        // Update student
        const update = {
          previous_class_id: student.current_class_id,
          promotion_status: action,
          updated_at: new Date().toISOString(),
        };

        if (action === 'promote' || action === 'graduated') {
          update.current_class_id = to_class_id || student.current_class_id;
          update.status = action === 'graduated' ? 'graduated' : 'active';
          action === 'promote' ? promoted++ : graduated++;
        } else if (action === 'repeat') {
          // Stay in same class but new year
          update.current_class_id = to_class_id || student.current_class_id;
          repeated++;
        }
        if (academic_year_id) update.academic_year_id = academic_year_id;

        await supabase.from('student_profiles').update(update).eq('id', student_id);
      } catch { failed++; }
    }

    res.json({ success: true, data: { promoted, repeated, graduated, failed, total: decisions.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── GET /api/sms/promotion/history ───────────────────────────
exports.getHistory = async (req, res) => {
  try {
    const { class_id, academic_year_id } = req.query;
    let q = supabase.from('promotion_history')
      .select(`*, student:student_profiles(id,first_name,last_name,student_id),
        from_class:classes!promotion_history_from_class_id_fkey(name),
        to_class:classes!promotion_history_to_class_id_fkey(name)`)
      .eq('school_id', req.schoolId);
    if (class_id) q = q.eq('from_class_id', class_id);
    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
