'use strict';
const { supabase } = require('../supabase');
const ExcelJS      = require('exceljs');
const https        = require('https');
const http         = require('http');

// ── Colors ────────────────────────────────────────────────────
const NAVY  = { argb:'FF0A2456' };
const WHITE = { argb:'FFFFFFFF' };
const LGRAY = { argb:'FFEDEFF5' };
const BLACK = { argb:'FF0D0D0D' };
const GOLD  = { argb:'FFC49A00' };

// ── Layout: 2 bulletins per sheet ────────────────────────────
const LEFT_COL  = 1;   // A
const RIGHT_COL = 18;  // R  (Q=17 is blank separator)
const BULL_COLS = 16;  // each bulletin spans 16 columns

// Column widths within a bulletin [Subject, TEST, EX, TOT, TEST, EX, TOT, RANK, pad×8]
const COL_W = [18, 6, 6, 7, 6, 6, 8, 7, 3,3,3,3,3,3,3,3];

// ── Helpers ───────────────────────────────────────────────────
function fetchBuf(url) {
  return new Promise((res,rej) => {
    const mod = url.startsWith('https')?https:http;
    mod.get(url, r => { const c=[]; r.on('data',d=>c.push(d)); r.on('end',()=>res(Buffer.concat(c))); r.on('error',rej); }).on('error',rej);
  });
}
async function embedImg(doc,buf){ try{return await doc.embedJpg(buf);}catch{} try{return await doc.embedPng(buf);}catch{} return null; }
function fmt(n){ if(n==null)return'—'; const f=parseFloat(n); return isNaN(f)?'—':String(parseFloat(f.toFixed(1))); }
function gradeStr(pct){ if(pct>=80)return'A1'; if(pct>=70)return'B2'; if(pct>=60)return'C3'; if(pct>=50)return'D4'; if(pct>=40)return'E5'; return'F'; }
function colLetter(n){ let s=''; while(n>0){s=String.fromCharCode(64+(n-1)%26)+s;n=Math.floor((n-1)/26);} return s; }
function addr(c,r){ return `${colLetter(c)}${r}`; }

function thinB(hex='AAAAAA'){ const s={style:'thin',color:{argb:'FF'+hex}}; return{top:s,left:s,bottom:s,right:s}; }
function medB(){ const s={style:'medium',color:NAVY}; return{top:s,left:s,bottom:s,right:s}; }
function navyFill(){ return{type:'pattern',pattern:'solid',fgColor:NAVY}; }
function lgrayFill(){ return{type:'pattern',pattern:'solid',fgColor:LGRAY}; }
function whiteFill(){ return{type:'pattern',pattern:'solid',fgColor:WHITE}; }

function mc(ws,r,c1,c2,val,style){ // merge cells and set value
  if(c1<c2){ try{ ws.mergeCells(`${addr(c1,r)}:${addr(c2,r)}`); }catch{} }
  const cell=ws.getCell(r,c1); cell.value=val; if(style) Object.assign(cell,style);
}
function sc(ws,r,c,val,style){ const cell=ws.getCell(r,c); cell.value=val; if(style) Object.assign(cell,style); }
function rh(ws,r,h){ ws.getRow(r).height=h; }

function navyHdr(bold=true){ return{ fill:navyFill(), font:{bold,color:WHITE,size:9,name:'Calibri'}, alignment:{horizontal:'center',vertical:'middle',wrapText:true}, border:thinB('FFFFFF') }; }
function dataStyle(alt,bold=false){ return{ fill:alt?lgrayFill():whiteFill(), font:{bold,size:8.5,color:BLACK,name:'Calibri'}, alignment:{horizontal:'center',vertical:'middle'}, border:thinB() }; }

