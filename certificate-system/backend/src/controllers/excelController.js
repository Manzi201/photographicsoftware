const { supabase } = require('../supabase');
const ExcelJS = require('exceljs');

// ── Color helpers ─────────────────────────────────────────────
const NAVY_HEX  = '0A2464';
const LGRAY_HEX = 'EEF0F8';
const WHITE_HEX = 'FFFFFF';
const GOLD_HEX  = 'C49A00';

function grade(pct) {
  if (pct >= 80) return { g:'A1', color:'00802A' };
  if (pct >= 70) return { g:'B2', color:'0B5DAB' };
  if (pct >= 60) return { g:'C3', color:'996600' };
  if (pct >= 50) return { g:'D4', color:'CC7700' };
  if (pct >= 40) return { g:'E5', color:'CC4400' };
  return { g:'F', color:'CC0000' };
}

function navyFill() { return { type:'pattern', pattern:'solid', fgColor:{argb:'FF'+NAVY_HEX} }; }
function lgrayFill(){ return { type:'pattern', pattern:'solid', fgColor:{argb:'FF'+LGRAY_HEX} }; }
function whiteFill(){ return { type:'pattern', pattern:'solid', fgColor:{argb:'FF'+WHITE_HEX} }; }
function goldFill() { return { type:'pattern', pattern:'solid', fgColor:{argb:'FF'+GOLD_HEX} }; }

function navyBold(sz=10) { return { name:'Calibri', bold:true, size:sz, color:{argb:'FFFFFFFF'} }; }
function darkFont(sz=9, bold=false) { return { name:'Calibri', bold, size:sz, color:{argb:'FF0D0D1A'} }; }
function thinBorder() {
  const s = { style:'thin', color:{argb:'FFA0A8C0'} };
  return { top:s, left:s, bottom:s, right:s };
}
function medBorder() {
  const m = { style:'medium', color:{argb:'FF'+NAVY_HEX} };
  const t = { style:'thin', color:{argb:'FFA0A8C0'} };
  return { top:m, left:m, bottom:m, right:m };
}

