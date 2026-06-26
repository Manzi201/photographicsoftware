const { supabase }  = require('../supabase');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');

// ── Font paths ────────────────────────────────────────────────
const FONTS_DIR = path.join(__dirname, '..', 'fonts');
const FONT_FILES = {
  script:      path.join(FONTS_DIR, 'GreatVibes-Regular.ttf'),
  bold:        path.join(FONTS_DIR, 'Montserrat-Bold.ttf'),
  semibold:    path.join(FONTS_DIR, 'Montserrat-SemiBold.ttf'),
  regular:     path.join(FONTS_DIR, 'Montserrat-Regular.ttf'),
  italic:      path.join(FONTS_DIR, 'Montserrat-Italic.ttf'),
  boldItalic:  path.join(FONTS_DIR, 'Montserrat-BoldItalic.ttf'),
};

// ── Load all fonts into a PDFDocument ────────────────────────
async function loadFonts(doc) {
  doc.registerFontkit(fontkit);
  const load = async (key) => {
    try {
      const bytes = fs.readFileSync(FONT_FILES[key]);
      return await doc.embedFont(bytes);
    } catch {
      // fallback to standard fonts if file missing
      return await doc.embedFont(key === 'bold' || key === 'semibold' ? StandardFonts.HelveticaBold
        : key === 'italic' || key === 'boldItalic' ? StandardFonts.HelveticaOblique
        : StandardFonts.Helvetica);
    }
  };
  return {
    script:     await load('script'),
    bold:       await load('bold'),
    semibold:   await load('semibold'),
    regular:    await load('regular'),
    italic:     await load('italic'),
    boldItalic: await load('boldItalic'),
  };
}

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
function wrap(text, font, size, maxW) {
  const words = (text||'').split(' '), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxW) { if (cur) lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur); return lines;
}
function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}
function fmtDate(d = new Date()) {
  const M = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  return `${ordinal(d.getDate())} ${M[d.getMonth()]} ${d.getFullYear()}`;
}
function fillVars(text, vars) {
  return (text||'').replace(/\{class\}/gi, vars.class||'')
    .replace(/\{year\}/gi, vars.year||'')
    .replace(/\{school\}/gi, vars.school||'')
    .replace(/\{city\}/gi, vars.city||'Kigali')
    .replace(/\{date\}/gi, vars.date||fmtDate());
}
// Draw centered text in area [x, x+w]
function ctr(page, text, y, size, font, color, areaX, areaW) {
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: areaX + (areaW - tw) / 2, y, size, font, color });
}
// Center on full page width W
function ctrW(page, text, y, size, font, color, W) {
  ctr(page, text, y, size, font, color, 0, W);
}
function buildVars(student, template, settings) {
  const year = student.year || new Date().getFullYear();
  return {
    class:  template,
    year:   `${year}-${Number(year)+1}`,
    school: settings.school_name || '',
    city:   settings.city || 'Kigali',
    date:   fmtDate(),
  };
}
async function tryLogo(doc, page, settings, x, y, w, h) {
  if (!settings.logo_url) return;
  try { const buf = await fetchBuf(settings.logo_url); const img = await embedImg(doc,buf); if(img) page.drawImage(img,{x,y,width:w,height:h}); } catch {}
}
async function tryPhoto(doc, page, student, x, y, w, h) {
  if (student.photo_url) {
    try { const buf = await fetchBuf(student.photo_url); const img = await embedImg(doc,buf); if(img){page.drawImage(img,{x,y,width:w,height:h});return;} } catch {}
  }
  page.drawRectangle({x,y,width:w,height:h,color:rgb(0.88,0.88,0.88)});
}
async function trySig(doc, page, settings, x, y, w, h) {
  if (!settings.signature_url) return;
  try { const buf = await fetchBuf(settings.signature_url); const img = await embedImg(doc,buf); if(img) page.drawImage(img,{x,y,width:w,height:h,opacity:0.88}); } catch {}
}
async function tryStamp(doc, page, settings, cx, cy, size) {
  if (!settings.stamp_url) return false;
  try { const buf = await fetchBuf(settings.stamp_url); const img = await embedImg(doc,buf); if(img){page.drawImage(img,{x:cx-size/2,y:cy-size/2,width:size,height:size,opacity:0.82});return true;} } catch {}
  return false;
}
function drawSunSeal(page, cx, cy, rOuter, rInner, rCore, teeth, c1, c2, c3) {
  for (let i=0;i<teeth;i++){const a=Math.PI*2*i/teeth;page.drawCircle({x:cx+Math.cos(a)*(rOuter+4),y:cy+Math.sin(a)*(rOuter+4),size:rOuter*0.14,color:c1});}
  page.drawCircle({x:cx,y:cy,size:rOuter,color:c1});
  page.drawCircle({x:cx,y:cy,size:rInner,color:c2});
  page.drawCircle({x:cx,y:cy,size:rCore,color:c3});
}

