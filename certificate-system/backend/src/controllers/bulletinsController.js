const { supabase } = require('../supabase');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');

// ── A4 LANDSCAPE ─────────────────────────────────────────────
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const COL_W  = 400;
const GAP    = 21.89;   // PAGE_W - 2*COL_W - 2*10 margin
const LEFT_X = 10;
const RIGHT_X = LEFT_X + COL_W + GAP;

// ── Colors ────────────────────────────────────────────────────
const NAVY  = rgb(0.04, 0.14, 0.40);
const BLUE  = rgb(0.10, 0.35, 0.75);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0.05, 0.05, 0.05);
const LGRAY = rgb(0.93, 0.94, 0.97);
const MGRAY = rgb(0.70, 0.70, 0.75);

// ── Table column widths (within each 400pt bulletin) ─────────
const SUBJ_W = 100;
const COL_MW = 38;   // 6 mark columns × 38 = 228
const RANK_W = COL_W - SUBJ_W - COL_MW * 6; // 72
const ROW_H  = 14;
const HDR_H  = 16;

// ── Utilities ─────────────────────────────────────────────────
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
function fmtNum(n) {
  if (n == null) return '—';
  const f = parseFloat(n);
  return isNaN(f) ? '—' : String(parseFloat(f.toFixed(1)));
}
function drawCentered(page, text, font, size, color, x, width, y) {
  const tw = font.widthOfTextAtSize(String(text), size);
  page.drawText(String(text), { x: x + (width - tw) / 2, y, size, font, color });
}
function drawCell(page, x, y, w, h, bgColor) {
  if (bgColor) page.drawRectangle({ x, y, width: w, height: h, color: bgColor });
  page.drawRectangle({ x, y, width: w, height: h, borderColor: NAVY, borderWidth: 0.4 });
}
function clip(text, font, size, maxW) {
  let t = String(text || '');
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
  return t;
}
async function loadFonts(doc) {
  const load = async (name) => {
    try { return await doc.embedFont(fs.readFileSync(path.join(FONTS_DIR, name))); } catch {}
    return await doc.embedFont(StandardFonts.Helvetica);
  };
  return {
    B:  await load('Montserrat-Bold.ttf'),
    R:  await load('Montserrat-Regular.ttf'),
    SB: await load('Montserrat-SemiBold.ttf'),
  };
}

