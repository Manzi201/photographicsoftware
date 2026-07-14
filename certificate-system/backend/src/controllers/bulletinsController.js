'use strict';
const { supabase } = require('../supabase');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');

const PAGE_W = 841.89, PAGE_H = 595.28;
// Layout: 2 bulletins side-by-side on A4 landscape (297×210mm = 841.89×595.28pt)
// Leave 12pt margin each side, 16pt gap between bulletins
// Each bulletin = (841.89 - 24 - 16) / 2 = 400.945 → use 400 (safe integer)
const MARGIN_X = 12, MARGIN_Y = 10;
const BULL_GAP = 16;
const BULL_W   = 400;  // each bulletin width in points — verified: 12+400+16+400+12 = 840 < 841.89 ✓

// Internal column widths — must sum to exactly BULL_W
// SUBJ(100) + 6×MARK(38) + RANK(72) = 100+228+72 = 400 ✓
const COL_SUBJ=100, COL_MARK=38, COL_RANK=72;
const ROW_H_HDR=16, ROW_H_SUBJ=14;

const NAVY   = rgb(0.039,0.141,0.337);
const WHITE  = rgb(1,1,1);
const LGRAY  = rgb(0.929,0.937,0.961);
const LBLUE  = rgb(0.835,0.878,0.961);
const BLACK  = rgb(0.051,0.051,0.051);
const MGRAY  = rgb(0.533,0.533,0.533);
const BORDER = rgb(0.667,0.667,0.667);

const FONTS_DIR = path.join(__dirname,'..','fonts');

function fetchBuf(url){
  return new Promise((res,rej)=>{
    const mod=url.startsWith('https')?https:http;
    mod.get(url,r=>{const c=[];r.on('data',d=>c.push(d));r.on('end',()=>res(Buffer.concat(c)));r.on('error',rej);}).on('error',rej);
  });
}
async function embedImg(doc,buf){try{return await doc.embedJpg(buf);}catch{}try{return await doc.embedPng(buf);}catch{}return null;}
function fmt(n){if(n==null)return'—';const f=parseFloat(n);return isNaN(f)?'—':String(parseFloat(f.toFixed(1)));}
function gradeStr(p){if(p>=80)return'A1';if(p>=70)return'B2';if(p>=60)return'C3';if(p>=50)return'D4';if(p>=40)return'E5';return'F';}
async function loadFonts(doc){
  doc.registerFontkit(fontkit);
  const load=async f=>{try{return await doc.embedFont(fs.readFileSync(path.join(FONTS_DIR,f)));}catch{return await doc.embedFont(StandardFonts.Helvetica);}};
  return{bold:await load('Montserrat-Bold.ttf'),semibold:await load('Montserrat-SemiBold.ttf'),regular:await load('Montserrat-Regular.ttf')};
}

function drawRect(pg,x,y,w,h,{fill,stroke,sw=0.4}={}){
  if(fill)pg.drawRectangle({x,y,width:w,height:h,color:fill});
  if(stroke)pg.drawRectangle({x,y,width:w,height:h,borderColor:stroke,borderWidth:sw});
}
function drawLine(pg,x1,y1,x2,y2,color,t=0.5){pg.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness:t,color});}

function drawText(pg,text,x,y,font,size,color,{maxW,align='left',boxW}={}){
  let t=String(text??'');
  if(maxW){while(t.length>1&&font.widthOfTextAtSize(t,size)>maxW)t=t.slice(0,-1);}
  const tw=font.widthOfTextAtSize(t,size);
  let dx=x;
  if(align==='center'&&boxW)dx=x+(boxW-tw)/2;
  if(align==='right'&&boxW)dx=x+boxW-tw;
  pg.drawText(t,{x:dx,y,size,font,color});
  return tw;
}

function cell(pg,x,y,w,h,text,font,sz,tc,bg,o={}){
  if(bg)drawRect(pg,x,y,w,h,{fill:bg});
  drawRect(pg,x,y,w,h,{stroke:o.borderColor||BORDER,sw:o.borderW||0.4});
  if(text!==''&&text!=null){
    const th=sz*0.72;
    const ty=y+(h-th)/2;
    drawText(pg,String(text),x+(o.padL??2),ty,font,sz,tc,{maxW:o.maxW,align:o.align,boxW:o.boxW||w});
  }
}

