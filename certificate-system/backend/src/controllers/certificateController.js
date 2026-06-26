const { supabase } = require('../supabase');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const https = require('https');
const http  = require('http');

// ── Helpers ──────────────────────────────────────────────────
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
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxW) { if (cur) lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur); return lines;
}
function ordinal(n) {
  const s=['th','st','nd','rd'], v=n%100;
  return n+(s[(v-20)%10]||s[v]||s[0]);
}
function fmtDate(d=new Date()) {
  const M=['January','February','March','April','May','June',
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
function ctr(page, text, y, size, font, color, W) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x:(W-w)/2, y, size, font, color });
}

// ════════════════════════════════════════════════════════════════
// DESIGN 1 — "Presidential" — white + gold double frame, photo top-right
// ════════════════════════════════════════════════════════════════
async function design1(doc, page, student, template, settings, W, H, fonts) {
  const { B, R, BI, I } = fonts;
  const gold   = rgb(0.75, 0.55, 0.00);
  const navy   = rgb(0.06, 0.18, 0.50);
  const green  = rgb(0.04, 0.52, 0.18);
  const gray   = rgb(0.25, 0.25, 0.25);
  const black  = rgb(0.06, 0.06, 0.06);

  const vars = buildVars(student, template, settings);

  // White background
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:rgb(1,1,1) });

  // Gold outer frame
  page.drawRectangle({ x:8, y:8, width:W-16, height:H-16, borderColor:gold, borderWidth:4, color:rgb(1,1,1,0) });
  // Navy inner frame
  page.drawRectangle({ x:16, y:16, width:W-32, height:H-32, borderColor:navy, borderWidth:1.5, color:rgb(1,1,1,0) });
  // Gold thin inner
  page.drawRectangle({ x:20, y:20, width:W-40, height:H-40, borderColor:gold, borderWidth:0.5, color:rgb(1,1,1,0) });

  // Corner gold squares
  const cs = 14;
  [[10,H-10-cs],[W-10-cs,H-10-cs],[10,10],[W-10-cs,10]].forEach(([x,y]) =>
    page.drawRectangle({ x, y, width:cs, height:cs, color:gold })
  );

  // Top gold banner
  page.drawRectangle({ x:8, y:H-80, width:W-16, height:60, color:gold });

  // School name on gold banner
  const sn = (settings.school_name||'SCHOOL NAME').toUpperCase();
  let snSz = 22; while (B.widthOfTextAtSize(sn,snSz) > W-200 && snSz>10) snSz--;
  ctr(page, sn, H-62, snSz, B, rgb(1,1,1), W);

  // LOGO top-left on banner
  await drawLogo(doc, page, settings, 28, H-76, 52, 52);

  // PHOTO top-right
  const pW=130, pH=168, pX=W-pW-28, pY=H-pH-28;
  await drawPhoto(doc, page, student, pX, pY, pW, pH, navy, rgb(1,1,1,0));

  // CERTIFICATE OF COMPLETION — spaced
  const titleY = H-108;
  ctr(page, 'C E R T I F I C A T E   O F   C O M P L E T I O N', titleY, 14, BI, navy, W);

  // Gold decorative divider
  const dlY = titleY-10;
  page.drawLine({ start:{x:80,y:dlY}, end:{x:W-80,y:dlY}, thickness:0.8, color:gold });
  page.drawLine({ start:{x:100,y:dlY-3}, end:{x:W-100,y:dlY-3}, thickness:0.3, color:gold });

  // "This is to certify that"
  ctr(page, 'This is to certify that', dlY-20, 11, I, gray, W);

  // Student name
  const nm = `${student.first_name} ${student.last_name}`.toUpperCase();
  let nSz=36; while (B.widthOfTextAtSize(nm,nSz) > W-130 && nSz>18) nSz--;
  ctr(page, nm, dlY-58, nSz, B, green, W);

  // Body text
  const l1 = fillVars(settings.cert_line1||'Has completed in {class} at', vars) + ' ' + (settings.school_name||'');
  const l2 = fillVars(settings.cert_line2||'in Academic year of {year}', vars);
  const bodyY = dlY-58-nSz-10;
  const l1lines = wrap(l1, R, 13, W-120);
  l1lines.forEach((ln,i) => ctr(page, ln, bodyY-i*16, 13, R, black, W));
  const l2Y = bodyY - l1lines.length*16 - 4;
  wrap(l2, R, 13, W-120).forEach((ln,i) => ctr(page, ln, l2Y-i*16, 13, R, black, W));

  // Purpose text bold italic
  const pY2 = l2Y - wrap(l2,R,13,W-120).length*16 - 16;
  const purp = fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve', vars);
  wrap(purp, BI, 11, W-100).forEach((ln,i) => ctr(page, ln, pY2-i*14, 11, BI, black, W));

  // Done text
  const doneY = pY2 - wrap(purp,BI,11,W-100).length*14 - 10;
  const done = fillVars(settings.cert_done_text||'Done at {city} on {date}', vars);
  ctr(page, done, doneY, 11, BI, black, W);

  // Signature + stamp
  await drawFooter(doc, page, settings, W, H, gold, navy, B, R);
}

