const { supabase } = require('../supabase');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
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

// ── Grade helpers ─────────────────────────────────────────────
function grade(pct) {
  if (pct >= 80) return 'A1';
  if (pct >= 70) return 'B2';
  if (pct >= 60) return 'C3';
  if (pct >= 50) return 'D4';
  if (pct >= 40) return 'E5';
  return 'F';
}

// ── Draw centered text helper ─────────────────────────────────
function drawCentered(page, text, font, size, color, x, width, y) {
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x + (width - tw) / 2, y, size, font, color });
}

// ── Draw bordered cell ────────────────────────────────────────
function drawCell(page, x, y, w, h, bgColor) {
  if (bgColor) page.drawRectangle({ x, y, width: w, height: h, color: bgColor });
  page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.2, 0.2, 0.4), borderWidth: 0.5 });
}

// ════════════════════════════════════════════════════════════════
// GENERATE BULLETIN PDF — Rwandan school report card format
// ════════════════════════════════════════════════════════════════
async function generateBulletinPDF(student, marks, subjects, classInfo, termInfo, yearInfo, school, meta) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const loadFont = async (name) => {
    try { return await doc.embedFont(fs.readFileSync(path.join(FONTS_DIR, name))); } catch {}
    return await doc.embedFont(StandardFonts.Helvetica);
  };
  const B  = await loadFont('Montserrat-Bold.ttf');
  const R  = await loadFont('Montserrat-Regular.ttf');
  const SB = await loadFont('Montserrat-SemiBold.ttf');

  const page = doc.addPage([595.28, 841.89]); // A4
  const W = 595.28, H = 841.89;
  const NAVY  = rgb(0.04, 0.14, 0.40);
  const WHITE = rgb(1, 1, 1);
  const BLACK = rgb(0.05, 0.05, 0.05);
  const LGRAY = rgb(0.93, 0.94, 0.97);
  const MGRAY = rgb(0.75, 0.75, 0.80);

  const ML = 20, MR = 20; // margins
  const CW = W - ML - MR;  // content width

  // ── TOP HEADER (3 columns) ───────────────────────────────────
  const HDR_H = 90;
  page.drawRectangle({ x: 0, y: H - HDR_H, width: W, height: HDR_H, color: WHITE });
  page.drawLine({ start:{x:0,y:H-HDR_H}, end:{x:W,y:H-HDR_H}, thickness:2, color:NAVY });

  // Left: Republic + School info
  const sn = school.school_name || 'My School';
  const cityAddr = school.address || school.city || 'Kigali';
  page.drawText('REPUBLIC OF RWANDA', { x:ML, y:H-18, size:8, font:B, color:NAVY });
  page.drawText(sn, { x:ML, y:H-30, size:8, font:B, color:BLACK });
  page.drawText(cityAddr, { x:ML, y:H-41, size:7, font:R, color:BLACK });
  if (school.phone) page.drawText(school.phone, { x:ML, y:H-52, size:7, font:R, color:BLACK });

  // Center: Logo
  const LOGO_X = (W - 60) / 2, LOGO_Y = H - HDR_H + 10;
  if (school.logo_url) {
    try {
      const buf = await fetchBuf(school.logo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x: LOGO_X, y: LOGO_Y, width: 60, height: 66 });
    } catch {}
  } else {
    page.drawRectangle({ x: LOGO_X, y: LOGO_Y, width: 60, height: 60, color: LGRAY });
    drawCentered(page, sn.substring(0,2).toUpperCase(), B, 20, NAVY, LOGO_X, 60, LOGO_Y+22);
  }

  // Right: Ministry + Year + Term
  const RX = W - 190;
  page.drawText('MINISTRY OF EDUCATION', { x: RX, y: H-18, size:8, font:B, color:NAVY });
  page.drawText(`School Year: ${yearInfo?.name || ''}`, { x:RX, y:H-30, size:8, font:R, color:BLACK });
  const termLabel = meta.is_annual ? 'Annual Report' : (termInfo?.name || '');
  const tlW = B.widthOfTextAtSize(termLabel, 10);
  page.drawText(termLabel, { x: W - MR - tlW, y: H-46, size:10, font:B, color:NAVY });

  // ── REPORT CARD TITLE BAR ────────────────────────────────────
  const TITLE_Y = H - HDR_H - 22;
  page.drawRectangle({ x: ML, y: TITLE_Y, width: CW, height: 20, color: NAVY });
  const title = meta.is_annual ? 'ANNUAL REPORT CARD' : 'REPORT CARD';
  drawCentered(page, title, B, 12, WHITE, ML, CW, TITLE_Y + 5);

  // ── STUDENT INFO ROW ─────────────────────────────────────────
  const INFO_Y = TITLE_Y - 70;
  page.drawRectangle({ x:ML, y:INFO_Y, width:CW, height:68, color:WHITE });
  page.drawRectangle({ x:ML, y:INFO_Y, width:CW, height:68, borderColor:NAVY, borderWidth:0.8 });

  // Photo box left
  const PH_W = 52, PH_H = 64;
  page.drawRectangle({ x:ML+4, y:INFO_Y+2, width:PH_W, height:PH_H, color:LGRAY });
  if (student.photo_url) {
    try {
      const buf = await fetchBuf(student.photo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:ML+4, y:INFO_Y+2, width:PH_W, height:PH_H });
    } catch {}
  }

  // Student fields
  const IFX = ML + PH_W + 10;
  const IFY = INFO_Y + 54;
  const labelW = 95;
  const fieldRows = [
    ['STUDENT NAME:', `${student.last_name?.toUpperCase() || ''} ${student.first_name || ''}`],
    ['BORN:', student.date_of_birth ? `${student.date_of_birth}` : 'at'],
    ['ID NO.:', student.student_id || '—'],
  ];
  fieldRows.forEach(([lbl, val], i) => {
    page.drawText(lbl, { x:IFX, y:IFY - i*18, size:8, font:R, color:MGRAY });
    page.drawText(val, { x:IFX+labelW, y:IFY - i*18, size:9, font:B, color:BLACK });
  });

  // Right column
  const RCX = W/2 + 20;
  const rightRows = [
    ['CLASS:', classInfo?.name || '—'],
    ['NO. OF STUDENTS:', String(meta.class_size || '—')],
    ['CONDUCT:', `${meta.conduct || 'Good'}`],
  ];
  rightRows.forEach(([lbl, val], i) => {
    page.drawText(lbl, { x:RCX, y:IFY - i*18, size:8, font:R, color:MGRAY });
    page.drawText(val, { x:RCX+120, y:IFY - i*18, size:9, font:B, color:BLACK });
  });

  // ── MARKS TABLE ──────────────────────────────────────────────
  // Columns: SUBJECTS | MAX POINT(TEST/EX/TOT) | O.P(TEST/EX/TOT) | RANK
  const TBL_Y = INFO_Y - 2;      // top of table
  const ROW_H = 16;

  // Column x positions & widths
  const C_SUBJ  = ML,           C_SUBJ_W  = 130;
  const C_MTEST = ML+130,       C_COL_W   = 38;
  const C_MEX   = ML+130+38;
  const C_MTOT  = ML+130+76;
  const C_OTEST = ML+130+114;
  const C_OEX   = ML+130+152;
  const C_OTOT  = ML+130+190;
  const C_RANK  = ML+130+228,   C_RANK_W  = CW - 130 - 228;

  // Group headers
  const GHY = TBL_Y - ROW_H;
  drawCell(page, C_SUBJ,  GHY, C_SUBJ_W, ROW_H, NAVY);
  drawCell(page, C_MTEST, GHY, C_COL_W*3, ROW_H, NAVY);
  drawCell(page, C_OTEST, GHY, C_COL_W*3, ROW_H, NAVY);
  drawCell(page, C_RANK,  GHY, C_RANK_W, ROW_H, NAVY);
  drawCentered(page,'SUBJECTS', B, 8, WHITE, C_SUBJ,  C_SUBJ_W,  GHY+4);
  drawCentered(page,'MAX POINT',B, 8, WHITE, C_MTEST, C_COL_W*3, GHY+4);
  drawCentered(page,'O.P',      B, 8, WHITE, C_OTEST, C_COL_W*3, GHY+4);
  drawCentered(page,'RANK',     B, 8, WHITE, C_RANK,  C_RANK_W,  GHY+4);

  // Sub-headers
  const SHY = GHY - ROW_H;
  const subCols = [
    [C_SUBJ,'',C_SUBJ_W],[C_MTEST,'TEST',C_COL_W],[C_MEX,'EX',C_COL_W],[C_MTOT,'TOT',C_COL_W],
    [C_OTEST,'TEST',C_COL_W],[C_OEX,'EX',C_COL_W],[C_OTOT,'TOT',C_COL_W],[C_RANK,'',C_RANK_W],
  ];
  subCols.forEach(([x,lbl,w]) => {
    drawCell(page, x, SHY, w, ROW_H, LGRAY);
    if (lbl) drawCentered(page, lbl, B, 7, NAVY, x, w, SHY+4);
  });

  // Subject rows
  let rowY = SHY - ROW_H;
  let grandTotalPts = 0, grandMaxPts = 0;
  let grandTestMax = 0, grandExMax = 0;
  let grandTestOp  = 0, grandExOp  = 0;

  // Build per-subject rank (by subject total across class)
  const subjectRanks = {};

  subjects.forEach((sub, idx) => {
    const m    = marks.find(mk => mk.subject_id === sub.id);
    const bg   = idx % 2 === 0 ? WHITE : LGRAY;
    const coef = sub.coefficient || 1;
    const maxM = sub.max_marks || 100;
    // Split max: TEST = half, EX = other half (or use cat marks directly)
    const maxTest = m?.cat1 != null ? maxM / 2 : maxM / 2;
    const maxEx   = m?.cat2 != null ? maxM / 2 : maxM / 2;
    const opTest  = m?.cat1 ?? null;
    const opEx    = m?.cat2 != null ? (parseFloat(m.cat2||0) + parseFloat(m.exam||0)) : (m?.exam ?? null);
    const opTot   = m?.total ?? null;

    // Accumulate grand totals
    grandTestMax += maxTest * coef;
    grandExMax   += maxEx   * coef;
    if (opTest != null) grandTestOp += parseFloat(opTest) * coef;
    if (opEx   != null) grandExOp   += parseFloat(opEx)   * coef;
    if (opTot  != null) { grandTotalPts += opTot * coef; grandMaxPts += maxM * coef; }

    // Subject rank placeholder (rank in class for this subject)
    const subRank = subjectRanks[sub.id] || '—';

    [C_SUBJ,C_MTEST,C_MEX,C_MTOT,C_OTEST,C_OEX,C_OTOT,C_RANK].forEach((x,ci) => {
      drawCell(page, x, rowY, ci===0?C_SUBJ_W:ci===7?C_RANK_W:C_COL_W, ROW_H, bg);
    });

    page.drawText(sub.name.toUpperCase(), { x:C_SUBJ+3, y:rowY+4, size:7.5, font:R, color:BLACK });
    const fmtNum = n => n != null ? String(parseFloat(n.toFixed(1))) : '—';
    drawCentered(page, fmtNum(maxTest), R, 8, BLACK, C_MTEST, C_COL_W, rowY+4);
    drawCentered(page, fmtNum(maxEx),   R, 8, BLACK, C_MEX,   C_COL_W, rowY+4);
    drawCentered(page, fmtNum(maxM),    R, 8, BLACK, C_MTOT,  C_COL_W, rowY+4);
    drawCentered(page, fmtNum(opTest),  R, 8, BLACK, C_OTEST, C_COL_W, rowY+4);
    drawCentered(page, fmtNum(opEx),    R, 8, BLACK, C_OEX,   C_COL_W, rowY+4);
    drawCentered(page, fmtNum(opTot),   SB,8, BLACK, C_OTOT,  C_COL_W, rowY+4);
    drawCentered(page, String(subRank), R, 8, BLACK, C_RANK,  C_RANK_W,rowY+4);
    rowY -= ROW_H;
  });

  // TOTAL row
  drawCell(page, C_SUBJ,  rowY, C_SUBJ_W,  ROW_H, NAVY);
  [C_MTEST,C_MEX,C_MTOT,C_OTEST,C_OEX,C_OTOT,C_RANK].forEach((x,ci) => {
    drawCell(page, x, rowY, ci===6?C_RANK_W:C_COL_W, ROW_H, NAVY);
  });
  page.drawText('TOTAL', { x:C_SUBJ+3, y:rowY+4, size:8, font:B, color:WHITE });
  const fmt = n => String(parseFloat(n.toFixed(1)));
  drawCentered(page,fmt(grandTestMax),B,8,WHITE,C_MTEST,C_COL_W,rowY+4);
  drawCentered(page,fmt(grandExMax),  B,8,WHITE,C_MEX,  C_COL_W,rowY+4);
  drawCentered(page,fmt(grandMaxPts), B,8,WHITE,C_MTOT, C_COL_W,rowY+4);
  drawCentered(page,fmt(grandTestOp), B,8,WHITE,C_OTEST,C_COL_W,rowY+4);
  drawCentered(page,fmt(grandExOp),   B,8,WHITE,C_OEX,  C_COL_W,rowY+4);
  drawCentered(page,fmt(grandTotalPts),B,8,WHITE,C_OTOT, C_COL_W,rowY+4);
  rowY -= ROW_H;

  // ── AVERAGE + RANK BAR ───────────────────────────────────────
  rowY -= 4;
  const avgPct = grandMaxPts > 0 ? (grandTotalPts / grandMaxPts * 100) : (meta.percentage || 0);
  const rankStr = meta.rank_in_class ? `${meta.rank_in_class} out of ${meta.class_size}` : '—';

  page.drawRectangle({ x:ML, y:rowY-ROW_H, width:CW/2-4, height:ROW_H, color:LGRAY, borderColor:NAVY, borderWidth:0.6 });
  page.drawRectangle({ x:ML+CW/2+4, y:rowY-ROW_H, width:CW/2-4, height:ROW_H, color:LGRAY, borderColor:NAVY, borderWidth:0.6 });
  page.drawText('AVERAGE:', { x:ML+8, y:rowY-ROW_H+5, size:9, font:B, color:NAVY });
  page.drawText(`${avgPct.toFixed(1)}%`, { x:ML+80, y:rowY-ROW_H+5, size:11, font:B, color:NAVY });
  page.drawText('RANK:', { x:ML+CW/2+12, y:rowY-ROW_H+5, size:9, font:B, color:NAVY });
  page.drawText(rankStr, { x:ML+CW/2+60, y:rowY-ROW_H+5, size:11, font:B, color:NAVY });
  rowY -= (ROW_H + 10);

  // ── OBSERVATIONS + SIGNATURES ────────────────────────────────
  const OBS_H = 80;
  const OBS_W = CW * 0.55;
  const SIG_W = CW - OBS_W - 4;
  const SIG_X = ML + OBS_W + 4;

  // Observations box
  page.drawRectangle({ x:ML, y:rowY-OBS_H, width:OBS_W, height:OBS_H, color:WHITE, borderColor:NAVY, borderWidth:0.6 });
  drawCentered(page, 'OBSERVATIONS', B, 8, NAVY, ML, OBS_W, rowY-12);
  // Lines for writing
  for (let i = 1; i <= 3; i++) {
    page.drawLine({ start:{x:ML+8, y:rowY-12-i*16}, end:{x:ML+OBS_W-8, y:rowY-12-i*16}, thickness:0.4, color:MGRAY });
  }
  if (meta.teacher_remarks) {
    page.drawText(meta.teacher_remarks, { x:ML+8, y:rowY-26, size:8, font:R, color:BLACK, maxWidth:OBS_W-16 });
  }

  // Signatures box
  page.drawRectangle({ x:SIG_X, y:rowY-OBS_H, width:SIG_W, height:OBS_H, color:WHITE, borderColor:NAVY, borderWidth:0.6 });
  const SIG_MID = rowY - OBS_H/2 - 2;

  // Teacher signature
  page.drawText('TEACHER SIGNATURE', { x:SIG_X+8, y:rowY-14, size:7.5, font:B, color:NAVY });
  page.drawLine({ start:{x:SIG_X+8,y:rowY-28}, end:{x:SIG_X+SIG_W-40,y:rowY-28}, thickness:0.5, color:MGRAY });
  page.drawText('Date: ___________', { x:SIG_X+SIG_W-80, y:rowY-28, size:7, font:R, color:MGRAY });
  if (school.signature_url) {
    try {
      const buf = await fetchBuf(school.signature_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:SIG_X+8, y:rowY-40, width:70, height:18, opacity:0.8 });
    } catch {}
  }

  // Divider
  page.drawLine({ start:{x:SIG_X+8,y:SIG_MID}, end:{x:SIG_X+SIG_W-8,y:SIG_MID}, thickness:0.4, color:MGRAY });

  // Parent signature
  page.drawText('PARENT SIGNATURE', { x:SIG_X+8, y:SIG_MID-12, size:7.5, font:B, color:NAVY });
  page.drawLine({ start:{x:SIG_X+8,y:SIG_MID-26}, end:{x:SIG_X+SIG_W-40,y:SIG_MID-26}, thickness:0.5, color:MGRAY });
  page.drawText('Date: ___________', { x:SIG_X+SIG_W-80, y:SIG_MID-26, size:7, font:R, color:MGRAY });

  // ── FOOTER ───────────────────────────────────────────────────
  page.drawLine({ start:{x:ML,y:28}, end:{x:W-MR,y:28}, thickness:0.8, color:NAVY });
  const footerText = school.cert_purpose || 'EDUCATION FOR LIFE';
  drawCentered(page, `— ${footerText} —`, R, 8, NAVY, ML, CW, 14);

  return await doc.save();
}