function estimateH(numSubs){
  return 66+1.2+16+16*3+16*2+ROW_H_SUBJ*numSubs+16+16+60;
}

async function drawBulletin(pg,F,bx,bTopY,student,marks,subjects,classInfo,termInfo,yearInfo,school,meta,logoImg){
  const W=BULL_W;

  // ── Calculate dynamic row height to ensure bulletin fits on page ──
  // Fixed sections height: HDR(66) + sep(1.2) + title(16) + 3×infoRow(48) + 2×hdrRow(32) + total(16) + avg(16) + bot(60)
  const FIXED_H = 66 + 1.2 + 16 + 16*3 + 16*2 + 16 + 16 + 60;
  const available = bTopY - MARGIN_Y; // space from top to bottom margin
  const rowBudget = available - FIXED_H;
  // Use standard row height unless subjects are many
  const rowH = subjects.length > 0
    ? Math.max(10, Math.min(ROW_H_SUBJ, Math.floor(rowBudget / subjects.length)))
    : ROW_H_SUBJ;

  let cur=0;
  const top=()=>bTopY-cur;
  const bot=(h)=>bTopY-cur-h;
  const adv=(h)=>{cur+=h;};

  // Header
  const HDR_H=66, LS=60, LEFT_W=140, RIGHT_W=140, MID_W=W-LEFT_W-RIGHT_W;
  drawRect(pg,bx,bTopY-HDR_H,W,HDR_H,{fill:WHITE});
  const lx=bx+2;
  pg.drawText('REPUBLIC OF RWANDA',{x:lx,y:bTopY-10,size:7,font:F.bold,color:NAVY});
  const sn=school.school_name||'School';
  pg.drawText(sn.substring(0,35),{x:lx,y:bTopY-20,size:7.5,font:F.bold,color:BLACK});
  const addr2=[school.address,school.city].filter(Boolean).join(', ');
  if(addr2)pg.drawText(addr2.substring(0,40),{x:lx,y:bTopY-30,size:6.5,font:F.regular,color:BLACK});
  if(school.phone)pg.drawText(school.phone,{x:lx,y:bTopY-40,size:6.5,font:F.regular,color:BLACK});

  const rBase=bx+W;
  // Right-aligned header text — clip to RIGHT_W to prevent overflow
  [['MINISTRY OF EDUCATION',F.bold,7,NAVY],[`School Year: ${yearInfo?.name||''}`,F.regular,7,BLACK],[meta.is_annual?'ANNUAL REPORT':(termInfo?.name||''),F.bold,7.5,NAVY]]
    .forEach(([t,f,s,c],i)=>{
      let txt=String(t||'');
      // Truncate so text never overflows right edge
      while(txt.length>1 && f.widthOfTextAtSize(txt,s)>RIGHT_W-4) txt=txt.slice(0,-1);
      const tw=f.widthOfTextAtSize(txt,s);
      pg.drawText(txt,{x:rBase-tw-2,y:bTopY-10-i*12,size:s,font:f,color:c});
    });

  // Logo
  const logoX=bx+LEFT_W+(MID_W-LS)/2, logoY=bTopY-HDR_H+(HDR_H-LS)/2;
  if(logoImg){pg.drawImage(logoImg,{x:logoX,y:logoY,width:LS,height:LS});}
  else{drawRect(pg,logoX,logoY,LS,LS,{fill:NAVY});const ini=(sn).split(' ').map(w=>w[0]).join('').slice(0,3).toUpperCase();const iW=F.bold.widthOfTextAtSize(ini,14);pg.drawText(ini,{x:logoX+(LS-iW)/2,y:logoY+LS/2-6,size:14,font:F.bold,color:WHITE});}
  adv(HDR_H);

  // Navy separator
  drawLine(pg,bx,top(),bx+W,top(),NAVY,1.2);adv(1.2);

  // Title bar
  const TH=16;
  drawRect(pg,bx,bot(TH),W,TH,{fill:NAVY});
  const tit=meta.is_annual?'ANNUAL REPORT CARD':'REPORT CARD';
  const tW=F.bold.widthOfTextAtSize(tit,9);
  pg.drawText(tit,{x:bx+(W-tW)/2,y:bot(TH)+(TH-9*0.72)/2,size:9,font:F.bold,color:WHITE});
  adv(TH);

  // Student info rows
  const IH=16;
  const fn=`${(student.last_name||'').toUpperCase()} ${student.first_name||''}`.trim();
  // Row 1: Name + Class
  {const y=bot(IH);drawRect(pg,bx,y,W,IH,{fill:LGRAY});
    cell(pg,bx,y,68,IH,'Student Name:',F.regular,6.5,MGRAY,null);
    cell(pg,bx+68,y,196,IH,fn,F.bold,7.5,BLACK,null,{maxW:190});
    cell(pg,bx+264,y,40,IH,'Class:',F.regular,6.5,MGRAY,null);
    cell(pg,bx+304,y,96,IH,classInfo?.name||'—',F.bold,7.5,BLACK,null,{maxW:90});adv(IH);}
  // Row 2: Born | N.Students | Conduct
  {const y=bot(IH);drawRect(pg,bx,y,W,IH,{fill:LGRAY});
    cell(pg,bx,y,28,IH,'Born:',F.regular,6.5,MGRAY,null);
    cell(pg,bx+28,y,88,IH,student.date_of_birth||'—',F.regular,7,BLACK,null);
    cell(pg,bx+116,y,58,IH,'N. Students:',F.regular,6.5,MGRAY,null);
    cell(pg,bx+174,y,36,IH,String(meta.class_size||'—'),F.bold,7,BLACK,null,{align:'center',boxW:36});
    cell(pg,bx+210,y,46,IH,'Conduct:',F.regular,6.5,MGRAY,null);
    cell(pg,bx+256,y,144,IH,`${meta.conduct||'Good'} / 40`,F.bold,7,BLACK,null);adv(IH);}
  // Row 3: ID
  {const y=bot(IH);drawRect(pg,bx,y,W,IH,{fill:LGRAY});
    cell(pg,bx,y,38,IH,'ID No.:',F.regular,6.5,MGRAY,null);
    cell(pg,bx+38,y,W-38,IH,student.student_id||'—',F.regular,7,BLACK,null);adv(IH);}

  // Table column x positions
  const cx=[bx,bx+COL_SUBJ,bx+COL_SUBJ+COL_MARK,bx+COL_SUBJ+COL_MARK*2,bx+COL_SUBJ+COL_MARK*3,bx+COL_SUBJ+COL_MARK*4,bx+COL_SUBJ+COL_MARK*5,bx+COL_SUBJ+COL_MARK*6];
  const cw=[COL_SUBJ,COL_MARK,COL_MARK,COL_MARK,COL_MARK,COL_MARK,COL_MARK,COL_RANK];

  // Header row 1
  {const y=bot(ROW_H_HDR);
    cell(pg,cx[0],y,cw[0],ROW_H_HDR,'SUBJECTS',F.bold,7,WHITE,NAVY,{align:'center',borderColor:WHITE});
    cell(pg,cx[1],y,cw[1]+cw[2]+cw[3],ROW_H_HDR,'MAX POINT',F.bold,7,WHITE,NAVY,{align:'center',borderColor:WHITE});
    cell(pg,cx[4],y,cw[4]+cw[5]+cw[6],ROW_H_HDR,'O.P',F.bold,7,WHITE,NAVY,{align:'center',borderColor:WHITE});
    cell(pg,cx[7],y,cw[7],ROW_H_HDR,'RANK',F.bold,7,WHITE,NAVY,{align:'center',borderColor:WHITE});adv(ROW_H_HDR);}

  // Header row 2
  {const y=bot(ROW_H_HDR);
    ['','TEST','EX','TOT','TEST','EX','TOT',''].forEach((h,i)=>cell(pg,cx[i],y,cw[i],ROW_H_HDR,h,F.bold,6.5,NAVY,LBLUE,{align:'center',borderColor:BORDER}));
    adv(ROW_H_HDR);}

  // Subject rows
  let gmT=0,gmE=0,gmTot=0,goT=0,goE=0,goTot=0;
  subjects.forEach((sub,idx)=>{
    const alt=idx%2===1, bg=alt?LGRAY:WHITE;
    const y=bot(rowH);
    const mx=sub.max_marks||100,mxT=sub.max_test||0,mxE=sub.max_exam||0;
    const mk=marks.find(m=>m.subject_id===sub.id);
    const opT=mk?.cat1!=null?parseFloat(mk.cat1):null;
    const opE=mk?.exam!=null?parseFloat(mk.exam):null;
    const opTo=mk?.total!=null?parseFloat(mk.total):null;
    gmT+=mxT;gmE+=mxE;gmTot+=mx;
    if(opT!=null)goT+=opT;if(opE!=null)goE+=opE;if(opTo!=null)goTot+=opTo;
    cell(pg,cx[0],y,cw[0],rowH,(sub.name||'').toUpperCase(),F.regular,6.5,BLACK,bg,{maxW:cw[0]-4,borderColor:BORDER});
    cell(pg,cx[1],y,cw[1],rowH,mxT||'—',F.regular,6.5,BLACK,bg,{align:'center',borderColor:BORDER});
    cell(pg,cx[2],y,cw[2],rowH,mxE||'—',F.regular,6.5,BLACK,bg,{align:'center',borderColor:BORDER});
    cell(pg,cx[3],y,cw[3],rowH,mx,F.regular,6.5,BLACK,bg,{align:'center',borderColor:BORDER});
    cell(pg,cx[4],y,cw[4],rowH,fmt(opT),F.regular,6.5,BLACK,bg,{align:'center',borderColor:BORDER});
    cell(pg,cx[5],y,cw[5],rowH,fmt(opE),F.regular,6.5,BLACK,bg,{align:'center',borderColor:BORDER});
    cell(pg,cx[6],y,cw[6],rowH,fmt(opTo),F.bold,6.5,BLACK,bg,{align:'center',borderColor:BORDER});
    cell(pg,cx[7],y,cw[7],rowH,meta.rank_in_class?String(meta.rank_in_class):'—',F.regular,6.5,BLACK,bg,{align:'center',borderColor:BORDER});
    adv(rowH);
  });

  // TOTAL row
  {const y=bot(ROW_H_HDR);
    const ts={borderColor:WHITE};
    cell(pg,cx[0],y,cw[0],ROW_H_HDR,'TOTAL',F.bold,7,WHITE,NAVY,ts);
    cell(pg,cx[1],y,cw[1],ROW_H_HDR,fmt(gmT),F.bold,7,WHITE,NAVY,{...ts,align:'center'});
    cell(pg,cx[2],y,cw[2],ROW_H_HDR,fmt(gmE),F.bold,7,WHITE,NAVY,{...ts,align:'center'});
    cell(pg,cx[3],y,cw[3],ROW_H_HDR,fmt(gmTot),F.bold,7,WHITE,NAVY,{...ts,align:'center'});
    cell(pg,cx[4],y,cw[4],ROW_H_HDR,fmt(goT),F.bold,7,WHITE,NAVY,{...ts,align:'center'});
    cell(pg,cx[5],y,cw[5],ROW_H_HDR,fmt(goE),F.bold,7,WHITE,NAVY,{...ts,align:'center'});
    cell(pg,cx[6],y,cw[6],ROW_H_HDR,fmt(goTot),F.bold,7,WHITE,NAVY,{...ts,align:'center'});
    cell(pg,cx[7],y,cw[7],ROW_H_HDR,'',F.bold,7,WHITE,NAVY,ts);adv(ROW_H_HDR);}

  // Average / Rank row
  {const y=bot(ROW_H_HDR);
    const avgPct=gmTot>0?(goTot/gmTot*100):(meta.percentage||0);
    const lw=COL_SUBJ+COL_MARK*6;
    cell(pg,bx,y,lw,ROW_H_HDR,`Average: ${avgPct.toFixed(1)}%`,F.bold,8,NAVY,LBLUE,{align:'center',borderColor:NAVY,borderW:0.8});
    cell(pg,bx+lw,y,COL_RANK,ROW_H_HDR,`Rank: ${meta.rank_in_class||'—'} / ${meta.class_size||'—'}`,F.bold,8,NAVY,LBLUE,{align:'center',borderColor:NAVY,borderW:0.8});
    adv(ROW_H_HDR);}

  // Bottom: Observations + Signatures
  const BOT_H=60, OBS_W=Math.round(W*0.52), SIG_W=W-OBS_W;
  const botTopY=bTopY-cur, botBotY=botTopY-BOT_H;
  drawRect(pg,bx,botTopY-14,OBS_W,14,{fill:NAVY});
  const ol=F.bold.widthOfTextAtSize('Observations',7);
  pg.drawText('Observations',{x:bx+(OBS_W-ol)/2,y:botTopY-10,size:7,font:F.bold,color:WHITE});
  drawRect(pg,bx,botBotY,OBS_W,BOT_H-14,{fill:WHITE,stroke:BORDER,sw:0.4});
  const ls2=(BOT_H-14)/4;for(let i=1;i<=3;i++){const ly=botBotY+(BOT_H-14)-i*ls2;drawLine(pg,bx+4,ly,bx+OBS_W-4,ly,BORDER,0.4);}
  const sX=bx+OBS_W, midH=(BOT_H-14)/2;
  drawRect(pg,sX,botTopY-14,SIG_W,14,{fill:NAVY});
  const sl=F.bold.widthOfTextAtSize('Teacher Signature',7);
  pg.drawText('Teacher Signature',{x:sX+(SIG_W-sl)/2,y:botTopY-10,size:7,font:F.bold,color:WHITE});
  drawRect(pg,sX,botTopY-14-midH,SIG_W,midH,{fill:WHITE,stroke:BORDER,sw:0.4});
  pg.drawText('Date: _______________',{x:sX+4,y:botTopY-14-midH+5,size:6.5,font:F.regular,color:MGRAY});
  drawRect(pg,sX,botBotY+midH-14,SIG_W,14,{fill:LGRAY,stroke:BORDER,sw:0.4});
  const pl=F.semibold.widthOfTextAtSize('Parent Signature',7);
  pg.drawText('Parent Signature',{x:sX+(SIG_W-pl)/2,y:botBotY+midH-10,size:7,font:F.semibold,color:NAVY});
  drawRect(pg,sX,botBotY,SIG_W,midH-14,{fill:WHITE,stroke:BORDER,sw:0.4});
  pg.drawText('Date: _______________',{x:sX+4,y:botBotY+5,size:6.5,font:F.regular,color:MGRAY});
  adv(BOT_H);

  // Outer border
  drawRect(pg,bx,bTopY-cur,W,cur,{stroke:NAVY,sw:1.5});
  return bTopY-cur;
}

