const { supabase } = require('../supabase');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const https = require('https');
const http  = require('http');

// ════════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════════
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
// Center text horizontally within [minX, maxX]
function ctr(page, text, y, size, font, color, maxX, minX = 0) {
  const w = font.widthOfTextAtSize(text, size);
  const cx = minX + (maxX - minX) / 2;
  page.drawText(text, { x: cx - w/2, y, size, font, color });
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
async function tryLoadLogo(doc, page, settings, x, y, w, h) {
  if (!settings.logo_url) return;
  try {
    const buf = await fetchBuf(settings.logo_url);
    const img = await embedImg(doc, buf);
    if (img) page.drawImage(img, { x, y, width: w, height: h });
  } catch {}
}
async function tryLoadPhoto(doc, page, student, x, y, w, h) {
  if (!student.photo_url) {
    page.drawRectangle({ x, y, width:w, height:h, color:rgb(0.88,0.88,0.88) });
    return;
  }
  try {
    const buf = await fetchBuf(student.photo_url);
    const img = await embedImg(doc, buf);
    if (img) { page.drawImage(img, { x, y, width:w, height:h }); return; }
  } catch {}
  page.drawRectangle({ x, y, width:w, height:h, color:rgb(0.88,0.88,0.88) });
}
async function tryLoadSignature(doc, page, settings, x, y, w, h) {
  if (!settings.signature_url) return;
  try {
    const buf = await fetchBuf(settings.signature_url);
    const img = await embedImg(doc, buf);
    if (img) page.drawImage(img, { x, y, width:w, height:h, opacity:0.88 });
  } catch {}
}
async function tryLoadStamp(doc, page, settings, x, y, size) {
  if (!settings.stamp_url) return false;
  try {
    const buf = await fetchBuf(settings.stamp_url);
    const img = await embedImg(doc, buf);
    if (img) { page.drawImage(img, { x:x-size/2, y:y-size/2, width:size, height:size, opacity:0.82 }); return true; }
  } catch {}
  return false;
}
// Draw a "gear/sun" seal
function drawSeal(page, cx, cy, outerR, innerR, teeth, color, innerColor) {
  for (let i = 0; i < teeth; i++) {
    const a = (Math.PI * 2 * i) / teeth;
    const r = outerR;
    page.drawCircle({ x: cx + Math.cos(a)*r, y: cy + Math.sin(a)*r, size: outerR*0.18, color });
  }
  page.drawCircle({ x:cx, y:cy, size:outerR, color });
  page.drawCircle({ x:cx, y:cy, size:innerR, color:innerColor });
}

// ════════════════════════════════════════════════════════════════
// DESIGN A — "Midnight Navy" (portrait) — inspired by uploaded image
// Deep navy bg, gold V-curves at bottom, gold seal, dual sig
// ════════════════════════════════════════════════════════════════
async function designA(doc, page, student, template, settings, W, H, fonts) {
  const { B, R, BI, I } = fonts;
  const navy   = rgb(0.04, 0.10, 0.30);
  const gold   = rgb(0.85, 0.65, 0.05);
  const ltGold = rgb(0.96, 0.82, 0.38);
  const white  = rgb(1, 1, 1);
  const vars   = buildVars(student, template, settings);
  const sn     = (settings.school_name||'SCHOOL NAME').toUpperCase();
  const nm     = `${student.first_name} ${student.last_name}`;
  const today  = fmtDate();

  // Full navy background
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:navy });

  // Dot-grid texture corners
  for (let r=0; r<7; r++) for (let c=0; c<7; c++) {
    const d = Math.sqrt(r*r+c*c);
    if (d<8) {
      const op = 0.12 + 0.04*(7-d);
      page.drawCircle({ x:22+c*14, y:22+r*14, size:2.2, color:rgb(0.25,0.45,0.75) });
      page.drawCircle({ x:W-22-c*14, y:22+r*14, size:2.2, color:rgb(0.25,0.45,0.75) });
    }
  }

  // Outer gold border (double)
  page.drawRectangle({ x:16, y:16, width:W-32, height:H-32, borderColor:gold, borderWidth:2.5, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:22, y:22, width:W-44, height:H-44, borderColor:rgb(0.70,0.50,0.02), borderWidth:0.6, color:rgb(1,1,1,0) });

  // Top-left diagonal gold swoosh
  page.drawLine({ start:{x:0,y:H-60}, end:{x:140,y:H+10}, thickness:50, color:gold });
  page.drawLine({ start:{x:0,y:H-80}, end:{x:160,y:H+10}, thickness:18, color:ltGold });
  page.drawLine({ start:{x:0,y:H-45}, end:{x:110,y:H+10}, thickness:8, color:rgb(0.55,0.38,0.01) });
  // Top-right
  page.drawLine({ start:{x:W,y:H-60}, end:{x:W-140,y:H+10}, thickness:50, color:gold });
  page.drawLine({ start:{x:W,y:H-80}, end:{x:W-160,y:H+10}, thickness:18, color:ltGold });
  page.drawLine({ start:{x:W,y:H-45}, end:{x:W-110,y:H+10}, thickness:8, color:rgb(0.55,0.38,0.01) });

  // Bottom V gold curves
  page.drawLine({ start:{x:0,y:215}, end:{x:W/2,y:88}, thickness:50, color:gold });
  page.drawLine({ start:{x:W,y:215}, end:{x:W/2,y:88}, thickness:50, color:gold });
  page.drawLine({ start:{x:0,y:198}, end:{x:W/2,y:72}, thickness:20, color:ltGold });
  page.drawLine({ start:{x:W,y:198}, end:{x:W/2,y:72}, thickness:20, color:ltGold });

  // Re-fill navy center to clean overlaps
  page.drawRectangle({ x:26, y:210, width:W-52, height:H-340, color:navy });
  page.drawRectangle({ x:26, y:H-195, width:W-52, height:150, color:navy });

  // Redraw borders on top
  page.drawRectangle({ x:16, y:16, width:W-32, height:H-32, borderColor:gold, borderWidth:2.5, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:22, y:22, width:W-44, height:H-44, borderColor:rgb(0.70,0.50,0.02), borderWidth:0.6, color:rgb(1,1,1,0) });

  // Logo centered top
  await tryLoadLogo(doc, page, settings, (W-52)/2, H-95, 52, 52);

  // School name
  let snSz=13; while(B.widthOfTextAtSize(sn,snSz)>W-90&&snSz>7) snSz--;
  ctr(page, sn, H-105, snSz, B, gold, W);
  page.drawLine({ start:{x:W/2-60,y:H-110}, end:{x:W/2+60,y:H-110}, thickness:0.6, color:ltGold });

  // CERTIFICATE
  ctr(page, 'CERTIFICATE', H-158, 42, B, gold, W);
  ctr(page, 'OF  ACHIEVEMENT', H-184, 15, B, gold, W);

  // Inner content box
  const bx=36, by=218, bW=W-72, bH=H-340;
  page.drawRectangle({ x:bx, y:by, width:bW, height:bH, borderColor:gold, borderWidth:1.2, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:bx+4, y:by+4, width:bW-8, height:bH-8, borderColor:rgb(0.65,0.46,0.02), borderWidth:0.4, color:rgb(1,1,1,0) });

  // Photo (top-right inside box)
  const pW=108, pH=138, pX=bx+bW-pW-14, pY=by+bH-pH-14;
  page.drawRectangle({ x:pX-3, y:pY-3, width:pW+6, height:pH+6, borderColor:gold, borderWidth:1.5, color:rgb(1,1,1,0) });
  await tryLoadPhoto(doc, page, student, pX, pY, pW, pH);

  // "This Certificate Is Proudly Presented To"
  const presY = by+bH-30;
  const presT = 'This Certificate Is Proudly Presented To';
  let presSz=10; while(I.widthOfTextAtSize(presT,presSz)>bW-pW-50&&presSz>7) presSz--;
  page.drawText(presT, { x:bx+18, y:presY, size:presSz, font:I, color:ltGold });

  // Student name
  let nSz=28; while(BI.widthOfTextAtSize(nm,nSz)>bW-pW-50&&nSz>13) nSz--;
  page.drawText(nm, { x:bx+18, y:presY-nSz-8, size:nSz, font:BI, color:gold });
  page.drawLine({ start:{x:bx+18,y:presY-nSz-13}, end:{x:bx+bW-pW-30,y:presY-nSz-13}, thickness:0.8, color:rgb(0.55,0.42,0.12) });

  // Body text
  const l1 = fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2 = fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const purp = fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  const done = fillVars(settings.cert_done_text||'Done at {city} on {date}',vars);
  let ty = presY - nSz - 28;
  wrap(l1+' '+l2+'. '+purp, I, 10.5, bW-40).forEach((ln,i) => {
    page.drawText(ln, { x:bx+18, y:ty-i*14, size:10.5, font:I, color:ltGold });
  });
  ty = ty - wrap(l1+' '+l2+'. '+purp,I,10.5,bW-40).length*14 - 8;
  page.drawText(done, { x:bx+18, y:ty, size:10, font:BI, color:gold });

  // Dual signatures
  const sigY = by+48;
  page.drawLine({ start:{x:bx+18,y:sigY+10}, end:{x:bx+148,y:sigY+10}, thickness:0.8, color:gold });
  await tryLoadSignature(doc, page, settings, bx+18, sigY+12, 128, 28);
  const sn2 = settings.signatory_name||'Head Teacher';
  page.drawText(sn2, { x:bx+18, y:sigY-3, size:9, font:I, color:ltGold });

  page.drawLine({ start:{x:bx+bW-152,y:sigY+10}, end:{x:bx+bW-22,y:sigY+10}, thickness:0.8, color:gold });
  const rSig = (settings.school_name||'Director').substring(0,16);
  page.drawText(rSig, { x:bx+bW-152, y:sigY-3, size:9, font:I, color:ltGold });

  // Gold seal bottom center
  const mx=W/2, my=115;
  for (let a=0; a<360; a+=13) {
    const rad=Math.PI*a/180;
    page.drawCircle({ x:mx+Math.cos(rad)*40, y:my+Math.sin(rad)*40, size:5.5, color:gold });
  }
  page.drawCircle({ x:mx, y:my, size:38, color:gold });
  page.drawCircle({ x:mx, y:my, size:31, color:rgb(0.68,0.48,0.03) });
  page.drawCircle({ x:mx, y:my, size:24, color:rgb(0.84,0.64,0.06) });
  ['★','★','★'].forEach((s,i) => {
    page.drawText(s, { x:mx-22+i*14, y:my-5, size:11, font:B, color:navy });
  });
}

