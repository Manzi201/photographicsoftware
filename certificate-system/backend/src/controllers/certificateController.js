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

// ════════════════════════════════════════════════════════════════
// DESIGN 6 — "Geometric Burgundy" — exactly like image 1
// Diagonal burgundy shapes top-left & bottom-right, gold lines,
// medal/ribbon top-right, white center, large script-like name
// ════════════════════════════════════════════════════════════════
async function design6(doc, page, student, template, settings, W, H, fonts) {
  const { B, R, BI, I } = fonts;
  const burg   = rgb(0.42, 0.02, 0.07);
  const dBurg  = rgb(0.28, 0.01, 0.04);
  const gold   = rgb(0.82, 0.65, 0.05);
  const ltGray = rgb(0.93, 0.91, 0.92);
  const black  = rgb(0.08, 0.06, 0.06);
  const vars = buildVars(student, template, settings);

  // White background
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:rgb(1,1,1) });

  // ── TOP-LEFT diagonal burgundy shapes ──────────────────────
  // Large background polygon (big dark triangle top-left)
  page.drawRectangle({ x:0, y:H-200, width:220, height:200, color:burg });
  // Diagonal cut: white triangle over it to create diagonal
  page.drawRectangle({ x:0, y:H-220, width:260, height:20, color:rgb(1,1,1) });
  // Lighter overlapping shape
  page.drawRectangle({ x:0, y:H-130, width:100, height:130, color:dBurg });

  // Gold diagonal lines (top-left)
  [[30, H-20, 180, H-90], [40, H-10, 200, H-100],
   [0, H-170, 90, H-220], [0, H-160, 80, H-210]].forEach(([x1,y1,x2,y2]) =>
    page.drawLine({ start:{x:x1,y:y1}, end:{x:x2,y:y2}, thickness:2.5, color:gold })
  );

  // Light gray diagonal shape (mid-left)
  page.drawRectangle({ x:0, y:100, width:140, height:200, color:ltGray });
  page.drawRectangle({ x:0, y:80, width:100, height:30, color:ltGray });

  // ── BOTTOM-RIGHT diagonal burgundy shapes ──────────────────
  page.drawRectangle({ x:W-220, y:0, width:220, height:190, color:burg });
  page.drawRectangle({ x:W-100, y:0, width:100, height:220, color:dBurg });
  // Gold diagonal lines (bottom-right)
  [[W-180, 20, W-30, 90], [W-190, 10, W-40, 80],
   [W-90, 170, W-20, 220], [W-80, 160, W-10, 210]].forEach(([x1,y1,x2,y2]) =>
    page.drawLine({ start:{x:x1,y:y1}, end:{x:x2,y:y2}, thickness:2.5, color:gold })
  );
  // Light shape bottom-right
  page.drawRectangle({ x:W-140, y:H-100, width:140, height:100, color:ltGray });

  // ── School logo top-left ────────────────────────────────────
  await drawLogo(doc, page, settings, 22, H-75, 55, 55);

  // ── School name centered top ────────────────────────────────
  const sn = (settings.school_name||'SCHOOL NAME').toUpperCase();
  let snSz=18; while(B.widthOfTextAtSize(sn,snSz)>W-350&&snSz>9) snSz--;
  ctr(page, sn, H-42, snSz, B, black, W);
  page.drawLine({ start:{x:W/2-80,y:H-48}, end:{x:W/2+80,y:H-48}, thickness:0.8, color:gold });

  // ── CERTIFICATE header ──────────────────────────────────────
  const certY = H-85;
  ctr(page, 'CERTIFICATE', certY, 36, B, black, W);
  ctr(page, 'OF ACHIEVEMENT', certY-28, 16, I, black, W);

  // ── MEDAL / SEAL (top-right) ────────────────────────────────
  const mx = W-95, my = H-100;
  // Red ribbon stripes below medal
  page.drawRectangle({ x:mx-18, y:my-60, width:14, height:70, rotate:degrees(-8), color:burg });
  page.drawRectangle({ x:mx+4,  y:my-60, width:14, height:70, rotate:degrees(8),  color:burg });
  // Gold medal circle
  page.drawCircle({ x:mx, y:my, size:34, color:gold });
  page.drawCircle({ x:mx, y:my, size:28, color:rgb(0.88,0.70,0.08) });
  page.drawCircle({ x:mx, y:my, size:22, color:rgb(0.92,0.75,0.10) });
  // Medal text
  page.drawText('★', { x:mx-5, y:my-5, size:14, font:B, color:rgb(0.60,0.42,0.01) });
  // Serrated edge (small circles around medal)
  for (let a=0; a<360; a+=20) {
    const rad=Math.PI*a/180, r=35;
    page.drawCircle({ x:mx+Math.cos(rad)*r, y:my+Math.sin(rad)*r, size:3, color:gold });
  }

  // ── Photo student (left side center) ───────────────────────
  const pW=115, pH=150, pX=65, pY=H-pH-250;
  page.drawRectangle({ x:pX-3, y:pY-3, width:pW+6, height:pH+6, borderColor:gold, borderWidth:1.5, color:rgb(1,1,1,0) });
  if (student.photo_url) {
    try {
      const buf = await fetchBuf(student.photo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:pX, y:pY, width:pW, height:pH });
    } catch {}
  }

  // ── "This certificate is presented to" ─────────────────────
  const presY = certY-62;
  ctr(page, 'This certificate is presented to', presY, 12, I, rgb(0.35,0.35,0.35), W);

  // ── Student name — large ────────────────────────────────────
  const nm = `${student.first_name} ${student.last_name}`;
  let nSz=38; while(BI.widthOfTextAtSize(nm,nSz)>W-250&&nSz>18) nSz--;
  ctr(page, nm, presY-52, nSz, BI, black, W);
  page.drawLine({ start:{x:W/2-180,y:presY-58}, end:{x:W/2+180,y:presY-58}, thickness:0.8, color:rgb(0.5,0.5,0.5) });

  // ── Body text ───────────────────────────────────────────────
  const l1 = fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2 = fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const by = presY-58-nSz+10;
  const l1l = wrap(l1+' '+l2, R, 11.5, W-300);
  l1l.forEach((ln,i)=>ctr(page,ln,by-i*15,11.5,R,black,W));

  const purp = fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  const py2 = by-l1l.length*15-12;
  wrap(purp,R,11,W-280).forEach((ln,i)=>ctr(page,ln,py2-i*14,11,R,black,W));

  // ── Signature ───────────────────────────────────────────────
  const sigY = 80;
  const sigX = W/2-80;
  if (settings.signature_url) {
    try {
      const buf = await fetchBuf(settings.signature_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:sigX-10, y:sigY+10, width:120, height:30, opacity:0.85 });
    } catch {}
  } else {
    // Script-style name placeholder
    const sigName = settings.signatory_name||'Head Teacher';
    let sigSz=16; while(BI.widthOfTextAtSize(sigName,sigSz)>160&&sigSz>10) sigSz--;
    const sigNW = BI.widthOfTextAtSize(sigName,sigSz);
    page.drawText(sigName, { x:sigX+(160-sigNW)/2, y:sigY+18, size:sigSz, font:BI, color:black });
  }
  page.drawLine({ start:{x:sigX,y:sigY+8}, end:{x:sigX+160,y:sigY+8}, thickness:0.8, color:rgb(0.4,0.4,0.4) });
  const slbl = settings.signatory_name||'Head Teacher';
  const slblW = R.widthOfTextAtSize(slbl,9);
  page.drawText(slbl, { x:sigX+(160-slblW)/2, y:sigY-3, size:9, font:R, color:rgb(0.4,0.4,0.4) });

  // ── Date ────────────────────────────────────────────────────
  const dateStr = fmtDate();
  const dateSz  = 12;
  const dateW   = B.widthOfTextAtSize(dateStr, dateSz);
  ctr(page, dateStr, 62, dateSz, B, black, W);
  ctr(page, 'Date', 50, 9, R, rgb(0.45,0.45,0.45), W);
}

