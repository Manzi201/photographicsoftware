'use strict';
const { supabase } = require('../supabase');
const ExcelJS      = require('exceljs');
const https        = require('https');
const http         = require('http');

// ── Colors ────────────────────────────────────────────────────
const NAVY  = 'FF0A2456';
const NAVY2 = 'FF1E3A8A';
const WHITE = 'FFFFFFFF';
const LYELL = 'FFFDFBE8';
const BLACK = 'FF0D0D0D';
const GRAY  = 'FF555555';

// Column indices (1-based, A=1)
const C = {
  SUBJ:1, MB:2, MC:3, MD:4,
  T1B:5, T1C:6, T1D:7,
  T2B:8, T2C:9, T2D:10,
  T3B:11, T3C:12, T3D:13,
  AN:14, AO:15, AP:16, AQ:17, LAST:17
};

// ── Helpers ───────────────────────────────────────────────────
function fetchBuf(url) {
  return new Promise((res,rej)=>{
    const mod=url.startsWith('https')?https:http;
    mod.get(url,r=>{const c=[];r.on('data',d=>c.push(d));r.on('end',()=>res(Buffer.concat(c)));r.on('error',rej);}).on('error',rej);
  });
}
function n(v){if(v==null)return null;const f=parseFloat(v);return isNaN(f)?null:f;}
function fmt(v,d=1){const f=n(v);return f!=null?parseFloat(f.toFixed(d)):null;}
function pct(o,m){if(!m)return null;return parseFloat(((o/m)*100).toFixed(1));}
function colLetter(n){let s='';while(n>0){s=String.fromCharCode(64+(n-1)%26)+s;n=Math.floor((n-1)/26);}return s;}
function addr(c,r){return`${colLetter(c)}${r}`;}
function fill(argb){return{type:'pattern',pattern:'solid',fgColor:{argb}};}
function thin(hex='AAAAAA'){const s={style:'thin',color:{argb:'FF'+hex}};return{top:s,left:s,bottom:s,right:s};}
function font(argb,size=9,bold=false,italic=false,underline=false){
  const f={name:'Calibri',size,color:{argb},bold,italic};if(underline)f.underline=true;return f;
}
function mc(ws,r,c1,c2,val,style={}){
  if(c1<c2){try{ws.mergeCells(`${addr(c1,r)}:${addr(c2,r)}`);}catch{}}
  const cell=ws.getCell(r,c1);cell.value=val;
  if(style.font)cell.font=style.font;if(style.fill)cell.fill=style.fill;
  if(style.alignment)cell.alignment=style.alignment;if(style.border)cell.border=style.border;
  return cell;
}
function sc(ws,r,c,val,style={}){
  const cell=ws.getCell(r,c);cell.value=val;
  if(style.font)cell.font=style.font;if(style.fill)cell.fill=style.fill;
  if(style.alignment)cell.alignment=style.alignment;if(style.border)cell.border=style.border;
  return cell;
}
function rh(ws,r,h){ws.getRow(r).height=h;}

// ── Setup columns per bulletin half ──────────────────────────
function setupCols(ws){
  ws.getColumn(C.SUBJ).width=20; ws.getColumn(C.MB).width=5.5; ws.getColumn(C.MC).width=5.5; ws.getColumn(C.MD).width=6.5;
  ws.getColumn(C.T1B).width=5.5; ws.getColumn(C.T1C).width=6; ws.getColumn(C.T1D).width=6.5;
  ws.getColumn(C.T2B).width=5.5; ws.getColumn(C.T2C).width=6; ws.getColumn(C.T2D).width=6.5;
  ws.getColumn(C.T3B).width=5.5; ws.getColumn(C.T3C).width=6; ws.getColumn(C.T3D).width=6.5;
  ws.getColumn(C.AN).width=7.5; ws.getColumn(C.AO).width=7.5; ws.getColumn(C.AP).width=6.5; ws.getColumn(C.AQ).width=6.5;
}
function setupPrint(ws){
  ws.pageSetup={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:1,
    margins:{left:0.4,right:0.4,top:0.5,bottom:0.5,header:0.2,footer:0.2}};
}