async function computeAnnualMarks(studentId,classId,schoolId,academicYearId){
  const{data:allTerms}=await supabase.from('terms').select('id,number').eq('academic_year_id',academicYearId).eq('school_id',schoolId).in('number',[1,2,3]);
  if(!allTerms?.length)return[];
  const fetches=await Promise.all(allTerms.map(t=>supabase.from('marks').select('*').eq('student_id',studentId).eq('term_id',t.id)));
  const sm={};
  fetches.forEach(({data:mks})=>(mks||[]).forEach(m=>{
    if(!sm[m.subject_id])sm[m.subject_id]={...m,_s:0,_c:0};
    if(m.total!=null){sm[m.subject_id]._s+=parseFloat(m.total);sm[m.subject_id]._c+=1;}
  }));
  return Object.values(sm).map(m=>({...m,cat1:null,exam:null,total:m._c>0?parseFloat((m._s/m._c).toFixed(2)):null}));
}
function computeStats(students,marksMap,subjects){
  return students.map(st=>{let tw=0,mx=0;subjects.forEach(sub=>{const m=(marksMap[st.id]||[]).find(mk=>mk.subject_id===sub.id);if(m?.total!=null){tw+=parseFloat(m.total)*(sub.coefficient||1);mx+=(sub.max_marks||100)*(sub.coefficient||1);}});return{student:st,pct:mx>0?(tw/mx)*100:0,total:tw,maxTotal:mx};});
}
function buildRanks(statsArr){
  const sorted=[...statsArr].sort((a,b)=>b.pct-a.pct);sorted.forEach((s,i)=>s.rank=i+1);
  const rm={},sm={};sorted.forEach(s=>{rm[s.student.id]=s.rank;sm[s.student.id]=s;});return{rankMap:rm,statsMap:sm};
}
async function fetchShared(schoolId,classId,academicYearId){
  const[{data:classSubs},{data:yearInfo},{data:classInfo},{data:school}]=await Promise.all([
    supabase.from('class_subjects').select('*,subject:subjects(*)').eq('class_id',classId),
    supabase.from('academic_years').select('*').eq('id',academicYearId).single(),
    supabase.from('classes').select('*').eq('id',classId).single(),
    supabase.from('schools').select('*').eq('id',schoolId).single(),
  ]);
  // Build subjects: only core ones, sorted by sort_order then name
  // is_core on class_subjects overrides is_core on subject itself
  const allSubs=(classSubs||[])
    .map(cs=>({
      ...cs.subject,
      sort_order: cs.sort_order ?? cs.subject?.sort_order ?? 999,
      is_core:    cs.is_core    != null ? cs.is_core    : (cs.subject?.is_core ?? false),
      class_subject_id: cs.id,
    }))
    .filter(s => s && s.id);

  // Sort by sort_order then name
  allSubs.sort((a,b)=>{
    const oa=a.sort_order??999, ob=b.sort_order??999;
    if(oa!==ob)return oa-ob;
    return(a.name||'').localeCompare(b.name||'');
  });

  // For report cards: use only core subjects if any are marked core,
  // otherwise fall back to all subjects
  const coreOnly=allSubs.filter(s=>s.is_core);
  const subjects=coreOnly.length>0?coreOnly:allSubs;

  return{subjects,allSubjects:allSubs,yearInfo,classInfo,school};
}
async function buildPDF(students,marksMap,subjects,classInfo,termInfo,yearInfo,school,rankMap,statsMap,conduct,isAnnual){
  const doc=await PDFDocument.create();
  const F=await loadFonts(doc);
  let logoImg=null;
  if(school?.logo_url){try{const buf=await fetchBuf(school.logo_url);logoImg=await embedImg(doc,buf);}catch{}}
  const bTopY=PAGE_H-MARGIN_Y;
  for(let i=0;i<students.length;i+=2){
    const pg=doc.addPage([PAGE_W,PAGE_H]);
    const stL=students[i],spL=statsMap[stL.id];
    const mL={percentage:spL.pct,rank_in_class:rankMap[stL.id],class_size:students.length,conduct:conduct||'Good',is_annual:isAnnual};
    await drawBulletin(pg,F,MARGIN_X,bTopY,stL,marksMap[stL.id]||[],subjects,classInfo,termInfo,yearInfo,school,mL,logoImg);
    if(i+1<students.length){
      const stR=students[i+1],spR=statsMap[stR.id];
      const mR={percentage:spR.pct,rank_in_class:rankMap[stR.id],class_size:students.length,conduct:conduct||'Good',is_annual:isAnnual};
      await drawBulletin(pg,F,MARGIN_X+BULL_W+BULL_GAP,bTopY,stR,marksMap[stR.id]||[],subjects,classInfo,termInfo,yearInfo,school,mR,logoImg);
    }
  }
  return doc.save();
}