function setupCols(ws){
  for(let i=0;i<BULL_COLS;i++) ws.getColumn(LEFT_COL+i).width=COL_W[i];
  ws.getColumn(17).width=2;
  for(let i=0;i<BULL_COLS;i++) ws.getColumn(RIGHT_COL+i).width=COL_W[i];
}
function setupPrint(ws){
  ws.pageSetup={ orientation:'landscape', paperSize:9, fitToPage:true, fitToWidth:1, fitToHeight:0,
    margins:{left:0.3,right:0.3,top:0.4,bottom:0.4,header:0.2,footer:0.2} };
}

// ════════════════════════════════════════════════════════════
// DRAW ONE BULLETIN starting at (startCol, startRow)
// Returns last row used
// ════════════════════════════════════════════════════════════
async function drawBulletin(ws, wb, startCol, startRow, student, marks, subjects, classInfo, termInfo, yearInfo, school, meta, logoImgId) {
  const ox = startCol, ex = startCol + BULL_COLS - 1;
  let r = startRow;

  // ── Header rows 1-4 ──────────────────────────────────────
  rh(ws,r,13);
  mc(ws,r,ox,ox+6, 'REPUBLIC OF RWANDA', {font:{bold:true,color:NAVY,size:8,name:'Calibri'},alignment:{horizontal:'left',vertical:'middle'}});
  mc(ws,r,ox+9,ex, 'MINISTRY OF EDUCATION', {font:{bold:true,color:NAVY,size:8,name:'Calibri'},alignment:{horizontal:'right',vertical:'middle'}});

  r++; rh(ws,r,15);
  mc(ws,r,ox,ox+6, school.school_name||'School', {font:{bold:true,size:10,color:BLACK,name:'Calibri'},alignment:{horizontal:'left',vertical:'middle'}});
  mc(ws,r,ox+9,ex, `School Year: ${yearInfo?.name||''}`, {font:{size:9,color:BLACK,name:'Calibri'},alignment:{horizontal:'right',vertical:'middle'}});

  r++; rh(ws,r,12);
  const addr2=[school.address,school.city].filter(Boolean).join(', ')||'';
  mc(ws,r,ox,ox+6, addr2, {font:{size:8,color:BLACK,name:'Calibri'},alignment:{horizontal:'left',vertical:'middle'}});
  const tLabel=meta.is_annual?'ANNUAL REPORT':(termInfo?.name||'');
  mc(ws,r,ox+9,ex, tLabel, {font:{bold:true,size:10,color:NAVY,name:'Calibri'},alignment:{horizontal:'right',vertical:'middle'}});

  r++; rh(ws,r,12);
  mc(ws,r,ox,ox+6, school.phone?`Tel: ${school.phone}`:'', {font:{size:8,color:BLACK,name:'Calibri'},alignment:{horizontal:'left',vertical:'middle'}});

  // Logo (spans rows 1-4, middle columns)
  if (logoImgId != null) {
    const midC = ox + 7;
    ws.addImage(logoImgId, { tl:{col:midC-1,row:startRow-1}, br:{col:midC+1,row:startRow+3}, editAs:'oneCell' });
  }

  // ── Title bar ─────────────────────────────────────────────
  r++; rh(ws,r,18);
  mc(ws,r,ox,ex, meta.is_annual?'ANNUAL REPORT CARD':'REPORT CARD', {fill:navyFill(),font:{bold:true,color:WHITE,size:12,name:'Calibri'},alignment:{horizontal:'center',vertical:'middle'},border:thinB('FFFFFF')});

  // ── Student info rows 6-8 ─────────────────────────────────
  const lbl={font:{bold:true,size:8,color:{argb:'FF555555'},name:'Calibri'},alignment:{vertical:'middle'},border:thinB('BBBBBB')};
  const val={font:{bold:true,size:9,color:BLACK,name:'Calibri'},alignment:{vertical:'middle'},border:thinB('BBBBBB')};
  const fullName=`${(student.last_name||'').toUpperCase()} ${student.first_name||''}`.trim();

  r++; rh(ws,r,15);
  sc(ws,r,ox,'Name:',lbl); mc(ws,r,ox+1,ox+6,fullName,val);
  sc(ws,r,ox+7,'Class:',lbl); mc(ws,r,ox+8,ex,classInfo?.name||'—',val);

  r++; rh(ws,r,15);
  sc(ws,r,ox,'Born:',lbl); mc(ws,r,ox+1,ox+4,student.date_of_birth||'—',val);
  sc(ws,r,ox+5,'N.Students:',lbl); mc(ws,r,ox+6,ox+9,String(meta.class_size||'—'),val);
  sc(ws,r,ox+10,'Conduct:',lbl); mc(ws,r,ox+11,ex,`${meta.conduct||'Good'} / 40`,val);

  r++; rh(ws,r,15);
  sc(ws,r,ox,'ID No.:',lbl); mc(ws,r,ox+1,ex,student.student_id||'—',val);

  // ── Table headers ─────────────────────────────────────────
  r++; rh(ws,r,16);
  mc(ws,r,ox,ox,      'SUBJECTS',  navyHdr());
  mc(ws,r,ox+1,ox+3,  'MAX POINT', navyHdr());
  mc(ws,r,ox+4,ox+6,  'O.P',       navyHdr());
  mc(ws,r,ox+7,ex,    'RANK',      navyHdr());

  r++; rh(ws,r,14);
  const shS={fill:lgrayFill(),font:{bold:true,color:NAVY,size:8,name:'Calibri'},alignment:{horizontal:'center',vertical:'middle'},border:thinB('AAAAAA')};
  sc(ws,r,ox,'',shS);
  sc(ws,r,ox+1,'TEST',shS); sc(ws,r,ox+2,'EX',shS); sc(ws,r,ox+3,'TOT',shS);
  sc(ws,r,ox+4,'TEST',shS); sc(ws,r,ox+5,'EX',shS); sc(ws,r,ox+6,'TOT',shS);
  mc(ws,r,ox+7,ex,'',shS);

  // ── Subject rows ──────────────────────────────────────────
  let gmT=0,gmE=0,gmTot=0, goT=0,goE=0,goTot=0;

  subjects.forEach((sub,idx) => {
    r++; rh(ws,r,13);
    const alt=idx%2===1;
    const base=dataStyle(alt);
    const mx=sub.max_marks||100, mxT=sub.max_test||0, mxE=sub.max_exam||0;
    const mk=marks.find(m=>m.subject_id===sub.id);
    const opT=mk?.cat1!=null?parseFloat(mk.cat1):null;
    const opE=mk?.exam!=null?parseFloat(mk.exam):null;
    const opTo=mk?.total!=null?parseFloat(mk.total):null;
    gmT+=mxT; gmE+=mxE; gmTot+=mx;
    if(opT!=null)goT+=opT; if(opE!=null)goE+=opE; if(opTo!=null)goTot+=opTo;

    sc(ws,r,ox,(sub.name||'').toUpperCase(),{...base,alignment:{horizontal:'left',vertical:'middle'},font:{size:8.5,color:BLACK,name:'Calibri'}});
    sc(ws,r,ox+1,mxT||'—',base); sc(ws,r,ox+2,mxE||'—',base); sc(ws,r,ox+3,mx,base);
    sc(ws,r,ox+4,fmt(opT),base); sc(ws,r,ox+5,fmt(opE),base);
    sc(ws,r,ox+6,fmt(opTo),{...base,font:{bold:true,size:8.5,color:BLACK,name:'Calibri'}});
    mc(ws,r,ox+7,ex,meta.rank_in_class?String(meta.rank_in_class):'—',base);
  });

  // ── TOTAL row ─────────────────────────────────────────────
  r++; rh(ws,r,14);
  const tS={fill:navyFill(),font:{bold:true,color:WHITE,size:9,name:'Calibri'},alignment:{horizontal:'center',vertical:'middle'},border:thinB('FFFFFF')};
  mc(ws,r,ox,ox,'TOTAL',{...tS,alignment:{horizontal:'left',vertical:'middle'}});
  sc(ws,r,ox+1,fmt(gmT),tS); sc(ws,r,ox+2,fmt(gmE),tS); sc(ws,r,ox+3,fmt(gmTot),tS);
  sc(ws,r,ox+4,fmt(goT),tS); sc(ws,r,ox+5,fmt(goE),tS); sc(ws,r,ox+6,fmt(goTot),tS);
  mc(ws,r,ox+7,ex,'',tS);

  // ── AVERAGE / RANK row ────────────────────────────────────
  r++; rh(ws,r,16);
  const avgPct=gmTot>0?(goTot/gmTot*100):(meta.percentage||0);
  const aS={fill:lgrayFill(),font:{bold:true,color:NAVY,size:10,name:'Calibri'},alignment:{horizontal:'center',vertical:'middle'},border:thinB('0A2456')};
  mc(ws,r,ox,ox+6,`Average: ${avgPct.toFixed(1)}%`,aS);
  mc(ws,r,ox+7,ex,`Rank: ${meta.rank_in_class||'—'} / ${meta.class_size||'—'}`,aS);

  // ── Observations + Signatures (4 rows) ───────────────────
  const obsEnd=ox+8, sigSt=ox+9;
  r++; rh(ws,r,13);
  mc(ws,r,ox,obsEnd,'Observations',{fill:navyFill(),font:{bold:true,color:WHITE,size:9,name:'Calibri'},alignment:{horizontal:'center',vertical:'middle'},border:thinB('FFFFFF')});
  mc(ws,r,sigSt,ex,'Teacher Signature',{fill:navyFill(),font:{bold:true,color:WHITE,size:9,name:'Calibri'},alignment:{horizontal:'center',vertical:'middle'},border:thinB('FFFFFF')});
  r++; rh(ws,r,13);
  mc(ws,r,ox,obsEnd,'',{fill:whiteFill(),border:thinB()});
  mc(ws,r,sigSt,ex,'Date: _____________',{font:{size:8,color:{argb:'FF888888'},name:'Calibri'},alignment:{horizontal:'left',vertical:'bottom'},border:thinB()});
  r++; rh(ws,r,13);
  mc(ws,r,ox,obsEnd,'',{fill:whiteFill(),border:thinB()});
  mc(ws,r,sigSt,ex,'Parent Signature',{fill:lgrayFill(),font:{bold:true,size:8.5,color:NAVY,name:'Calibri'},alignment:{horizontal:'center',vertical:'middle'},border:thinB()});
  r++; rh(ws,r,13);
  mc(ws,r,ox,obsEnd,'',{fill:whiteFill(),border:thinB()});
  mc(ws,r,sigSt,ex,'Date: _____________',{font:{size:8,color:{argb:'FF888888'},name:'Calibri'},alignment:{horizontal:'left',vertical:'bottom'},border:thinB()});

  // Thick outline around entire bulletin
  for(let row=startRow;row<=r;row++){
    for(let col=ox;col<=ex;col++){
      const cell=ws.getCell(row,col);
      const b=Object.assign({},cell.border||{});
      if(row===startRow)b.top={style:'medium',color:NAVY};
      if(row===r)b.bottom={style:'medium',color:NAVY};
      if(col===ox)b.left={style:'medium',color:NAVY};
      if(col===ex)b.right={style:'medium',color:NAVY};
      cell.border=b;
    }
  }
  return r;
}

