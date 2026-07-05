const { supabase } = require('../supabase');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, res => {
      const ch = []; res.on('data', c => ch.push(c));
      res.on('end', () => resolve(Buffer.concat(ch)));
      res.on('error', reject);
    }).on('error', reject);
  });
}
async function embedImg(doc, buf) {
  try { return await doc.embedJpg(buf); } catch {}
  try { return await doc.embedPng(buf); } catch {}
  return null;
}
function gradeColor(pct) {
  if (pct >= 80) return rgb(0.00, 0.50, 0.10);
  if (pct >= 60) return rgb(0.04, 0.36, 0.72);
  if (pct >= 50) return rgb(0.60, 0.40, 0.00);
  return rgb(0.75, 0.05, 0.05);
}
function grade(pct) {
  if (pct >= 80) return 'A1';
  if (pct >= 70) return 'B2';
  if (pct >= 60) return 'C3';
  if (pct >= 50) return 'D4';
  if (pct >= 40) return 'E5';
  return 'F';
}

// ── Generate a single bulletin PDF ────────────────────────────
async function generateBulletinPDF(student, marks, subjects, classInfo, termInfo, yearInfo, school, bulletinMeta) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const loadFont = async (name) => {
    try { return await doc.embedFont(fs.readFileSync(path.join(FONTS_DIR, name))); } catch {}
    return await doc.embedFont(StandardFonts.Helvetica);
  };
  const B  = await loadFont('Montserrat-Bold.ttf');
  const R  = await loadFont('Montserrat-Regular.ttf');
  const I  = await loadFont('Montserrat-Italic.ttf');
  const SB = await loadFont('Montserrat-SemiBold.ttf');

  const page = doc.addPage([595.28, 841.89]); // A4 Portrait
  const W = 595.28, H = 841.89;

  const navy = rgb(0.05, 0.14, 0.40);
  const gold = rgb(0.75, 0.55, 0.00);
  const ltGray = rgb(0.96, 0.96, 0.97);
  const dkGray = rgb(0.30, 0.30, 0.32);
  const black  = rgb(0.08, 0.08, 0.08);

  // ── Header ───────────────────────────────────────────────────
  page.drawRectangle({ x:0, y:H-90, width:W, height:90, color:navy });
  page.drawRectangle({ x:0, y:H-95, width:W, height:5, color:gold });

  // Logo
  if (school.logo_url) {
    try {
      const buf = await fetchBuf(school.logo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:18, y:H-82, width:66, height:66 });
    } catch {}
  }

  // School name
  const sn = (school.school_name || 'SCHOOL').toUpperCase();
  let snSz = 18; while (B.widthOfTextAtSize(sn, snSz) > W-180 && snSz > 10) snSz--;
  const snW = B.widthOfTextAtSize(sn, snSz);
  page.drawText(sn, { x:(W-snW)/2, y:H-46, size:snSz, font:B, color:rgb(1,1,1) });
  const rptTitle = bulletinMeta.is_annual ? 'ANNUAL REPORT CARD' : 'SCHOOL REPORT CARD';
  const rtW = SB.widthOfTextAtSize(rptTitle, 11);
  page.drawText(rptTitle, { x:(W-rtW)/2, y:H-62, size:11, font:SB, color:gold });
  const termStr = `${termInfo?.name || ''} — ${yearInfo?.name || ''}`;
  const tsW = R.widthOfTextAtSize(termStr, 9);
  page.drawText(termStr, { x:(W-tsW)/2, y:H-76, size:9, font:R, color:rgb(0.80,0.85,0.95) });

  // ── Student Info Banner ──────────────────────────────────────
  const infoY = H - 95;
  page.drawRectangle({ x:0, y:infoY-65, width:W, height:65, color:ltGray });
  page.drawLine({ start:{x:0,y:infoY-65}, end:{x:W,y:infoY-65}, thickness:0.8, color:rgb(0.85,0.85,0.88) });

  // Student photo
  if (student.photo_url) {
    try {
      const buf = await fetchBuf(student.photo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:16, y:infoY-62, width:46, height:58 });
    } catch {}
  } else {
    page.drawRectangle({ x:16, y:infoY-62, width:46, height:58, color:rgb(0.88,0.88,0.90) });
  }

  const ix = 72;
  page.drawText(`${student.last_name.toUpperCase()} ${student.first_name}`, { x:ix, y:infoY-16, size:13, font:B, color:navy });
  page.drawText(`ID: ${student.student_id || '—'}`, { x:ix, y:infoY-30, size:9, font:R, color:dkGray });
  page.drawText(`Class: ${classInfo?.name || '—'}  |  Gender: ${student.gender || '—'}`, { x:ix, y:infoY-42, size:9, font:R, color:dkGray });
  page.drawText(`Attendance: ${bulletinMeta.days_present || 0}/${(bulletinMeta.days_present || 0) + (bulletinMeta.days_absent || 0)} days`, { x:ix, y:infoY-54, size:9, font:R, color:dkGray });

  // Rank + % on right
  const pct = bulletinMeta.percentage || 0;
  const rankStr = bulletinMeta.rank_in_class ? `${bulletinMeta.rank_in_class}/${bulletinMeta.class_size}` : '—';
  page.drawText('TOTAL', { x:W-120, y:infoY-16, size:8, font:SB, color:navy });
  page.drawText(`${pct.toFixed(1)}%`, { x:W-120, y:infoY-30, size:18, font:B, color:gradeColor(pct) });
  page.drawText(grade(pct), { x:W-120, y:infoY-46, size:14, font:B, color:gradeColor(pct) });
  page.drawText(`Rank: ${rankStr}`, { x:W-120, y:infoY-58, size:9, font:R, color:dkGray });

  // ── Marks Table ──────────────────────────────────────────────
  const tableTop = infoY - 78;
  const cols = { subj:16, cat1:310, cat2:360, exam:410, total:460, pct:500, grade:545 };
  const colW = { subj:290, cat1:46, cat2:46, exam:46, total:36, pct:42, grade:42 };

  // Header row
  page.drawRectangle({ x:12, y:tableTop-20, width:W-24, height:20, color:navy });
  [['Subject', cols.subj], ['CA1', cols.cat1], ['CA2', cols.cat2], ['Exam', cols.exam],
   ['Total', cols.total], ['%', cols.pct], ['Grade', cols.grade]
  ].forEach(([label, x]) => {
    const lw = B.widthOfTextAtSize(label, 8);
    page.drawText(label, { x, y:tableTop-14, size:8, font:B, color:rgb(1,1,1) });
  });

  let rowY = tableTop - 22;
  let totalWeighted = 0, totalCoeff = 0, totalMaxW = 0;

  subjects.forEach((sub, idx) => {
    const m = marks.find(mk => mk.subject_id === sub.id);
    const isEven = idx % 2 === 0;
    if (isEven) page.drawRectangle({ x:12, y:rowY-16, width:W-24, height:17, color:rgb(0.97,0.97,0.99) });

    const coef  = sub.coefficient || 1;
    const maxM  = sub.max_marks   || 100;
    const tot   = m?.total  ?? null;
    const pctS  = tot !== null ? Math.min(100, (tot / maxM) * 100) : null;
    const grd   = pctS !== null ? grade(pctS) : '—';

    if (tot !== null) {
      totalWeighted += tot * coef;
      totalCoeff    += coef;
      totalMaxW     += maxM * coef;
    }

    page.drawText(sub.name, { x:cols.subj, y:rowY-12, size:9, font:R, color:black });
    if (sub.coefficient > 1) page.drawText(`(×${sub.coefficient})`, { x:cols.subj+B.widthOfTextAtSize(sub.name,9)+4, y:rowY-12, size:7, font:I, color:navy });
    page.drawText(m?.cat1  != null ? String(m.cat1)  : '—', { x:cols.cat1,  y:rowY-12, size:9, font:R, color:black });
    page.drawText(m?.cat2  != null ? String(m.cat2)  : '—', { x:cols.cat2,  y:rowY-12, size:9, font:R, color:black });
    page.drawText(m?.exam  != null ? String(m.exam)  : '—', { x:cols.exam,  y:rowY-12, size:9, font:R, color:black });
    page.drawText(tot       != null ? tot.toFixed(1)  : '—', { x:cols.total, y:rowY-12, size:9, font:SB, color:black });
    page.drawText(pctS      != null ? pctS.toFixed(1)+'%' : '—', { x:cols.pct, y:rowY-12, size:9, font:R, color:dkGray });
    if (pctS !== null) page.drawText(grd, { x:cols.grade, y:rowY-12, size:9, font:B, color:gradeColor(pctS) });
    page.drawLine({ start:{x:12,y:rowY-16}, end:{x:W-12,y:rowY-16}, thickness:0.3, color:rgb(0.88,0.88,0.90) });
    rowY -= 17;
  });

  // Total row
  const finalPct = totalMaxW > 0 ? (totalWeighted / totalMaxW) * 100 : 0;
  page.drawRectangle({ x:12, y:rowY-18, width:W-24, height:19, color:navy });
  page.drawText('OVERALL', { x:cols.subj, y:rowY-12, size:9, font:B, color:rgb(1,1,1) });
  page.drawText(totalWeighted.toFixed(1), { x:cols.total, y:rowY-12, size:9, font:B, color:gold });
  page.drawText(finalPct.toFixed(1)+'%', { x:cols.pct, y:rowY-12, size:9, font:B, color:gold });
  page.drawText(grade(finalPct), { x:cols.grade, y:rowY-12, size:9, font:B, color:gold });
  rowY -= 20;

  // ── Remarks ──────────────────────────────────────────────────
  rowY -= 12;
  page.drawText('Class Teacher Remarks:', { x:16, y:rowY, size:9, font:SB, color:navy });
  page.drawLine({ start:{x:16,y:rowY-14}, end:{x:W/2-10,y:rowY-14}, thickness:0.6, color:rgb(0.7,0.7,0.7) });
  if (bulletinMeta.teacher_remarks) page.drawText(bulletinMeta.teacher_remarks, { x:16, y:rowY-12, size:9, font:I, color:dkGray });

  page.drawText("Head Teacher's Remarks:", { x:W/2+5, y:rowY, size:9, font:SB, color:navy });
  page.drawLine({ start:{x:W/2+5,y:rowY-14}, end:{x:W-16,y:rowY-14}, thickness:0.6, color:rgb(0.7,0.7,0.7) });
  if (bulletinMeta.head_remarks) page.drawText(bulletinMeta.head_remarks, { x:W/2+5, y:rowY-12, size:9, font:I, color:dkGray });
  rowY -= 30;

  // ── Signatures ───────────────────────────────────────────────
  page.drawLine({ start:{x:20,y:rowY-14}, end:{x:160,y:rowY-14}, thickness:0.7, color:rgb(0.5,0.5,0.5) });
  page.drawText('Class Teacher', { x:20, y:rowY-26, size:9, font:R, color:dkGray });
  page.drawLine({ start:{x:W/2-60,y:rowY-14}, end:{x:W/2+60,y:rowY-14}, thickness:0.7, color:rgb(0.5,0.5,0.5) });
  page.drawText('Head Teacher', { x:W/2-60+(120-SB.widthOfTextAtSize('Head Teacher',9))/2, y:rowY-26, size:9, font:R, color:dkGray });
  page.drawLine({ start:{x:W-170,y:rowY-14}, end:{x:W-20,y:rowY-14}, thickness:0.7, color:rgb(0.5,0.5,0.5) });
  page.drawText('Parent / Guardian', { x:W-170, y:rowY-26, size:9, font:R, color:dkGray });

  // Signature image
  if (school.signature_url) {
    try {
      const buf = await fetchBuf(school.signature_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:W/2-55, y:rowY-12, width:110, height:24, opacity:0.85 });
    } catch {}
  }

  // ── Footer ───────────────────────────────────────────────────
  page.drawRectangle({ x:0, y:0, width:W, height:28, color:navy });
  const date = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  page.drawText(`Issued: ${date}`, { x:16, y:10, size:8, font:R, color:rgb(0.75,0.80,0.95) });
  const stamp = `${school.school_name || ''} — Official Report Card`;
  const stW = R.widthOfTextAtSize(stamp, 8);
  page.drawText(stamp, { x:(W-stW)/2, y:10, size:8, font:R, color:gold });

  return await doc.save();
}