// ── Data fetchers ─────────────────────────────────────────────
async function fetchTermIds(schoolId,academicYearId){
  const{data}=await supabase.from('terms').select('id,number,name,is_current')
    .eq('school_id',schoolId).eq('academic_year_id',academicYearId).in('number',[1,2,3]);
  const map={};(data||[]).forEach(t=>{map[t.number]=t;});return map;
}
async function fetchSubjects(classId){
  const{data}=await supabase.from('class_subjects').select('*,subject:subjects(id,name,code,max_marks,max_test,max_exam,coefficient,sort_order,is_core)').eq('class_id',classId);
  return(data||[])
    .map(cs=>({
      ...cs.subject,
      sort_order: cs.sort_order ?? cs.subject?.sort_order ?? 999,
      is_core:    cs.is_core != null ? cs.is_core : (cs.subject?.is_core ?? false),
    }))
    .filter(Boolean)
    .sort((a,b)=>{
      const oa=a.sort_order??999, ob=b.sort_order??999;
      if(oa!==ob)return oa-ob;
      return(a.name||'').localeCompare(b.name||'');
    });
}
async function fetchClassMarks(schoolId,classId,termId){
  if(!termId)return[];
  const{data}=await supabase.from('marks').select('student_id,subject_id,cat1,exam,total').eq('school_id',schoolId).eq('class_id',classId).eq('term_id',termId);
  return data||[];
}
function computeRanks(students,marks,subjects){
  const stats=students.map(st=>{
    let tw=0,mx=0;
    subjects.forEach(sub=>{const m=marks.find(mk=>mk.student_id===st.id&&mk.subject_id===sub.id);if(m?.total!=null){tw+=parseFloat(m.total)*(sub.coefficient||1);mx+=(sub.max_marks||100)*(sub.coefficient||1);}});
    return{id:st.id,pct:mx>0?(tw/mx)*100:0,total:tw,max:mx};
  });
  const sorted=[...stats].sort((a,b)=>b.pct-a.pct);sorted.forEach((s,i)=>s.rank=i+1);
  const rm={},sm={};sorted.forEach(s=>{rm[s.id]=s.rank;sm[s.id]=s;});return{rankMap:rm,statsMap:sm};
}