// ════════════════════════════════════════════════════════════════
// DESIGN 2 — "Emerald Ribbon" — deep green header ribbon, cream body
// ════════════════════════════════════════════════════════════════
async function design2(doc, page, student, template, settings, W, H, fonts) {
  const { B, R, BI, I } = fonts;
  const darkGreen = rgb(0.02, 0.38, 0.14);
  const midGreen  = rgb(0.04, 0.58, 0.22);
  const gold      = rgb(0.78, 0.58, 0.02);
  const black     = rgb(0.06, 0.06, 0.06);

  const vars = buildVars(student, template, settings);

  // Cream background
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:rgb(0.99, 0.98, 0.93) });

  // Side ribbons
  page.drawRectangle({ x:0, y:0, width:18, height:H, color:darkGreen });
  page.drawRectangle({ x:W-18, y:0, width:18, height:H, color:darkGreen });
  page.drawRectangle({ x:18, y:0, width:5, height:H, color:gold });
  page.drawRectangle({ x:W-23, y:0, width:5, height:H, color:gold });

  // Top ribbon
  page.drawRectangle({ x:0, y:H-90, width:W, height:90, color:darkGreen });
  page.drawRectangle({ x:0, y:H-96, width:W, height:6, color:gold });
  page.drawRectangle({ x:0, y:H-98, width:W, height:2, color:midGreen });

  // School name on ribbon
  const sn = (settings.school_name||'SCHOOL NAME').toUpperCase();
  let snSz=20; while (B.widthOfTextAtSize(sn,snSz)>W-260&&snSz>9) snSz--;
  ctr(page, sn, H-60, snSz, B, rgb(1,1,1), W);
  // Sub text on ribbon
  ctr(page, 'E X C E L L E N C E   I N   E D U C A T I O N', H-78, 8, I, gold, W);

  // Logo
  await drawLogo(doc, page, settings, 28, H-84, 62, 62);

  // Photo (right side, below ribbon)
  const pW=132, pH=170, pX=W-pW-30, pY=H-pH-100;
  await drawPhoto(doc, page, student, pX, pY, pH, pW, darkGreen, gold);

  // Certificate title
  const titleY = H-116;
  ctr(page, 'C E R T I F I C A T E   O F   C O M P L E T I O N', titleY, 13, BI, darkGreen, W);
  page.drawLine({ start:{x:70,y:titleY-8}, end:{x:W-70,y:titleY-8}, thickness:0.8, color:gold });

  // Certify
  ctr(page, 'This is to certify that', titleY-24, 11, I, rgb(0.35,0.35,0.35), W);

  // Name
  const nm = `${student.first_name} ${student.last_name}`.toUpperCase();
  let nSz=34; while(B.widthOfTextAtSize(nm,nSz)>W-140&&nSz>16) nSz--;
  ctr(page, nm, titleY-62, nSz, B, darkGreen, W);

  const l1 = fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2 = fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const by = titleY-62-nSz-12;
  const l1l = wrap(l1,R,13,W-130);
  l1l.forEach((ln,i) => ctr(page,ln,by-i*16,13,R,black,W));
  const l2y = by-l1l.length*16-4;
  wrap(l2,R,13,W-130).forEach((ln,i)=>ctr(page,ln,l2y-i*16,13,R,black,W));

  const py2 = l2y-wrap(l2,R,13,W-130).length*16-18;
  const purp = fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  wrap(purp,BI,11,W-100).forEach((ln,i)=>ctr(page,ln,py2-i*14,11,BI,black,W));
  const dy = py2-wrap(purp,BI,11,W-100).length*14-10;
  ctr(page, fillVars(settings.cert_done_text||'Done at {city} on {date}',vars), dy, 11, BI, black, W);

  await drawFooter(doc, page, settings, W, H, gold, darkGreen, B, R);
}