// ── CONTROLLERS ───────────────────────────────────────────────

// GET /api/sms/bulletins?student_id=&term_id=
exports.getBulletins = async (req, res) => {
  try {
    const { student_id, term_id, class_id } = req.query;
    let q = supabase.from('bulletins')
      .select('*, student:student_profiles(id,first_name,last_name,student_id), term:terms(name,number), class:classes(name)')
      .eq('school_id', req.schoolId);
    if (student_id) q = q.eq('student_id', student_id);
    if (term_id)    q = q.eq('term_id', term_id);
    if (class_id)   q = q.eq('class_id', class_id);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── Helper: compute marks for Annual (average of T1+T2+T3) ───
async function computeAnnualMarks(studentId, classId, schoolId, academicYearId) {
  // Get the 3 term IDs for this year
  const { data: allTerms } = await supabase.from('terms')
    .select('id,number').eq('academic_year_id', academicYearId).eq('school_id', schoolId)
    .in('number', [1, 2, 3]);

  if (!allTerms?.length) return [];

  // Get marks for each term
  const allMarks = await Promise.all(allTerms.map(t =>
    supabase.from('marks').select('*, subject:subjects(*)')
      .eq('student_id', studentId).eq('term_id', t.id)
  ));

  // Build averaged marks per subject
  const subjectMap = {};
  allMarks.forEach(({ data: mks }) => {
    (mks || []).forEach(m => {
      if (!subjectMap[m.subject_id]) subjectMap[m.subject_id] = { ...m, _count: 0, _totalSum: 0 };
      if (m.total != null) {
        subjectMap[m.subject_id]._totalSum += m.total;
        subjectMap[m.subject_id]._count    += 1;
      }
    });
  });

  return Object.values(subjectMap).map(m => ({
    ...m,
    cat1: null, cat2: null, exam: null,
    total: m._count > 0 ? parseFloat((m._totalSum / m._count).toFixed(2)) : null,
  }));
}

// POST /api/sms/bulletins/generate — generate PDF for one student
exports.generateOne = async (req, res) => {
  try {
    const { student_id, term_id, class_id, academic_year_id, teacher_remarks, head_remarks, conduct, days_present, days_absent } = req.body;

    // Get term info to check if Annual
    const { data: termInfo } = await supabase.from('terms').select('*').eq('id', term_id).single();
    const isAnnual = termInfo?.number === 4;

    const [{ data: student }, { data: classSubs }, { data: yearInfo }, { data: classInfo }] = await Promise.all([
      supabase.from('student_profiles').select('*').eq('id', student_id).single(),
      supabase.from('class_subjects').select('*, subject:subjects(*)').eq('class_id', class_id),
      supabase.from('academic_years').select('*').eq('id', academic_year_id).single(),
      supabase.from('classes').select('*').eq('id', class_id).single(),
    ]);

    const subjects = (classSubs || []).map(cs => cs.subject);

    // Get marks — averaged if Annual
    let marks;
    if (isAnnual) {
      marks = await computeAnnualMarks(student_id, class_id, req.schoolId, academic_year_id);
    } else {
      const { data: m } = await supabase.from('marks').select('*, subject:subjects(*)')
        .eq('student_id', student_id).eq('term_id', term_id);
      marks = m || [];
    }

    // Calculate totals
    const { data: allBulletins } = await supabase.from('bulletins')
      .select('student_id, percentage').eq('term_id', term_id).eq('class_id', class_id);

    let totalWeighted = 0, totalMaxW = 0;
    subjects.forEach(sub => {
      const m = marks.find(mk => mk.subject_id === sub.id);
      if (m?.total != null) {
        totalWeighted += m.total * (sub.coefficient || 1);
        totalMaxW     += (sub.max_marks || 100) * (sub.coefficient || 1);
      }
    });
    const pct = totalMaxW > 0 ? (totalWeighted / totalMaxW) * 100 : 0;

    const peers = [...(allBulletins || []), { student_id, percentage: pct }]
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    const rank = peers.findIndex(p => p.student_id === student_id) + 1;

    const bulletinMeta = {
      percentage: pct, rank_in_class: rank, class_size: peers.length,
      teacher_remarks, head_remarks, conduct: conduct || 'Good',
      days_present: parseInt(days_present || 0), days_absent: parseInt(days_absent || 0),
      is_annual: isAnnual,
    };

    const pdfBytes = await generateBulletinPDF(
      student, marks, subjects, classInfo, termInfo, yearInfo, req.school, bulletinMeta
    );

    await supabase.from('bulletins').upsert([{
      school_id: req.schoolId, student_id, term_id, class_id, academic_year_id,
      total_marks: totalWeighted, max_possible: totalMaxW,
      percentage: pct, rank_in_class: rank, class_size: peers.length,
      grade: pct >= 80 ? 'A1' : pct >= 70 ? 'B2' : pct >= 60 ? 'C3' : pct >= 50 ? 'D4' : 'F',
      conduct, teacher_remarks, head_remarks,
      days_present: parseInt(days_present || 0), days_absent: parseInt(days_absent || 0),
      generated_at: new Date().toISOString(), generated_by: req.staff?.id || null,
    }], { onConflict: 'student_id,term_id' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${student.student_id || student_id}_bulletin.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('generateOne error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/sms/bulletins/generate-class — generate all bulletins for a class/term
exports.generateClass = async (req, res) => {
  try {
    const { term_id, class_id, academic_year_id, conduct, teacher_remarks, head_remarks } = req.body;

    const { data: termInfo } = await supabase.from('terms').select('*').eq('id', term_id).single();
    const isAnnual = termInfo?.number === 4;

    const { data: students } = await supabase.from('student_profiles')
      .select('*').eq('current_class_id', class_id).eq('status', 'active').eq('school_id', req.schoolId);

    if (!students?.length) return res.status(404).json({ success: false, error: 'No students in class' });

    const [{ data: classSubs }, { data: yearInfo }, { data: classInfo }] = await Promise.all([
      supabase.from('class_subjects').select('*, subject:subjects(*)').eq('class_id', class_id),
      supabase.from('academic_years').select('*').eq('id', academic_year_id).single(),
      supabase.from('classes').select('*').eq('id', class_id).single(),
    ]);
    const subjects = (classSubs || []).map(cs => cs.subject);

    // Get marks per student
    let allMarksMap = {};
    if (isAnnual) {
      for (const st of students) {
        allMarksMap[st.id] = await computeAnnualMarks(st.id, class_id, req.schoolId, academic_year_id);
      }
    } else {
      const { data: allMarks } = await supabase.from('marks').select('*').eq('class_id', class_id).eq('term_id', term_id);
      students.forEach(st => { allMarksMap[st.id] = (allMarks || []).filter(m => m.student_id === st.id); });
    }

    // Calculate percentages for ranking
    const studentPcts = students.map(st => {
      const stMarks = allMarksMap[st.id] || [];
      let tw = 0, tmx = 0;
      subjects.forEach(sub => {
        const m = stMarks.find(mk => mk.subject_id === sub.id);
        if (m?.total != null) { tw += m.total * (sub.coefficient||1); tmx += (sub.max_marks||100) * (sub.coefficient||1); }
      });
      return { student: st, pct: tmx > 0 ? (tw/tmx)*100 : 0, total: tw, maxTotal: tmx };
    }).sort((a,b) => b.pct - a.pct);
    studentPcts.forEach((sp,i) => { sp.rank = i+1; });

    const merged = await PDFDocument.create();
    for (const sp of studentPcts) {
      const meta = {
        percentage: sp.pct, rank_in_class: sp.rank, class_size: students.length,
        teacher_remarks, head_remarks, conduct: conduct||'Good', days_present:0, days_absent:0, is_annual: isAnnual,
      };
      const bytes = await generateBulletinPDF(sp.student, allMarksMap[sp.student.id]||[], subjects, classInfo, termInfo, yearInfo, req.school, meta);
      const bDoc = await PDFDocument.load(bytes);
      const [pg] = await merged.copyPages(bDoc,[0]);
      merged.addPage(pg);

      await supabase.from('bulletins').upsert([{
        school_id:req.schoolId, student_id:sp.student.id, term_id, class_id, academic_year_id,
        total_marks:sp.total, max_possible:sp.maxTotal, percentage:sp.pct,
        rank_in_class:sp.rank, class_size:students.length,
        grade: sp.pct>=80?'A1':sp.pct>=70?'B2':sp.pct>=60?'C3':sp.pct>=50?'D4':'F',
        conduct, teacher_remarks, head_remarks, generated_at: new Date().toISOString(),
      }],{onConflict:'student_id,term_id'});
    }

    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="${classInfo?.name||'class'}_${isAnnual?'annual':termInfo?.name||''}_bulletins.pdf"`);
    res.send(Buffer.from(await merged.save()));
  } catch (err) {
    console.error('generateClass error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
