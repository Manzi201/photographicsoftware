const { supabase } = require('../supabase');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const https = require('https');
const http  = require('http');

// ── Image helpers ─────────────────────────────────────────────
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

// ── Text helpers ──────────────────────────────────────────────
function wrap(text, font, size, maxW) {
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxW) { if (cur) lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
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
// Replace template vars: {class}, {year}, {school}, {city}, {date}
function fillVars(text, vars) {
  return text
    .replace(/\{class\}/gi, vars.class || '')
    .replace(/\{year\}/gi, vars.year || '')
    .replace(/\{school\}/gi, vars.school || '')
    .replace(/\{city\}/gi, vars.city || 'Kigali')
    .replace(/\{date\}/gi, vars.date || fmtDate());
}

// ═════════════════════════════════════════════════════════════
// DESIGN THEMES — 5 beautiful certificate designs
// ═════════════════════════════════════════════════════════════
const DESIGNS = {
  // ── Design 1: Classic White (nk'ifoto ya reference) ────────
  classic: {
    name:        'Classic White',
    bg:          rgb(1, 1, 1),
    border1:     rgb(0.07, 0.20, 0.54),   // navy blue
    border2:     rgb(0.07, 0.20, 0.54),
    titleColor:  rgb(0.07, 0.20, 0.54),
    nameColor:   rgb(0.07, 0.55, 0.18),   // green
    bodyColor:   rgb(0.12, 0.12, 0.12),
    accentColor: rgb(0.07, 0.20, 0.54),
    boldPurpose: true,
  },
  // ── Design 2: Royal Gold ────────────────────────────────────
  royal: {
    name:        'Royal Gold',
    bg:          rgb(0.99, 0.98, 0.93),   // cream
    border1:     rgb(0.55, 0.40, 0.02),   // dark gold
    border2:     rgb(0.85, 0.65, 0.10),   // bright gold
    titleColor:  rgb(0.40, 0.28, 0.01),
    nameColor:   rgb(0.07, 0.36, 0.68),   // blue
    bodyColor:   rgb(0.15, 0.12, 0.05),
    accentColor: rgb(0.78, 0.56, 0.02),
    boldPurpose: true,
  },
  // ── Design 3: Emerald Prestige ──────────────────────────────
  emerald: {
    name:        'Emerald Prestige',
    bg:          rgb(0.97, 1.00, 0.97),   // pale green
    border1:     rgb(0.02, 0.45, 0.18),   // deep green
    border2:     rgb(0.13, 0.72, 0.30),   // bright green
    titleColor:  rgb(0.02, 0.40, 0.16),
    nameColor:   rgb(0.02, 0.40, 0.16),
    bodyColor:   rgb(0.10, 0.15, 0.10),
    accentColor: rgb(0.13, 0.65, 0.28),
    boldPurpose: true,
  },
  // ── Design 4: Burgundy Elegance ─────────────────────────────
  burgundy: {
    name:        'Burgundy Elegance',
    bg:          rgb(0.99, 0.97, 0.97),   // pale pink
    border1:     rgb(0.50, 0.04, 0.10),   // deep burgundy
    border2:     rgb(0.78, 0.15, 0.22),   // bright red
    titleColor:  rgb(0.45, 0.03, 0.08),
    nameColor:   rgb(0.10, 0.20, 0.60),   // navy
    bodyColor:   rgb(0.12, 0.10, 0.10),
    accentColor: rgb(0.72, 0.12, 0.18),
    boldPurpose: true,
  },
  // ── Design 5: Sapphire Modern ───────────────────────────────
  sapphire: {
    name:        'Sapphire Modern',
    bg:          rgb(0.97, 0.98, 1.00),   // pale blue
    border1:     rgb(0.06, 0.25, 0.65),   // dark sapphire
    border2:     rgb(0.23, 0.56, 0.94),   // bright blue
    titleColor:  rgb(0.06, 0.22, 0.58),
    nameColor:   rgb(0.06, 0.22, 0.58),
    bodyColor:   rgb(0.10, 0.10, 0.18),
    accentColor: rgb(0.20, 0.52, 0.90),
    boldPurpose: true,
  },
};


// ═════════════════════════════════════════════════════════════
// MAIN CERTIFICATE GENERATOR
// A4 Landscape: 841.89 × 595.28 pt
// ═════════════════════════════════════════════════════════════
async function generateCertificatePDF(student, template, settings, designKey = 'classic') {
  const doc = await PDFDocument.create();
  const W = 841.89, H = 595.28;
  const page = doc.addPage([W, H]);

  const B  = await doc.embedFont(StandardFonts.HelveticaBold);
  const R  = await doc.embedFont(StandardFonts.Helvetica);
  const BI = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const I  = await doc.embedFont(StandardFonts.HelveticaOblique);

  const D = DESIGNS[designKey] || DESIGNS.classic;

  // ── Build variable values ────────────────────────────────
  const schoolName = (settings.school_name || 'YOUR SCHOOL NAME').trim();
  const year       = student.year || new Date().getFullYear();
  const city       = settings.city || 'Kigali';
  const today      = fmtDate();
  const vars       = { class: template, year, school: schoolName, city, date: today };

  // ── Custom text (from settings, with fallbacks) ───────────
  const line1Tpl    = settings.cert_line1    || 'Has completed in {class} at';
  const line2Tpl    = settings.cert_line2    || 'in Academic year of {year}';
  const purposeTpl  = settings.cert_purpose  || 'This certificate is given for whichever purpose it may serve';
  const doneTpl     = settings.cert_done_text|| 'Done at {city} on {date}';
  const line1Text   = fillVars(line1Tpl,   vars);
  const line2Text   = fillVars(line2Tpl,   vars);
  const purposeText = fillVars(purposeTpl, vars);
  const doneText    = fillVars(doneTpl,    vars);

  // ── Background ───────────────────────────────────────────
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:D.bg });
  if (settings.background_url) {
    try {
      const buf = await fetchBuf(settings.background_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:0, y:0, width:W, height:H, opacity:0.12 });
    } catch {}
  }

  // ── Outer triple border ───────────────────────────────────
  page.drawRectangle({ x:8,  y:8,  width:W-16, height:H-16, borderColor:D.border1, borderWidth:3,   color:rgb(1,1,1,0) });
  page.drawRectangle({ x:13, y:13, width:W-26, height:H-26, borderColor:D.border2, borderWidth:1,   color:rgb(1,1,1,0) });
  page.drawRectangle({ x:17, y:17, width:W-34, height:H-34, borderColor:D.border1, borderWidth:0.5, color:rgb(1,1,1,0) });

  // ── Corner decorations ────────────────────────────────────
  const drawCornerBox = (x, y, size) => {
    page.drawRectangle({ x, y, width:size, height:size,
      borderColor:D.accentColor, borderWidth:1.5, color:rgb(1,1,1,0) });
    page.drawRectangle({ x:x+3, y:y+3, width:size-6, height:size-6,
      borderColor:D.accentColor, borderWidth:0.5, color:rgb(1,1,1,0) });
  };
  const cs = 18;
  drawCornerBox(22, H-22-cs, cs); drawCornerBox(W-22-cs, H-22-cs, cs);
  drawCornerBox(22, 22, cs);      drawCornerBox(W-22-cs, 22, cs);

  // ── PHOTO — top-right ─────────────────────────────────────
  const pW = 128, pH = 158;
  const pX = W - pW - 28;
  const pY = H - pH - 26;

  page.drawRectangle({ x:pX-4, y:pY-4, width:pW+8, height:pH+8,
    borderColor:D.border1, borderWidth:1.5, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:pX-1, y:pY-1, width:pW+2, height:pH+2,
    borderColor:D.accentColor, borderWidth:0.5, color:rgb(1,1,1,0) });

  if (student.photo_url) {
    try {
      const buf = await fetchBuf(student.photo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:pX, y:pY, width:pW, height:pH });
    } catch {}
  } else {
    page.drawRectangle({ x:pX, y:pY, width:pW, height:pH, color:rgb(0.94,0.94,0.94) });
    const nw = R.widthOfTextAtSize('NO PHOTO', 9);
    page.drawText('NO PHOTO', { x:pX+(pW-nw)/2, y:pY+pH/2-4, size:9, font:R, color:rgb(0.65,0.65,0.65) });
  }

  // ── LOGO — top-left ───────────────────────────────────────
  const lSz = 80, lX = 28, lY = H - lSz - 24;
  if (settings.logo_url) {
    try {
      const buf = await fetchBuf(settings.logo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:lX, y:lY, width:lSz, height:lSz });
    } catch {}
  } else {
    page.drawRectangle({ x:lX, y:lY, width:lSz, height:lSz,
      borderColor:D.border1, borderWidth:1, color:rgb(0.95,0.95,0.98) });
    const ab = schoolName.charAt(0);
    const abW = B.widthOfTextAtSize(ab, 28);
    page.drawText(ab, { x:lX+(lSz-abW)/2, y:lY+lSz/2-10, size:28, font:B, color:D.border1 });
  }

  // ── SCHOOL NAME in bordered box ───────────────────────────
  const bxL = lX + lSz + 12, bxR = pX - 12;
  const bxW = bxR - bxL, bxH = 36, bxY = H - bxH - 28;

  page.drawRectangle({ x:bxL, y:bxY, width:bxW, height:bxH,
    borderColor:D.border1, borderWidth:2, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:bxL+3, y:bxY+3, width:bxW-6, height:bxH-6,
    borderColor:D.accentColor, borderWidth:0.5, color:rgb(1,1,1,0) });

  let snSz = 18;
  while (B.widthOfTextAtSize(schoolName, snSz) > bxW-20 && snSz > 9) snSz--;
  const snW = B.widthOfTextAtSize(schoolName, snSz);
  page.drawText(schoolName, {
    x: bxL + (bxW-snW)/2, y: bxY + (bxH-snSz)/2 + 2, size:snSz, font:B, color:D.titleColor,
  });

  // ── CERTIFICATE OF COMPLETION (spaced letters) ────────────
  const titleY = H - 148;
  const titleRaw = 'CERTIFICATE OF COMPLETION';
  const titleSpaced = titleRaw.split('').join(' ');
  let tSz = 15;
  while (BI.widthOfTextAtSize(titleSpaced, tSz) > W-100 && tSz > 8) tSz--;
  const tW = BI.widthOfTextAtSize(titleSpaced, tSz);
  page.drawText(titleSpaced, { x:(W-tW)/2, y:titleY, size:tSz, font:BI, color:D.titleColor });

  // Decorative line under title
  const lineY = titleY - 7;
  const lineW = tW + 40;
  page.drawLine({ start:{x:(W-lineW)/2, y:lineY}, end:{x:(W+lineW)/2, y:lineY}, thickness:0.8, color:D.accentColor });
  page.drawLine({ start:{x:(W-lineW/2)/2+20, y:lineY-3}, end:{x:(W+lineW/2)/2-20, y:lineY-3}, thickness:0.3, color:D.accentColor });

  // ── "This is to certify that" ─────────────────────────────
  const certifyY = lineY - 18;
  const ctT = 'This is to certify that';
  const ctW = I.widthOfTextAtSize(ctT, 11);
  page.drawText(ctT, { x:(W-ctW)/2, y:certifyY, size:11, font:I, color:rgb(0.30,0.30,0.30) });

  // ── STUDENT NAME ──────────────────────────────────────────
  const fullName = `${student.first_name} ${student.last_name}`.toUpperCase();
  let nSz = 34;
  while (B.widthOfTextAtSize(fullName, nSz) > W-110 && nSz > 16) nSz--;
  const nameY = certifyY - 44;
  const nameW = B.widthOfTextAtSize(fullName, nSz);
  page.drawText(fullName, { x:(W-nameW)/2, y:nameY, size:nSz, font:B, color:D.nameColor });

  // ── Body lines ────────────────────────────────────────────
  // Line 1: custom
  const l1Lines = wrap(line1Text + ' ' + schoolName, R, 13, W-100);
  l1Lines.forEach((line, i) => {
    const lw = R.widthOfTextAtSize(line, 13);
    page.drawText(line, { x:(W-lw)/2, y:nameY-30-(i*17), size:13, font:R, color:D.bodyColor });
  });

  // Line 2: custom (academic year)
  const l2Y = nameY - 30 - l1Lines.length*17 - 2;
  const l2Lines = wrap(line2Text, R, 13, W-100);
  l2Lines.forEach((line, i) => {
    const lw = R.widthOfTextAtSize(line, 13);
    page.drawText(line, { x:(W-lw)/2, y:l2Y-i*17, size:13, font:R, color:D.bodyColor });
  });

  // ── Mini logo centered ────────────────────────────────────
  const mLogoY = l2Y - l2Lines.length*17 - 10;
  const mLogoSz = 32;
  if (settings.logo_url && mLogoY > 100) {
    try {
      const buf = await fetchBuf(settings.logo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:(W-mLogoSz)/2, y:mLogoY, width:mLogoSz, height:mLogoSz });
    } catch {}
  }

  // ── Purpose text (bold italic, centered) ─────────────────
  const purpY = mLogoY > 100 ? mLogoY - 16 : l2Y - l2Lines.length*17 - 16;
  const purpLines = wrap(purposeText, BI, 11, W - 80);
  purpLines.forEach((line, i) => {
    const lw = BI.widthOfTextAtSize(line, 11);
    page.drawText(line, { x:(W-lw)/2, y:purpY-i*15, size:11, font:BI, color:D.bodyColor });
  });

  // ── "Done at..." text ─────────────────────────────────────
  const doneY = purpY - purpLines.length*15 - 10;
  const doneSz = 11;
  const doneLines = wrap(doneText, BI, doneSz, W-80);
  doneLines.forEach((line, i) => {
    const lw = BI.widthOfTextAtSize(line, doneSz);
    page.drawText(line, { x:(W-lw)/2, y:doneY-i*14, size:doneSz, font:BI, color:D.bodyColor });
  });

  // ── Signature ─────────────────────────────────────────────
  const sigY = 42;
  const sigX = 75;
  if (settings.signature_url) {
    try {
      const buf = await fetchBuf(settings.signature_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:sigX, y:sigY+10, width:110, height:28, opacity:0.85 });
    } catch {}
  }
  page.drawLine({ start:{x:sigX, y:sigY+6}, end:{x:sigX+120, y:sigY+6}, thickness:0.8, color:rgb(0.3,0.3,0.3) });
  const sigName = settings.signatory_name || 'Head Teacher';
  const snW2 = R.widthOfTextAtSize(sigName, 9);
  page.drawText(sigName, { x:sigX+(120-snW2)/2, y:sigY-5, size:9, font:R, color:rgb(0.3,0.3,0.3) });

  // ── Stamp ─────────────────────────────────────────────────
  const stX = W - 130, stY = 58;
  if (settings.stamp_url) {
    try {
      const buf = await fetchBuf(settings.stamp_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:stX-28, y:stY-28, width:58, height:58, opacity:0.80 });
    } catch {}
  } else {
    page.drawCircle({ x:stX, y:stY, size:26, borderColor:D.accentColor, borderWidth:1.5, color:rgb(1,1,1,0) });
    page.drawCircle({ x:stX, y:stY, size:20, borderColor:D.accentColor, borderWidth:0.7, color:rgb(1,1,1,0) });
    ['OFFICIAL','STAMP'].forEach((t,i) => {
      const tw = B.widthOfTextAtSize(t, 6);
      page.drawText(t, { x:stX-tw/2, y:stY+(i===0?4:-4), size:6, font:B, color:D.accentColor });
    });
  }

  return await doc.save();
}


// ═════════════════════════════════════════════════════════════
// CONTROLLERS
// ═════════════════════════════════════════════════════════════

exports.generateCertificate = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { template, style = 'classic' } = req.query;

    const { data: student, error } = await supabase
      .from('students').select('*')
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
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.generateBatch = async (req, res) => {
  try {
    const { class: cls, year, template, style = 'classic' } = req.query;
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
      const certDoc = await PDFDocument.load(bytes);
      const [p] = await merged.copyPages(certDoc, [0]);
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
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getCertificates = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('certificates')
      .select('*, students(first_name, last_name, photo_number, class)')
      .eq('school_id', req.schoolId)
      .order('generated_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