// ════════════════════════════════════════════════════════════════
// DESIGN 3 — "Sapphire Modern" — bold blue left panel + white right
// ════════════════════════════════════════════════════════════════
async function design3(doc, page, student, template, settings, W, H, fonts) {
  const { B, R, BI, I } = fonts;
  const sapph = rgb(0.06, 0.22, 0.62);
  const ltBlu = rgb(0.88, 0.93, 1.00);
  const gold  = rgb(0.80, 0.60, 0.02);
  const black = rgb(0.06, 0.06, 0.06);

  const vars = buildVars(student, template, settings);

  // White bg
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:rgb(1,1,1) });

  // Blue left panel
  const panelW = 260;
  page.drawRectangle({ x:0, y:0, width:panelW, height:H, color:sapph });
  page.drawRectangle({ x:panelW, y:0, width:6, height:H, color:gold });

  // Top bar full
  page.drawRectangle({ x:0, y:H-12, width:W, height:12, color:sapph });
  page.drawRectangle({ x:0, y:0, width:W, height:10, color:sapph });

  // School name on left panel top
  const sn = (settings.school_name||'SCHOOL NAME').toUpperCase();
  const snLines = wrap(sn, B, 15, panelW-30);
  snLines.forEach((ln,i) => {
    const w = B.widthOfTextAtSize(ln,15);
    page.drawText(ln, { x:(panelW-w)/2, y:H-50-i*20, size:15, font:B, color:rgb(1,1,1) });
  });

  // Gold line on panel
  page.drawLine({ start:{x:20,y:H-55-snLines.length*20}, end:{x:panelW-20,y:H-55-snLines.length*20}, thickness:1, color:gold });

  // Logo on panel
  await drawLogo(doc, page, settings, (panelW-70)/2, H-145, 70, 70);

  // Photo on panel (portrait)
  const pW=160, pH=210, pX=(panelW-pW)/2, pY=H-145-pH-20;
  await drawPhoto(doc, page, student, pX, pY, pW, pH, gold, ltBlu);

  // Right side content
  const rx = panelW+30, rW = W-panelW-50;

  // CERTIFICATE OF COMPLETION
  const titleY = H-55;
  const tTxt = 'C E R T I F I C A T E   O F   C O M P L E T I O N';
  let tSz=13; while(BI.widthOfTextAtSize(tTxt,tSz)>rW&&tSz>8) tSz--;
  page.drawText(tTxt, { x:rx, y:titleY, size:tSz, font:BI, color:sapph });
  page.drawLine({ start:{x:rx,y:titleY-8}, end:{x:W-25,y:titleY-8}, thickness:0.8, color:gold });

  // Certify
  page.drawText('This is to certify that', { x:rx, y:titleY-24, size:11, font:I, color:rgb(0.35,0.35,0.35) });

  // Name
  const nm = `${student.first_name} ${student.last_name}`.toUpperCase();
  let nSz=30; while(B.widthOfTextAtSize(nm,nSz)>rW&&nSz>14) nSz--;
  page.drawText(nm, { x:rx, y:titleY-58, size:nSz, font:B, color:sapph });
  page.drawLine({ start:{x:rx,y:titleY-62}, end:{x:W-25,y:titleY-62}, thickness:1.5, color:gold });
  page.drawLine({ start:{x:rx,y:titleY-65}, end:{x:W-25,y:titleY-65}, thickness:0.4, color:gold });

  const l1 = fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2 = fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const by = titleY-82;
  const l1l = wrap(l1,R,12,rW);
  l1l.forEach((ln,i)=>page.drawText(ln,{x:rx,y:by-i*16,size:12,font:R,color:black}));
  const l2y = by-l1l.length*16-4;
  wrap(l2,R,12,rW).forEach((ln,i)=>page.drawText(ln,{x:rx,y:l2y-i*16,size:12,font:R,color:black}));

  const py2 = l2y-wrap(l2,R,12,rW).length*16-20;
  const purp = fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  wrap(purp,BI,10.5,rW).forEach((ln,i)=>page.drawText(ln,{x:rx,y:py2-i*14,size:10.5,font:BI,color:black}));
  const dy = py2-wrap(purp,BI,10.5,rW).length*14-10;
  page.drawText(fillVars(settings.cert_done_text||'Done at {city} on {date}',vars),{x:rx,y:dy,size:10.5,font:BI,color:black});

  await drawFooter(doc, page, settings, W, H, gold, sapph, B, R);
}

