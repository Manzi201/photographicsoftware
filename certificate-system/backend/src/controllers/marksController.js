const { supabase } = require('../supabase');

function calcGrade(pct) {
  if (pct >= 80) return 'A1'; if (pct >= 70) return 'B2'; if (pct >= 60) return 'C3';
  if (pct >= 50) return 'D4'; if (pct >= 40) return 'E5'; return 'F';
}
function gradeRemarks(pct) {
  if (pct >= 80) return 'Excellent'; if (pct >= 70) return 'Very Good'; if (pct >= 60) return 'Good';
  if (pct >= 50) return 'Average';   if (pct >= 40) return 'Below Average'; return 'Fail';
}

// ── Compute total: cat1(TEST) + exam(EXAM)
// If max_exam === 0 → exam-free subject, total = cat1 only
// If exam not entered → treat as 0 but still valid
function computeMark(cat1, exam, sub) {
  const mTest = sub?.max_test || 0;
  const mExam = sub?.max_exam || 0;
  const maxM  = sub?.max_marks || (mTest + mExam) || 100;
  const c1    = parseFloat(cat1 ?? 0);
  const ex    = mExam > 0 ? parseFloat(exam ?? 0) : 0; // ignore exam if subject has no exam
  const total = c1 + ex;
  const pct   = maxM > 0 ? Math.min(100, (total / maxM) * 100) : 0;
  return { cat1: c1, cat2: 0, exam: ex, total, percentage: pct, grade: calcGrade(pct), remarks: gradeRemarks(pct) };
}

// GET /api/sms/marks
exports.getMarks = async (req, res) => {
  try {
    const { student_id, term_id, class_id, subject_id } = req.query;
    let q = supabase.from('marks')
      .select('*, subject:subjects(id,name,code,max_marks,max_test,max_exam,coefficient), student:student_profiles(id,first_name,last_name,student_id)')
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

// POST /api/sms/marks
exports.upsertMark = async (req, res) => {
  try {
    const { student_id, subject_id, term_id, class_id, academic_year_id, cat1, exam } = req.body;
    const { data: sub } = await supabase.from('subjects')
      .select('max_marks,max_test,max_exam,coefficient').eq('id', subject_id).single();
    const { cat1:c1, cat2:c2, exam:ex, total, percentage:pct, grade, remarks } = computeMark(cat1, exam, sub);
    const { data, error } = await supabase.from('marks').upsert([{
      school_id:req.schoolId, student_id, subject_id, term_id, class_id, academic_year_id,
      cat1:c1, cat2:c2, exam:ex, total, percentage:pct, grade, remarks,
      entered_by: req.staff?.id||null, updated_at: new Date().toISOString(),
    }],{onConflict:'student_id,subject_id,term_id'}).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/sms/marks/bulk
exports.bulkUpsertMarks = async (req, res) => {
  try {
    const { marks, term_id, class_id, subject_id, academic_year_id } = req.body;
    if (!Array.isArray(marks)) return res.status(400).json({ success:false, error:'marks must be array' });
    const { data: sub } = await supabase.from('subjects')
      .select('max_marks,max_test,max_exam,coefficient').eq('id', subject_id).single();
    const rows = marks.map(m => {
      const { cat1:c1, cat2:c2, exam:ex, total, percentage:pct, grade, remarks } = computeMark(m.cat1, m.exam, sub);
      return {
        school_id:req.schoolId, student_id:m.student_id, subject_id, term_id, class_id, academic_year_id,
        cat1:c1, cat2:c2, exam:ex, total, percentage:pct, grade, remarks,
        entered_by:req.staff?.id||null, updated_at:new Date().toISOString(),
      };
    });
    const { data, error } = await supabase.from('marks')
      .upsert(rows,{onConflict:'student_id,subject_id,term_id'}).select();
    if (error) throw error;
    res.json({ success:true, data, count:data.length });
  } catch (err) { res.status(500).json({ success:false, error:err.message }); }
};

// GET /api/sms/marks/class-report
exports.classReport = async (req, res) => {
  try {
    const { class_id, term_id } = req.query;
    if (!class_id||!term_id) return res.status(400).json({success:false,error:'class_id and term_id required'});
    const { data: students } = await supabase.from('student_profiles')
      .select('id,first_name,last_name,student_id,photo_url').eq('current_class_id',class_id).eq('status','active');
    const { data: allMarks } = await supabase.from('marks')
      .select('*, subject:subjects(id,name,code,max_marks,max_test,max_exam,coefficient)')
      .eq('class_id',class_id).eq('term_id',term_id).eq('school_id',req.schoolId);
    const { data: classSubs } = await supabase.from('class_subjects')
      .select('*, subject:subjects(*)').eq('class_id',class_id);
    const report = (students||[]).map(st => {
      const stMarks=(allMarks||[]).filter(m=>m.student_id===st.id);
      let wTotal=0, maxPoss=0;
      const subjectMarks=(classSubs||[]).map(cs=>{
        const m=stMarks.find(x=>x.subject_id===cs.subject_id);
        const coef=cs.subject?.coefficient||1, maxM=cs.subject?.max_marks||100;
        const total=m?.total||0;
        wTotal+=total*coef; maxPoss+=maxM*coef;
        return {subject:cs.subject, mark:m||null, total};
      });
      const pct=maxPoss>0?(wTotal/maxPoss)*100:0;
      return {student:st, subjectMarks, total:wTotal, percentage:pct, grade:calcGrade(pct)};
    });
    report.sort((a,b)=>b.percentage-a.percentage);
    report.forEach((r,i)=>{r.rank=i+1;});
    res.json({success:true, data:{report, subjects:(classSubs||[]).map(c=>c.subject)}});
  } catch (err) { res.status(500).json({success:false,error:err.message}); }
};
