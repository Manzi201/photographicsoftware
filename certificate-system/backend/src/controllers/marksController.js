const { supabase } = require('../supabase');

// ── Helper: calculate grade from percentage ───────────────────
function calcGrade(pct) {
  if (pct >= 80) return 'A1';
  if (pct >= 70) return 'B2';
  if (pct >= 60) return 'C3';
  if (pct >= 50) return 'D4';
  if (pct >= 40) return 'E5';
  return 'F';
}
function gradeRemarks(pct) {
  if (pct >= 80) return 'Excellent';
  if (pct >= 70) return 'Very Good';
  if (pct >= 60) return 'Good';
  if (pct >= 50) return 'Average';
  if (pct >= 40) return 'Below Average';
  return 'Fail';
}

// GET /api/sms/marks?student_id=&term_id=&class_id=
exports.getMarks = async (req, res) => {
  try {
    const { student_id, term_id, class_id, subject_id } = req.query;
    let q = supabase.from('marks')
      .select('*, subject:subjects(id,name,code,max_marks,coefficient), student:student_profiles(id,first_name,last_name,student_id)')
      .eq('school_id', req.schoolId);
    if (student_id) q = q.eq('student_id', student_id);
    if (term_id)    q = q.eq('term_id', term_id);
    if (class_id)   q = q.eq('class_id', class_id);
    if (subject_id) q = q.eq('subject_id', subject_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/sms/marks — enter/update a single mark
exports.upsertMark = async (req, res) => {
  try {
    const { student_id, subject_id, term_id, class_id, academic_year_id, cat1, cat2, exam } = req.body;

    // Fetch subject max_marks
    const { data: sub } = await supabase.from('subjects').select('max_marks,coefficient').eq('id', subject_id).single();
    const maxMarks = sub?.max_marks || 100;

    // Calculate total & percentage
    const c1 = parseFloat(cat1 || 0), c2 = parseFloat(cat2 || 0), ex = parseFloat(exam || 0);
    const total = c1 + c2 + ex;
    const pct   = Math.min(100, (total / maxMarks) * 100);
    const grade = calcGrade(pct);

    const { data, error } = await supabase.from('marks').upsert([{
      school_id: req.schoolId, student_id, subject_id, term_id, class_id, academic_year_id,
      cat1: c1, cat2: c2, exam: ex, total, percentage: pct, grade,
      remarks: gradeRemarks(pct), entered_by: req.staff?.id || null,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'student_id,subject_id,term_id' }).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/sms/marks/bulk — enter marks for whole class/subject at once
exports.bulkUpsertMarks = async (req, res) => {
  try {
    const { marks, term_id, class_id, subject_id, academic_year_id } = req.body;
    if (!Array.isArray(marks)) return res.status(400).json({ success: false, error: 'marks must be array' });

    const { data: sub } = await supabase.from('subjects').select('max_marks').eq('id', subject_id).single();
    const maxMarks = sub?.max_marks || 100;

    const rows = marks.map(m => {
      const c1 = parseFloat(m.cat1 || 0), c2 = parseFloat(m.cat2 || 0), ex = parseFloat(m.exam || 0);
      const total = c1 + c2 + ex;
      const pct   = Math.min(100, (total / maxMarks) * 100);
      return {
        school_id: req.schoolId, student_id: m.student_id, subject_id, term_id, class_id, academic_year_id,
        cat1: c1, cat2: c2, exam: ex, total, percentage: pct,
        grade: calcGrade(pct), remarks: gradeRemarks(pct),
        entered_by: req.staff?.id || null, updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase.from('marks')
      .upsert(rows, { onConflict: 'student_id,subject_id,term_id' }).select();
    if (error) throw error;
    res.json({ success: true, data, count: data.length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/sms/marks/class-report?class_id=&term_id= — full class marks table
exports.classReport = async (req, res) => {
  try {
    const { class_id, term_id } = req.query;
    if (!class_id || !term_id) return res.status(400).json({ success: false, error: 'class_id and term_id required' });

    // Get all students in class
    const { data: students } = await supabase.from('student_profiles')
      .select('id,first_name,last_name,student_id,photo_url').eq('current_class_id', class_id).eq('status','active');

    // Get all marks for term+class
    const { data: allMarks } = await supabase.from('marks')
      .select('*, subject:subjects(id,name,code,max_marks,coefficient)')
      .eq('class_id', class_id).eq('term_id', term_id).eq('school_id', req.schoolId);

    // Get all subjects for class
    const { data: classSubs } = await supabase.from('class_subjects')
      .select('*, subject:subjects(*)').eq('class_id', class_id);

    // Build report: per student, totals + rank
    const report = (students || []).map(st => {
      const stMarks = (allMarks || []).filter(m => m.student_id === st.id);
      let weightedTotal = 0, totalCoef = 0, maxPossible = 0;
      const subjectMarks = (classSubs || []).map(cs => {
        const m = stMarks.find(x => x.subject_id === cs.subject_id);
        const coef = cs.subject?.coefficient || 1;
        const maxM = cs.subject?.max_marks || 100;
        const total = m?.total || 0;
        weightedTotal += total * coef;
        totalCoef     += coef;
        maxPossible   += maxM * coef;
        return { subject: cs.subject, mark: m || null, total };
      });
      const pct = maxPossible > 0 ? (weightedTotal / maxPossible) * 100 : 0;
      return { student: st, subjectMarks, total: weightedTotal, percentage: pct, grade: calcGrade(pct) };
    });

    // Rank by percentage
    report.sort((a, b) => b.percentage - a.percentage);
    report.forEach((r, i) => { r.rank = i + 1; });

    res.json({ success: true, data: { report, subjects: (classSubs || []).map(c => c.subject) } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