// ════════════════════════════════════════════════════════════════
// DESIGN B — "Ivory Gold Classic" — landscape, pure elegance
// White/ivory bg, ornate gold frame with corner flourishes,
// centered layout, large script name, ribbon seal
// ════════════════════════════════════════════════════════════════
async function designB(doc, page, student, template, settings, W, H, fonts) {
  const { B, R, BI, I } = fonts;
  const ivory  = rgb(0.99, 0.98, 0.93);
  const gold   = rgb(0.76, 0.56, 0.02);
  const dGold  = rgb(0.52, 0.36, 0.00);
  const navy   = rgb(0.05, 0.14, 0.40);
  const black  = rgb(0.08, 0.06, 0.05);
  const vars   = buildVars(student, template, settings);
  const sn     = (settings.school_name||'SCHOOL NAME').toUpperCase();
  const nm     = `${student.first_name} ${student.last_name}`;

  // Ivory background
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:ivory });

  // Background image
  if (settings.background_url) {
    try {
      const buf = await fetchBuf(settings.background_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:0, y:0, width:W, height:H, opacity:0.10 });
    } catch {}
  }

  // Thick gold outer frame
  page.drawRectangle({ x:10, y:10, width:W-20, height:H-20, borderColor:gold, borderWidth:5, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:20, y:20, width:W-40, height:H-40, borderColor:dGold, borderWidth:1, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:25, y:25, width:W-50, height:H-50, borderColor:gold, borderWidth:0.4, color:rgb(1,1,1,0) });

  // Corner flourish squares
  const cs = 20;
  [[10,H-10-cs],[W-10-cs,H-10-cs],[10,10],[W-10-cs,10]].forEach(([x,y]) => {
    page.drawRectangle({ x, y, width:cs, height:cs, color:dGold });
    page.drawRectangle({ x:x+3, y:y+3, width:cs-6, height:cs-6, color:ivory });
  });

  // Top gold ribbon bar
  page.drawRectangle({ x:10, y:H-95, width:W-20, height:72, color:dGold });
  page.drawRectangle({ x:10, y:H-96, width:W-20, height:2, color:gold });
  page.drawRectangle({ x:10, y:H-23, width:W-20, height:2, color:gold });

  // School name on ribbon
  let snSz=21; while(B.widthOfTextAtSize(sn,snSz)>W-250&&snSz>10) snSz--;
  ctr(page, sn, H-66, snSz, B, rgb(1,1,1), W);
  // Tagline
  ctr(page, '— E X C E L L E N C E   ·   I N T E G R I T Y   ·   A C H I E V E M E N T —', H-82, 8, I, gold, W);

  // Logo on ribbon (left)
  await tryLoadLogo(doc, page, settings, 28, H-90, 60, 60);

  // Photo (top right)
  const pW=138, pH=178, pX=W-pW-28, pY=H-pH-28;
  page.drawRectangle({ x:pX-5, y:pY-5, width:pW+10, height:pH+10, borderColor:gold, borderWidth:2, color:ivory });
  page.drawRectangle({ x:pX-2, y:pY-2, width:pW+4, height:pH+4, borderColor:dGold, borderWidth:0.5, color:rgb(1,1,1,0) });
  await tryLoadPhoto(doc, page, student, pX, pY, pW, pH);

  // Photo number label
  page.drawRectangle({ x:pX, y:pY-20, width:pW, height:20, color:dGold });
  const pnTxt = `No: ${student.photo_number}`;
  const pnW = B.widthOfTextAtSize(pnTxt,8);
  page.drawText(pnTxt, { x:pX+(pW-pnW)/2, y:pY-14, size:8, font:B, color:rgb(1,1,1) });

  // CERTIFICATE title
  const tY = H-124;
  ctr(page, 'C  E  R  T  I  F  I  C  A  T  E', tY, 22, B, navy, W);
  ctr(page, 'O F   C O M P L E T I O N', tY-20, 13, B, gold, W);

  // Decorative line with diamond
  const dlY = tY-32;
  page.drawLine({ start:{x:60,y:dlY}, end:{x:W/2-20,y:dlY}, thickness:1, color:gold });
  page.drawRectangle({ x:W/2-8,y:dlY-5,width:12,height:12,rotate:degrees(45), color:gold });
  page.drawLine({ start:{x:W/2+20,y:dlY}, end:{x:W-60,y:dlY}, thickness:1, color:gold });

  // Presented to
  ctr(page, 'This is to certify that', dlY-18, 11, I, rgb(0.35,0.35,0.35), W);

  // Student name — large
  let nSz=38; while(BI.widthOfTextAtSize(nm,nSz)>W-160&&nSz>18) nSz--;
  ctr(page, nm, dlY-58, nSz, BI, navy, W);
  const nlY = dlY-63;
  page.drawLine({ start:{x:W/2-180,y:nlY}, end:{x:W/2+180,y:nlY}, thickness:1.5, color:gold });
  page.drawLine({ start:{x:W/2-180,y:nlY-3}, end:{x:W/2+180,y:nlY-3}, thickness:0.4, color:dGold });

  // Body
  const l1 = fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2 = fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const by = nlY-20;
  wrap(l1, R, 13, W-170).forEach((ln,i)=>ctr(page,ln,by-i*16,13,R,black,W));
  const l2y = by-wrap(l1,R,13,W-170).length*16-4;
  wrap(l2, R, 13, W-170).forEach((ln,i)=>ctr(page,ln,l2y-i*16,13,R,black,W));

  const py2 = l2y-wrap(l2,R,13,W-170).length*16-14;
  const purp = fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  wrap(purp, BI, 11, W-120).forEach((ln,i)=>ctr(page,ln,py2-i*14,11,BI,black,W));
  const dy = py2-wrap(purp,BI,11,W-120).length*14-10;
  ctr(page, fillVars(settings.cert_done_text||'Done at {city} on {date}',vars), dy, 11, BI, black, W);

  // Footer
  const fY = 44;
  // Date
  page.drawText('DATE', { x:44, y:fY+18, size:7, font:B, color:dGold });
  page.drawLine({ start:{x:44,y:fY+14}, end:{x:180,y:fY+14}, thickness:0.8, color:gold });
  page.drawText(fmtDate(), { x:44, y:fY+2, size:10, font:R, color:black });

  // Signature center
  const sigX = W/2-75;
  page.drawText('SIGNATURE', { x:sigX+18, y:fY+18, size:7, font:B, color:dGold });
  page.drawLine({ start:{x:sigX,y:fY+14}, end:{x:sigX+150,y:fY+14}, thickness:0.8, color:gold });
  await tryLoadSignature(doc, page, settings, sigX+5, fY+16, 130, 28);
  const sName = settings.signatory_name||'Head Teacher';
  const sNW = R.widthOfTextAtSize(sName,10);
  page.drawText(sName, { x:sigX+(150-sNW)/2, y:fY+2, size:10, font:R, color:black });

  // Stamp / seal right
  const stX = W-110, stY = fY+35;
  const hadStamp = await tryLoadStamp(doc, page, settings, stX, stY, 60);
  if (!hadStamp) {
    drawSeal(page, stX, stY, 32, 24, 18, dGold, gold);
    page.drawText('★★★', { x:stX-12, y:stY-5, size:10, font:B, color:navy });
  }
}