// ════════════════════════════════════════════════════════════════
// DESIGN 4 — "Burgundy Prestige" — rich dark red, ornamental
// ════════════════════════════════════════════════════════════════
async function design4(doc, page, student, template, settings, W, H, fonts) {
  const { B, R, BI, I } = fonts;
  const burg  = rgb(0.48, 0.03, 0.08);
  const dBurg = rgb(0.32, 0.01, 0.05);
  const gold  = rgb(0.82, 0.62, 0.03);
  const cream = rgb(0.99, 0.97, 0.92);
  const black = rgb(0.08, 0.05, 0.05);

  const vars = buildVars(student, template, settings);

  // Cream bg
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:cream });

  // Thick burgundy top + bottom
  page.drawRectangle({ x:0, y:H-85, width:W, height:85, color:burg });
  page.drawRectangle({ x:0, y:0, width:W, height:55, color:burg });
  // Gold line separators
  [H-86, H-89, 54, 57].forEach(y =>
    page.drawLine({ start:{x:0,y}, end:{x:W,y}, thickness:y>100?2:1, color:gold })
  );

  // Side accents
  page.drawRectangle({ x:0, y:55, width:8, height:H-140, color:burg });
  page.drawRectangle({ x:W-8, y:55, width:8, height:H-140, color:burg });
  page.drawRectangle({ x:8, y:58, width:3, height:H-146, color:gold });
  page.drawRectangle({ x:W-11, y:58, width:3, height:H-146, color:gold });

  // School name
  const sn = (settings.school_name||'SCHOOL NAME').toUpperCase();
  let snSz=22; while(B.widthOfTextAtSize(sn,snSz)>W-230&&snSz>10) snSz--;
  ctr(page, sn, H-56, snSz, B, rgb(1,1,1), W);
  ctr(page, 'E X C E L L E N C E   ·   I N T E G R I T Y   ·   A C H I E V E M E N T', H-74, 7.5, I, gold, W);

  // Logo
  await drawLogo(doc, page, settings, 26, H-78, 60, 60);

  // Photo
  const pW=130, pH=168, pX=W-pW-26, pY=H-pH-95;
  await drawPhoto(doc, page, student, pX, pY, pW, pH, gold, rgb(1,1,1,0));

  // Title
  const tY = H-108;
  ctr(page, 'C E R T I F I C A T E   O F   C O M P L E T I O N', tY, 13.5, BI, burg, W);
  page.drawLine({ start:{x:60,y:tY-9}, end:{x:W-60,y:tY-9}, thickness:0.8, color:gold });
  page.drawLine({ start:{x:80,y:tY-12}, end:{x:W-80,y:tY-12}, thickness:0.3, color:burg });

  ctr(page, 'This is to certify that', tY-26, 11, I, rgb(0.38,0.28,0.28), W);

  const nm = `${student.first_name} ${student.last_name}`.toUpperCase();
  let nSz=34; while(B.widthOfTextAtSize(nm,nSz)>W-140&&nSz>16) nSz--;
  ctr(page, nm, tY-64, nSz, B, dBurg, W);

  const l1=fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2=fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const by=tY-64-nSz-10;
  const l1l=wrap(l1,R,13,W-130);
  l1l.forEach((ln,i)=>ctr(page,ln,by-i*16,13,R,black,W));
  const l2y=by-l1l.length*16-4;
  wrap(l2,R,13,W-130).forEach((ln,i)=>ctr(page,ln,l2y-i*16,13,R,black,W));

  const py2=l2y-wrap(l2,R,13,W-130).length*16-18;
  const purp=fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  wrap(purp,BI,11,W-100).forEach((ln,i)=>ctr(page,ln,py2-i*14,11,BI,black,W));
  const dy=py2-wrap(purp,BI,11,W-100).length*14-10;
  ctr(page,fillVars(settings.cert_done_text||'Done at {city} on {date}',vars),dy,11,BI,black,W);

  // Footer on burg bar
  await drawFooterOnDark(doc, page, settings, W, H, gold, B, R);
}