// ════════════════════════════════════════════════════════════
// BUILD SHEET: 2 bulletins per row, sorted alphabetically
// ════════════════════════════════════════════════════════════
async function buildSheet(wb, sheetName, students, marksMap, subjects, classInfo, termInfo, yearInfo, school, rankMap, statsMap, conduct, isAnnual) {
  const ws = wb.addWorksheet(sheetName);
  setupCols(ws); setupPrint(ws);

  let logoImgId=null;
  if(school?.logo_url){
    try{
      const buf=await fetchBuf(school.logo_url);
      const isPng=buf[0]===0x89&&buf[1]===0x50;
      logoImgId=wb.addImage({buffer:buf,extension:isPng?'png':'jpeg'});
    }catch{}
  }

  let curRow=1;
  for(let i=0;i<students.length;i+=2){
    const rowStart=curRow;
    const stL=students[i], spL=statsMap[stL.id];
    const metaL={percentage:spL.pct,rank_in_class:rankMap[stL.id],class_size:students.length,conduct:conduct||'Good',is_annual:isAnnual};
    const lastRow=await drawBulletin(ws,wb,LEFT_COL,rowStart,stL,marksMap[stL.id]||[],subjects,classInfo,termInfo,yearInfo,school,metaL,logoImgId);
    if(i+1<students.length){
      const stR=students[i+1], spR=statsMap[stR.id];
      const metaR={percentage:spR.pct,rank_in_class:rankMap[stR.id],class_size:students.length,conduct:conduct||'Good',is_annual:isAnnual};
      await drawBulletin(ws,wb,RIGHT_COL,rowStart,stR,marksMap[stR.id]||[],subjects,classInfo,termInfo,yearInfo,school,metaR,logoImgId);
    }
    curRow=lastRow+3;
  }
  ws.views=[{state:'frozen',xSplit:0,ySplit:10,activeCell:'A11'}];
}