// ════════════════════════════════════════════════════════════
// DRAW ONE TERM BULLETIN on its own sheet (portrait A4)
// Matches image exactly: header, REPORT CARD title, student
// info, table with MAX POINT + O.P + RANK, totals, avg/rank
// ════════════════════════════════════════════════════════════
async function drawTermBulletin(wb,student,marks,subjects,classInfo,termInfo,yearInfo,school,meta,logoImgId){
  const sheetName=(
    `${(student.last_name||'').toUpperCase()} ${student.first_name||''}`.replace(/[\\\/\?\*\[\]:]/g,' ').trim().substring(0,25)+
    ` ${termInfo?.name||'T?'}`
  ).substring(0,31);

  const ws=wb.addWorksheet(sheetName);
  setupCols(ws); setupPrint(ws);
  const L=C.SUBJ, R=C.LAST;
  let r=1;

  // ── HEADER rows 1-5 ─────────────────────────────────────
  rh(ws,1,13);rh(ws,2,14);rh(ws,3,13);rh(ws,4,12);rh(ws,5,5);

  // Logo top-left (cols A-B, rows 1-4)
  if(logoImgId!=null){
    ws.addImage(logoImgId,{tl:{col:0,row:0},br:{col:2,row:4},editAs:'oneCell'});
  }

  // Left side: Republic + school info
  const sn=school.school_name||'School';
  const addrStr=[school.address,school.city].filter(Boolean).join(', ')||'';
  mc(ws,1,L,L+5,'REPUBLIC OF RWANDA',{font:font(NAVY,8,true),alignment:{horizontal:'left',vertical:'middle'}});
  mc(ws,2,L,L+5,sn,{font:font(BLACK,9,true),alignment:{horizontal:'left',vertical:'middle'}});
  mc(ws,3,L,L+5,addrStr,{font:font(BLACK,8),alignment:{horizontal:'left',vertical:'middle'}});
  mc(ws,4,L,L+5,school.phone||'',{font:font(BLACK,8),alignment:{horizontal:'left',vertical:'middle'}});

  // Right side: Ministry + Year + Term
  const RX=L+9;
  mc(ws,1,RX,R,'MINISTRY OF EDUCATION',{font:font(NAVY,8,true),alignment:{horizontal:'right',vertical:'middle'}});
  mc(ws,2,RX,R,`School Year: ${yearInfo?.name||''}`,{font:font(BLACK,8),alignment:{horizontal:'right',vertical:'middle'}});
  mc(ws,3,RX,R,termInfo?.name||'',{font:font(NAVY,10,true),alignment:{horizontal:'right',vertical:'middle'}});

  // Row 5: navy separator
  for(let col=L;col<=R;col++){ws.getCell(5,col).fill=fill(NAVY);}

  // ── REPORT CARD title row 6 ─────────────────────────────
  r=6; rh(ws,6,20);
  mc(ws,6,L,R,'REPORT CARD',{
    fill:fill(WHITE),font:font(NAVY,13,true,false,true),
    alignment:{horizontal:'center',vertical:'middle'},
    border:{bottom:{style:'medium',color:{argb:NAVY}}}
  });

  // ── Student info rows 7-9 ───────────────────────────────
  rh(ws,7,14);rh(ws,8,14);rh(ws,9,14);
  const lbl={font:font(GRAY,8.5,true),alignment:{vertical:'middle'}};
  const val={font:font(BLACK,9,true),alignment:{vertical:'middle'}};
  const fullName=`${(student.last_name||'').toUpperCase()} ${student.first_name||''}`.trim();

  mc(ws,7,L,L,'Student Name:',lbl);mc(ws,7,L+1,L+8,fullName,val);
  mc(ws,7,L+9,L+10,'Class:',lbl);mc(ws,7,L+11,R,classInfo?.name||'—',val);
  mc(ws,8,L,L,'Born:',lbl);mc(ws,8,L+1,L+4,student.date_of_birth||'at',val);
  mc(ws,8,L+5,L+6,'N. Students:',lbl);mc(ws,8,L+7,L+9,String(meta.class_size||'—'),val);
  mc(ws,8,L+10,L+11,'Conduct:',lbl);mc(ws,8,L+12,R,`${meta.conduct||'Good'} / 40`,val);
  mc(ws,9,L,L,'ID No.:',lbl);mc(ws,9,L+1,L+8,student.student_id||'—',val);

  // ── Table headers rows 10-11 ─────────────────────────────
  rh(ws,10,22);rh(ws,11,16);
  const gh={fill:fill(NAVY),font:font(WHITE,8,true),alignment:{horizontal:'center',vertical:'middle',wrapText:true},border:thin('FFFFFF')};
  const sh={fill:fill(NAVY2),font:font(WHITE,8,true),alignment:{horizontal:'center',vertical:'middle'},border:tin('FFFFFF')};

  function tin(hex){const s={style:'thin',color:{argb:'FF'+hex}};return{top:s,left:s,bottom:s,right:s};}

  // Row 10 group headers — SUBJECTS merges rows 10+11
  try{ws.mergeCells(`${addr(C.SUBJ,10)}:${addr(C.SUBJ,11)}`);}catch{}
  sc(ws,10,C.SUBJ,'SUBJECTS',{fill:fill(NAVY),font:font(WHITE,9,true),alignment:{horizontal:'center',vertical:'middle'},border:thin('FFFFFF')});
  mc(ws,10,C.MB,C.MD,'MAX POINT',gh); mc(ws,10,C.T1B,C.T1D,'O.P',gh);
  try{ws.mergeCells(`${addr(C.LAST,10)}:${addr(C.LAST,11)}`);}catch{}
  sc(ws,10,C.LAST,'RANK',gh);

  // Row 11 sub-headers
  sc(ws,11,C.SUBJ,'',{fill:fill(NAVY2),border:thin('FFFFFF')});
  [C.MB,C.T1B].forEach((start,grp)=>{
    sc(ws,11,start,'TEST',{fill:fill(NAVY2),font:font(WHITE,8,true),alignment:{horizontal:'center',vertical:'middle'},border:thin('FFFFFF')});
    sc(ws,11,start+1,'EX',{fill:fill(NAVY2),font:font(WHITE,8,true),alignment:{horizontal:'center',vertical:'middle'},border:thin('FFFFFF')});
    sc(ws,11,start+2,'TOT',{fill:fill(NAVY2),font:font(WHITE,8,true),alignment:{horizontal:'center',vertical:'middle'},border:thin('FFFFFF')});
  });
  sc(ws,11,C.LAST,'',{fill:fill(NAVY2),border:thin('FFFFFF')});

  // ── Subject rows ─────────────────────────────────────────
  let dataR=12;
  let gmT=0,gmE=0,gmTot=0,goT=0,goE=0,goTot=0;

  subjects.forEach((sub,idx)=>{
    rh(ws,dataR,13);
    const alt=idx%2===1;
    const bg=fill(alt?LYELL:WHITE);
    const base={fill:bg,border:thin(),alignment:{horizontal:'center',vertical:'middle'}};
    const mx=sub.max_marks||100, mxT=sub.max_test||0, mxE=sub.max_exam||0;
    const mk=marks.find(m=>m.subject_id===sub.id);
    const opT=n(mk?.cat1),opE=n(mk?.exam),opTo=n(mk?.total);
    gmT+=mxT;gmE+=mxE;gmTot+=mx;
    if(opT!=null)goT+=opT;if(opE!=null)goE+=opE;if(opTo!=null)goTot+=opTo;
    sc(ws,dataR,C.SUBJ,(sub.name||'').toUpperCase(),{...base,font:font(BLACK,8.5),alignment:{horizontal:'left',vertical:'middle',indent:1}});
    const num=(v)=>v!=null?v:'';
    sc(ws,dataR,C.MB,mxT||'',{...base,font:font(BLACK,8,false,true)});
    sc(ws,dataR,C.MC,mxE||'',{...base,font:font(BLACK,8,false,true)});
    sc(ws,dataR,C.MD,mx||'',{...base,font:font(BLACK,8.5,true)});
    sc(ws,dataR,C.T1B,num(opT),{...base,font:font(BLACK,8)});
    sc(ws,dataR,C.T1C,num(opE),{...base,font:font(BLACK,8)});
    sc(ws,dataR,C.T1D,num(opTo),{...base,font:font(BLACK,8.5,true)});
    sc(ws,dataR,C.LAST,meta.rank_in_class?meta.rank_in_class:'—',{...base,font:font(BLACK,8.5)});
    dataR++;
  });

  // ── TOTAL row ─────────────────────────────────────────────
  rh(ws,dataR,14);
  const ts={fill:fill(NAVY),font:font(WHITE,9,true),alignment:{horizontal:'center',vertical:'middle'},border:thin('FFFFFF')};
  mc(ws,dataR,C.SUBJ,C.SUBJ,'Total',{...ts,alignment:{horizontal:'left',vertical:'middle',indent:1}});
  sc(ws,dataR,C.MB,fmt(gmT)||'',ts);sc(ws,dataR,C.MC,fmt(gmE)||'',ts);sc(ws,dataR,C.MD,fmt(gmTot)||'',ts);
  sc(ws,dataR,C.T1B,fmt(goT)||'',ts);sc(ws,dataR,C.T1C,fmt(goE)||'',ts);sc(ws,dataR,C.T1D,fmt(goTot)||'',ts);
  sc(ws,dataR,C.LAST,'',ts);
  dataR++;

  // ── AVERAGE / RANK row ────────────────────────────────────
  rh(ws,dataR,16);
  const avgPct=gmTot>0?(goTot/gmTot*100):(meta.percentage||0);
  const as={fill:fill('FFE8F0FE'),font:font(NAVY,10,true),alignment:{horizontal:'center',vertical:'middle'},border:{bottom:{style:'medium',color:{argb:NAVY}}}};
  mc(ws,dataR,C.SUBJ,C.MD,`Average: ${avgPct.toFixed(1)}%`,as);
  mc(ws,dataR,C.T1B,C.T1C,'Rank:',{...as,font:font(NAVY,9,true)});
  const rkStr=meta.rank_in_class?`${meta.rank_in_class} out of ${meta.class_size}`:'—';
  mc(ws,dataR,C.T1D,C.LAST,rkStr,{...as,font:font(NAVY,10,true)});
  dataR++;

  // ── Observations + Signatures ─────────────────────────────
  rh(ws,dataR,6);dataR++;
  const obsEnd=C.SUBJ+8,sigSt=C.SUBJ+9;
  rh(ws,dataR,14);
  mc(ws,dataR,C.SUBJ,obsEnd,'Observations',{fill:fill(NAVY),font:font(WHITE,9,true),alignment:{horizontal:'center',vertical:'middle'},border:thin('FFFFFF')});
  mc(ws,dataR,sigSt,R,'Teacher Signature',{fill:fill(NAVY),font:font(WHITE,9,true),alignment:{horizontal:'center',vertical:'middle'},border:thin('FFFFFF')});
  dataR++;
  for(let i=0;i<2;i++){
    rh(ws,dataR,16);
    mc(ws,dataR,C.SUBJ,obsEnd,'',{fill:fill(WHITE),border:thin()});
    if(i===0){mc(ws,dataR,sigSt,R,'Date: ___________',{fill:fill(WHITE),font:font(GRAY,8),alignment:{horizontal:'left',vertical:'bottom'},border:thin()});}
    else{mc(ws,dataR,sigSt,R,'Parent Signature',{fill:fill('FFEEEEEE'),font:font(NAVY,9,true),alignment:{horizontal:'center',vertical:'middle'},border:thin()});}
    dataR++;
  }
  rh(ws,dataR,16);
  mc(ws,dataR,C.SUBJ,obsEnd,'',{fill:fill(WHITE),border:thin()});
  mc(ws,dataR,sigSt,R,'Date: ___________',{fill:fill(WHITE),font:font(GRAY,8),alignment:{horizontal:'left',vertical:'bottom'},border:thin()});

  // Outer border around entire bulletin
  for(let row=1;row<=dataR;row++){
    for(let col=L;col<=R;col++){
      const cell=ws.getCell(row,col);
      const b=Object.assign({},cell.border||{});
      if(row===1)b.top={style:'medium',color:{argb:NAVY}};
      if(row===dataR)b.bottom={style:'medium',color:{argb:NAVY}};
      if(col===L)b.left={style:'medium',color:{argb:NAVY}};
      if(col===R)b.right={style:'medium',color:{argb:NAVY}};
      cell.border=b;
    }
  }

  ws.views=[{state:'frozen',xSplit:0,ySplit:11,activeCell:'A12'}];
}