exports.getBulletins=async(req,res)=>{
  try{
    const{student_id,term_id,class_id}=req.query;
    let q=supabase.from('bulletins').select('*,student:student_profiles(id,first_name,last_name,student_id),term:terms(name,number),class:classes(name)').eq('school_id',req.schoolId);
    if(student_id)q=q.eq('student_id',student_id);if(term_id)q=q.eq('term_id',term_id);if(class_id)q=q.eq('class_id',class_id);
    const{data,error}=await q.order('created_at',{ascending:false});
    if(error)throw error;res.json({success:true,data});
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
    let tw=0,mx=0;
    subjects.forEach(sub=>{const m=marks.find(mk=>mk.subject_id===sub.id);if(m?.total!=null){tw+=parseFloat(m.total)*(sub.coefficient||1);mx+=(sub.max_marks||100)*(sub.coefficient||1);}});
    const pct=mx>0?(tw/mx)*100:0;
    const{data:peers}=await supabase.from('bulletins').select('student_id,percentage').eq('term_id',term_id).eq('class_id',class_id);
    const sorted=[...(peers||[]),{student_id,percentage:pct}].sort((a,b)=>(b.percentage||0)-(a.percentage||0));
    const rank=sorted.findIndex(p=>p.student_id===student_id)+1;
    const meta={percentage:pct,rank_in_class:rank,class_size:sorted.length,conduct:conduct||'Good',is_annual:isAnnual,teacher_remarks,head_remarks};
    await supabase.from('bulletins').upsert([{school_id:req.schoolId,student_id,term_id,class_id,academic_year_id,total_marks:tw,max_possible:mx,percentage:pct,rank_in_class:rank,class_size:sorted.length,grade:gradeStr(pct),conduct,teacher_remarks,head_remarks,generated_at:new Date().toISOString(),generated_by:req.staff?.id||null}],{onConflict:'student_id,term_id'});
    const doc=await PDFDocument.create();const F=await loadFonts(doc);
    let logoImg=null;if(school?.logo_url){try{const buf=await fetchBuf(school.logo_url);logoImg=await embedImg(doc,buf);}catch{}}
    const pg=doc.addPage([PAGE_W,PAGE_H]);
    await drawBulletin(pg,F,MARGIN_X,PAGE_H-MARGIN_Y,student,marks,subjects,classInfo,termInfo,yearInfo,school,meta,logoImg);
    const pdfBytes=await doc.save();
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="${student.student_id||student_id}_${termInfo?.name||'bulletin'}.pdf"`);
    res.end(Buffer.from(pdfBytes));
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
    const students=[...rawStudents].sort((a,b)=>{const c=(a.last_name||'').toLowerCase().localeCompare((b.last_name||'').toLowerCase());return c!==0?c:(a.first_name||'').toLowerCase().localeCompare((b.first_name||'').toLowerCase());});
    let marksMap={};
    if(isAnnual){for(const st of students)marksMap[st.id]=await computeAnnualMarks(st.id,class_id,req.schoolId,academic_year_id);}
    else{const{data:allMarks}=await supabase.from('marks').select('*').eq('class_id',class_id).eq('term_id',term_id);students.forEach(st=>{marksMap[st.id]=(allMarks||[]).filter(m=>m.student_id===st.id);});}
    const statsArr=computeStats(students,marksMap,subjects);
    const{rankMap,statsMap}=buildRanks(statsArr);
    for(const st of students){const sp=statsMap[st.id];await supabase.from('bulletins').upsert([{school_id:req.schoolId,student_id:st.id,term_id,class_id,academic_year_id,total_marks:sp.total,max_possible:sp.maxTotal,percentage:sp.pct,rank_in_class:rankMap[st.id],class_size:students.length,grade:gradeStr(sp.pct),conduct,teacher_remarks,head_remarks,generated_at:new Date().toISOString()}],{onConflict:'student_id,term_id'});}
    if(termInfo?.number===3){
      const annMap={};for(const st of students)annMap[st.id]=await computeAnnualMarks(st.id,class_id,req.schoolId,academic_year_id);
      const annStats=computeStats(students,annMap,subjects);const{rankMap:aR,statsMap:aS}=buildRanks(annStats);
      for(const st of students){const sp=aS[st.id];await supabase.from('bulletins').upsert([{school_id:req.schoolId,student_id:st.id,term_id:null,class_id,academic_year_id,total_marks:sp.total,max_possible:sp.maxTotal,percentage:sp.pct,rank_in_class:aR[st.id],class_size:students.length,grade:gradeStr(sp.pct),conduct,generated_at:new Date().toISOString()}],{onConflict:'student_id,term_id'});}
    }
    const pdfBytes=await buildPDF(students,marksMap,subjects,classInfo,termInfo,yearInfo,school,rankMap,statsMap,conduct,isAnnual);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="${classInfo?.name||'class'}_${isAnnual?'Annual':termInfo?.name||'Term'}_bulletins.pdf"`);
    res.end(Buffer.from(pdfBytes));
  }catch(err){console.error('generateClass:',err);res.status(500).json({success:false,error:err.message});}
};
async function fetchSharedForOne(schoolId,classId,academicYearId){
  const result=await fetchShared(schoolId,classId,academicYearId);
  return result;
}
exports.computeAnnualMarks=computeAnnualMarks;