// ════════════════════════════════════════════════════════════════
// DESIGN A — "Midnight Navy Portrait"
// A4 Portrait · Deep navy · Gold V-curves · Script name · Gold seal
// ════════════════════════════════════════════════════════════════
async function designA(doc, page, student, template, settings, W, H, F) {
  const navy=rgb(0.04,0.10,0.30), dNavy=rgb(0.02,0.06,0.18);
  const gold=rgb(0.85,0.65,0.05), ltGold=rgb(0.96,0.82,0.38);
  const white=rgb(1,1,1);
  const vars=buildVars(student,template,settings);
  const sn=(settings.school_name||'SCHOOL NAME').toUpperCase();
  const nm=`${student.first_name} ${student.last_name}`;

  // Navy bg
  page.drawRectangle({x:0,y:0,width:W,height:H,color:navy});

  // Dot-texture corners
  for(let r=0;r<6;r++) for(let c=0;c<6;c++){
    if(Math.sqrt(r*r+c*c)<7){
      page.drawCircle({x:24+c*13,y:24+r*13,size:1.8,color:rgb(0.20,0.35,0.62)});
      page.drawCircle({x:W-24-c*13,y:24+r*13,size:1.8,color:rgb(0.20,0.35,0.62)});
    }
  }

  // Gold double border
  page.drawRectangle({x:16,y:16,width:W-32,height:H-32,borderColor:gold,borderWidth:2.5,color:rgb(1,1,1,0)});
  page.drawRectangle({x:22,y:22,width:W-44,height:H-44,borderColor:rgb(0.65,0.46,0.02),borderWidth:0.6,color:rgb(1,1,1,0)});

  // Top swooshes
  page.drawLine({start:{x:0,y:H-50},end:{x:150,y:H+20},thickness:55,color:gold});
  page.drawLine({start:{x:0,y:H-80},end:{x:170,y:H+20},thickness:20,color:ltGold});
  page.drawLine({start:{x:W,y:H-50},end:{x:W-150,y:H+20},thickness:55,color:gold});
  page.drawLine({start:{x:W,y:H-80},end:{x:W-170,y:H+20},thickness:20,color:ltGold});

  // Bottom V-shape
  page.drawLine({start:{x:0,y:210},end:{x:W/2,y:88},thickness:55,color:gold});
  page.drawLine({start:{x:W,y:210},end:{x:W/2,y:88},thickness:55,color:gold});
  page.drawLine({start:{x:0,y:192},end:{x:W/2,y:72},thickness:22,color:ltGold});
  page.drawLine({start:{x:W,y:192},end:{x:W/2,y:72},thickness:22,color:ltGold});

  // Clean center areas
  page.drawRectangle({x:26,y:208,width:W-52,height:H-346,color:navy});
  page.drawRectangle({x:26,y:H-200,width:W-52,height:158,color:navy});

  // Redraw borders
  page.drawRectangle({x:16,y:16,width:W-32,height:H-32,borderColor:gold,borderWidth:2.5,color:rgb(1,1,1,0)});
  page.drawRectangle({x:22,y:22,width:W-44,height:H-44,borderColor:rgb(0.65,0.46,0.02),borderWidth:0.6,color:rgb(1,1,1,0)});

  // Logo
  await tryLogo(doc,page,settings,(W-54)/2,H-100,54,54);

  // School name
  let snSz=14; while(F.bold.widthOfTextAtSize(sn,snSz)>W-80&&snSz>8) snSz--;
  ctrW(page,sn,H-112,snSz,F.bold,gold,W);
  page.drawLine({start:{x:W/2-55,y:H-117},end:{x:W/2+55,y:H-117},thickness:0.6,color:ltGold});

  // CERTIFICATE
  ctrW(page,'CERTIFICATE',H-162,44,F.bold,gold,W);
  ctrW(page,'O F   A C H I E V E M E N T',H-186,13,F.semibold,gold,W);

  // Inner box
  const bx=36,by=216,bW=W-72,bH=H-bx*2-220;
  page.drawRectangle({x:bx,y:by,width:bW,height:bH,borderColor:gold,borderWidth:1.2,color:rgb(1,1,1,0)});
  page.drawRectangle({x:bx+4,y:by+4,width:bW-8,height:bH-8,borderColor:rgb(0.62,0.44,0.02),borderWidth:0.4,color:rgb(1,1,1,0)});

  // Photo top-right in box
  const pW=106,pH=136,pX=bx+bW-pW-14,pY=by+bH-pH-14;
  page.drawRectangle({x:pX-3,y:pY-3,width:pW+6,height:pH+6,borderColor:gold,borderWidth:1.5,color:rgb(1,1,1,0)});
  await tryPhoto(doc,page,student,pX,pY,pW,pH);

  // "This Certificate Is Proudly Presented To"
  const presY=by+bH-32;
  let presT='This Certificate Is Proudly Presented To';
  page.drawText(presT,{x:bx+18,y:presY,size:10,font:F.italic,color:ltGold});

  // Student name — SCRIPT FONT (Great Vibes)
  let nSz=42; while(F.script.widthOfTextAtSize(nm,nSz)>bW-pW-44&&nSz>20) nSz--;
  page.drawText(nm,{x:bx+18,y:presY-nSz-6,size:nSz,font:F.script,color:gold});
  page.drawLine({start:{x:bx+18,y:presY-nSz-12},end:{x:bx+bW-pW-28,y:presY-nSz-12},thickness:0.8,color:rgb(0.55,0.42,0.12)});

  // Body text
  const vars2=vars;
  const l1=fillVars(settings.cert_line1||'Has completed in {class} at',vars2)+' '+(settings.school_name||'');
  const l2=fillVars(settings.cert_line2||'in Academic year of {year}',vars2);
  const purp=fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars2);
  const done=fillVars(settings.cert_done_text||'Done at {city} on {date}',vars2);
  let ty=presY-nSz-28;
  wrap(l1+' '+l2,F.regular,10.5,bW-44).forEach((ln,i)=>page.drawText(ln,{x:bx+18,y:ty-i*14,size:10.5,font:F.regular,color:ltGold}));
  ty-=wrap(l1+' '+l2,F.regular,10.5,bW-44).length*14+6;
  wrap(purp,F.italic,10,bW-44).forEach((ln,i)=>page.drawText(ln,{x:bx+18,y:ty-i*14,size:10,font:F.italic,color:ltGold}));
  ty-=wrap(purp,F.italic,10,bW-44).length*14+6;
  page.drawText(done,{x:bx+18,y:ty,size:10,font:F.boldItalic,color:gold});

  // Dual signatures
  const sY=by+46;
  page.drawLine({start:{x:bx+18,y:sY+10},end:{x:bx+152,y:sY+10},thickness:0.8,color:gold});
  await trySig(doc,page,settings,bx+18,sY+12,130,28);
  page.drawText(settings.signatory_name||'Head Teacher',{x:bx+18,y:sY-4,size:9,font:F.regular,color:ltGold});
  page.drawLine({start:{x:bx+bW-155,y:sY+10},end:{x:bx+bW-21,y:sY+10},thickness:0.8,color:gold});
  page.drawText((settings.school_name||'Director').substring(0,16),{x:bx+bW-155,y:sY-4,size:9,font:F.regular,color:ltGold});

  // Gold seal
  const mx=W/2,my=118;
  drawSunSeal(page,mx,my,40,32,25,24,gold,rgb(0.68,0.48,0.03),rgb(0.84,0.64,0.06));
  ['★','★','★'].forEach((s,i)=>page.drawText(s,{x:mx-22+i*14,y:my-5,size:12,font:F.bold,color:navy}));
}