// ════════════════════════════════════════════════════════════
// DRAW ANNUAL (Progressive School Report) — one sheet
// per student with T1/T2/T3 + Annual columns
// ════════════════════════════════════════════════════════════
async function drawAnnualSheet(wb,student,mT1,mT2,mT3,subjects,classInfo,yearInfo,school,ranks,classSize,logoImgId){
  const sheetName=(`${(student.last_name||'').toUpperCase()} ${student.first_name||''}`.replace(/[\\\/\?\*\[\]:]/g,' ').trim().substring(0,25)+' Annual').substring(0,31);
  const ws=wb.addWorksheet(sheetName);
  setupCols(ws); setupPrint(ws);
  const L=C.SUBJ, R=C.LAST;
  let r=1;

  // Header rows 1-5 (same style as term bulletin)
  rh(ws,1,13);rh(ws,2,14);rh(ws,3,13);rh(ws,4,12);rh(ws,5,5);
  if(logoImgId!=null)ws.addImage(logoImgId,{tl:{col:0,row:0},br:{col:2,row:4},editAs:'oneCell'});
  const sn=school.school_name||'School';
  mc(ws,1,L,L+5,'REPUBLIC OF RWANDA',{font:font(NAVY,8,true),alignment:{horizontal:'left',vertical:'middle'}});
  mc(ws,2,L,L+5,sn,{font:font(BLACK,9,true),alignment:{horizontal:'left',vertical:'middle'}});
  mc(ws,3,L,L+5,[school.address,school.city].filter(Boolean).join(', ')||'',{font:font(BLACK,8),alignment:{horizontal:'left',vertical:'middle'}});
  mc(ws,4,L,L+5,school.phone||'',{font:font(BLACK,8),alignment:{horizontal:'left',vertical:'middle'}});
  mc(ws,1,L+9,R,'MINISTRY OF EDUCATION',{font:font(NAVY,8,true),alignment:{horizontal:'right',vertical:'middle'}});
  mc(ws,2,L+9,R,`School Year: ${yearInfo?.name||''}`,{font:font(BLACK,8),alignment:{horizontal:'right',vertical:'middle'}});
  mc(ws,3,L+9,R,'ANNUAL REPORT',{font:font(NAVY,10,true),alignment:{horizontal:'right',vertical:'middle'}});
  for(let col=L;col<=R;col++)ws.getCell(5,col).fill=fill(NAVY);

  // Title row 6
  r=6;rh(ws,6,20);
  mc(ws,6,L,R,'PROGRESSIVE SCHOOL REPORT',{fill:fill(WHITE),font:font(NAVY,13,true,false,true),alignment:{horizontal:'center',vertical:'middle'},border:{bottom:{style:'medium',color:{argb:NAVY}}}});

  // Student info rows 7-9
  rh(ws,7,14);rh(ws,8,14);rh(ws,9,14);
  const lbl={font:font(GRAY,8.5,true),alignment:{vertical:'middle'}};
  const val={font:font(BLACK,9,true),alignment:{vertical:'middle'}};
  const fullName=`${(student.last_name||'').toUpperCase()} ${student.first_name||''}`.trim();
  mc(ws,7,L,L,'Student Name:',lbl);mc(ws,7,L+1,L+8,fullName,val);
  mc(ws,7,L+9,L+10,'School Year:',lbl);mc(ws,7,L+11,R,yearInfo?.name||'—',val);
  mc(ws,8,L,L,"Student's No.:",lbl);mc(ws,8,L+1,L+4,student.student_id||'—',val);
  mc(ws,8,L+5,L+6,'Option:',lbl);mc(ws,8,L+7,R,classInfo?.level||'—',val);
  mc(ws,9,L,L,'Class:',lbl);mc(ws,9,L+1,L+4,classInfo?.name||'—',val);

  // Table header rows 10-11
  rh(ws,10,24);rh(ws,11,16);
  const gh={fill:fill(NAVY),font:font(WHITE,8,true),alignment:{horizontal:'center',vertical:'middle',wrapText:true},border:thin('FFFFFF')};
  const sh={fill:fill('FF1E3A8A'),font:font(WHITE,8,true),alignment:{horizontal:'center',vertical:'middle'},border:tin2('FFFFFF')};

  function tin2(hex){const s={style:'thin',color:{argb:'FF'+hex}};return{top:s,left:s,bottom:s,right:s};}

  try{ws.mergeCells(`${addr(C.SUBJ,10)}:${addr(C.SUBJ,11)}`);}catch{}
  sc(ws,10,C.SUBJ,'Subjects',{fill:fill(NAVY),font:font(WHITE,9,true),alignment:{horizontal:'center',vertical:'middle'},border:tin2('FFFFFF')});
  mc(ws,10,C.MB,C.MD,'MAX POINTS',gh);
  mc(ws,10,C.T1B,C.T1D,'1st TERM O.P',gh);
  mc(ws,10,C.T2B,C.T2D,'2nd TERM O.P',gh);
  mc(ws,10,C.T3B,C.T3D,'3rd TERM O.P',gh);
  mc(ws,10,C.AN,C.AP,'ANNUAL POINTS',gh);
  try{ws.mergeCells(`${addr(C.AQ,10)}:${addr(C.AQ,11)}`);}catch{}
  sc(ws,10,C.AQ,'2nd SIT %',gh);

  sc(ws,11,C.SUBJ,'',{fill:fill('FF1E3A8A'),border:tin2('FFFFFF')});
  [[C.MB,'TEST',C.MC,'EX',C.MD,'TOT'],[C.T1B,'TEST',C.T1C,'EX',C.T1D,'TOT'],
   [C.T2B,'TEST',C.T2C,'EX',C.T2D,'TOT'],[C.T3B,'TEST',C.T3C,'EX',C.T3D,'TOT']].forEach(([b,lb,c,lc,d,ld])=>{
    sc(ws,11,b,lb,{fill:fill('FF1E3A8A'),font:font(WHITE,8,true),alignment:{horizontal:'center',vertical:'middle'},border:tin2('FFFFFF')});
    sc(ws,11,c,lc,{fill:fill('FF1E3A8A'),font:font(WHITE,8,true),alignment:{horizontal:'center',vertical:'middle'},border:tin2('FFFFFF')});
    sc(ws,11,d,ld,{fill:fill('FF1E3A8A'),font:font(WHITE,8,true),alignment:{horizontal:'center',vertical:'middle'},border:tin2('FFFFFF')});
  });
  sc(ws,11,C.AN,'MAX TOT',sh);sc(ws,11,C.AO,'O.P',sh);sc(ws,11,C.AP,'%',sh);
  sc(ws,11,C.AQ,'',sh);

  // Subject rows
  let dataR=12;
  let gmT=0,gmE=0,gmTot=0, t1T=0,t1E=0,t1To=0, t2T=0,t2E=0,t2To=0, t3T=0,t3E=0,t3To=0, anMax=0,anOP=0;

  subjects.forEach((sub,idx)=>{
    rh(ws,dataR,13);
    const alt=idx%2===1;
    const bg=fill(alt?'FFFDF8E1':WHITE);
    const base={fill:bg,border:thin(),alignment:{horizontal:'center',vertical:'middle'}};
    const mx=sub.max_marks||100,mxT=sub.max_test||0,mxE=sub.max_exam||0;
    const m1=mT1.find(m=>m.subject_id===sub.id),m2=mT2.find(m=>m.subject_id===sub.id),m3=mT3.find(m=>m.subject_id===sub.id);
    const v1T=n(m1?.cat1),v1E=n(m1?.exam),v1To=n(m1?.total);
    const v2T=n(m2?.cat1),v2E=n(m2?.exam),v2To=n(m2?.total);
    const v3T=n(m3?.cat1),v3E=n(m3?.exam),v3To=n(m3?.total);
    const termTots=[v1To,v2To,v3To].filter(v=>v!=null);
    const annOP=termTots.length>0?fmt(termTots.reduce((a,b)=>a+b,0)/termTots.length):null;
    const annMax=mx;
    const annPct=pct(annOP,annMax);
    gmT+=mxT;gmE+=mxE;gmTot+=mx;
    if(v1T!=null)t1T+=v1T;if(v1E!=null)t1E+=v1E;if(v1To!=null)t1To+=v1To;
    if(v2T!=null)t2T+=v2T;if(v2E!=null)t2E+=v2E;if(v2To!=null)t2To+=v2To;
    if(v3T!=null)t3T+=v3T;if(v3E!=null)t3E+=v3E;if(v3To!=null)t3To+=v3To;
    anMax+=annMax;if(annOP!=null)anOP+=annOP;
    const num=(v)=>v!=null?v:'';
    sc(ws,dataR,C.SUBJ,(sub.name||'').toUpperCase(),{...base,font:font(BLACK,8.5),alignment:{horizontal:'left',vertical:'middle',indent:1}});
    sc(ws,dataR,C.MB,mxT||'',{...base,font:font(BLACK,8,false,true)});sc(ws,dataR,C.MC,mxE||'',{...base,font:font(BLACK,8,false,true)});sc(ws,dataR,C.MD,mx,{...base,font:font(BLACK,8.5,true)});
    sc(ws,dataR,C.T1B,num(v1T),base);sc(ws,dataR,C.T1C,num(v1E),base);sc(ws,dataR,C.T1D,num(v1To),{...base,font:font(BLACK,8.5,true)});
    sc(ws,dataR,C.T2B,num(v2T),base);sc(ws,dataR,C.T2C,num(v2E),base);sc(ws,dataR,C.T2D,num(v2To),{...base,font:font(BLACK,8.5,true)});
    sc(ws,dataR,C.T3B,num(v3T),base);sc(ws,dataR,C.T3C,num(v3E),base);sc(ws,dataR,C.T3D,num(v3To),{...base,font:font(BLACK,8.5,true)});
    sc(ws,dataR,C.AN,num(annMax),{...base,font:font(BLACK,8.5,true)});sc(ws,dataR,C.AO,num(annOP),{...base,font:font(BLACK,8.5,true)});
    sc(ws,dataR,C.AP,annPct!=null?annPct:'',{...base,font:font(BLACK,8.5,true)});sc(ws,dataR,C.AQ,'',base);
    dataR++;
  });

  // TOTAL row
  rh(ws,dataR,14);
  const ts={fill:fill(NAVY),font:font(WHITE,9,true),alignment:{horizontal:'center',vertical:'middle'},border:tin2('FFFFFF')};
  mc(ws,dataR,C.SUBJ,C.SUBJ,'TOTAL',{...ts,alignment:{horizontal:'left',vertical:'middle',indent:1}});
  [[C.MB,gmT],[C.MC,gmE],[C.MD,gmTot],[C.T1B,t1T],[C.T1C,t1E],[C.T1D,t1To],[C.T2B,t2T],[C.T2C,t2E],[C.T2D,t2To],[C.T3B,t3T],[C.T3C,t3E],[C.T3D,t3To],[C.AN,anMax],[C.AO,fmt(anOP)],[C.AP,pct(anOP,anMax)],[C.AQ,'']].forEach(([col,v])=>sc(ws,dataR,col,v||'',ts));
  dataR++;

  // % row
  rh(ws,dataR,13);
  const ps={fill:fill('FFE8F0FE'),font:font(NAVY,8.5,true),alignment:{horizontal:'center',vertical:'middle'},border:tin2('AAAAAA')};
  mc(ws,dataR,C.SUBJ,C.SUBJ,'%',{...ps,alignment:{horizontal:'left',vertical:'middle',indent:1}});
  [[C.MB,''],[C.MC,''],[C.MD,''],[C.T1B,''],[C.T1C,''],[C.T1D,pct(t1To,gmTot)],[C.T2B,''],[C.T2C,''],[C.T2D,pct(t2To,gmTot)],[C.T3B,''],[C.T3C,''],[C.T3D,pct(t3To,gmTot)],[C.AN,''],[C.AO,''],[C.AP,pct(anOP,anMax)],[C.AQ,'']].forEach(([col,v])=>sc(ws,dataR,col,v??'',ps));
  dataR++;

  // Position row
  rh(ws,dataR,13);
  const pos={fill:fill(WHITE),font:font(BLACK,8.5,true),alignment:{horizontal:'center',vertical:'middle'},border:tin2('AAAAAA')};
  mc(ws,dataR,C.SUBJ,C.SUBJ,'Position',{...pos,alignment:{horizontal:'left',vertical:'middle',indent:1}});
  [[C.MB,''],[C.MC,''],[C.MD,''],[C.T1B,''],[C.T1C,''],[C.T1D,ranks.t1?`${ranks.t1}/${classSize}`:''],[C.T2B,''],[C.T2C,''],[C.T2D,ranks.t2?`${ranks.t2}/${classSize}`:''],[C.T3B,''],[C.T3C,''],[C.T3D,ranks.t3?`${ranks.t3}/${classSize}`:''],[C.AN,''],[C.AO,''],[C.AP,ranks.annual?`${ranks.annual}/${classSize}`:''],[C.AQ,'']].forEach(([col,v])=>sc(ws,dataR,col,v,pos));
  dataR++;

  // Signature rows
  rh(ws,dataR,5);dataR++;
  rh(ws,dataR,14);
  mc(ws,dataR,C.SUBJ,C.SUBJ+7,"Class Teacher's Signature:",{fill:fill(WHITE),font:font(GRAY,8.5,true),alignment:{vertical:'middle'},border:thin()});
  mc(ws,dataR,C.SUBJ+8,R,'',{fill:fill(WHITE),border:{bottom:{style:'thin',color:{argb:'FF000000'}}}});
  dataR++;
  rh(ws,dataR,14);
  mc(ws,dataR,C.SUBJ,C.SUBJ+7,"Parent's Signature:",{fill:fill(WHITE),font:font(GRAY,8.5,true),alignment:{vertical:'middle'},border:thin()});
  mc(ws,dataR,C.SUBJ+8,R,'',{fill:fill(WHITE),border:{bottom:{style:'thin',color:{argb:'FF000000'}}}});

  ws.views=[{state:'frozen',xSplit:0,ySplit:11,activeCell:'A12'}];
}