// ════════════════════════════════════════════════════════════════
// DESIGN 5 — "Midnight Gold" — deep navy full bg, gold text, premium
// ════════════════════════════════════════════════════════════════
async function design5(doc, page, student, template, settings, W, H, fonts) {
  const { B, R, BI, I } = fonts;
  const navy  = rgb(0.04, 0.08, 0.22);
  const gold  = rgb(0.88, 0.68, 0.08);
  const ltGold= rgb(0.98, 0.88, 0.60);
  const white = rgb(1,1,1);
  const offW  = rgb(0.90, 0.92, 0.98);

  const vars = buildVars(student, template, settings);

  // Navy bg
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:navy });

  // Gold borders
  page.drawRectangle({ x:10, y:10, width:W-20, height:H-20, borderColor:gold, borderWidth:2, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:15, y:15, width:W-30, height:H-30, borderColor:ltGold, borderWidth:0.5, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:19, y:19, width:W-38, height:H-38, borderColor:gold, borderWidth:0.3, color:rgb(1,1,1,0) });

  // Corner diamonds
  const drawDiamond = (cx, cy, sz) => {
    page.drawRectangle({ x:cx-sz/2, y:cy-sz/2, width:sz, height:sz, rotate:degrees(45), color:gold });
  };
  [28, W-28].forEach(x => [H-28, 28].forEach(y => drawDiamond(x, y, 10)));

  // School name top center
  const sn = (settings.school_name||'SCHOOL NAME').toUpperCase();
  let snSz=20; while(B.widthOfTextAtSize(sn,snSz)>W-240&&snSz>10) snSz--;
  ctr(page, sn, H-56, snSz, B, gold, W);
  ctr(page, '— OFFICIAL CERTIFICATE —', H-72, 8, I, ltGold, W);

  // Gold horizontal lines near top
  [H-78, H-81].forEach((y,i) =>
    page.drawLine({ start:{x:50,y}, end:{x:W-50,y}, thickness:i===0?1:0.3, color:gold })
  );

  // Logo
  await drawLogo(doc, page, settings, 28, H-75, 55, 55);

  // Photo with gold frame
  const pW=128, pH=165, pX=W-pW-28, pY=H-pH-28;
  page.drawRectangle({ x:pX-5, y:pY-5, width:pW+10, height:pH+10, borderColor:gold, borderWidth:2, color:rgb(1,1,1,0) });
  if (student.photo_url) {
    try {
      const buf = await fetchBuf(student.photo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:pX, y:pY, width:pW, height:pH });
    } catch {}
  }

  // Title
  const tY = H-100;
  ctr(page, 'C E R T I F I C A T E   O F   C O M P L E T I O N', tY, 13, BI, gold, W);
  page.drawLine({ start:{x:60,y:tY-8}, end:{x:W-60,y:tY-8}, thickness:0.8, color:gold });

  ctr(page, 'This is to certify that', tY-22, 11, I, offW, W);

  const nm = `${student.first_name} ${student.last_name}`.toUpperCase();
  let nSz=33; while(B.widthOfTextAtSize(nm,nSz)>W-140&&nSz>16) nSz--;
  ctr(page, nm, tY-58, nSz, B, gold, W);
  page.drawLine({ start:{x:80,y:tY-62}, end:{x:W-80,y:tY-62}, thickness:1, color:ltGold });

  const l1=fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2=fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const by=tY-78;
  const l1l=wrap(l1,R,12,W-130);
  l1l.forEach((ln,i)=>ctr(page,ln,by-i*15,12,R,white,W));
  const l2y=by-l1l.length*15-4;
  wrap(l2,R,12,W-130).forEach((ln,i)=>ctr(page,ln,l2y-i*15,12,R,white,W));

  const py2=l2y-wrap(l2,R,12,W-130).length*15-18;
  const purp=fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  wrap(purp,BI,10.5,W-100).forEach((ln,i)=>ctr(page,ln,py2-i*13,10.5,BI,ltGold,W));
  const dy=py2-wrap(purp,BI,10.5,W-100).length*13-10;
  ctr(page,fillVars(settings.cert_done_text||'Done at {city} on {date}',vars),dy,10.5,BI,ltGold,W);

  await drawFooterOnDark(doc, page, settings, W, H, gold, B, R);
}