// ════════════════════════════════════════════════════════════════
// DESIGN B — "Ivory Gold Classic" — landscape elegance
// ════════════════════════════════════════════════════════════════
async function designB(doc, page, student, template, settings, W, H, F) {
  const ivory=rgb(0.99,0.98,0.93), gold=rgb(0.76,0.56,0.02);
  const dGold=rgb(0.52,0.36,0.00), navy=rgb(0.05,0.14,0.40);
  const black=rgb(0.08,0.06,0.05);
  const vars=buildVars(student,template,settings);
  const sn=(settings.school_name||'SCHOOL NAME').toUpperCase();
  const nm=`${student.first_name} ${student.last_name}`;

  page.drawRectangle({x:0,y:0,width:W,height:H,color:ivory});
  if(settings.background_url){try{const buf=await fetchBuf(settings.background_url);const img=await embedImg(doc,buf);if(img)page.drawImage(img,{x:0,y:0,width:W,height:H,opacity:0.08});}catch{}}

  // Thick gold frame
  page.drawRectangle({x:10,y:10,width:W-20,height:H-20,borderColor:gold,borderWidth:5,color:rgb(1,1,1,0)});
  page.drawRectangle({x:20,y:20,width:W-40,height:H-40,borderColor:dGold,borderWidth:1,color:rgb(1,1,1,0)});
  page.drawRectangle({x:26,y:26,width:W-52,height:H-52,borderColor:gold,borderWidth:0.4,color:rgb(1,1,1,0)});

  // Corner flourishes
  [[10,H-30,20],[W-30,H-30,20],[10,10,20],[W-30,10,20]].forEach(([x,y,s])=>{
    page.drawRectangle({x,y,width:s,height:s,color:dGold});
    page.drawRectangle({x:x+3,y:y+3,width:s-6,height:s-6,color:ivory});
  });

  // Top ribbon
  page.drawRectangle({x:10,y:H-98,width:W-20,height:76,color:dGold});
  page.drawLine({start:{x:10,y:H-22},end:{x:W-10,y:H-22},thickness:2,color:gold});
  page.drawLine({start:{x:10,y:H-98},end:{x:W-10,y:H-98},thickness:2,color:gold});

  // School name on ribbon
  let snSz=22; while(F.bold.widthOfTextAtSize(sn,snSz)>W-260&&snSz>10) snSz--;
  ctrW(page,sn,H-64,snSz,F.bold,rgb(1,1,1),W);
  ctrW(page,'— EXCELLENCE · INTEGRITY · ACHIEVEMENT —',H-82,7.5,F.italic,gold,W);

  await tryLogo(doc,page,settings,30,H-92,62,62);

  // Photo
  const pW=138,pH=180,pX=W-pW-28,pY=H-pH-28;
  page.drawRectangle({x:pX-5,y:pY-5,width:pW+10,height:pH+10,borderColor:gold,borderWidth:2,color:ivory});
  await tryPhoto(doc,page,student,pX,pY,pW,pH);
  // Photo number
  page.drawRectangle({x:pX,y:pY-20,width:pW,height:20,color:dGold});
  const pn=`Photo: ${student.photo_number}`, pnW=F.bold.widthOfTextAtSize(pn,8);
  page.drawText(pn,{x:pX+(pW-pnW)/2,y:pY-14,size:8,font:F.bold,color:rgb(1,1,1)});

  // Certificate title
  const tY=H-128;
  ctrW(page,'C  E  R  T  I  F  I  C  A  T  E',tY,22,F.bold,navy,W);
  ctrW(page,'O F   C O M P L E T I O N',tY-20,13,F.semibold,gold,W);

  // Decorative divider
  const dlY=tY-34;
  page.drawLine({start:{x:60,y:dlY},end:{x:W/2-22,y:dlY},thickness:1,color:gold});
  page.drawRectangle({x:W/2-10,y:dlY-6,width:14,height:14,rotate:degrees(45),color:gold});
  page.drawLine({start:{x:W/2+22,y:dlY},end:{x:W-60,y:dlY},thickness:1,color:gold});

  ctrW(page,'This is to certify that',dlY-18,11,F.italic,rgb(0.38,0.32,0.20),W);

  // Student name — SCRIPT
  let nSz=42; while(F.script.widthOfTextAtSize(nm,nSz)>W-180&&nSz>20) nSz--;
  ctrW(page,nm,dlY-60,nSz,F.script,navy,W);
  const nlY=dlY-66;
  page.drawLine({start:{x:W/2-185,y:nlY},end:{x:W/2+185,y:nlY},thickness:1.5,color:gold});
  page.drawLine({start:{x:W/2-185,y:nlY-3},end:{x:W/2+185,y:nlY-3},thickness:0.4,color:dGold});

  const vars2=vars;
  const l1=fillVars(settings.cert_line1||'Has completed in {class} at',vars2)+' '+(settings.school_name||'');
  const l2=fillVars(settings.cert_line2||'in Academic year of {year}',vars2);
  const purp=fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars2);
  let by=nlY-20;
  wrap(l1,F.regular,13,W-180).forEach((ln,i)=>ctrW(page,ln,by-i*16,13,F.regular,black,W));
  by-=wrap(l1,F.regular,13,W-180).length*16+4;
  wrap(l2,F.regular,13,W-180).forEach((ln,i)=>ctrW(page,ln,by-i*16,13,F.regular,black,W));
  by-=wrap(l2,F.regular,13,W-180).length*16+14;
  wrap(purp,F.boldItalic,11,W-120).forEach((ln,i)=>ctrW(page,ln,by-i*14,11,F.boldItalic,black,W));
  by-=wrap(purp,F.boldItalic,11,W-120).length*14+10;
  ctrW(page,fillVars(settings.cert_done_text||'Done at {city} on {date}',vars2),by,11,F.boldItalic,black,W);

  // Footer
  const fY=42;
  page.drawText('DATE ISSUED',{x:44,y:fY+20,size:7,font:F.bold,color:dGold});
  page.drawLine({start:{x:44,y:fY+16},end:{x:185,y:fY+16},thickness:0.8,color:gold});
  page.drawText(fmtDate(),{x:44,y:fY+2,size:10,font:F.regular,color:black});

  const sigX=W/2-78;
  page.drawText('SIGNATURE',{x:sigX+20,y:fY+20,size:7,font:F.bold,color:dGold});
  page.drawLine({start:{x:sigX,y:fY+16},end:{x:sigX+155,y:fY+16},thickness:0.8,color:gold});
  await trySig(doc,page,settings,sigX+5,fY+18,140,28);
  const sName=settings.signatory_name||'Head Teacher';
  const sNW=F.regular.widthOfTextAtSize(sName,10);
  page.drawText(sName,{x:sigX+(155-sNW)/2,y:fY+2,size:10,font:F.regular,color:black});

  const stX=W-110,stY=fY+36;
  const had=await tryStamp(doc,page,settings,stX,stY,60);
  if(!had){drawSunSeal(page,stX,stY,30,23,17,16,dGold,gold,rgb(0.90,0.74,0.12));page.drawText('★★★',{x:stX-14,y:stY-5,size:10,font:F.bold,color:navy});}
}