// ════════════════════════════════════════════════════════════
// DRAW ONE BULLETIN COLUMN  (ox = left edge of this column)
// ════════════════════════════════════════════════════════════
async function drawBulletinColumn(page, doc, ox, fonts, student, marks, subjects, classInfo, termInfo, yearInfo, school, meta) {
  const { B, R, SB } = fonts;
  let cy = PAGE_H - 8;

  // ── Header ──────────────────────────────────────────────
  const HDR_TOTAL = 76;
  const HDR_BOT   = cy - HDR_TOTAL;
  const leftW = Math.floor(COL_W * 0.38);
  const sn   = school.school_name || 'My School';
  const addr = [school.address, school.city].filter(Boolean).join(', ') || '';
  const ph   = school.phone || '';

  page.drawText('REPUBLIC OF RWANDA', { x: ox+2, y: cy-10, size:6.5, font:B, color:NAVY });
  page.drawText(clip(sn, B, 7.5, leftW-4),   { x:ox+2, y:cy-20, size:7.5, font:B, color:BLACK });
  page.drawText(clip(addr||' ', R, 6.5, leftW-4), { x:ox+2, y:cy-30, size:6.5, font:R, color:BLACK });
  if (ph) page.drawText(ph, { x:ox+2, y:cy-40, size:6.5, font:R, color:BLACK });

  // Logo — centered
  const LS=62, LX=ox+(COL_W-LS)/2, LY=HDR_BOT+(HDR_TOTAL-LS)/2;
  if (school.logo_url) {
    try {
      const buf=await fetchBuf(school.logo_url); const img=await embedImg(doc,buf);
      if(img) page.drawImage(img,{x:LX,y:LY,width:LS,height:LS});
    } catch {}
  } else {
    page.drawRectangle({x:LX,y:LY,width:LS,height:LS,color:LGRAY,borderColor:NAVY,borderWidth:1});
    const ini = sn.split(' ').map(w=>w[0]).slice(0,3).join('').toUpperCase();
    drawCentered(page,ini,B,16,NAVY,LX,LS,LY+LS/2-8);
  }

  // Right col
  const RX = ox+COL_W-leftW;
  page.drawText('MINISTRY OF EDUCATION', { x:RX, y:cy-10, size:6.5, font:B, color:NAVY });
  page.drawText(`School Year: ${yearInfo?.name||''}`, { x:RX, y:cy-22, size:7, font:R, color:BLACK });
  const tLabel = meta.is_annual ? 'ANNUAL REPORT' : (termInfo?.name||'');
  page.drawText(clip(tLabel,B,9,leftW-2), { x:RX, y:cy-36, size:9, font:B, color:BLUE });

  cy = HDR_BOT - 1;
  page.drawLine({start:{x:ox,y:cy},end:{x:ox+COL_W,y:cy},thickness:1.2,color:NAVY});
  cy -= 1;

  // ── Title bar ─────────────────────────────────────────────
  const TITLE_H=16;
  page.drawRectangle({x:ox,y:cy-TITLE_H,width:COL_W,height:TITLE_H,color:NAVY});
  drawCentered(page, meta.is_annual?'ANNUAL REPORT CARD':'REPORT CARD', B,10,WHITE,ox,COL_W,cy-TITLE_H+4);
  cy -= TITLE_H;

  // ── Student info ──────────────────────────────────────────
  const INFO_H=48;
  page.drawRectangle({x:ox,y:cy-INFO_H,width:COL_W,height:INFO_H,color:WHITE,borderColor:NAVY,borderWidth:0.6});
  const LBL=MGRAY, VAL=BLACK, lsz=6.5, vsz=7.5;
  const hW=COL_W/2, tW=COL_W/3;
  const fullName=`${(student.last_name||'').toUpperCase()} ${student.first_name||''}`.trim();

  page.drawText('Student Name:', {x:ox+3,y:cy-11,size:lsz,font:R,color:LBL});
  page.drawText(clip(fullName,B,vsz,hW-72), {x:ox+72,y:cy-11,size:vsz,font:B,color:VAL});
  page.drawText('Class:', {x:ox+hW+3,y:cy-11,size:lsz,font:R,color:LBL});
  page.drawText(clip(classInfo?.name||'—',B,vsz,hW-32), {x:ox+hW+30,y:cy-11,size:vsz,font:B,color:VAL});

  page.drawText('Born:', {x:ox+3,y:cy-24,size:lsz,font:R,color:LBL});
  page.drawText(clip(student.date_of_birth||'—',R,vsz,tW-28), {x:ox+26,y:cy-24,size:vsz,font:R,color:VAL});
  page.drawText('N. Students:', {x:ox+tW+2,y:cy-24,size:lsz,font:R,color:LBL});
  page.drawText(String(meta.class_size||'—'), {x:ox+tW+52,y:cy-24,size:vsz,font:B,color:VAL});
  page.drawText('Conduct:', {x:ox+tW*2+2,y:cy-24,size:lsz,font:R,color:LBL});
  page.drawText(clip(`${meta.conduct||'Good'} / 40`,B,vsz,tW-44), {x:ox+tW*2+40,y:cy-24,size:vsz,font:B,color:VAL});

  page.drawText('ID No.:', {x:ox+3,y:cy-37,size:lsz,font:R,color:LBL});
  page.drawText(clip(student.student_id||'—',R,vsz,hW-32), {x:ox+32,y:cy-37,size:vsz,font:R,color:VAL});
  cy -= INFO_H;

  // ── Marks table ──────────────────────────────────────────
  const cSubj=ox, cMT=ox+SUBJ_W, cME=cMT+COL_MW, cMTo=cME+COL_MW;
  const cOT=cMTo+COL_MW, cOE=cOT+COL_MW, cOTo=cOE+COL_MW, cRk=cOTo+COL_MW;

  // Header row 1
  drawCell(page,cSubj,cy-HDR_H,SUBJ_W,    HDR_H,NAVY);
  drawCell(page,cMT,  cy-HDR_H,COL_MW*3,  HDR_H,NAVY);
  drawCell(page,cOT,  cy-HDR_H,COL_MW*3,  HDR_H,NAVY);
  drawCell(page,cRk,  cy-HDR_H,RANK_W,     HDR_H,NAVY);
  drawCentered(page,'SUBJECTS', B,7,WHITE,cSubj,SUBJ_W,    cy-HDR_H+5);
  drawCentered(page,'MAX POINT',B,7,WHITE,cMT,  COL_MW*3,  cy-HDR_H+5);
  drawCentered(page,'O.P',      B,7,WHITE,cOT,  COL_MW*3,  cy-HDR_H+5);
  drawCentered(page,'RANK',     B,7,WHITE,cRk,  RANK_W,     cy-HDR_H+5);
  cy -= HDR_H;

  // Header row 2
  [[cSubj,''],[cMT,'TEST'],[cME,'EX'],[cMTo,'TOT'],[cOT,'TEST'],[cOE,'EX'],[cOTo,'TOT'],[cRk,'']].forEach(([x,lbl],i)=>{
    const w=i===0?SUBJ_W:i===7?RANK_W:COL_MW;
    drawCell(page,x,cy-HDR_H,w,HDR_H,LGRAY);
    if(lbl) drawCentered(page,lbl,B,7,NAVY,x,w,cy-HDR_H+5);
  });
  cy -= HDR_H;

  // Data rows
  let gmT=0,gmE=0,gmTo=0,goT=0,goE=0,goTo=0;
  subjects.forEach((sub,idx)=>{
    const m=marks.find(mk=>mk.subject_id===sub.id);
    const bg=idx%2===0?WHITE:LGRAY;
    const mx=sub.max_marks||100, mxT=mx/2, mxE=mx/2;
    const opT=m?.cat1!=null?parseFloat(m.cat1):null;
    const opE=m?.exam!=null?parseFloat(m.exam):null;
    const opTo=m?.total!=null?parseFloat(m.total):null;
    gmT+=mxT; gmE+=mxE; gmTo+=mx;
    if(opT!=null)goT+=opT; if(opE!=null)goE+=opE; if(opTo!=null)goTo+=opTo;

    [[cSubj,SUBJ_W],[cMT,COL_MW],[cME,COL_MW],[cMTo,COL_MW],[cOT,COL_MW],[cOE,COL_MW],[cOTo,COL_MW],[cRk,RANK_W]].forEach(([x,w])=>drawCell(page,x,cy-ROW_H,w,ROW_H,bg));
    page.drawText(clip((sub.name||'').toUpperCase(),R,7,SUBJ_W-4),{x:cSubj+3,y:cy-ROW_H+4,size:7,font:R,color:BLACK});
    drawCentered(page,fmtNum(mxT),R,7,BLACK,cMT,COL_MW,cy-ROW_H+4);
    drawCentered(page,fmtNum(mxE),R,7,BLACK,cME,COL_MW,cy-ROW_H+4);
    drawCentered(page,fmtNum(mx), R,7,BLACK,cMTo,COL_MW,cy-ROW_H+4);
    drawCentered(page,fmtNum(opT),R,7,BLACK,cOT,COL_MW,cy-ROW_H+4);
    drawCentered(page,fmtNum(opE),R,7,BLACK,cOE,COL_MW,cy-ROW_H+4);
    drawCentered(page,fmtNum(opTo),SB,7,BLACK,cOTo,COL_MW,cy-ROW_H+4);
    drawCentered(page,meta.rank_in_class?String(meta.rank_in_class):'—',R,7,BLACK,cRk,RANK_W,cy-ROW_H+4);
    cy -= ROW_H;
  });

  // Total row
  [[cSubj,SUBJ_W],[cMT,COL_MW],[cME,COL_MW],[cMTo,COL_MW],[cOT,COL_MW],[cOE,COL_MW],[cOTo,COL_MW],[cRk,RANK_W]].forEach(([x,w])=>drawCell(page,x,cy-ROW_H,w,ROW_H,NAVY));
  page.drawText('Total',{x:cSubj+3,y:cy-ROW_H+4,size:7,font:B,color:WHITE});
  [  [cMT,fmtNum(gmT)],[cME,fmtNum(gmE)],[cMTo,fmtNum(gmTo)],
     [cOT,fmtNum(goT)],[cOE,fmtNum(goE)],[cOTo,fmtNum(goTo)] ].forEach(([x,v])=>drawCentered(page,v,B,7,WHITE,x,COL_MW,cy-ROW_H+4));
  cy -= ROW_H;

  // Average + Rank
  cy -= 3;
  const AVG_H=18, hCW=COL_W/2-2;
  page.drawRectangle({x:ox,y:cy-AVG_H,width:hCW,height:AVG_H,color:LGRAY,borderColor:NAVY,borderWidth:0.6});
  const avgPct=gmTo>0?(goTo/gmTo*100):(meta.percentage||0);
  page.drawText('Average',{x:ox+5,y:cy-AVG_H+6,size:7.5,font:B,color:NAVY});
  page.drawText(`${avgPct.toFixed(1)}%`,{x:ox+B.widthOfTextAtSize('Average',7.5)+10,y:cy-AVG_H+5,size:11,font:B,color:NAVY});

  const rkX=ox+hCW+4;
  page.drawRectangle({x:rkX,y:cy-AVG_H,width:hCW,height:AVG_H,color:LGRAY,borderColor:NAVY,borderWidth:0.6});
  const rkStr=meta.rank_in_class?`${meta.rank_in_class} out of ${meta.class_size}`:'—';
  page.drawText('Rank',{x:rkX+5,y:cy-AVG_H+6,size:7.5,font:B,color:NAVY});
  page.drawText(clip(rkStr,B,10,hCW-B.widthOfTextAtSize('Rank',7.5)-14),{x:rkX+B.widthOfTextAtSize('Rank',7.5)+10,y:cy-AVG_H+5,size:10,font:B,color:NAVY});
  cy -= (AVG_H+4);

  // ── Bottom: Observations + Signatures ───────────────────
  const botH = 55;  // fixed height — compact, matches reference image
  const botY  = 12; // fixed from bottom of page
  page.drawRectangle({x:ox,y:botY,width:COL_W,height:botH,color:WHITE,borderColor:NAVY,borderWidth:0.7});
  const obsW=Math.floor(COL_W*0.52), sigW=COL_W-obsW;
  page.drawRectangle({x:ox,y:botY,width:obsW,height:botH,color:WHITE,borderColor:NAVY,borderWidth:0.5});
  drawCentered(page,'Observations',B,8,NAVY,ox,obsW,botY+botH-12);
  // 3 writing lines spaced evenly
  const lineSpacing = (botH - 22) / 3;
  for(let i=1;i<=3;i++){
    const ly = botY + botH - 12 - i * lineSpacing;
    page.drawLine({start:{x:ox+6,y:ly},end:{x:ox+obsW-6,y:ly},thickness:0.4,color:MGRAY});
  }

  const sX=ox+obsW, mid=botY+botH/2;
  // Teacher Signature (top half)
  page.drawText('Teacher Signature',{x:sX+5,y:botY+botH-12,size:7,font:B,color:NAVY});
  page.drawLine({start:{x:sX+5,y:botY+botH-24},end:{x:sX+sigW-36,y:botY+botH-24},thickness:0.5,color:MGRAY});
  page.drawText('Date: ________',{x:sX+sigW-58,y:botY+botH-24,size:6,font:R,color:MGRAY});
  // Divider
  page.drawLine({start:{x:sX+5,y:mid},end:{x:sX+sigW-5,y:mid},thickness:0.5,color:MGRAY});
  // Parent Signature (bottom half)
  page.drawText('Parent Signature',{x:sX+5,y:mid-12,size:7,font:B,color:NAVY});
  page.drawLine({start:{x:sX+5,y:mid-24},end:{x:sX+sigW-36,y:mid-24},thickness:0.5,color:MGRAY});
  page.drawText('Date: ________',{x:sX+sigW-58,y:mid-24,size:6,font:R,color:MGRAY});
}