// ════════════════════════════════════════════════════════════
// GET /api/sms/excel/class-report
// Pivot: rows=students (alpha) × cols=subjects (CAT1/CAT2/EXAM/TOTAL/%)
// ════════════════════════════════════════════════════════════
exports.exportClassReport = async (req, res) => {
  try {
    const { class_id, term_id, academic_year_id } = req.query;
    if (!class_id || !term_id) {
      return res.status(400).json({ success:false, error:'class_id and term_id required' });
    }

    // Fetch data
    const [{ data: classInfo }, { data: termInfo }, { data: yearInfo },
           { data: students }, { data: classSubs }, { data: allMarks }] = await Promise.all([
      supabase.from('classes').select('name,level').eq('id', class_id).single(),
      supabase.from('terms').select('name,number').eq('id', term_id).single(),
      supabase.from('academic_years').select('name').eq('id', academic_year_id||'00000000-0000-0000-0000-000000000000').single(),
      supabase.from('student_profiles')
        .select('id,first_name,last_name,student_id,gender')
        .eq('current_class_id', class_id).eq('status','active').eq('school_id', req.schoolId)
        .order('last_name').order('first_name'),
      supabase.from('class_subjects')
        .select('*, subject:subjects(id,name,code,max_marks,coefficient)')
        .eq('class_id', class_id),
      supabase.from('marks').select('*').eq('class_id', class_id).eq('term_id', term_id).eq('school_id', req.schoolId),
    ]);

    const subjects = (classSubs||[]).map(cs=>cs.subject).filter(Boolean);
    const isAnnual = termInfo?.number === 4;

    // Build workbook
    const wb  = new ExcelJS.Workbook();
    wb.creator = 'SchoolMS';
    wb.created = new Date();

    const ws = wb.addWorksheet(`${classInfo?.name||'Class'} - ${termInfo?.name||'Term'}`, {
      pageSetup: { paperSize:9, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0 },
      printArea: undefined,
    });

    // ── School header ─────────────────────────────────────
    const { data: school } = await supabase.from('schools').select('school_name,active_year,city,phone').eq('id', req.schoolId).single();

    // Total columns: #, ID, Name, Gender + per-subject(CAT1,CAT2,EXAM,TOTAL) + TOTAL_MARKS, %, RANK
    const subColCount = subjects.length * 4; // CAT1+CAT2+EXAM+TOTAL per subject
    const totalCols   = 4 + subColCount + 3; // 3 summary cols

    // Row 1: School name (merged)
    ws.mergeCells(1,1,1,totalCols);
    const r1 = ws.getRow(1);
    r1.getCell(1).value = (school?.school_name||'SCHOOL').toUpperCase();
    r1.getCell(1).font  = { name:'Calibri', bold:true, size:14, color:{argb:'FF'+NAVY_HEX} };
    r1.getCell(1).alignment = { horizontal:'center', vertical:'middle' };
    r1.height = 22;

    // Row 2: Term + Year + Class
    ws.mergeCells(2,1,2,totalCols);
    const termYearLabel = `${termInfo?.name||''} — Academic Year: ${yearInfo?.name||school?.active_year||''} — Class: ${classInfo?.name||''} ${classInfo?.level?'('+classInfo.level+')':''}`;
    ws.getRow(2).getCell(1).value = termYearLabel;
    ws.getRow(2).getCell(1).font  = { name:'Calibri', bold:true, size:11, color:{argb:'FFFFFFFF'} };
    ws.getRow(2).getCell(1).fill  = navyFill();
    ws.getRow(2).getCell(1).alignment = { horizontal:'center', vertical:'middle' };
    ws.getRow(2).height = 18;

    // Row 3: blank separator
    ws.getRow(3).height = 6;

    // ── Column header rows ─────────────────────────────────
    // Row 4: group headers  (#, ID, Name, Gender | Subject names spanning 4 | TOTAL | % | RANK)
    // Row 5: sub-headers     (                  | CAT1 CAT2 EXAM TOT | ... )
    const r4 = ws.getRow(4);
    const r5 = ws.getRow(5);
    r4.height = 18; r5.height = 16;

    const fixedHeaders = ['#','Student ID','Name','Gender'];
    fixedHeaders.forEach((h,i) => {
      const c4=r4.getCell(i+1), c5=r5.getCell(i+1);
      ws.mergeCells(4,i+1,5,i+1); // merge rows 4+5 for fixed cols
      c4.value = h; c4.fill = navyFill(); c4.font = navyBold(9);
      c4.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      c4.border = medBorder();
    });

    let col = 5;
    subjects.forEach(sub => {
      // Merge rows 4 over 4 columns for subject name
      ws.mergeCells(4, col, 4, col+3);
      const hdr = r4.getCell(col);
      hdr.value = (sub.name||'').toUpperCase() + (sub.coefficient>1?` (×${sub.coefficient})`:'');
      hdr.fill  = navyFill(); hdr.font = navyBold(8);
      hdr.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      hdr.border = medBorder();

      const MAX = sub.max_marks || 100;
      const mT  = MAX/2, mE = MAX/2;
      ['CAT1\n('+mT+')','CAT2','EXAM\n('+mE+')','TOTAL\n('+MAX+')'].forEach((lbl,i) => {
        const c = r5.getCell(col+i);
        c.value = lbl; c.fill = lgrayFill(); c.font = { name:'Calibri', bold:true, size:8, color:{argb:'FF'+NAVY_HEX} };
        c.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
        c.border = thinBorder();
      });
      col += 4;
    });

    // Summary cols
    [['TOTAL\nPTS',18],['AVG\n%',12],['RANK',10]].forEach(([lbl,w],i) => {
      ws.mergeCells(4,col+i,5,col+i);
      const c = r4.getCell(col+i);
      c.value = lbl; c.fill = goldFill();
      c.font = { name:'Calibri', bold:true, size:9, color:{argb:'FF'+NAVY_HEX} };
      c.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      c.border = medBorder();
      ws.getColumn(col+i).width = w;
    });

    // ── Set column widths ─────────────────────────────────
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 22;
    ws.getColumn(4).width = 8;
    for (let i=5; i<col; i++) ws.getColumn(i).width = 9;

    // ── Data rows ─────────────────────────────────────────
    // Compute totals+rank
    const sortedStudents = [...(students||[])].sort((a,b)=>{
      const ln=(a.last_name||'').localeCompare(b.last_name||'');
      return ln!==0?ln:(a.first_name||'').localeCompare(b.first_name||'');
    });

    const studentStats = sortedStudents.map(st => {
      let tw=0, tmx=0;
      subjects.forEach(sub => {
        const m=(allMarks||[]).find(mk=>mk.student_id===st.id&&mk.subject_id===sub.id);
        if(m?.total!=null){ tw+=m.total*(sub.coefficient||1); tmx+=(sub.max_marks||100)*(sub.coefficient||1); }
      });
      return { st, tw, tmx, pct: tmx>0?(tw/tmx)*100:0 };
    });
    const ranked=[...studentStats].sort((a,b)=>b.pct-a.pct);
    ranked.forEach((s,i)=>{ s.rank=i+1; });
    const rankMap={};
    ranked.forEach(s=>{ rankMap[s.st.id]=s.rank; });

    let dataRowNum = 6;
    studentStats.forEach((ss, idx) => {
      const { st } = ss;
      const row = ws.getRow(dataRowNum++);
      const isEven = idx%2===0;
      const rowBg  = isEven ? whiteFill() : lgrayFill();
      row.height = 15;

      // Fixed cols
      [idx+1, st.student_id||'—', `${(st.last_name||'').toUpperCase()} ${st.first_name||''}`.trim(), st.gender||'—'].forEach((val,i) => {
        const c = row.getCell(i+1);
        c.value = val; c.fill = rowBg;
        c.font  = darkFont(9, i===2);
        c.alignment = { horizontal: i===2?'left':'center', vertical:'middle' };
        c.border = thinBorder();
      });

      // Subject marks
      let sc = 5;
      subjects.forEach(sub => {
        const m = (allMarks||[]).find(mk=>mk.student_id===st.id&&mk.subject_id===sub.id);
        const cat1 = m?.cat1!=null ? parseFloat(m.cat1) : null;
        const cat2 = m?.cat2!=null ? parseFloat(m.cat2) : null;
        const exam = m?.exam!=null ? parseFloat(m.exam) : null;
        const tot  = m?.total!=null? parseFloat(m.total): null;

        [cat1,cat2,exam,tot].forEach((val,i) => {
          const c = row.getCell(sc+i);
          c.value = val!=null ? val : '';
          c.fill  = i===3 ? lgrayFill() : rowBg;
          c.font  = i===3 ? darkFont(9,true) : darkFont(9);
          c.alignment = { horizontal:'center', vertical:'middle' };
          c.border = thinBorder();
          // Color total based on % of subject
          if (i===3 && tot!=null) {
            const sPct = (tot/(sub.max_marks||100))*100;
            const { color } = grade(sPct);
            c.font = { name:'Calibri', bold:true, size:9, color:{argb:'FF'+color} };
          }
        });
        sc += 4;
      });

      // Summary cols
      const { g, color } = grade(ss.pct);
      const totalCell = row.getCell(col);
      totalCell.value = parseFloat(ss.tw.toFixed(1));
      totalCell.fill  = navyFill(); totalCell.font = navyBold(9);
      totalCell.alignment = { horizontal:'center', vertical:'middle' };
      totalCell.border = medBorder();

      const pctCell = row.getCell(col+1);
      pctCell.value = `${ss.pct.toFixed(1)}%`;
      pctCell.fill  = lgrayFill();
      pctCell.font  = { name:'Calibri', bold:true, size:9, color:{argb:'FF'+color} };
      pctCell.alignment = { horizontal:'center', vertical:'middle' };
      pctCell.border = thinBorder();

      const rkCell = row.getCell(col+2);
      rkCell.value = rankMap[st.id]||'—';
      rkCell.fill  = lgrayFill(); rkCell.font = darkFont(9,true);
      rkCell.alignment = { horizontal:'center', vertical:'middle' };
      rkCell.border = thinBorder();
    });

    // ── Class totals row ──────────────────────────────────
    const totRow = ws.getRow(dataRowNum);
    totRow.height = 16;
    ws.mergeCells(dataRowNum,1,dataRowNum,4);
    const tc = totRow.getCell(1);
    tc.value = `CLASS SUMMARY (${sortedStudents.length} students)`;
    tc.fill = navyFill(); tc.font = navyBold(9);
    tc.alignment = { horizontal:'center', vertical:'middle' }; tc.border = medBorder();

    let sc2=5;
    subjects.forEach(sub => {
      const subMarks = (allMarks||[]).filter(mk=>mk.subject_id===sub.id);
      const tots = subMarks.map(m=>m.total).filter(v=>v!=null);
      const avg  = tots.length>0 ? tots.reduce((a,b)=>a+b,0)/tots.length : 0;
      ws.mergeCells(dataRowNum,sc2,dataRowNum,sc2+3);
      const c = totRow.getCell(sc2);
      c.value = `Avg: ${avg.toFixed(1)} / ${sub.max_marks||100}`;
      c.fill  = goldFill(); c.font = { name:'Calibri', bold:true, size:8, color:{argb:'FF'+NAVY_HEX} };
      c.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      c.border = medBorder();
      sc2+=4;
    });

    // ── Freeze panes + auto filter ────────────────────────
    ws.views = [{ state:'frozen', xSplit:4, ySplit:5, activeCell:'E6' }];

    const clsLabel = classInfo?.name?.replace(/[^a-z0-9]/gi,'_')||'class';
    const termLabel = termInfo?.name?.replace(/[^a-z0-9]/gi,'_')||'term';
    const filename = `${clsLabel}_${termLabel}_marks.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('exportClassReport error:', err);
    res.status(500).json({ success:false, error:err.message });
  }
};

// ── GET /api/sms/excel/students — student list per class ──────
exports.exportStudents = async (req, res) => {
  try {
    const { class_id } = req.query;
    let q = supabase.from('student_profiles')
      .select('student_id,first_name,last_name,gender,date_of_birth,parent_name,parent_phone,parent_phone2,parent_email,address,fee_status,fee_balance,current_class:classes!student_profiles_current_class_id_fkey(name),academic_year:academic_years(name)')
      .eq('school_id', req.schoolId).eq('status','active').order('last_name').order('first_name');
    if (class_id) q = q.eq('current_class_id', class_id);
    const { data: students, error } = await q;
    if (error) throw error;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Students', { pageSetup:{ paperSize:9, orientation:'landscape' } });
    ws.columns = [
      {header:'#',              key:'num',         width:5},
      {header:'Student ID',     key:'student_id',  width:14},
      {header:'Last Name',      key:'last_name',   width:18},
      {header:'First Name',     key:'first_name',  width:18},
      {header:'Gender',         key:'gender',      width:8},
      {header:'Date of Birth',  key:'dob',         width:14},
      {header:'Class',          key:'class',       width:10},
      {header:'Year',           key:'year',        width:12},
      {header:'Parent Name',    key:'parent_name', width:22},
      {header:'Phone 1',        key:'phone1',      width:14},
      {header:'Phone 2',        key:'phone2',      width:14},
      {header:'Email',          key:'email',       width:24},
      {header:'Address',        key:'address',     width:20},
      {header:'Fee Status',     key:'fee_status',  width:12},
      {header:'Balance (RWF)',  key:'fee_balance', width:14},
    ];

    // Style header row
    ws.getRow(1).eachCell(c => {
      c.fill = navyFill(); c.font = navyBold(10);
      c.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      c.border = thinBorder();
    });
    ws.getRow(1).height = 20;

    (students||[]).forEach((st,i) => {
      const r = ws.addRow({
        num: i+1, student_id: st.student_id||'—',
        last_name: (st.last_name||'').toUpperCase(), first_name: st.first_name||'',
        gender: st.gender||'—', dob: st.date_of_birth||'—',
        class: st.current_class?.name||'—', year: st.academic_year?.name||'—',
        parent_name: st.parent_name||'—', phone1: st.parent_phone||'—',
        phone2: st.parent_phone2||'—', email: st.parent_email||'—',
        address: st.address||'—', fee_status: st.fee_status||'unpaid',
        fee_balance: parseFloat(st.fee_balance||0),
      });
      r.eachCell(c => {
        c.fill = i%2===0 ? whiteFill() : lgrayFill();
        c.font = darkFont(9); c.border = thinBorder();
        c.alignment = { vertical:'middle', horizontal:'left' };
      });
      r.getCell('num').alignment  = { horizontal:'center', vertical:'middle' };
      r.getCell('fee_status').font = { name:'Calibri', bold:true, size:9,
        color:{argb: st.fee_status==='paid'?'FF008000':st.fee_status==='partial'?'FFCC7700':'FFCC0000'} };
      r.height = 14;
    });

    ws.autoFilter = { from:{row:1,column:1}, to:{row:1,column:15} };
    ws.views = [{ state:'frozen', ySplit:1, activeCell:'A2' }];

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="students.xlsx"');
    await wb.xlsx.write(res); res.end();
  } catch (err) { res.status(500).json({ success:false, error:err.message }); }
};

// ── GET /api/sms/excel/finance ────────────────────────────────
exports.exportFinance = async (req, res) => {
  try {
    const { data: payments } = await supabase.from('payments')
      .select('*, student:student_profiles(first_name,last_name,student_id,current_class:classes!student_profiles_current_class_id_fkey(name)), term:terms(name)')
      .eq('school_id', req.schoolId).order('payment_date', { ascending:false }).limit(500);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Finance');
    ws.columns = [
      {header:'#',             key:'num',       width:5},
      {header:'Receipt No.',   key:'receipt',   width:14},
      {header:'Student ID',    key:'sid',       width:14},
      {header:'Name',          key:'name',      width:22},
      {header:'Class',         key:'class',     width:10},
      {header:'Term',          key:'term',      width:14},
      {header:'Amount (RWF)',  key:'amount',    width:14},
      {header:'Method',        key:'method',    width:12},
      {header:'Reference',     key:'ref',       width:16},
      {header:'Date',          key:'date',      width:16},
      {header:'Status',        key:'status',    width:12},
    ];
    ws.getRow(1).eachCell(c => {
      c.fill=navyFill(); c.font=navyBold(10);
      c.alignment={horizontal:'center',vertical:'middle'};
      c.border=thinBorder();
    });
    ws.getRow(1).height=20;
    (payments||[]).forEach((p,i) => {
      const st=p.student;
      const r=ws.addRow({
        num:i+1, receipt:p.receipt_number||'—',
        sid:st?.student_id||'—',
        name:`${(st?.last_name||'').toUpperCase()} ${st?.first_name||''}`.trim(),
        class:st?.current_class?.name||'—', term:p.term?.name||'—',
        amount:parseFloat(p.amount), method:(p.payment_method||'').toUpperCase(),
        ref:p.reference||'—', date:p.payment_date?new Date(p.payment_date).toLocaleDateString('en-GB'):'—',
        status:(p.status||'confirmed').toUpperCase(),
      });
      r.eachCell(c=>{ c.fill=i%2===0?whiteFill():lgrayFill(); c.font=darkFont(9); c.border=thinBorder(); c.alignment={vertical:'middle',horizontal:'left'}; });
      r.getCell('amount').numFmt = '#,##0';
      r.getCell('amount').font = {name:'Calibri',bold:true,size:9,color:{argb:'FF008000'}};
      r.height=14;
    });
    ws.autoFilter={from:{row:1,column:1},to:{row:1,column:11}};
    ws.views=[{state:'frozen',ySplit:1,activeCell:'A2'}];
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="finance.xlsx"');
    await wb.xlsx.write(res); res.end();
  } catch(err){ res.status(500).json({success:false,error:err.message}); }
};