// ════════════════════════════════════════════════════════════════
// DESIGN C — "Geometric Burgundy" — landscape with diagonal shapes
// ════════════════════════════════════════════════════════════════
async function designC(doc, page, student, template, settings, W, H, F) {
  const burg=rgb(0.42,0.02,0.07), dBurg=rgb(0.28,0.01,0.04);
  const gold=rgb(0.82,0.62,0.03), ltGray=rgb(0.92,0.90,0.91);
  const black=rgb(0.07,0.05,0.05);
  const vars=buildVars(student,template,settings);
  const sn=(settings.school_name||'SCHOOL NAME').toUpperCase();
  const nm=`${student.first_name} ${student.last_name}`;

  page.drawRectangle({x:0,y:0,width:W,height:H,color:rgb(1,1,1)});

  // Geometric panels TL
  page.drawRectangle({x:0,y:H-222,width:245,height:222,color:burg});
  page.drawRectangle({x:0,y:H-175,width:145,height:175,color:dBurg});
  page.drawRectangle({x:0,y:H-300,width:185,height:100,rotate:degrees(-14),color:ltGray});
  [[32,H-18,225,H-120],[48,H-8,240,H-110],[86,H-8,265,H-90]].forEach(([x1,y1,x2,y2])=>
    page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness:3.2,color:gold}));

  // Geometric panels BR
  page.drawRectangle({x:W-245,y:0,width:245,height:214,color:burg});
  page.drawRectangle({x:W-145,y:0,width:145,height:165,color:dBurg});
  page.drawRectangle({x:W-185,y:200,width:185,height:100,rotate:degrees(-14),color:ltGray});
  [[W-32,18,W-225,120],[W-48,8,W-240,110],[W-86,8,W-265,90]].forEach(([x1,y1,x2,y2])=>
    page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness:3.2,color:gold}));

  // Clean white center
  page.drawRectangle({x:198,y:0,width:W-396,height:H,color:rgb(1,1,1)});
  page.drawRectangle({x:0,y:H/2-215,width:W,height:430,color:rgb(1,1,1)});

  // Logo + school name
  await tryLogo(doc,page,settings,26,H-80,58,58);
  let snSz=20; while(F.bold.widthOfTextAtSize(sn,snSz)>W-350&&snSz>9) snSz--;
  ctrW(page,sn,H-44,snSz,F.bold,black,W);
  page.drawLine({start:{x:W/2-85,y:H-50},end:{x:W/2+85,y:H-50},thickness:1,color:gold});

  // Certificate header
  const certY=H-92;
  ctrW(page,'CERTIFICATE',certY,38,F.bold,black,W);
  ctrW(page,'OF  ACHIEVEMENT',certY-30,15,F.italic,black,W);

  // Medal top-right
  const mx=W-90,my=H-82;
  page.drawRectangle({x:mx-15,y:my-58,width:12,height:68,rotate:degrees(-7),color:burg});
  page.drawRectangle({x:mx+3,y:my-58,width:12,height:68,rotate:degrees(7),color:burg});
  drawSunSeal(page,mx,my,36,28,21,22,gold,rgb(0.88,0.68,0.08),rgb(0.94,0.76,0.12));
  page.drawText('★',{x:mx-7,y:my-6,size:15,font:F.bold,color:burg});

  // Photo left
  const pW=118,pH=158,pX=68,pY=H-pH-232;
  page.drawRectangle({x:pX-3,y:pY-3,width:pW+6,height:pH+6,borderColor:gold,borderWidth:1.5,color:rgb(1,1,1,0)});
  await tryPhoto(doc,page,student,pX,pY,pW,pH);

  ctrW(page,'This certificate is presented to',certY-66,12,F.italic,rgb(0.35,0.35,0.35),W);

  // Script name
  let nSz=44; while(F.script.widthOfTextAtSize(nm,nSz)>W-260&&nSz>22) nSz--;
  ctrW(page,nm,certY-66-nSz-6,nSz,F.script,black,W);
  page.drawLine({start:{x:W/2-205,y:certY-66-nSz-12},end:{x:W/2+205,y:certY-66-nSz-12},thickness:0.8,color:rgb(0.5,0.5,0.5)});

  const l1=fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2=fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const purp=fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  let by=certY-66-nSz-26;
  wrap(l1+' '+l2,F.regular,12,W-290).forEach((ln,i)=>ctrW(page,ln,by-i*16,12,F.regular,black,W));
  by-=wrap(l1+' '+l2,F.regular,12,W-290).length*16+10;
  wrap(purp,F.regular,11,W-270).forEach((ln,i)=>ctrW(page,ln,by-i*14,11,F.regular,black,W));
  by-=wrap(purp,F.regular,11,W-270).length*14+8;
  ctrW(page,fillVars(settings.cert_done_text||'Done at {city} on {date}',vars),by,11,F.boldItalic,black,W);

  // Signature
  const sigY=76,sigX=W/2-82;
  await trySig(doc,page,settings,sigX-5,sigY+10,136,32);
  const sName=settings.signatory_name||'Head Teacher';
  let sSz=16; while(F.script.widthOfTextAtSize(sName,sSz)>162&&sSz>10) sSz--;
  ctrW(page,sName,sigY+16,sSz,F.script,black,W);
  page.drawLine({start:{x:sigX,y:sigY+8},end:{x:sigX+165,y:sigY+8},thickness:0.8,color:rgb(0.4,0.4,0.4)});
  ctrW(page,'Signature',sigY-3,9,F.regular,rgb(0.45,0.45,0.45),W);
  ctrW(page,fmtDate(),52,12,F.bold,black,W);
  ctrW(page,'Date',38,9,F.regular,rgb(0.45,0.45,0.45),W);
}

