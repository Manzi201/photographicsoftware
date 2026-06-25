const { supabase } = require('../supabase');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const https = require('https');
const http  = require('http');

// ── Fetch image helper ────────────────────────────────────────
function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, res => {
      const ch = [];
      res.on('data', c => ch.push(c));
      res.on('end',  () => resolve(Buffer.concat(ch)));
      res.on('error', reject);
    }).on('error', reject);
  });
}
async function embedImg(doc, buf) {
  try { return await doc.embedJpg(buf); } catch {}
  try { return await doc.embedPng(buf); } catch {}
  return null;
}

// ── Split text into wrapped lines ─────────────────────────────
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

// ── Ordinal suffix: 1st, 2nd, 3rd... ─────────────────────────
function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

// ── Format date like "3rd July 2026" ─────────────────────────
function fmtDate(d = new Date()) {
  const months = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  return `${ordinal(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ══════════════════════════════════════════════════════════════
// TEMPLATES — 3 visual styles
// ══════════════════════════════════════════════════════════════
// Each template defines: border colors, layout style, fonts
// Style A = Clean white (like the reference image)
// Style B = Dark header band
// Style C = Elegant bordered

const STYLE_A = 'clean';    // white background, thin blue border, school name in box
const STYLE_B = 'classic';  // colored header band, ribbon decoration
const STYLE_C = 'elegant';  // double border, gold accents

// ── Per-class copy ─────────────────────────────────────────────
const CLASS_COPY = {
  'Top Class': {
    completeText: 'Has completed in Top Class at',
    purposeText:  'This certificate is given for whichever purpose it may serve',
  },
  'P6': {
    completeText: 'Has completed Primary Six (P6) at',
    purposeText:  'This certificate is given for whichever purpose it may serve',
  },
  'S3': {
    completeText: 'Has completed Senior Three (S3) at',
    purposeText:  'This certificate is given for whichever purpose it may serve',
  },
  'S6': {
    completeText: 'Has completed Senior Six (S6) at',
    purposeText:  'This certificate is given for whichever purpose it may serve',
  },
  'Nursery': {
    completeText: 'Has completed the Nursery programme at',
    purposeText:  'This certificate is given for whichever purpose it may serve',
  },
  'Graduation': {
    completeText: 'Has successfully graduated from',
    purposeText:  'This certificate is given for whichever purpose it may serve',
  },
};

// ══════════════════════════════════════════════════════════════
// MAIN CERTIFICATE GENERATOR
// W × H = A4 Landscape (841.89 × 595.28 pt)
//
// Layout matches reference image exactly:
//  ┌─────────────────────────────────────────────────────────┐
//  │ [LOGO]     ┌──────────────────────────────┐    [PHOTO] │
//  │            │     SCHOOL NAME              │            │
//  │            └──────────────────────────────┘            │
//  │         C E R T I F I C A T E  O F  C O M P L E T I O N│
//  │              ─────────────────────────────              │
//  │                  This is to certify that                │
//  │              STUDENT NAME (large, colored)              │
//  │    Has completed in [Class] at [School] in              │
//  │          Academic year of [year]-[year+1]               │
//  │                   [LOGO small]                          │
//  │   This certificate is given for whichever purpose...    │
//  │             Done at Kigali on [date]                    │
//  │   [SIGNATURE]              [STAMP]                      │
//  └─────────────────────────────────────────────────────────┘
// ══════════════════════════════════════════════════════════════
async function generateCertificatePDF(student, template, settings, style = STYLE_A) {
  const doc = await PDFDocument.create();
  const W = 841.89, H = 595.28;
  const page = doc.addPage([W, H]);

  const B  = await doc.embedFont(StandardFonts.HelveticaBold);
  const R  = await doc.embedFont(StandardFonts.Helvetica);
  const BI = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const I  = await doc.embedFont(StandardFonts.HelveticaOblique);

  const copy = CLASS_COPY[template] || CLASS_COPY['Top Class'];
  const schoolName = (settings.school_name || 'YOUR SCHOOL NAME').trim();
  const year = student.year || new Date().getFullYear();
  const academicYear = `${year}-${Number(year) + 1}`;
  const today = fmtDate();
  const city = settings.city || 'Kigali';

  // ── Choose colors by style ─────────────────────────────────
  let borderColor, titleColor, nameColor, accentColor, bgColor;

  if (style === STYLE_A) {         // Clean white — blue/navy
    borderColor = rgb(0.07, 0.20, 0.54);
    titleColor  = rgb(0.07, 0.20, 0.54);
    nameColor   = rgb(0.07, 0.55, 0.18);
    accentColor = rgb(0.07, 0.20, 0.54);
    bgColor     = rgb(1, 1, 1);
  } else if (style === STYLE_B) {  // Classic — dark + gold
    borderColor = rgb(0.40, 0.28, 0.02);
    titleColor  = rgb(0.40, 0.28, 0.02);
    nameColor   = rgb(0.07, 0.36, 0.75);
    accentColor = rgb(0.78, 0.56, 0.02);
    bgColor     = rgb(0.99, 0.98, 0.94);
  } else {                         // Elegant — deep red + gold
    borderColor = rgb(0.55, 0.05, 0.05);
    titleColor  = rgb(0.55, 0.05, 0.05);
    nameColor   = rgb(0.07, 0.36, 0.75);
    accentColor = rgb(0.78, 0.56, 0.02);
    bgColor     = rgb(0.99, 0.97, 0.97);
  }

  // ── Background ────────────────────────────────────────────
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:bgColor });
  if (settings.background_url) {
    try {
      const buf = await fetchBuf(settings.background_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:0, y:0, width:W, height:H, opacity:0.12 });
    } catch {}
  }

  // ── Outer border (double) ─────────────────────────────────
  page.drawRectangle({ x:10, y:10, width:W-20, height:H-20,
    borderColor, borderWidth:2.5, color:rgb(1,1,1,0) });
  page.drawRectangle({ x:15, y:15, width:W-30, height:H-30,
    borderColor:accentColor, borderWidth:0.8, color:rgb(1,1,1,0) });

  // ── PHOTO — top-right ─────────────────────────────────────
  const pW = 130, pH = 155;
  const pX = W - pW - 28;
  const pY = H - pH - 24;

  // Photo border
  page.drawRectangle({ x:pX-3, y:pY-3, width:pW+6, height:pH+6,
    borderColor, borderWidth:1.5, color:rgb(1,1,1,0) });

  if (student.photo_url) {
    try {
      const buf = await fetchBuf(student.photo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:pX, y:pY, width:pW, height:pH });
    } catch {}
  } else {
    page.drawRectangle({ x:pX, y:pY, width:pW, height:pH, color:rgb(0.93,0.93,0.93) });
    const nw = R.widthOfTextAtSize('NO PHOTO', 9);
    page.drawText('NO PHOTO', { x:pX+(pW-nw)/2, y:pY+pH/2-4, size:9, font:R, color:rgb(0.65,0.65,0.65) });
  }

  // ── LOGO — top-left ───────────────────────────────────────
  const logoSize = 85;
  const logoX = 28, logoY = H - logoSize - 22;

  if (settings.logo_url) {
    try {
      const buf = await fetchBuf(settings.logo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:logoX, y:logoY, width:logoSize, height:logoSize });
    } catch {}
  } else {
    // Placeholder circle with initial
    page.drawRectangle({ x:logoX, y:logoY, width:logoSize, height:logoSize,
      borderColor, borderWidth:1, color:rgb(0.95,0.95,0.98) });
    const abbrev = schoolName.charAt(0);
    const abbW = B.widthOfTextAtSize(abbrev, 32);
    page.drawText(abbrev, { x:logoX+(logoSize-abbW)/2, y:logoY+logoSize/2-12, size:32, font:B, color:borderColor });
  }

  // ── SCHOOL NAME in box — top center ───────────────────────
  const boxL = logoX + logoSize + 14;
  const boxR = pX - 14;
  const boxW = boxR - boxL;
  const boxH = 38;
  const boxY = H - boxH - 28;

  page.drawRectangle({ x:boxL, y:boxY, width:boxW, height:boxH,
    borderColor, borderWidth:2, color:rgb(1,1,1,0) });

  let snSize = 19;
  while (B.widthOfTextAtSize(schoolName, snSize) > boxW - 20 && snSize > 9) snSize--;
  const snW = B.widthOfTextAtSize(schoolName, snSize);
  page.drawText(schoolName, {
    x: boxL + (boxW - snW) / 2,
    y: boxY + (boxH - snSize) / 2 + 2,
    size: snSize, font: B, color: borderColor,
  });

  // ── CERTIFICATE OF COMPLETION — spaced letters ────────────
  const titleY = H - 148;
  const titleRaw = 'CERTIFICATE OF COMPLETION';
  // Spaced: add 2 spaces between each letter for the stretched look
  const titleSpaced = titleRaw.split('').join(' ');
  let tSize = 16;
  while (I.widthOfTextAtSize(titleSpaced, tSize) > W - 100 && tSize > 9) tSize--;
  const tW = I.widthOfTextAtSize(titleSpaced, tSize);
  page.drawText(titleSpaced, {
    x: (W - tW) / 2, y: titleY, size: tSize, font: BI, color: titleColor,
  });

  // Horizontal rule under title
  page.drawLine({
    start: { x: (W - tW) / 2 - 10, y: titleY - 5 },
    end:   { x: (W - tW) / 2 + tW + 10, y: titleY - 5 },
    thickness: 0.8, color: accentColor,
  });

  // ── "This is to certify that" ─────────────────────────────
  const certifyY = titleY - 22;
  const ctTxt = 'This is to certify that';
  const ctW = I.widthOfTextAtSize(ctTxt, 11);
  page.drawText(ctTxt, { x:(W-ctW)/2, y:certifyY, size:11, font:I, color:rgb(0.3,0.3,0.3) });

  // ── STUDENT NAME — large colored ──────────────────────────
  const fullName = `${student.first_name} ${student.last_name}`;
  // Mixed case: FIRST LAST with small caps feel
  const nameDisplay = fullName.toUpperCase();
  let nameSize = 36;
  while (B.widthOfTextAtSize(nameDisplay, nameSize) > W - 120 && nameSize > 18) nameSize--;
  const nameY = certifyY - 46;
  const nameW = B.widthOfTextAtSize(nameDisplay, nameSize);
  page.drawText(nameDisplay, { x:(W-nameW)/2, y:nameY, size:nameSize, font:B, color:nameColor });

  // ── Body text lines ───────────────────────────────────────
  // Line 1: "Has completed in Top class at [School] in"
  const line1 = `${copy.completeText} ${schoolName} in`;
  let l1Size = 13;
  while (R.widthOfTextAtSize(line1, l1Size) > W - 80 && l1Size > 9) l1Size--;
  const l1W = R.widthOfTextAtSize(line1, l1Size);
  const l1Y = nameY - 32;
  page.drawText(line1, { x:(W-l1W)/2, y:l1Y, size:l1Size, font:R, color:rgb(0.15,0.15,0.15) });

  // Line 2: "Academic year of 2025-2026"
  const line2 = `Academic year of ${academicYear}`;
  const l2Size = 13;
  const l2W = R.widthOfTextAtSize(line2, l2Size);
  const l2Y = l1Y - 20;
  page.drawText(line2, { x:(W-l2W)/2, y:l2Y, size:l2Size, font:R, color:rgb(0.15,0.15,0.15) });

  // ── Small logo in center (like reference image) ───────────
  const cLogoY = l2Y - 50;
  const cLogoSize = 36;
  if (settings.logo_url) {
    try {
      const buf = await fetchBuf(settings.logo_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, {
        x: (W - cLogoSize) / 2, y: cLogoY, width: cLogoSize, height: cLogoSize,
      });
    } catch {}
  } else {
    // Small decorative element
    page.drawRectangle({ x:(W-24)/2, y:cLogoY+6, width:24, height:24,
      rotate:degrees(45), borderColor:accentColor, borderWidth:1, color:rgb(1,1,1,0) });
  }

  // ── Purpose text — bold italic ────────────────────────────
  const purposeY = cLogoY - 18;
  const ptLines = wrap(copy.purposeText, BI, 11.5, W - 100);
  ptLines.forEach((line, i) => {
    const lw = BI.widthOfTextAtSize(line, 11.5);
    page.drawText(line, { x:(W-lw)/2, y:purposeY-i*16, size:11.5, font:BI, color:rgb(0.1,0.1,0.1) });
  });

  // ── "Done at [City] on [date]" ────────────────────────────
  const doneTxt = `Done at ${city} on ${today}`;
  let doneSize = 11.5;
  while (BI.widthOfTextAtSize(doneTxt, doneSize) > W - 100 && doneSize > 8) doneSize--;
  const doneW = BI.widthOfTextAtSize(doneTxt, doneSize);
  const doneY = purposeY - ptLines.length * 16 - 14;
  page.drawText(doneTxt, { x:(W-doneW)/2, y:doneY, size:doneSize, font:BI, color:rgb(0.1,0.1,0.1) });

  // ── Signature (left bottom) ───────────────────────────────
  const sigY = 42;
  const sigX = 80;
  if (settings.signature_url) {
    try {
      const buf = await fetchBuf(settings.signature_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:sigX, y:sigY+12, width:110, height:28, opacity:0.85 });
    } catch {}
  }
  page.drawLine({ start:{x:sigX, y:sigY+8}, end:{x:sigX+120, y:sigY+8}, thickness:0.8, color:rgb(0.3,0.3,0.3) });
  const sigName = settings.signatory_name || 'Head Teacher';
  const sigNW = R.widthOfTextAtSize(sigName, 9);
  page.drawText(sigName, { x:sigX+(120-sigNW)/2, y:sigY-4, size:9, font:R, color:rgb(0.3,0.3,0.3) });

  // ── Stamp (right bottom) ──────────────────────────────────
  const stX = W - 150;
  const stY = 50;
  if (settings.stamp_url) {
    try {
      const buf = await fetchBuf(settings.stamp_url);
      const img = await embedImg(doc, buf);
      if (img) page.drawImage(img, { x:stX-28, y:stY-28, width:60, height:60, opacity:0.8 });
    } catch {}
  } else {
    page.drawCircle({ x:stX, y:stY, size:28, borderColor:accentColor, borderWidth:1.5, color:rgb(1,1,1,0) });
    page.drawCircle({ x:stX, y:stY, size:22, borderColor:accentColor, borderWidth:0.7, color:rgb(1,1,1,0) });
    const stTxt1 = 'OFFICIAL', stTxt2 = 'STAMP';
    page.drawText(stTxt1, { x:stX-B.widthOfTextAtSize(stTxt1,6)/2, y:stY+4,  size:6, font:B, color:accentColor });
    page.drawText(stTxt2, { x:stX-B.widthOfTextAtSize(stTxt2,6)/2, y:stY-4, size:6, font:B, color:accentColor });
  }

  return await doc.save();
}

// ══════════════════════════════════════════════════════════════
// CONTROLLERS
// ══════════════════════════════════════════════════════════════

exports.generateCertificate = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { template, style = STYLE_A } = req.query;

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
      `attachment; filename="${student.photo_number}_${student.last_name}_certificate.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.generateBatch = async (req, res) => {
  try {
    const { class: cls, year, template, style = STYLE_A } = req.query;
    let q = supabase.from('students').select('*')
      .eq('school_id', req.schoolId).eq('status', 'active');
    if (cls)  q = q.eq('class', cls);
    if (year) q = q.eq('year', year);

    const { data: students, error } = await q.order('photo_number');
    if (error) throw error;
    if (!students.length) return res.status(404).json({ success: false, error: 'No students found' });

    const merged = await PDFDocument.create();
    for (const student of students) {
      const t = template || student.class || 'Top Class';
      const bytes = await generateCertificatePDF(student, t, req.school, style);
      const certDoc = await PDFDocument.load(bytes);
      const [p] = await merged.copyPages(certDoc, [0]);
      merged.addPage(p);
      await supabase.from('certificates').insert([{
        student_id: student.id, school_id: req.schoolId,
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