// ════════════════════════════════════════════════════════════════
// DESIGN C — "Geometric Diagonal" — landscape, burgundy+gold shapes
// Matching image 1 style: diagonal colored panels top-left & bottom-right
// ════════════════════════════════════════════════════════════════
async function designC(doc, page, student, template, settings, W, H, fonts) {
  const { B, R, BI, I } = fonts;
  const burg   = rgb(0.42, 0.02, 0.07);
  const dBurg  = rgb(0.28, 0.01, 0.04);
  const gold   = rgb(0.82, 0.62, 0.03);
  const ltGray = rgb(0.92, 0.90, 0.91);
  const black  = rgb(0.07, 0.05, 0.05);
  const vars   = buildVars(student, template, settings);
  const sn     = (settings.school_name||'SCHOOL NAME').toUpperCase();
  const nm     = `${student.first_name} ${student.last_name}`;

  // White background
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:rgb(1,1,1) });

  // ── TOP-LEFT geometric panels ─────────────────────────────
  // Large dark burgundy triangle area
  page.drawRectangle({ x:0, y:H-220, width:240, height:220, color:burg });
  page.drawRectangle({ x:0, y:H-170, width:140, height:170, color:dBurg });
  page.drawRectangle({ x:0, y:H-90, width:60, height:90, color:rgb(0.20,0.00,0.03) });
  // Light gray diagonal stripe top-left
  page.drawRectangle({ x:0, y:H-320, width:180, height:120, rotate:degrees(-15), color:ltGray });
  // Gold diagonal lines
  [[30,H-18,220,H-118],[45,H-8,235,H-108],[80,H-8,260,H-88]].forEach(([x1,y1,x2,y2]) =>
    page.drawLine({ start:{x:x1,y:y1}, end:{x:x2,y:y2}, thickness:3, color:gold })
  );

  // ── BOTTOM-RIGHT geometric panels ────────────────────────
  page.drawRectangle({ x:W-240, y:0, width:240, height:210, color:burg });
  page.drawRectangle({ x:W-140, y:0, width:140, height:160, color:dBurg });
  page.drawRectangle({ x:W-60, y:0, width:60, height:90, color:rgb(0.20,0.00,0.03) });
  page.drawRectangle({ x:W-180, y:200, width:180, height:120, rotate:degrees(-15), color:ltGray });
  // Gold diagonal lines bottom-right
  [[W-30,18,W-220,118],[W-45,8,W-235,108],[W-80,8,W-260,88]].forEach(([x1,y1,x2,y2]) =>
    page.drawLine({ start:{x:x1,y:y1}, end:{x:x2,y:y2}, thickness:3, color:gold })
  );

  // White clean center stripe
  page.drawRectangle({ x:200, y:0, width:W-400, height:H, color:rgb(1,1,1) });
  page.drawRectangle({ x:0, y:H/2-200, width:W, height:400, color:rgb(1,1,1) });

  // Logo top-left
  await tryLoadLogo(doc, page, settings, 26, H-78, 58, 58);

  // School name top center
  let snSz=20; while(B.widthOfTextAtSize(sn,snSz)>W-350&&snSz>9) snSz--;
  ctr(page, sn, H-44, snSz, B, black, W);
  page.drawLine({ start:{x:W/2-80,y:H-50}, end:{x:W/2+80,y:H-50}, thickness:1, color:gold });

  // CERTIFICATE header
  const certY = H-90;
  ctr(page, 'CERTIFICATE', certY, 38, B, black, W);
  ctr(page, 'OF  ACHIEVEMENT', certY-30, 15, I, black, W);

  // Medal/seal top-right
  const mx = W-88, my = H-82;
  // Ribbon
  page.drawRectangle({ x:mx-16,y:my-56,width:13,height:65, rotate:degrees(-7), color:burg });
  page.drawRectangle({ x:mx+3, y:my-56,width:13,height:65, rotate:degrees(7),  color:burg });
  // Seal
  for (let a=0; a<360; a+=16) {
    const rad=Math.PI*a/180;
    page.drawCircle({ x:mx+Math.cos(rad)*36, y:my+Math.sin(rad)*36, size:5, color:gold });
  }
  page.drawCircle({ x:mx, y:my, size:34, color:gold });
  page.drawCircle({ x:mx, y:my, size:26, color:rgb(0.88,0.68,0.08) });
  page.drawCircle({ x:mx, y:my, size:19, color:rgb(0.94,0.76,0.12) });
  page.drawText('★', { x:mx-6,y:my-5, size:14, font:B, color:burg });

  // Photo (left side)
  const pW=118, pH=155, pX=68, pY=H-pH-230;
  page.drawRectangle({ x:pX-3,y:pY-3,width:pW+6,height:pH+6, borderColor:gold, borderWidth:1.5, color:rgb(1,1,1,0) });
  await tryLoadPhoto(doc, page, student, pX, pY, pW, pH);

  // "This certificate is presented to"
  const presY = certY-66;
  ctr(page, 'This certificate is presented to', presY, 12, I, rgb(0.35,0.35,0.35), W);

  // Student name large
  let nSz=36; while(BI.widthOfTextAtSize(nm,nSz)>W-250&&nSz>16) nSz--;
  ctr(page, nm, presY-nSz-8, nSz, BI, black, W);
  page.drawLine({ start:{x:W/2-200,y:presY-nSz-14}, end:{x:W/2+200,y:presY-nSz-14}, thickness:0.8, color:rgb(0.5,0.5,0.5) });

  const l1 = fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2 = fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const by = presY-nSz-28;
  wrap(l1+' '+l2, R, 12, W-280).forEach((ln,i)=>ctr(page,ln,by-i*16,12,R,black,W));

  const purp = fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  const py2 = by-wrap(l1+' '+l2,R,12,W-280).length*16-12;
  wrap(purp,R,11,W-260).forEach((ln,i)=>ctr(page,ln,py2-i*14,11,R,black,W));
  ctr(page, fillVars(settings.cert_done_text||'Done at {city} on {date}',vars), py2-wrap(purp,R,11,W-260).length*14-10, 11, BI, black, W);

  // Signature
  const sigY = 76;
  const sigX = W/2-80;
  await tryLoadSignature(doc, page, settings, sigX-8, sigY+10, 130, 32);
  page.drawLine({ start:{x:sigX,y:sigY+8}, end:{x:sigX+160,y:sigY+8}, thickness:0.8, color:rgb(0.4,0.4,0.4) });
  const sName = settings.signatory_name||'Head Teacher';
  let sSz=14; while(BI.widthOfTextAtSize(sName,sSz)>155&&sSz>9) sSz--;
  const sNW = BI.widthOfTextAtSize(sName,sSz);
  page.drawText(sName, { x:sigX+(160-sNW)/2, y:sigY+18, size:sSz, font:BI, color:black });
  page.drawText('Signature', { x:sigX+(160-R.widthOfTextAtSize('Signature',9))/2, y:sigY-3, size:9, font:R, color:rgb(0.45,0.45,0.45) });

  // Date below
  ctr(page, fmtDate(), 52, 12, B, black, W);
  ctr(page, 'Date', 38, 9, R, rgb(0.45,0.45,0.45), W);
}