// ════════════════════════════════════════════════════════════════
// DESIGN 7 — "Blue Stripe Modern" — exactly like image 2
// Blue+gold diagonal stripes on sides, white center, ribbon badge
// ════════════════════════════════════════════════════════════════
async function design7(doc, page, student, template, settings, W, H, fonts) {
  const { B, R, BI, I } = fonts;
  const dBlue  = rgb(0.08, 0.22, 0.52);
  const mBlue  = rgb(0.12, 0.35, 0.72);
  const gold   = rgb(0.85, 0.65, 0.05);
  const ltGray = rgb(0.90, 0.92, 0.96);
  const black  = rgb(0.06, 0.06, 0.10);
  const vars = buildVars(student, template, settings);

  // White bg
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:rgb(1,1,1) });

  // Outer dark blue border
  page.drawRectangle({ x:0, y:0, width:W, height:H, borderColor:dBlue, borderWidth:14, color:rgb(1,1,1,0) });
  // White gap
  page.drawRectangle({ x:14, y:14, width:W-28, height:H-28, borderColor:rgb(1,1,1), borderWidth:4, color:rgb(1,1,1,0) });
  // Inner thin blue border
  page.drawRectangle({ x:18, y:18, width:W-36, height:H-36, borderColor:dBlue, borderWidth:1.2, color:rgb(1,1,1,0) });

  // ── LEFT diagonal stripe group ──────────────────────────────
  // Gray background strip
  page.drawRectangle({ x:14, y:H/2-80, width:120, height:260, rotate:degrees(-12), color:ltGray });
  // Blue diagonal stripes
  [[22, H-20, 22, 20], [36, H-20, 36, 20]].forEach(([x1,y1,x2,y2]) => {
    // Thick blue diagonal
    page.drawRectangle({ x:x1, y:H*0.1, width:28, height:H*0.8, rotate:degrees(-8), color:dBlue });
  });
  page.drawRectangle({ x:18, y:H*0.05, width:18, height:H*0.9, rotate:degrees(-8), color:mBlue });
  // Gold diagonal stripe
  page.drawRectangle({ x:62, y:H*0.08, width:22, height:H*0.84, rotate:degrees(-8), color:gold });
  page.drawRectangle({ x:82, y:H*0.1, width:10, height:H*0.8, rotate:degrees(-8), color:gold });

  // ── RIGHT diagonal stripe group ─────────────────────────────
  page.drawRectangle({ x:W-46, y:H*0.1, width:28, height:H*0.8, rotate:degrees(-8), color:dBlue });
  page.drawRectangle({ x:W-28, y:H*0.05, width:18, height:H*0.9, rotate:degrees(-8), color:mBlue });
  // Right gray background
  page.drawRectangle({ x:W-120, y:H/2-80, width:120, height:260, rotate:degrees(-12), color:ltGray });
  // Right gold
  page.drawRectangle({ x:W-84, y:H*0.08, width:22, height:H*0.84, rotate:degrees(-8), color:gold });
  page.drawRectangle({ x:W-104, y:H*0.1, width:10, height:H*0.8, rotate:degrees(-8), color:gold });

  // Re-draw white inner area to clean up overlapping shapes
  page.drawRectangle({ x:115, y:22, width:W-242, height:H-44, color:rgb(1,1,1) });

  // ── CERTIFICATE title ───────────────────────────────────────
  const titleY = H-68;
  ctr(page, 'C E R T I F I C A T E', titleY, 28, B, black, W);
  ctr(page, 'OF ACHIEVEMENT', titleY-24, 13, I, black, W);

  // Diamond decorators
  const dy = titleY-36;
  [W/2-16, W/2-4, W/2+8].forEach(x => {
    page.drawRectangle({ x, y:dy, width:8, height:8, rotate:degrees(45), color:gold });
  });

  // ── School logo + name ──────────────────────────────────────
  await drawLogo(doc, page, settings, 130, H-72, 48, 48);
  const sn = (settings.school_name||'SCHOOL').toUpperCase();
  let snSz=12; while(B.widthOfTextAtSize(sn,snSz)>100&&snSz>7) snSz--;
  page.drawText(sn, { x:130, y:H-82, size:snSz, font:B, color:dBlue });

  // ── Photo top-right inside ──────────────────────────────────
  const pW=118, pH=152, pX=W-pW-128, pY=H-pH-28;
  page.drawRectangle({ x:pX-3, y:pY-3, width:pW+6, height:pH+6, borderColor:dBlue, borderWidth:1.5, color:rgb(1,1,1,0) });
  if (student.photo_url) {
    try {
      const buf = await fetchBuf(student.photo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:pX, y:pY, width:pW, height:pH });
    } catch {}
  }

  // ── "This certificate is proudly presented to" ───────────────
  const presY = H-112;
  ctr(page, 'This certificate is proudly presented to', presY, 11, I, rgb(0.35,0.35,0.35), W);

  // ── Student name ─────────────────────────────────────────────
  const nm = `${student.first_name} ${student.last_name}`;
  let nSz=36; while(BI.widthOfTextAtSize(nm,nSz)>W-240&&nSz>16) nSz--;
  ctr(page, nm, presY-50, nSz, BI, black, W);
  page.drawLine({ start:{x:W/2-200,y:presY-56}, end:{x:W/2+200,y:presY-56}, thickness:0.8, color:rgb(0.6,0.6,0.6) });

  // ── Body ────────────────────────────────────────────────────
  const l1 = fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2 = fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const by = presY-56-nSz;
  const bLines = wrap(l1+' '+l2, R, 11.5, W-260);
  bLines.forEach((ln,i)=>ctr(page,ln,by-i*15,11.5,R,black,W));

  const purp = fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  const py2 = by-bLines.length*15-14;
  wrap(purp,R,11,W-260).forEach((ln,i)=>ctr(page,ln,py2-i*14,11,R,black,W));

  // ── BADGE / RIBBON (center bottom) ──────────────────────────
  const bx = W/2, by2 = 90;
  // Ribbon stripes
  page.drawRectangle({ x:bx-18, y:by2-45, width:14, height:55, rotate:degrees(-6), color:gold });
  page.drawRectangle({ x:bx+4,  y:by2-45, width:14, height:55, rotate:degrees(6),  color:gold });
  // Badge outer circle
  page.drawCircle({ x:bx, y:by2, size:32, color:dBlue });
  page.drawCircle({ x:bx, y:by2, size:26, color:mBlue });
  // Serrated
  for (let a=0; a<360; a+=18) {
    const rad=Math.PI*a/180, r=33;
    page.drawCircle({ x:bx+Math.cos(rad)*r, y:by2+Math.sin(rad)*r, size:3.5, color:gold });
  }
  page.drawCircle({ x:bx, y:by2, size:22, color:rgb(0.90,0.72,0.06) });
  // Star
  page.drawText('★', { x:bx-6, y:by2-5, size:14, font:B, color:dBlue });

  // ── Dual signatures ─────────────────────────────────────────
  const sigY = 42;
  // Left signature
  page.drawLine({ start:{x:140,y:sigY+8}, end:{x:290,y:sigY+8}, thickness:0.8, color:rgb(0.5,0.5,0.5) });
  const sName = settings.signatory_name||'Head Teacher';
  const sNameW = R.widthOfTextAtSize(sName, 9);
  page.drawText(sName, { x:140+(150-sNameW)/2, y:sigY-3, size:9, font:R, color:rgb(0.45,0.45,0.45) });
  if (settings.signature_url) {
    try {
      const buf = await fetchBuf(settings.signature_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:145, y:sigY+9, width:130, height:28, opacity:0.85 });
    } catch {}
  }

  // Right signature (school name line)
  page.drawLine({ start:{x:W-290,y:sigY+8}, end:{x:W-140,y:sigY+8}, thickness:0.8, color:rgb(0.5,0.5,0.5) });
  const rSig = (settings.school_name||'Director').substring(0,18);
  const rSigW = R.widthOfTextAtSize(rSig, 9);
  page.drawText(rSig, { x:W-290+(150-rSigW)/2, y:sigY-3, size:9, font:R, color:rgb(0.45,0.45,0.45) });
}