// ── Shared utilities ──────────────────────────────────────────
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

async function drawLogo(doc, page, settings, x, y, w, h) {
  if (settings.logo_url) {
    try {
      const buf = await fetchBuf(settings.logo_url);
      const img = await embedImg(doc, buf);
      if (img) { page.drawImage(img, { x, y, width:w, height:h }); return; }
    } catch {}
  }
}

async function drawPhoto(doc, page, student, x, y, w, h, frameColor, innerColor) {
  page.drawRectangle({ x:x-4, y:y-4, width:w+8, height:h+8,
    borderColor:frameColor, borderWidth:2, color:rgb(1,1,1,0) });
  if (student.photo_url) {
    try {
      const buf = await fetchBuf(student.photo_url);
      const img = await embedImg(doc, buf);
      if (img) { page.drawImage(img, { x, y, width:w, height:h }); return; }
    } catch {}
  }
  page.drawRectangle({ x, y, width:w, height:h, color:rgb(0.90,0.90,0.90) });
}

async function drawFooter(doc, page, settings, W, H, accentColor, darkColor, B, R) {
  const sigY = 34;
  // Signature
  if (settings.signature_url) {
    try {
      const buf = await fetchBuf(settings.signature_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:70, y:sigY+8, width:110, height:28, opacity:0.85 });
    } catch {}
  }
  page.drawLine({ start:{x:65,y:sigY+4}, end:{x:190,y:sigY+4}, thickness:0.8, color:rgb(0.3,0.3,0.3) });
  const sn = settings.signatory_name||'Head Teacher';
  const snW = R.widthOfTextAtSize(sn,8);
  page.drawText(sn, { x:65+(125-snW)/2, y:sigY-7, size:8, font:R, color:rgb(0.3,0.3,0.3) });

  // Stamp
  const stX=W-120, stY=50;
  if (settings.stamp_url) {
    try {
      const buf = await fetchBuf(settings.stamp_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:stX-26, y:stY-26, width:54, height:54, opacity:0.80 });
    } catch {}
  } else {
    page.drawCircle({ x:stX, y:stY, size:24, borderColor:accentColor, borderWidth:1.5, color:rgb(1,1,1,0) });
    page.drawCircle({ x:stX, y:stY, size:18, borderColor:accentColor, borderWidth:0.7, color:rgb(1,1,1,0) });
    ['OFFICIAL','STAMP'].forEach((t,i)=>{
      const tw=B.widthOfTextAtSize(t,6);
      page.drawText(t,{x:stX-tw/2,y:stY+(i===0?4:-3),size:6,font:B,color:accentColor});
    });
  }
}