// ════════════════════════════════════════════════════════════
// ANNUAL MARKS HELPER
// ════════════════════════════════════════════════════════════
async function computeAnnualMarks(studentId, classId, schoolId, academicYearId) {
  const { data: allTerms } = await supabase.from('terms')
    .select('id,number').eq('academic_year_id', academicYearId).eq('school_id', schoolId).in('number',[1,2,3]);
  if (!allTerms?.length) return [];
  const allMarks = await Promise.all(allTerms.map(t =>
    supabase.from('marks').select('*, subject:subjects(*)').eq('student_id', studentId).eq('term_id', t.id)
  ));
  const sm = {};
  allMarks.forEach(({ data: mks }) => {
    (mks||[]).forEach(m => {
      if (!sm[m.subject_id]) sm[m.subject_id] = { ...m, _c:0, _s:0 };
      if (m.total!=null) { sm[m.subject_id]._s += m.total; sm[m.subject_id]._c += 1; }
    });
  });
  return Object.values(sm).map(m => ({
    ...m, cat1:null, cat2:null, exam:null,
    total: m._c > 0 ? parseFloat((m._s/m._c).toFixed(2)) : null,
  }));
}

// ════════════════════════════════════════════════════════════
// CONTROLLERS
// ════════════════════════════════════════════════════════════

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