// ════════════════════════════════════════════════════════════════
// DESIGN 8 — "Navy Gold Portrait" — exactly like uploaded image
// Portrait A4, deep navy bg, gold borders, diagonal gold curves,
// large CERTIFICATE title, gold medal bottom center
// ════════════════════════════════════════════════════════════════
async function design8(doc, page, student, template, settings, W, H, fonts) {
  // Note: W=595.28, H=841.89 (portrait)
  const { B, R, BI, I } = fonts;
  const navy   = rgb(0.04, 0.10, 0.30);
  const dNavy  = rgb(0.02, 0.06, 0.20);
  const gold   = rgb(0.85, 0.65, 0.05);
  const ltGold = rgb(0.95, 0.80, 0.35);
  const white  = rgb(1, 1, 1);
  const vars   = buildVars(student, template, settings);

  // ── Deep navy background ─────────────────────────────────
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:navy });

  // ── Background texture dots (bottom corners) ────────────
  for (let r=0; r<6; r++) for (let c=0; c<6; c++) {
    if (Math.sqrt(r*r+c*c) < 7) {
      page.drawCircle({ x:30+c*14, y:30+r*14, size:2, color:rgb(0.15,0.28,0.55), borderWidth:0 });
      page.drawCircle({ x:W-30-c*14, y:30+r*14, size:2, color:rgb(0.15,0.28,0.55), borderWidth:0 });
    }
  }

  // ── Outer gold border rect ───────────────────────────────
  page.drawRectangle({ x:18, y:18, width:W-36, height:H-36,
    borderColor:gold, borderWidth:2.5, color:rgb(1,1,1,0) });
  // Inner thin gold border
  page.drawRectangle({ x:24, y:24, width:W-48, height:H-48,
    borderColor:rgb(0.75,0.55,0.02), borderWidth:0.7, color:rgb(1,1,1,0) });

  // ── TOP-LEFT diagonal gold curve ─────────────────────────
  // Simulate curved diagonal with a series of overlapping rectangles
  const drawDiagCurve = (startX, startY, endX, endY, thick, color) => {
    const steps = 20;
    for (let i=0; i<=steps; i++) {
      const t = i/steps;
      const x = startX + (endX-startX)*t;
      const y = startY + (endY-startY)*t;
      page.drawRectangle({ x:x-thick/2, y:y-thick/2, width:thick, height:thick, color, borderWidth:0 });
    }
  };

  // Top-left diagonal gold swoosh
  page.drawLine({ start:{x:0,y:H-80}, end:{x:130,y:H}, thickness:40, color:gold, opacity:0.9 });
  page.drawLine({ start:{x:0,y:H-120}, end:{x:160,y:H}, thickness:18, color:ltGold, opacity:0.8 });
  page.drawLine({ start:{x:0,y:H-60}, end:{x:100,y:H}, thickness:10, color:rgb(0.60,0.42,0.02) });

  // Top-right diagonal
  page.drawLine({ start:{x:W,y:H-80}, end:{x:W-130,y:H}, thickness:40, color:gold, opacity:0.9 });
  page.drawLine({ start:{x:W,y:H-120}, end:{x:W-160,y:H}, thickness:18, color:ltGold, opacity:0.8 });
  page.drawLine({ start:{x:W,y:H-60}, end:{x:W-100,y:H}, thickness:10, color:rgb(0.60,0.42,0.02) });

  // Bottom gold V-shape (the distinctive swoosh at bottom)
  // Left leg of V
  page.drawLine({ start:{x:0,y:220}, end:{x:W/2,y:90}, thickness:45, color:gold });
  page.drawLine({ start:{x:0,y:220}, end:{x:W/2,y:90}, thickness:25, color:ltGold });
  page.drawLine({ start:{x:0,y:205}, end:{x:W/2,y:78}, thickness:8, color:rgb(0.60,0.42,0.02) });
  // Right leg of V
  page.drawLine({ start:{x:W,y:220}, end:{x:W/2,y:90}, thickness:45, color:gold });
  page.drawLine({ start:{x:W,y:220}, end:{x:W/2,y:90}, thickness:25, color:ltGold });
  page.drawLine({ start:{x:W,y:205}, end:{x:W/2,y:78}, thickness:8, color:rgb(0.60,0.42,0.02) });

  // Re-draw navy inner rectangle to clean up
  page.drawRectangle({ x:28, y:200, width:W-56, height:H-310, color:navy });
  // Also clean top area
  page.drawRectangle({ x:28, y:H-200, width:W-56, height:160, color:navy });

  // Redraw borders on top
  page.drawRectangle({ x:18, y:18, width:W-36, height:H-36,
    borderColor:gold, borderWidth:2.5, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:24, y:24, width:W-48, height:H-48,
    borderColor:rgb(0.75,0.55,0.02), borderWidth:0.7, color:rgb(1,1,1,0) });

  // ── LOGO + school name (top) ──────────────────────────────
  await drawLogo(doc, page, settings, (W-55)/2, H-100, 55, 55);
  const sn = (settings.school_name||'SCHOOL NAME').toUpperCase();
  let snSz=13; while(B.widthOfTextAtSize(sn,snSz)>W-80&&snSz>8) snSz--;
  ctr(page, sn, H-112, snSz, B, gold, W);

  // ── CERTIFICATE title ────────────────────────────────────
  const certY = H-168;
  ctr(page, 'CERTIFICATE', certY, 46, B, gold, W);
  ctr(page, 'OF ACHIEVEMENT', certY-36, 16, B, gold, W);

  // ── Inner gold box ────────────────────────────────────────
  const boxX=40, boxY=215, boxW=W-80, boxH=H-boxY-220;
  page.drawRectangle({ x:boxX, y:boxY, width:boxW, height:boxH,
    borderColor:gold, borderWidth:1.2, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:boxX+4, y:boxY+4, width:boxW-8, height:boxH-8,
    borderColor:rgb(0.65,0.48,0.02), borderWidth:0.4, color:rgb(1,1,1,0) });

  // ── Student photo (top-right inside box) ─────────────────
  const pW=110, pH=140;
  const pX=boxX+boxW-pW-18, pY=boxY+boxH-pH-18;
  page.drawRectangle({ x:pX-3, y:pY-3, width:pW+6, height:pH+6,
    borderColor:gold, borderWidth:1.5, color:rgb(1,1,1,0) });
  if (student.photo_url) {
    try {
      const buf = await fetchBuf(student.photo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:pX, y:pY, width:pW, height:pH });
    } catch {}
  }

  // ── "This Certificate is Proudly Presented To" ──────────
  const presY = boxY + boxH - 35;
  const presT = 'This Certificate Is Proudly Presented To';
  let presSz=11; while(I.widthOfTextAtSize(presT,presSz)>boxW-pW-50&&presSz>8) presSz--;
  page.drawText(presT, { x:boxX+20, y:presY, size:presSz, font:I, color:ltGold });

  // ── Student name (large, gold) ────────────────────────────
  const nm = `${student.first_name} ${student.last_name}`;
  let nSz=30; while(BI.widthOfTextAtSize(nm,nSz)>boxW-pW-50&&nSz>14) nSz--;
  page.drawText(nm, { x:boxX+20, y:presY-nSz-10, size:nSz, font:BI, color:gold });
  page.drawLine({ start:{x:boxX+20,y:presY-nSz-14}, end:{x:boxX+boxW-pW-30,y:presY-nSz-14},
    thickness:0.8, color:rgb(0.6,0.5,0.2) });

  // ── Body text ─────────────────────────────────────────────
  const l1 = fillVars(settings.cert_line1||'Has completed in {class} at',vars)+' '+(settings.school_name||'');
  const l2 = fillVars(settings.cert_line2||'in Academic year of {year}',vars);
  const purp = fillVars(settings.cert_purpose||'This certificate is given for whichever purpose it may serve',vars);
  const done = fillVars(settings.cert_done_text||'Done at {city} on {date}',vars);
  const textMaxW = boxW - 40;
  let ty = presY - nSz - 32;
  const allText = wrap(l1+' '+l2+'. '+purp, I, 11, textMaxW);
  allText.forEach((ln,i) => {
    const lw = I.widthOfTextAtSize(ln,11);
    page.drawText(ln, { x:boxX+20, y:ty-i*15, size:11, font:I, color:ltGold });
  });
  ty = ty - allText.length*15 - 10;
  page.drawText(done, { x:boxX+20, y:ty, size:10.5, font:BI, color:gold });

  // ── Dual signature lines ──────────────────────────────────
  const sigY = boxY + 50;
  const sigName = settings.signatory_name||'Head Teacher';

  // Left signature
  page.drawLine({ start:{x:boxX+20,y:sigY+12}, end:{x:boxX+150,y:sigY+12}, thickness:0.8, color:gold });
  if (settings.signature_url) {
    try {
      const buf = await fetchBuf(settings.signature_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:boxX+20, y:sigY+14, width:120, height:28, opacity:0.85 });
    } catch {}
  }
  const sW = I.widthOfTextAtSize(sigName, 10);
  page.drawText(sigName, { x:boxX+20, y:sigY-2, size:10, font:I, color:ltGold });

  // Right signature
  page.drawLine({ start:{x:boxX+boxW-155,y:sigY+12}, end:{x:boxX+boxW-25,y:sigY+12}, thickness:0.8, color:gold });
  const dirName = (settings.school_name||'Director').substring(0,16);
  page.drawText(dirName, { x:boxX+boxW-155, y:sigY-2, size:10, font:I, color:ltGold });

  // ── GOLD MEDAL (bottom center) ────────────────────────────
  const mx=W/2, my=115;
  // Serrated outer ring
  for (let a=0; a<360; a+=15) {
    const rad=Math.PI*a/180, r=38;
    page.drawCircle({ x:mx+Math.cos(rad)*r, y:my+Math.sin(rad)*r, size:5, color:gold });
  }
  // Medal circles
  page.drawCircle({ x:mx, y:my, size:36, color:gold });
  page.drawCircle({ x:mx, y:my, size:30, color:rgb(0.72,0.52,0.04) });
  page.drawCircle({ x:mx, y:my, size:24, color:rgb(0.85,0.65,0.06) });
  // Stars in medal
  ['★','★','★'].forEach((s,i) => {
    page.drawText(s, { x:mx-22+i*14, y:my-5, size:10, font:B, color:navy });
  });
}

// ── Main dispatcher ───────────────────────────────────────────
async function generateCertificatePDF(student, template, settings, designKey='classic') {
  const doc = await PDFDocument.create();
  // Design 8 is PORTRAIT (595×842), all others are LANDSCAPE (842×595)
  const isPortrait = (designKey==='8'||designKey==='navy_gold');
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
    '1':design1, classic:design1, presidential:design1,
    '2':design2, emerald:design2,
    '3':design3, sapphire:design3,
    '4':design4, burgundy:design4,
    '5':design5, midnight:design5,
    '6':design6, geometric:design6,
    '7':design7, blue_stripe:design7,
    '8':design8, navy_gold:design8,
    royal:design2,
  };
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