async function drawFooterOnDark(doc, page, settings, W, H, gold, B, R) {
  const sigY = 34;
  if (settings.signature_url) {
    try {
      const buf = await fetchBuf(settings.signature_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:70, y:sigY+8, width:110, height:28, opacity:0.85 });
    } catch {}
  }
  page.drawLine({ start:{x:65,y:sigY+4}, end:{x:190,y:sigY+4}, thickness:0.8, color:gold });
  const sn = settings.signatory_name||'Head Teacher';
  const snW = R.widthOfTextAtSize(sn,8);
  page.drawText(sn, { x:65+(125-snW)/2, y:sigY-7, size:8, font:R, color:gold });

  const stX=W-120, stY=50;
  if (settings.stamp_url) {
    try {
      const buf = await fetchBuf(settings.stamp_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:stX-26, y:stY-26, width:54, height:54, opacity:0.80 });
    } catch {}
  } else {
    page.drawCircle({ x:stX, y:stY, size:24, borderColor:gold, borderWidth:1.5, color:rgb(1,1,1,0) });
    page.drawCircle({ x:stX, y:stY, size:18, borderColor:gold, borderWidth:0.7, color:rgb(1,1,1,0) });
    ['OFFICIAL','STAMP'].forEach((t,i)=>{
      const tw=B.widthOfTextAtSize(t,6);
      page.drawText(t,{x:stX-tw/2,y:stY+(i===0?4:-3),size:6,font:B,color:gold});
    });
  }
}

// ── Main dispatcher ───────────────────────────────────────────
async function generateCertificatePDF(student, template, settings, designKey='classic') {
  const doc = await PDFDocument.create();
  const W=841.89, H=595.28;
  const page = doc.addPage([W,H]);
  const fonts = {
    B:  await doc.embedFont(StandardFonts.HelveticaBold),
    R:  await doc.embedFont(StandardFonts.Helvetica),
    BI: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    I:  await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const map = { 1:design1, 2:design2, classic:design1,
    3:design3, sapphire:design3,
    4:design4, burgundy:design4,
    5:design5, midnight:design5,
    royal:design2, emerald:design2 };
  const fn = map[designKey] || design1;
  await fn(doc, page, student, template, settings, W, H, fonts);
  return await doc.save();
}

// ── Controllers ───────────────────────────────────────────────
exports.generateCertificate = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { template, style='1' } = req.query;
    const { data: student, error } = await supabase.from('students').select('*')
      .eq('school_id', req.schoolId).or(`id.eq.${studentId},photo_number.eq.${studentId}`).single();
    if (error) throw new Error('Student not found');
    const usedTemplate = template || student.class || 'Top Class';
    const pdfBytes = await generateCertificatePDF(student, usedTemplate, req.school, style);
    await supabase.from('certificates').insert([{
      student_id:student.id, school_id:req.schoolId,
      template:usedTemplate, generated_at:new Date().toISOString(), printed_by:req.user.id,
    }]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="${student.photo_number}_${student.last_name}_cert.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) { res.status(500).json({ success:false, error:err.message }); }
};

exports.generateBatch = async (req, res) => {
  try {
    const { class:cls, year, template, style='1' } = req.query;
    let q = supabase.from('students').select('*').eq('school_id',req.schoolId).eq('status','active');
    if (cls)  q=q.eq('class',cls);
    if (year) q=q.eq('year',year);
    const { data:students, error } = await q.order('photo_number');
    if (error) throw error;
    if (!students.length) return res.status(404).json({ success:false, error:'No students found' });
    const merged = await PDFDocument.create();
    for (const s of students) {
      const t = template||s.class||'Top Class';
      const bytes = await generateCertificatePDF(s, t, req.school, style);
      const cd = await PDFDocument.load(bytes);
      const [p] = await merged.copyPages(cd,[0]);
      merged.addPage(p);
      await supabase.from('certificates').insert([{
        student_id:s.id, school_id:req.schoolId,
        template:t, generated_at:new Date().toISOString(), printed_by:req.user.id,
      }]);
    }
    const label = cls?`${cls}_`:'all_';
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="${label}certificates_${year||new Date().getFullYear()}.pdf"`);
    res.send(Buffer.from(await merged.save()));
  } catch (err) { res.status(500).json({ success:false, error:err.message }); }
};

exports.getCertificates = async (req, res) => {
  try {
    const { data, error } = await supabase.from('certificates')
      .select('*, students(first_name, last_name, photo_number, class)')
      .eq('school_id',req.schoolId).order('generated_at',{ascending:false}).limit(100);
    if (error) throw error;
    res.json({ success:true, data });
  } catch (err) { res.status(500).json({ success:false, error:err.message }); }
};