// ════════════════════════════════════════════════════════════
// ANNUAL MARKS HELPER
// ════════════════════════════════════════════════════════════
async function computeAnnualMarks(studentId, classId, schoolId, academicYearId){
  const {data:allTerms}=await supabase.from('terms').select('id,number').eq('academic_year_id',academicYearId).eq('school_id',schoolId).in('number',[1,2,3]);
  if(!allTerms?.length)return[];
  const fetches=await Promise.all(allTerms.map(t=>supabase.from('marks').select('*').eq('student_id',studentId).eq('term_id',t.id)));
  const sm={};
  fetches.forEach(({data:mks})=>(mks||[]).forEach(m=>{
    if(!sm[m.subject_id])sm[m.subject_id]={...m,_s:0,_c:0};
    if(m.total!=null){sm[m.subject_id]._s+=parseFloat(m.total);sm[m.subject_id]._c+=1;}
  }));
  return Object.values(sm).map(m=>({...m,cat1:null,exam:null,total:m._c>0?parseFloat((m._s/m._c).toFixed(2)):null}));
}

// ── Shared helpers ────────────────────────────────────────────
function computeStats(students,marksMap,subjects){
  return students.map(st=>{
    const mks=marksMap[st.id]||[]; let tw=0,mx=0;
    subjects.forEach(sub=>{const m=mks.find(mk=>mk.subject_id===sub.id);if(m?.total!=null){tw+=parseFloat(m.total)*(sub.coefficient||1);mx+=(sub.max_marks||100)*(sub.coefficient||1);}});
    return{student:st,pct:mx>0?(tw/mx)*100:0,total:tw,maxTotal:mx};
  });
}
function buildRanks(statsArr){
  const sorted=[...statsArr].sort((a,b)=>b.pct-a.pct);
  sorted.forEach((s,i)=>s.rank=i+1);
  const rankMap={},statsMap={};
  sorted.forEach(s=>{rankMap[s.student.id]=s.rank;statsMap[s.student.id]=s;});
  return{rankMap,statsMap};
}
async function fetchShared(schoolId,classId,academicYearId){
  const[{data:classSubs},{data:yearInfo},{data:classInfo},{data:school}]=await Promise.all([
    supabase.from('class_subjects').select('*,subject:subjects(*)').eq('class_id',classId),
    supabase.from('academic_years').select('*').eq('id',academicYearId).single(),
    supabase.from('classes').select('*').eq('id',classId).single(),
    supabase.from('schools').select('*').eq('id',schoolId).single(),
  ]);
  const subjects=(classSubs||[]).map(cs=>cs.subject).filter(Boolean).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  return{subjects,yearInfo,classInfo,school};
}