// ════════════════════════════════════════════════════════════
// ASSEMBLE CLASS DATA
// ════════════════════════════════════════════════════════════
async function assembleClassData(schoolId,classId,academicYearId){
  const[{data:classInfo},{data:yearInfo},{data:school},{data:rawStudents}]=await Promise.all([
    supabase.from('classes').select('*').eq('id',classId).single(),
    supabase.from('academic_years').select('*').eq('id',academicYearId).single(),
    supabase.from('schools').select('*').eq('id',schoolId).single(),
    supabase.from('student_profiles').select('id,first_name,last_name,student_id,date_of_birth,gender').eq('school_id',schoolId).eq('current_class_id',classId).eq('status','active').order('last_name').order('first_name'),
  ]);
  const subjects=await fetchSubjects(classId);
  const termMap=await fetchTermIds(schoolId,academicYearId);
  let mT1=[],mT2=[],mT3=[];
  await Promise.all([
    termMap[1]?supabase.from('marks').select('student_id,subject_id,cat1,exam,total').eq('school_id',schoolId).eq('class_id',classId).eq('term_id',termMap[1].id).then(({data})=>{mT1=data||[];}):Promise.resolve(),
    termMap[2]?supabase.from('marks').select('student_id,subject_id,cat1,exam,total').eq('school_id',schoolId).eq('class_id',classId).eq('term_id',termMap[2].id).then(({data})=>{mT2=data||[];}):Promise.resolve(),
    termMap[3]?supabase.from('marks').select('student_id,subject_id,cat1,exam,total').eq('school_id',schoolId).eq('class_id',classId).eq('term_id',termMap[3].id).then(({data})=>{mT3=data||[];}):Promise.resolve(),
  ]);
  const students=(rawStudents||[]).sort((a,b)=>{const c=(a.last_name||'').toLowerCase().localeCompare((b.last_name||'').toLowerCase());return c!==0?c:(a.first_name||'').toLowerCase().localeCompare((b.first_name||'').toLowerCase());});
  const r1=computeRanks(students,mT1,subjects),r2=computeRanks(students,mT2,subjects),r3=computeRanks(students,mT3,subjects);
  // Annual ranks
  const annStats=students.map(st=>{
    let tw=0,mx=0;
    subjects.forEach(sub=>{const m1=mT1.find(m=>m.student_id===st.id&&m.subject_id===sub.id),m2=mT2.find(m=>m.student_id===st.id&&m.subject_id===sub.id),m3=mT3.find(m=>m.student_id===st.id&&m.subject_id===sub.id);const tArr=[m1?.total,m2?.total,m3?.total].filter(v=>v!=null).map(Number);if(tArr.length>0){const avg=tArr.reduce((a,b)=>a+b,0)/tArr.length;tw+=avg*(sub.coefficient||1);mx+=(sub.max_marks||100)*(sub.coefficient||1);}});
    return{id:st.id,pct:mx>0?(tw/mx)*100:0};
  });
  const annSorted=[...annStats].sort((a,b)=>b.pct-a.pct);annSorted.forEach((s,i)=>s.rank=i+1);
  const annRank={};annSorted.forEach(s=>{annRank[s.id]=s.rank;});
  return{students,subjects,classInfo,yearInfo,school,mT1,mT2,mT3,r1,r2,r3,annRank};
}

