const { supabase } = require('../supabase');

// Generate CSV (well-formatted, opens nicely in Excel)
function toCSV(headers, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  rows.forEach(row => lines.push(row.map(esc).join(',')));
  return lines.join('\r\n');
}

// ── GET /api/sms/excel/students?class_id= ────────────────────
exports.exportStudents = async (req, res) => {
  try {
    const { class_id, academic_year_id } = req.query;

    let q = supabase.from('student_profiles')
      .select(`*, current_class:classes(id,name,level), academic_year:academic_years(name)`)
      .eq('school_id', req.schoolId).eq('status','active');
    if (class_id)          q = q.eq('current_class_id', class_id);
    if (academic_year_id)  q = q.eq('academic_year_id', academic_year_id);

    const { data: students, error } = await q.order('last_name').order('first_name');
    if (error) throw error;

    const headers = [
      'No','Student ID','Last Name','First Name','Other Names',
      'Date of Birth','Gender','Nationality',
      'Class','Academic Year',
      'Parent Name','Parent Phone','Parent Phone 2','Parent Email',
      'Address','Admission Date',
      'Fee Balance','Fee Status','Status'
    ];

    const rows = (students||[]).map((s,i) => [
      i+1, s.student_id, s.last_name, s.first_name, s.other_names||'',
      s.date_of_birth||'', s.gender||'', s.nationality||'',
      s.current_class?.name||'', s.academic_year?.name||'',
      s.parent_name||'', s.parent_phone||'', s.parent_phone2||'', s.parent_email||'',
      s.address||'', s.admission_date||'',
      s.fee_balance||0, s.fee_status||'unpaid', s.status||'active'
    ]);

    const cls = students[0]?.current_class?.name || 'all';
    const csv = toCSV(headers, rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="students_${cls}_${new Date().toISOString().split('T')[0]}.csv"`);
    // BOM for Excel UTF-8 compatibility
    res.send('\uFEFF' + csv);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── GET /api/sms/excel/marks?class_id=&term_id= ───────────────
exports.exportMarks = async (req, res) => {
  try {
    const { class_id, term_id } = req.query;

    const [{ data: students }, { data: classSubs }, { data: allMarks }, { data: cls }, { data: trm }] = await Promise.all([
      supabase.from('student_profiles').select('id,first_name,last_name,student_id').eq('current_class_id', class_id).eq('status','active').order('last_name'),
      supabase.from('class_subjects').select('*, subject:subjects(*)').eq('class_id', class_id),
      supabase.from('marks').select('*').eq('class_id', class_id).eq('term_id', term_id),
      supabase.from('classes').select('name').eq('id', class_id).single(),
      supabase.from('terms').select('name').eq('id', term_id).single(),
    ]);

    const subjects = (classSubs||[]).map(cs => cs.subject);
    const subHeaders = subjects.flatMap(s => [`${s.name} CA1`,`${s.name} CA2`,`${s.name} Exam`,`${s.name} Total`,`${s.name} %`]);
    const headers = ['No','Student ID','Name',...subHeaders,'Overall Total','Overall %','Grade','Rank'];

    let rows = (students||[]).map((st,i) => {
      let weightedTotal=0, totalMax=0;
      const subCells = subjects.flatMap(sub => {
        const m = allMarks?.find(x => x.student_id===st.id && x.subject_id===sub.id);
        const coef = sub.coefficient||1, maxM = sub.max_marks||100;
        if (m?.total != null) { weightedTotal += m.total*coef; totalMax += maxM*coef; }
        return [m?.cat1??'',m?.cat2??'',m?.exam??'',m?.total?.toFixed(1)??'',m?.percentage?.toFixed(1)??''];
      });
      const pct = totalMax>0?(weightedTotal/totalMax*100):0;
      const grd = pct>=80?'A1':pct>=70?'B2':pct>=60?'C3':pct>=50?'D4':pct>=40?'E5':'F';
      return { cells:[i+1, st.student_id, `${st.last_name} ${st.first_name}`, ...subCells, weightedTotal.toFixed(1), pct.toFixed(1), grd], pct };
    });

    // Add ranks
    rows.sort((a,b)=>b.pct-a.pct);
    rows = rows.map((r,i)=>({...r, rank:i+1}));
    rows.sort((a,b)=>a.cells[0]-b.cells[0]); // restore original order
    const finalRows = rows.map(r => [...r.cells, r.rank]);

    const csv = toCSV(headers, finalRows);
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="marks_${cls?.name||''}_${trm?.name||''}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── GET /api/sms/excel/finance?term_id= ──────────────────────
exports.exportFinance = async (req, res) => {
  try {
    const { term_id, class_id } = req.query;
    let q = supabase.from('student_profiles')
      .select('id,student_id,first_name,last_name,parent_name,parent_phone,fee_balance,fee_status,current_class:classes(name)')
      .eq('school_id', req.schoolId).eq('status','active');
    if (class_id) q = q.eq('current_class_id', class_id);
    const { data: students } = await q.order('last_name');

    // Get payments per student for this term
    let pq = supabase.from('payments').select('student_id,amount,payment_date,payment_method').eq('school_id', req.schoolId).eq('status','confirmed');
    if (term_id) pq = pq.eq('term_id', term_id);
    const { data: payments } = await pq;

    const headers = ['No','Student ID','Name','Class','Parent Name','Parent Phone','Amount Paid','Balance','Fee Status','Payment Method'];
    const rows = (students||[]).map((s,i) => {
      const stPayments = (payments||[]).filter(p=>p.student_id===s.id);
      const totalPaid = stPayments.reduce((sum,p)=>sum+parseFloat(p.amount||0),0);
      const methods = [...new Set(stPayments.map(p=>p.payment_method))].join('+');
      return [i+1, s.student_id, `${s.last_name} ${s.first_name}`, s.current_class?.name||'', s.parent_name||'', s.parent_phone||'', totalPaid.toFixed(2), (s.fee_balance||0).toFixed(2), s.fee_status||'unpaid', methods||'—'];
    });

    const csv = toCSV(headers, rows);
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="finance_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