// ════════════════════════════════════════════════════════════
// CONTROLLERS
// ════════════════════════════════════════════════════════════

exports.getBulletins=async(req,res)=>{
  try{
    const{student_id,term_id,class_id}=req.query;
    let q=supabase.from('bulletins').select('*,student:student_profiles(id,first_name,last_name,student_id),term:terms(name,number),class:classes(name)').eq('school_id',req.schoolId);
    if(student_id)q=q.eq('student_id',student_id);
    if(term_id)q=q.eq('term_id',term_id);
    if(class_id)q=q.eq('class_id',class_id);
    const{data,error}=await q.order('created_at',{ascending:false});
    if(error)throw error;
    res.json({success:true,data});
  }catch(err){res.status(500).json({success:false,error:err.message});}
};

exports.generateOne=async(req,res)=>{
  try{
    const{student_id,term_id,class_id,academic_year_id,teacher_remarks,head_remarks,conduct}=req.body;
    const{data:termInfo}=await supabase.from('terms').select('*').eq('id',term_id).single();
    const isAnnual=termInfo?.number===4;
    const{subjects,yearInfo,classInfo,school}=await fetchShared(req.schoolId,class_id,academic_year_id);
    const{data:student}=await supabase.from('student_profiles').select('*').eq('id',student_id).single();
    let marks;
    if(isAnnual)marks=await computeAnnualMarks(student_id,class_id,req.schoolId,academic_year_id);
    else{const{data:m}=await supabase.from('marks').select('*').eq('student_id',student_id).eq('term_id',term_id);marks=m||[];}
    const{data:peers}=await supabase.from('bulletins').select('student_id,percentage').eq('term_id',term_id).eq('class_id',class_id);
    let tw=0,mx=0;
    subjects.forEach(sub=>{const m=marks.find(mk=>mk.subject_id===sub.id);if(m?.total!=null){tw+=parseFloat(m.total)*(sub.coefficient||1);mx+=(sub.max_marks||100)*(sub.coefficient||1);}});
    const pct=mx>0?(tw/mx)*100:0;
    const sorted=[...(peers||[]),{student_id,percentage:pct}].sort((a,b)=>(b.percentage||0)-(a.percentage||0));
    const rank=sorted.findIndex(p=>p.student_id===student_id)+1;
    const meta={percentage:pct,rank_in_class:rank,class_size:sorted.length,conduct:conduct||'Good',is_annual:isAnnual};
    const wb=new ExcelJS.Workbook(); wb.creator=school?.school_name||'School'; wb.created=new Date();
    const statsMap={[student.id]:{pct,total:tw,maxTotal:mx}};
    const rankMap={[student.id]:rank};
    const marksMap={[student.id]:marks};
    await buildSheet(wb,isAnnual?'Annual Report':(termInfo?.name||'Bulletin'),[student],marksMap,subjects,classInfo,termInfo,yearInfo,school,rankMap,statsMap,conduct,isAnnual);
    await supabase.from('bulletins').upsert([{school_id:req.schoolId,student_id,term_id,class_id,academic_year_id,total_marks:tw,max_possible:mx,percentage:pct,rank_in_class:rank,class_size:sorted.length,grade:gradeStr(pct),conduct,teacher_remarks,head_remarks,generated_at:new Date().toISOString(),generated_by:req.staff?.id||null}],{onConflict:'student_id,term_id'});
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${student.student_id||student_id}_${termInfo?.name||'bulletin'}.xlsx"`);
    await wb.xlsx.write(res); res.end();
  }catch(err){console.error('generateOne:',err);res.status(500).json({success:false,error:err.message});}
};