// ════════════════════════════════════════════════════════════
// CONTROLLERS
// ════════════════════════════════════════════════════════════

// POST /api/sms/excel/annual-report — full annual (T1+T2+T3+Annual per student)
exports.generateAnnualReport=async(req,res)=>{
  try{
    const{class_id,academic_year_id}=req.query;
    const d=await assembleClassData(req.schoolId,class_id,academic_year_id);
    if(!d.students.length)return res.status(404).json({success:false,error:'No active students'});
    const wb=new ExcelJS.Workbook();wb.creator=d.school?.school_name||'School';wb.created=new Date();
    let logoImgId=null;
    if(d.school?.logo_url){try{const buf=await fetchBuf(d.school.logo_url);const isPng=buf[0]===0x89&&buf[1]===0x50;logoImgId=wb.addImage({buffer:buf,extension:isPng?'png':'jpeg'});}catch{}}
    for(const st of d.students){
      const ranks={t1:d.r1.rankMap[st.id]||null,t2:d.r2.rankMap[st.id]||null,t3:d.r3.rankMap[st.id]||null,annual:d.annRank[st.id]||null};
      await drawAnnualSheet(wb,st,d.mT1.filter(m=>m.student_id===st.id),d.mT2.filter(m=>m.student_id===st.id),d.mT3.filter(m=>m.student_id===st.id),d.subjects,d.classInfo,d.yearInfo,d.school,ranks,d.students.length,logoImgId);
    }
    const fname=`annual_report_${(d.classInfo?.name||'class').replace(/[^a-z0-9]/gi,'_')}_${(d.yearInfo?.name||'year').replace(/[^a-z0-9]/gi,'_')}.xlsx`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${fname}"`);
    await wb.xlsx.write(res);res.end();
  }catch(err){console.error('generateAnnualReport:',err);res.status(500).json({success:false,error:err.message});}
};