// ════════════════════════════════════════════════════════════════
// DESIGN D — "Blue Diagonal Modern" — landscape with blue stripes
// ════════════════════════════════════════════════════════════════
async function designD(doc, page, student, template, settings, W, H, F) {
  const dBlue=rgb(0.08,0.22,0.52), mBlue=rgb(0.14,0.36,0.72);
  const ltBlue=rgb(0.83,0.89,0.98), gold=rgb(0.84,0.64,0.04), ltGold=rgb(0.95,0.82,0.32);
  const black=rgb(0.06,0.06,0.10);
  const vars=buildVars(student,template,settings);
  const sn=(settings.school_name||'SCHOOL NAME').toUpperCase();
  const nm=`${student.first_name} ${student.last_name}`;

  page.drawRectangle({x:0,y:0,width:W,height:H,color:rgb(1,1,1)});

  // Blue outer border
  page.drawRectangle({x:0,y:0,width:W,height:H,borderColor:dBlue,borderWidth:16,color:rgb(1,1,1,0)});
  page.drawRectangle({x:16,y:16,width:W-32,height:H-32,borderColor:rgb(1,1,1),borderWidth:4,color:rgb(1,1,1,0)});
  page.drawRectangle({x:20,y:20,width:W-40,height:H-40,borderColor:dBlue,borderWidth:1.2,color:rgb(1,1,1,0)});

  // Left diagonal stripes
  page.drawRectangle({x:16,y:H*0.12,width:30,height:H*0.76,rotate:degrees(-8),color:dBlue});
  page.drawRectangle({x:32,y:H*0.10,width:18,height:H*0.80,rotate:degrees(-8),color:mBlue});
  page.drawRectangle({x:22,y:H*0.18,width:94,height:H*0.64,rotate:degrees(-11),color:ltBlue});
  page.drawRectangle({x:55,y:H*0.09,width:22,height:H*0.82,rotate:degrees(-8),color:gold});
  page.drawRectangle({x:75,y:H*0.12,width:10,height:H*0.76,rotate:degrees(-8),color:ltGold});

  // Right diagonal stripes
  page.drawRectangle({x:W-46,y:H*0.12,width:30,height:H*0.76,rotate:degrees(-8),color:dBlue});
  page.drawRectangle({x:W-50,y:H*0.10,width:18,height:H*0.80,rotate:degrees(-8),color:mBlue});
  page.drawRectangle({x:W-116,y:H*0.18,width:94,height:H*0.64,rotate:degrees(-11),color:ltBlue});
  page.drawRectangle({x:W-77,y:H*0.09,width:22,height:H*0.82,rotate:degrees(-8),color:gold});
  page.drawRectangle({x:W-85,y:H*0.12,width:10,height:H*0.76,rotate:degrees(-8),color:ltGold});

  // White center clean
  page.drawRectangle({x:112,y:24,width:W-224,height:H-48,color:rgb(1,1,1)});

  // Logo + school
  await tryLogo(doc,page,settings,132,H-68,44,44);
  let snSz=11; while(F.bold.widthOfTextAtSize(sn,snSz)>90&&snSz>7) snSz--;
  page.drawText(sn,{x:132,y:H-80,size:snSz,font:F.bold,color:dBlue});

  // Photo right
  const pW=116,pH=152,pX=W-pW-124,pY=H-pH-26;
  page.drawRectangle({x:pX-3,y:pY-3,width:pW+6,height:pH+6,borderColor:dBlue,borderWidth:1.5,color:rgb(1,1,1,0)});
  await tryPhoto(doc,page,student,pX,pY,pW,pH);

  // Certificate title
  const titleY=H-62;
  ctrW(page,'C E R T I F I C A T E',titleY,26,F.bold,black,W);
  ctrW(page,'OF  ACHIEVEMENT',titleY-22,12,F.italic,black,W);
  // Diamonds
  [W/2-16,W/2-4,W/2+8].forEach(x=>page.drawRectangle({x,y:titleY-34,width:9,height:9,rotate:degrees(45),color:gold}));

  ctrW(page,'This Certificate Is Proudly Presented To',H-106,11,F.italic,rgb(0.35,0.35,0.35),W);

  // Script name
  let nSz=40; while(F.script.widthOfTextAtSize(nm,nSz)>W-240&&nSz>20) nSz--;
  ctrW(page,nm,H-106-nSz-8,nSz,F.script,black,W);
  page.drawLine({start:{x:W/2-215,y:H-106-nSz-14},end:{x:W/2+215,y:H-106-nSz-14},thickness:0.8,color:rgb(0.6,0.6,0.6)});

  const l1=fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2=fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const purp=fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  const done=fillVars(settings.cert_done_text||'Done at {city} on {date}',vars);
  let by=H-106-nSz-30;
  const bLines=wrap(l1+' '+l2+'. '+purp,F.regular,11.5,W-250);
  bLines.forEach((ln,i)=>ctrW(page,ln,by-i*15,11.5,F.regular,black,W));
  ctrW(page,done,by-bLines.length*15-10,11,F.boldItalic,black,W);

  // Ribbon badge
  const bx=W/2,by2=82;
  page.drawRectangle({x:bx-17,y:by2-46,width:14,height:56,rotate:degrees(-6),color:gold});
  page.drawRectangle({x:bx+3,y:by2-46,width:14,height:56,rotate:degrees(6),color:gold});
  drawSunSeal(page,bx,by2,32,25,19,20,gold,mBlue,dBlue);
  page.drawText('★',{x:bx-7,y:by2-5,size:14,font:F.bold,color:gold});

  // Dual signatures
  const sY=38;
  page.drawLine({start:{x:132,y:sY+10},end:{x:286,y:sY+10},thickness:0.8,color:rgb(0.5,0.5,0.5)});
  await trySig(doc,page,settings,134,sY+12,148,28);
  page.drawText(settings.signatory_name||'Head Teacher',{x:132,y:sY-3,size:9,font:F.regular,color:rgb(0.45,0.45,0.45)});
  page.drawLine({start:{x:W-286,y:sY+10},end:{x:W-132,y:sY+10},thickness:0.8,color:rgb(0.5,0.5,0.5)});
  page.drawText((settings.school_name||'Director').substring(0,16),{x:W-286,y:sY-3,size:9,font:F.regular,color:rgb(0.45,0.45,0.45)});
}