exports.generateOne = async (req, res) => {
  try {
    const { student_id, term_id, class_id, academic_year_id, teacher_remarks, head_remarks, conduct, days_present, days_absent } = req.body;
    const { data: termInfo } = await supabase.from('terms').select('*').eq('id', term_id).single();
    const isAnnual = termInfo?.number === 4;
    const { data: schoolFull } = await supabase.from('schools').select('*').eq('id', req.schoolId).single();
    const school = schoolFull || req.school;
    const [{ data: student }, { data: classSubs }, { data: yearInfo }, { data: classInfo }] = await Promise.all([
      supabase.from('student_profiles').select('*').eq('id', student_id).single(),
      supabase.from('class_subjects').select('*, subject:subjects(*)').eq('class_id', class_id),
      supabase.from('academic_years').select('*').eq('id', academic_year_id).single(),
      supabase.from('classes').select('*').eq('id', class_id).single(),
    ]);
    const subjects = (classSubs||[]).map(cs=>cs.subject);
    let marks;
    if (isAnnual) { marks = await computeAnnualMarks(student_id, class_id, req.schoolId, academic_year_id); }
    else {
      const { data: m } = await supabase.from('marks').select('*, subject:subjects(*)')
        .eq('student_id', student_id).eq('term_id', term_id);
      marks = m || [];
    }
    const { data: allB } = await supabase.from('bulletins').select('student_id,percentage').eq('term_id', term_id).eq('class_id', class_id);
    let tw=0,tmx=0;
    subjects.forEach(sub => { const m=marks.find(mk=>mk.subject_id===sub.id); if(m?.total!=null){tw+=m.total*(sub.coefficient||1);tmx+=(sub.max_marks||100)*(sub.coefficient||1);} });
    const pct = tmx>0?(tw/tmx)*100:0;
    const peers = [...(allB||[]),{student_id,percentage:pct}].sort((a,b)=>(b.percentage||0)-(a.percentage||0));
    const rank = peers.findIndex(p=>p.student_id===student_id)+1;
    const meta = { percentage:pct, rank_in_class:rank, class_size:peers.length, teacher_remarks, head_remarks, conduct:conduct||'Good', days_present:parseInt(days_present||0), days_absent:parseInt(days_absent||0), is_annual:isAnnual };

    const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
    const fonts = await loadFonts(doc);
    const page = doc.addPage([PAGE_W, PAGE_H]);
    await drawBulletinColumn(page, doc, LEFT_X, fonts, student, marks, subjects, classInfo, termInfo, yearInfo, school, meta);
    const pdfBytes = await doc.save();

    await supabase.from('bulletins').upsert([{
      school_id:req.schoolId, student_id, term_id, class_id, academic_year_id,
      total_marks:tw, max_possible:tmx, percentage:pct, rank_in_class:rank, class_size:peers.length,
      grade:pct>=80?'A1':pct>=70?'B2':pct>=60?'C3':pct>=50?'D4':'F',
      conduct, teacher_remarks, head_remarks, days_present:parseInt(days_present||0), days_absent:parseInt(days_absent||0),
      generated_at:new Date().toISOString(), generated_by:req.staff?.id||null,
    }],{onConflict:'student_id,term_id'});

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
    const { data: schoolFull } = await supabase.from('schools').select('*').eq('id', req.schoolId).single();
    const school = schoolFull || req.school;
    const { data: rawStudents } = await supabase.from('student_profiles')
      .select('*').eq('current_class_id', class_id).eq('status','active').eq('school_id',req.schoolId);
    if (!rawStudents?.length) return res.status(404).json({ success:false, error:'No students in class' });

    // ── Sort alphabetically by last_name then first_name ──
    const students = [...rawStudents].sort((a,b) => {
      const ln=(a.last_name||'').toLowerCase().localeCompare((b.last_name||'').toLowerCase());
      return ln!==0?ln:(a.first_name||'').toLowerCase().localeCompare((b.first_name||'').toLowerCase());
    });

    const [{ data: classSubs },{ data: yearInfo },{ data: classInfo }] = await Promise.all([
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

    // Compute percentages for ranking
    const stats = students.map(st => {
      const sm=allMarksMap[st.id]||[]; let tw=0,tmx=0;
      subjects.forEach(sub => { const m=sm.find(mk=>mk.subject_id===sub.id); if(m?.total!=null){tw+=m.total*(sub.coefficient||1);tmx+=(sub.max_marks||100)*(sub.coefficient||1);} });
      return { student:st, pct:tmx>0?(tw/tmx)*100:0, total:tw, maxTotal:tmx };
    });
    const ranked=[...stats].sort((a,b)=>b.pct-a.pct);
    ranked.forEach((s,i)=>{ s.rank=i+1; });
    const rankMap={};
    ranked.forEach(s=>{ rankMap[s.student.id]=s.rank; });

    const merged = await PDFDocument.create(); merged.registerFontkit(fontkit);
    const fonts = await loadFonts(merged);

    // 2 bulletins per A4 landscape page
    for (let i=0; i<students.length; i+=2) {
      const pg = merged.addPage([PAGE_W, PAGE_H]);
      // Vertical divider line between two bulletins
      pg.drawLine({ start:{x:PAGE_W/2,y:10}, end:{x:PAGE_W/2,y:PAGE_H-10}, thickness:0.5, color:MGRAY });

      for (let side=0; side<2; side++) {
        const st = students[i+side];
        if (!st) break;
        const sp = stats.find(s=>s.student.id===st.id);
        const m = {
          percentage:sp.pct, rank_in_class:rankMap[st.id], class_size:students.length,
          teacher_remarks, head_remarks, conduct:conduct||'Good',
          days_present:0, days_absent:0, is_annual:isAnnual,
        };
        await drawBulletinColumn(pg, merged, side===0?LEFT_X:RIGHT_X, fonts, st, allMarksMap[st.id]||[], subjects, classInfo, termInfo, yearInfo, school, m);
      }

      // Save bulletins
      for (let side=0; side<2; side++) {
        const st = students[i+side];
        if (!st) break;
        const sp = stats.find(s=>s.student.id===st.id);
        await supabase.from('bulletins').upsert([{
          school_id:req.schoolId, student_id:st.id, term_id, class_id, academic_year_id,
          total_marks:sp.total, max_possible:sp.maxTotal, percentage:sp.pct,
          rank_in_class:rankMap[st.id], class_size:students.length,
          grade:sp.pct>=80?'A1':sp.pct>=70?'B2':sp.pct>=60?'C3':sp.pct>=50?'D4':'F',
          conduct, teacher_remarks, head_remarks, generated_at:new Date().toISOString(),
        }],{onConflict:'student_id,term_id'});
      }
    }

    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="${classInfo?.name||'class'}_${isAnnual?'annual':termInfo?.name||''}_bulletins.pdf"`);
    res.send(Buffer.from(await merged.save()));
  } catch (err) { console.error('generateClass error:', err); res.status(500).json({ success:false, error:err.message }); }
};