// ════════════════════════════════════════════════════════════════
// CONTROLLERS
// ════════════════════════════════════════════════════════════════

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

async function computeAnnualMarks(studentId, classId, schoolId, academicYearId) {
  const { data: allTerms } = await supabase.from('terms')
    .select('id,number').eq('academic_year_id', academicYearId).eq('school_id', schoolId)
    .in('number', [1, 2, 3]);
  if (!allTerms?.length) return [];
  const allMarks = await Promise.all(allTerms.map(t =>
    supabase.from('marks').select('*, subject:subjects(*)').eq('student_id', studentId).eq('term_id', t.id)
  ));
  const subjectMap = {};
  allMarks.forEach(({ data: mks }) => {
    (mks || []).forEach(m => {
      if (!subjectMap[m.subject_id]) subjectMap[m.subject_id] = { ...m, _count: 0, _totalSum: 0 };
      if (m.total != null) { subjectMap[m.subject_id]._totalSum += m.total; subjectMap[m.subject_id]._count += 1; }
    });
  });
  return Object.values(subjectMap).map(m => ({
    ...m, cat1: null, cat2: null, exam: null,
    total: m._count > 0 ? parseFloat((m._totalSum / m._count).toFixed(2)) : null,
  }));
}

exports.generateOne = async (req, res) => {
  try {
    const { student_id, term_id, class_id, academic_year_id, teacher_remarks, head_remarks, conduct, days_present, days_absent } = req.body;
    const { data: termInfo } = await supabase.from('terms').select('*').eq('id', term_id).single();
    const isAnnual = termInfo?.number === 4;
    const [{ data: student }, { data: classSubs }, { data: yearInfo }, { data: classInfo }] = await Promise.all([
      supabase.from('student_profiles').select('*').eq('id', student_id).single(),
      supabase.from('class_subjects').select('*, subject:subjects(*)').eq('class_id', class_id),
      supabase.from('academic_years').select('*').eq('id', academic_year_id).single(),
      supabase.from('classes').select('*').eq('id', class_id).single(),
    ]);
    const subjects = (classSubs || []).map(cs => cs.subject);
    let marks;
    if (isAnnual) {
      marks = await computeAnnualMarks(student_id, class_id, req.schoolId, academic_year_id);
    } else {
      const { data: m } = await supabase.from('marks').select('*, subject:subjects(*)').eq('student_id', student_id).eq('term_id', term_id);
      marks = m || [];
    }
    const { data: allBulletins } = await supabase.from('bulletins').select('student_id,percentage').eq('term_id', term_id).eq('class_id', class_id);
    let tw = 0, tmx = 0;
    subjects.forEach(sub => {
      const m = marks.find(mk => mk.subject_id === sub.id);
      if (m?.total != null) { tw += m.total * (sub.coefficient||1); tmx += (sub.max_marks||100) * (sub.coefficient||1); }
    });
    const pct = tmx > 0 ? (tw / tmx) * 100 : 0;
    const peers = [...(allBulletins||[]), { student_id, percentage: pct }].sort((a,b)=>(b.percentage||0)-(a.percentage||0));
    const rank = peers.findIndex(p => p.student_id === student_id) + 1;
    const bulletinMeta = { percentage:pct, rank_in_class:rank, class_size:peers.length, teacher_remarks, head_remarks, conduct:conduct||'Good', days_present:parseInt(days_present||0), days_absent:parseInt(days_absent||0), is_annual:isAnnual };
    const pdfBytes = await generateBulletinPDF(student, marks, subjects, classInfo, termInfo, yearInfo, req.school, bulletinMeta);
    await supabase.from('bulletins').upsert([{ school_id:req.schoolId, student_id, term_id, class_id, academic_year_id, total_marks:tw, max_possible:tmx, percentage:pct, rank_in_class:rank, class_size:peers.length, grade:pct>=80?'A1':pct>=70?'B2':pct>=60?'C3':pct>=50?'D4':'F', conduct, teacher_remarks, head_remarks, days_present:parseInt(days_present||0), days_absent:parseInt(days_absent||0), generated_at:new Date().toISOString(), generated_by:req.staff?.id||null }], { onConflict:'student_id,term_id' });
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="${student.student_id||student_id}_bulletin.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) { console.error('generateOne error:', err); res.status(500).json({ success:false, error:err.message }); }
};

exports.generateClass = async (req, res) => {
  try {
    const { term_id, class_id, academic_year_id, conduct, teacher_remarks, head_remarks } = req.body;
    const { data: termInfo } = await supabase.from('terms').select('*').eq('id', term_id).single();
    const isAnnual = termInfo?.number === 4;
    const { data: students } = await supabase.from('student_profiles').select('*').eq('current_class_id', class_id).eq('status','active').eq('school_id', req.schoolId);
    if (!students?.length) return res.status(404).json({ success:false, error:'No students in class' });
    const [{ data: classSubs }, { data: yearInfo }, { data: classInfo }] = await Promise.all([
      supabase.from('class_subjects').select('*, subject:subjects(*)').eq('class_id', class_id),
      supabase.from('academic_years').select('*').eq('id', academic_year_id).single(),
      supabase.from('classes').select('*').eq('id', class_id).single(),
    ]);
    const subjects = (classSubs||[]).map(cs=>cs.subject);
    let allMarksMap = {};
    if (isAnnual) {
      for (const st of students) allMarksMap[st.id] = await computeAnnualMarks(st.id, class_id, req.schoolId, academic_year_id);
    } else {
      const { data: allMarks } = await supabase.from('marks').select('*').eq('class_id', class_id).eq('term_id', term_id);
      students.forEach(st => { allMarksMap[st.id] = (allMarks||[]).filter(m=>m.student_id===st.id); });
    }
    const studentPcts = students.map(st => {
      const sm = allMarksMap[st.id]||[]; let tw=0,tmx=0;
      subjects.forEach(sub => { const m=sm.find(mk=>mk.subject_id===sub.id); if(m?.total!=null){tw+=m.total*(sub.coefficient||1);tmx+=(sub.max_marks||100)*(sub.coefficient||1);} });
      return { student:st, pct:tmx>0?(tw/tmx)*100:0, total:tw, maxTotal:tmx };
    }).sort((a,b)=>b.pct-a.pct);
    studentPcts.forEach((sp,i)=>{ sp.rank=i+1; });
    const merged = await PDFDocument.create();
    for (const sp of studentPcts) {
      const meta = { percentage:sp.pct, rank_in_class:sp.rank, class_size:students.length, teacher_remarks, head_remarks, conduct:conduct||'Good', days_present:0, days_absent:0, is_annual:isAnnual };
      const bytes = await generateBulletinPDF(sp.student, allMarksMap[sp.student.id]||[], subjects, classInfo, termInfo, yearInfo, req.school, meta);
      const bDoc = await PDFDocument.load(bytes);
      const [pg] = await merged.copyPages(bDoc,[0]);
      merged.addPage(pg);
      await supabase.from('bulletins').upsert([{ school_id:req.schoolId, student_id:sp.student.id, term_id, class_id, academic_year_id, total_marks:sp.total, max_possible:sp.maxTotal, percentage:sp.pct, rank_in_class:sp.rank, class_size:students.length, grade:sp.pct>=80?'A1':sp.pct>=70?'B2':sp.pct>=60?'C3':sp.pct>=50?'D4':'F', conduct, teacher_remarks, head_remarks, generated_at:new Date().toISOString() }],{onConflict:'student_id,term_id'});
    }
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="${classInfo?.name||'class'}_${isAnnual?'annual':termInfo?.name||''}_bulletins.pdf"`);
    res.send(Buffer.from(await merged.save()));
  } catch (err) { console.error('generateClass error:', err); res.status(500).json({ success:false, error:err.message }); }
};