exports.generateClass=async(req,res)=>{
  try{
    const{term_id,class_id,academic_year_id,conduct,teacher_remarks,head_remarks}=req.body;
    const{data:termInfo}=await supabase.from('terms').select('*').eq('id',term_id).single();
    const isAnnual=termInfo?.number===4;
    const{subjects,yearInfo,classInfo,school}=await fetchShared(req.schoolId,class_id,academic_year_id);
    const{data:rawStudents}=await supabase.from('student_profiles').select('*').eq('current_class_id',class_id).eq('status','active').eq('school_id',req.schoolId);
    if(!rawStudents?.length)return res.status(404).json({success:false,error:'No active students'});

    // Sort alphabetically
    const students=[...rawStudents].sort((a,b)=>{const c=(a.last_name||'').toLowerCase().localeCompare((b.last_name||'').toLowerCase());return c!==0?c:(a.first_name||'').toLowerCase().localeCompare((b.first_name||'').toLowerCase());});

    let marksMap={};
    if(isAnnual){for(const st of students)marksMap[st.id]=await computeAnnualMarks(st.id,class_id,req.schoolId,academic_year_id);}
    else{const{data:allMarks}=await supabase.from('marks').select('*').eq('class_id',class_id).eq('term_id',term_id);students.forEach(st=>{marksMap[st.id]=(allMarks||[]).filter(m=>m.student_id===st.id);});}

    const statsArr=computeStats(students,marksMap,subjects);
    const{rankMap,statsMap}=buildRanks(statsArr);

    const wb=new ExcelJS.Workbook(); wb.creator=school?.school_name||'School'; wb.created=new Date();
    const termName=isAnnual?'Annual':(termInfo?.name||'Term');
    await buildSheet(wb,termName,students,marksMap,subjects,classInfo,termInfo,yearInfo,school,rankMap,statsMap,conduct,isAnnual);

    // Auto-generate Annual when Term 3 saved
    if(termInfo?.number===3){
      const annMarksMap={};
      for(const st of students)annMarksMap[st.id]=await computeAnnualMarks(st.id,class_id,req.schoolId,academic_year_id);
      const annStats=computeStats(students,annMarksMap,subjects);
      const{rankMap:aRank,statsMap:aStat}=buildRanks(annStats);
      const annTermInfo={...termInfo,name:'Annual Report',number:4};
      await buildSheet(wb,'Annual Report',students,annMarksMap,subjects,classInfo,annTermInfo,yearInfo,school,aRank,aStat,conduct,true);
      for(const st of students){const sp=aStat[st.id];await supabase.from('bulletins').upsert([{school_id:req.schoolId,student_id:st.id,term_id:null,class_id,academic_year_id,total_marks:sp.total,max_possible:sp.maxTotal,percentage:sp.pct,rank_in_class:aRank[st.id],class_size:students.length,grade:gradeStr(sp.pct),conduct,teacher_remarks,head_remarks,generated_at:new Date().toISOString()}],{onConflict:'student_id,term_id'});}
    }

    // Persist term records
    for(const st of students){const sp=statsMap[st.id];await supabase.from('bulletins').upsert([{school_id:req.schoolId,student_id:st.id,term_id,class_id,academic_year_id,total_marks:sp.total,max_possible:sp.maxTotal,percentage:sp.pct,rank_in_class:rankMap[st.id],class_size:students.length,grade:gradeStr(sp.pct),conduct,teacher_remarks,head_remarks,generated_at:new Date().toISOString()}],{onConflict:'student_id,term_id'});}

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${classInfo?.name||'class'}_${termName}_bulletins.xlsx"`);
    await wb.xlsx.write(res); res.end();
  }catch(err){console.error('generateClass:',err);res.status(500).json({success:false,error:err.message});}
};