// ════════════════════════════════════════════════════════════════
// DESIGN D — "Blue Diagonal Modern" — landscape, matching image 2
// Blue+gold diagonal corner stripes, white center, ribbon badge
// ════════════════════════════════════════════════════════════════
async function designD(doc, page, student, template, settings, W, H, fonts) {
  const { B, R, BI, I } = fonts;
  const dBlue  = rgb(0.08, 0.22, 0.52);
  const mBlue  = rgb(0.14, 0.36, 0.72);
  const ltBlue = rgb(0.82, 0.88, 0.98);
  const gold   = rgb(0.84, 0.64, 0.04);
  const ltGold = rgb(0.94, 0.80, 0.30);
  const black  = rgb(0.06, 0.06, 0.10);
  const vars   = buildVars(student, template, settings);
  const sn     = (settings.school_name||'SCHOOL NAME').toUpperCase();
  const nm     = `${student.first_name} ${student.last_name}`;

  // White background
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:rgb(1,1,1) });

  // Dark blue outer border (thick)
  page.drawRectangle({ x:0, y:0, width:W, height:H, borderColor:dBlue, borderWidth:15, color:rgb(1,1,1,0) });
  // White gap ring
  page.drawRectangle({ x:15, y:15, width:W-30, height:H-30, borderColor:rgb(1,1,1), borderWidth:4, color:rgb(1,1,1,0) });
  // Thin inner blue border
  page.drawRectangle({ x:19, y:19, width:W-38, height:H-38, borderColor:dBlue, borderWidth:1.2, color:rgb(1,1,1,0) });

  // LEFT diagonal stripe group
  page.drawRectangle({ x:14, y:H*0.12, width:26, height:H*0.76, rotate:degrees(-8), color:dBlue });
  page.drawRectangle({ x:28, y:H*0.10, width:16, height:H*0.80, rotate:degrees(-8), color:mBlue });
  // Gray diagonal background strip (left)
  page.drawRectangle({ x:19, y:H*0.20, width:88, height:H*0.60, rotate:degrees(-10), color:ltBlue });
  // Gold diagonal (left)
  page.drawRectangle({ x:52, y:H*0.09, width:20, height:H*0.82, rotate:degrees(-8), color:gold });
  page.drawRectangle({ x:70, y:H*0.12, width:9,  height:H*0.76, rotate:degrees(-8), color:ltGold });

  // RIGHT diagonal stripe group
  page.drawRectangle({ x:W-40, y:H*0.12, width:26, height:H*0.76, rotate:degrees(-8), color:dBlue });
  page.drawRectangle({ x:W-44, y:H*0.10, width:16, height:H*0.80, rotate:degrees(-8), color:mBlue });
  // Gray diagonal background strip (right)
  page.drawRectangle({ x:W-107, y:H*0.20, width:88, height:H*0.60, rotate:degrees(-10), color:ltBlue });
  // Gold diagonal (right)
  page.drawRectangle({ x:W-72, y:H*0.09, width:20, height:H*0.82, rotate:degrees(-8), color:gold });
  page.drawRectangle({ x:W-79, y:H*0.12, width:9,  height:H*0.76, rotate:degrees(-8), color:ltGold });

  // Clean white center
  page.drawRectangle({ x:106, y:22, width:W-212, height:H-44, color:rgb(1,1,1) });

  // School info top-left inside
  await tryLoadLogo(doc, page, settings, 128, H-68, 44, 44);

  // CERTIFICATE title
  const titleY = H-62;
  ctr(page, 'C E R T I F I C A T E', titleY, 26, B, black, W);
  ctr(page, 'OF ACHIEVEMENT', titleY-22, 12, I, black, W);

  // Diamond decorators
  [W/2-16, W/2-4, W/2+8].forEach(x => {
    page.drawRectangle({ x, y:titleY-34, width:8, height:8, rotate:degrees(45), color:gold });
  });

  // School name small (right of logo)
  let snSz=11; while(B.widthOfTextAtSize(sn,snSz)>90&&snSz>7) snSz--;
  page.drawText(sn, { x:130, y:H-80, size:snSz, font:B, color:dBlue });

  // Photo top-right inside
  const pW=115, pH=150, pX=W-pW-120, pY=H-pH-26;
  page.drawRectangle({ x:pX-3,y:pY-3,width:pW+6,height:pH+6, borderColor:dBlue, borderWidth:1.5, color:rgb(1,1,1,0) });
  await tryLoadPhoto(doc, page, student, pX, pY, pW, pH);

  // "proudly presented to"
  const presY = H-106;
  ctr(page, 'This Certificate Is Proudly Presented To', presY, 11, I, rgb(0.35,0.35,0.35), W);

  // Student name
  let nSz=34; while(BI.widthOfTextAtSize(nm,nSz)>W-230&&nSz>15) nSz--;
  ctr(page, nm, presY-nSz-8, nSz, BI, black, W);
  page.drawLine({ start:{x:W/2-210,y:presY-nSz-14}, end:{x:W/2+210,y:presY-nSz-14}, thickness:0.8, color:rgb(0.6,0.6,0.6) });

  // Body
  const l1 = fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2 = fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const purp = fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  const done = fillVars(settings.cert_done_text||'Done at {city} on {date}',vars);
  const by = presY-nSz-28;
  const bLines = wrap(l1+' '+l2+'. '+purp, R, 11.5, W-240);
  bLines.forEach((ln,i)=>ctr(page,ln,by-i*15,11.5,R,black,W));
  ctr(page, done, by-bLines.length*15-10, 11, BI, black, W);

  // Ribbon badge bottom center
  const bx=W/2, by2=82;
  page.drawRectangle({ x:bx-17,y:by2-44,width:13,height:55, rotate:degrees(-6), color:gold });
  page.drawRectangle({ x:bx+4, y:by2-44,width:13,height:55, rotate:degrees(6),  color:gold });
  for (let a=0; a<360; a+=16) {
    const rad=Math.PI*a/180;
    page.drawCircle({ x:bx+Math.cos(rad)*32, y:by2+Math.sin(rad)*32, size:4.5, color:gold });
  }
  page.drawCircle({ x:bx,y:by2,size:30, color:dBlue });
  page.drawCircle({ x:bx,y:by2,size:24, color:mBlue });
  page.drawCircle({ x:bx,y:by2,size:18, color:gold });
  page.drawText('★', { x:bx-6,y:by2-5, size:13, font:B, color:dBlue });

  // Dual signatures
  const sigY = 38;
  // Left
  page.drawLine({ start:{x:130,y:sigY+10}, end:{x:280,y:sigY+10}, thickness:0.8, color:rgb(0.5,0.5,0.5) });
  await tryLoadSignature(doc, page, settings, 132, sigY+12, 144, 28);
  page.drawText(settings.signatory_name||'Head Teacher', { x:130, y:sigY-3, size:9, font:R, color:rgb(0.45,0.45,0.45) });
  // Right
  page.drawLine({ start:{x:W-280,y:sigY+10}, end:{x:W-130,y:sigY+10}, thickness:0.8, color:rgb(0.5,0.5,0.5) });
  page.drawText((settings.school_name||'Director').substring(0,16), { x:W-280, y:sigY-3, size:9, font:R, color:rgb(0.45,0.45,0.45) });
}