// ════════════════════════════════════════════════════════════════
// DISPATCHER + CONTROLLERS
// ════════════════════════════════════════════════════════════════
async function generateCertificatePDF(student, template, settings, designKey) {
  const doc = await PDFDocument.create();
  const isPortrait = (designKey === 'A' || designKey === 'a' || designKey === '1');
  const W = isPortrait ? 595.28 : 841.89;
  const H = isPortrait ? 841.89 : 595.28;
  const page = doc.addPage([W, H]);
  const F = await loadFonts(doc);

  const map = {
    'A': designA, 'a': designA, '1': designA,
    'B': designB, 'b': designB, '2': designB,
    'C': designC, 'c': designC, '3': designC,
    'D': designD, 'd': designD, '4': designD,
  };
  const fn = map[designKey] || designA;
  await fn(doc, page, student, template, settings, W, H, F);
  return await doc.save();
}

exports.generateCertificate = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { template, style = 'A' } = req.query;
    const { data: student, error } = await supabase.from('students').select('*')
      .eq('school_id', req.schoolId)
      .or(`id.eq.${studentId},photo_number.eq.${studentId}`)
      .single();
    if (error) throw new Error('Student not found');
    const usedTemplate = template || student.class || 'Top Class';
    const pdfBytes = await generateCertificatePDF(student, usedTemplate, req.school, style);
    await supabase.from('certificates').insert([{
      student_id: student.id, school_id: req.schoolId,
      template: usedTemplate, generated_at: new Date().toISOString(), printed_by: req.user.id,
    }]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="${student.photo_number}_${student.last_name}_cert.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('generateCertificate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.generateBatch = async (req, res) => {
  try {
    const { class: cls, year, template, style = 'A' } = req.query;
    let q = supabase.from('students').select('*')
      .eq('school_id', req.schoolId).eq('status', 'active');
    if (cls)  q = q.eq('class', cls);
    if (year) q = q.eq('year', year);
    const { data: students, error } = await q.order('photo_number');
    if (error) throw error;
    if (!students.length) return res.status(404).json({ success: false, error: 'No students found' });

    const merged = await PDFDocument.create();
    for (const s of students) {
      const t = template || s.class || 'Top Class';
      const bytes = await generateCertificatePDF(s, t, req.school, style);
      const cd = await PDFDocument.load(bytes);
      const [p] = await merged.copyPages(cd, [0]);
      merged.addPage(p);
      await supabase.from('certificates').insert([{
        student_id: s.id, school_id: req.schoolId,
        template: t, generated_at: new Date().toISOString(), printed_by: req.user.id,
      }]);
    }
    const label = cls ? `${cls}_` : 'all_';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="${label}certificates_${year || new Date().getFullYear()}.pdf"`);
    res.send(Buffer.from(await merged.save()));
  } catch (err) {
    console.error('generateBatch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getCertificates = async (req, res) => {
  try {
    const { data, error } = await supabase.from('certificates')
      .select('*, students(first_name, last_name, photo_number, class)')
      .eq('school_id', req.schoolId)
      .order('generated_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