// GET /api/sms/excel/annual-report/student — single student annual
exports.generateOneAnnualReport=async(req,res)=>{
  try{
    const{student_id,class_id,academic_year_id}=req.query;
    if(!student_id||!class_id||!academic_year_id)return res.status(400).json({success:false,error:'student_id, class_id, academic_year_id required'});
    const{data:student}=await supabase.from('student_profiles').select('id,first_name,last_name,student_id,date_of_birth,gender').eq('id',student_id).eq('school_id',req.schoolId).single();
    if(!student)return res.status(404).json({success:false,error:'Student not found'});
    const d=await assembleClassData(req.schoolId,class_id,academic_year_id);
    const wb=new ExcelJS.Workbook();wb.creator=d.school?.school_name||'School';wb.created=new Date();
    let logoImgId=null;
    if(d.school?.logo_url){try{const buf=await fetchBuf(d.school.logo_url);const isPng=buf[0]===0x89&&buf[1]===0x50;logoImgId=wb.addImage({buffer:buf,extension:isPng?'png':'jpeg'});}catch{}}
    const ranks={t1:d.r1.rankMap[student_id]||null,t2:d.r2.rankMap[student_id]||null,t3:d.r3.rankMap[student_id]||null,annual:d.annRank[student_id]||null};
    await drawAnnualSheet(wb,student,d.mT1.filter(m=>m.student_id===student_id),d.mT2.filter(m=>m.student_id===student_id),d.mT3.filter(m=>m.student_id===student_id),d.subjects,d.classInfo,d.yearInfo,d.school,ranks,d.students.length,logoImgId);
    const fname=`annual_${(student.last_name||'').replace(/[^a-z0-9]/gi,'_')}_${(d.yearInfo?.name||'').replace(/[^a-z0-9]/gi,'_')}.xlsx`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${fname}"`);
    await wb.xlsx.write(res);res.end();
  }catch(err){console.error('generateOneAnnualReport:',err);res.status(500).json({success:false,error:err.message});}
};