// ════════════════════════════════════════════════════════════════
// DISPATCHER + CONTROLLERS
// ════════════════════════════════════════════════════════════════
async function generateCertificatePDF(student, template, settings, designKey='A') {
  const doc = await PDFDocument.create();
  // Design A is PORTRAIT (595×842), B/C/D are LANDSCAPE (842×595)
  const isPortrait = (designKey==='A' || designKey==='a' || designKey==='1');
  const W = isPortrait ? 595.28 : 841.89;
  const H = isPortrait ? 841.89 : 595.28;
  const page = doc.addPage([W, H]);
  const fonts = {
    B:  await doc.embedFont(StandardFonts.HelveticaBold),
    R:  await doc.embedFont(StandardFonts.Helvetica),
    BI: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    I:  await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const map = {
    'A':designA, 'a':designA, '1':designA,
    'B':designB, 'b':designB, '2':designB,
    'C':designC, 'c':designC, '3':designC,
    'D':designD, 'd':designD, '4':designD,
  };
  const fn = map[designKey] || designA;
  await fn(doc, page, student, template, settings, W, H, fonts);
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
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.generateBatch = async (req, res) => {
  try {
    const { class: cls, year, template, style = 'A' } = req.query;
    let q = supabase.from('students').select('*').eq('school_id', req.schoolId).eq('status', 'active');
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
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.getCertificates = async (req, res) => {
  try {
    const { data, error } = await supabase.from('certificates')
      .select('*, students(first_name, last_name, photo_number, class)')
      .eq('school_id', req.schoolId)
      .order('generated_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
