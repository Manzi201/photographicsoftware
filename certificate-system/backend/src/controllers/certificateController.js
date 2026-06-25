const { supabase } = require('../supabase');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const https = require('https');
const http  = require('http');

// ── Helpers ───────────────────────────────────────────────────
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function embedImage(pdfDoc, buffer) {
  try { return await pdfDoc.embedJpg(buffer); } catch {}
  try { return await pdfDoc.embedPng(buffer); } catch {}
  return null;
}

// ── Per-class theme + motivational phrases ─────────────────────
const THEMES = {
  'Top Class': {
    primary: rgb(0.70, 0.50, 0.02),
    accent:  rgb(0.90, 0.68, 0.10),
    light:   rgb(0.99, 0.97, 0.88),
    title:   'CERTIFICATE OF TOP CLASS COMPLETION',
    line1:   'has successfully completed the Top Class programme',
    line2:   'demonstrating exceptional ability, curiosity, and a love of learning.',
    praise:  '"A bright mind, a brilliant future ahead."',
  },
  'P6': {
    primary: rgb(0.07, 0.36, 0.75),
    accent:  rgb(0.23, 0.56, 0.94),
    light:   rgb(0.92, 0.96, 1.00),
    title:   'CERTIFICATE OF PRIMARY 6 COMPLETION',
    line1:   'has successfully completed Primary Six (P6)',
    line2:   'and is hereby recognised for outstanding academic achievement and dedication.',
    praise:  '"Knowledge is a gift — and you have embraced it fully."',
  },
  'S3': {
    primary: rgb(0.05, 0.55, 0.18),
    accent:  rgb(0.13, 0.72, 0.30),
    light:   rgb(0.90, 0.99, 0.92),
    title:   'CERTIFICATE OF SENIOR 3 COMPLETION',
    line1:   'has successfully completed Senior Three (S3)',
    line2:   'showing remarkable perseverance, integrity, and academic excellence.',
    praise:  '"Every step forward is a step toward greatness."',
  },
  'S6': {
    primary: rgb(0.72, 0.06, 0.06),
    accent:  rgb(0.90, 0.20, 0.20),
    light:   rgb(0.99, 0.92, 0.92),
    title:   'CERTIFICATE OF SENIOR 6 COMPLETION',
    line1:   'has successfully completed Senior Six (S6)',
    line2:   'and is commended for six years of dedication, hard work, and scholastic achievement.',
    praise:  '"The world awaits a mind as capable as yours."',
  },
  'Nursery': {
    primary: rgb(0.50, 0.05, 0.72),
    accent:  rgb(0.68, 0.28, 0.92),
    light:   rgb(0.97, 0.92, 1.00),
    title:   'CERTIFICATE OF NURSERY COMPLETION',
    line1:   'has joyfully completed the Nursery programme',
    line2:   'and has shown wonderful growth, creativity, and a beautiful eagerness to learn.',
    praise:  '"Every great journey begins with a single step — yours has begun!"',
  },
  'Graduation': {
    primary: rgb(0.50, 0.33, 0.00),
    accent:  rgb(0.78, 0.56, 0.02),
    light:   rgb(0.99, 0.96, 0.84),
    title:   'CERTIFICATE OF GRADUATION',
    line1:   'has fulfilled all academic requirements and is hereby awarded this',
    line2:   'Certificate of Graduation with distinction, honour, and great pride.',
    praise:  '"Today you graduate — tomorrow you change the world."',
  },
};

// ── Corner ornaments ───────────────────────────────────────────
function drawCorners(page, w, h, color) {
  const sz = 38, m = 26;
  [[m, h-m, 1, 0], [m, h-m, 0, -1],
   [w-m, h-m, -1, 0], [w-m, h-m, 0, -1],
   [m, m, 1, 0], [m, m, 0, 1],
   [w-m, m, -1, 0], [w-m, m, 0, 1]
  ].forEach(([x,y,dx,dy]) =>
    page.drawLine({ start:{x,y}, end:{x:x+dx*sz, y:y+dy*sz}, thickness:3, color })
  );
}

// ── Diamond divider ────────────────────────────────────────────
function diamonds(page, x, y, len, color) {
  for (let i = 0; i < len; i += 13) {
    page.drawRectangle({ x:x+i, y:y-3, width:5, height:5, rotate:degrees(45), color, borderWidth:0 });
  }
}

// ── Centered text helper ───────────────────────────────────────
function centerText(page, text, y, size, font, color, maxX, minX = 30) {
  const w = font.widthOfTextAtSize(text, size);
  const cx = minX + (maxX - minX) / 2;
  page.drawText(text, { x: cx - w/2, y, size, font, color });
}

// ══════════════════════════════════════════════════════════════
// CERTIFICATE PDF GENERATOR
// Layout (A4 Landscape 841.89 × 595.28 pt):
//
//  ┌──────────────────────────────────────────────────────────┐
//  │  [LOGO]   SCHOOL NAME            [PHOTO hejuru]          │
//  │           ─────────────          ┌────────────┐          │
//  │  ██████████████████████████████  │            │          │
//  │  █  CERTIFICATE TITLE BAND  █   │   STUDENT  │          │
//  │  ██████████████████████████████  │   PHOTO    │          │
//  │                                  │            │          │
//  │  This is to certify that         └────────────┘          │
//  │  ◆ ◆ ◆ ◆ ◆ ◆                    PHOTO NO: XXX          │
//  │  STUDENT FULL NAME                                        │
//  │  ────────────────                                        │
//  │  ██ CLASS BAND ██                                        │
//  │  "Motivational quote"                                    │
//  │  award text...                                           │
//  │                                                          │
//  │  DATE          SIGNATURE         STAMP                   │
//  └──────────────────────────────────────────────────────────┘
// ══════════════════════════════════════════════════════════════
async function generateCertificatePDF(student, template, settings) {
  const pdfDoc = await PDFDocument.create();
  const W = 841.89, H = 595.28;
  const page = pdfDoc.addPage([W, H]);

  const theme = THEMES[template] || THEMES['Top Class'];
  const B = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const R = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const I = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // ── 1. Background ────────────────────────────────────────────
  if (settings.background_url) {
    try {
      const buf = await fetchImageBuffer(settings.background_url);
      const img = await embedImage(pdfDoc, buf);
      if (img) page.drawImage(img, { x:0, y:0, width:W, height:H, opacity:0.15 });
    } catch {}
  } else {
    page.drawRectangle({ x:0, y:0, width:W, height:H, color:theme.light });
  }

  // ── 2. Frame stripes ─────────────────────────────────────────
  page.drawRectangle({ x:0, y:0,    width:W,  height:13, color:theme.primary });
  page.drawRectangle({ x:0, y:H-13, width:W,  height:13, color:theme.primary });
  page.drawRectangle({ x:0, y:0,    width:13, height:H,  color:theme.primary });
  page.drawRectangle({ x:W-13, y:0, width:13, height:H,  color:theme.primary });
  // Inner border
  page.drawRectangle({ x:18, y:18, width:W-36, height:H-36, borderColor:theme.accent, borderWidth:1.2, color:rgb(1,1,1,0) });
  // Corner ornaments
  drawCorners(page, W, H, theme.primary);

  // ── 3. PHOTO — top-right corner ──────────────────────────────
  // Photo positioned at top-right, touching the inner border
  const pW = 160, pH = 200;
  const pX = W - pW - 32;   // right side with margin
  const pY = H - pH - 32;   // top with margin (hejuru)

  // Photo frame
  page.drawRectangle({ x:pX-5, y:pY-5, width:pW+10, height:pH+10,
    color:rgb(1,1,1), borderColor:theme.accent, borderWidth:2 });
  page.drawRectangle({ x:pX-2, y:pY-2, width:pW+4, height:pH+4,
    borderColor:theme.primary, borderWidth:0.5, color:rgb(1,1,1,0) });

  if (student.photo_url) {
    try {
      const buf = await fetchImageBuffer(student.photo_url);
      const img = await embedImage(pdfDoc, buf);
      if (img) page.drawImage(img, { x:pX, y:pY, width:pW, height:pH });
    } catch {}
  } else {
    page.drawRectangle({ x:pX, y:pY, width:pW, height:pH, color:rgb(0.94,0.94,0.94) });
    const nw = R.widthOfTextAtSize('NO PHOTO', 10);
    page.drawText('NO PHOTO', { x:pX+(pW-nw)/2, y:pY+pH/2-5, size:10, font:R, color:rgb(0.7,0.7,0.7) });
  }

  // Photo number label below photo
  page.drawRectangle({ x:pX, y:pY-20, width:pW, height:20, color:theme.primary });
  const pnTxt = `PHOTO NO: ${student.photo_number}`;
  const pnW = B.widthOfTextAtSize(pnTxt, 8);
  page.drawText(pnTxt, { x:pX+(pW-pnW)/2, y:pY-14, size:8, font:B, color:rgb(1,1,1) });

  // ── 4. Header — Logo + School name ──────────────────────────
  const contentMaxX = pX - 20; // content area ends before photo

  // Logo
  let logoY = H - 105;
  if (settings.logo_url) {
    try {
      const buf = await fetchImageBuffer(settings.logo_url);
      const img = await embedImage(pdfDoc, buf);
      if (img) { page.drawImage(img, { x:28, y:logoY, width:68, height:68 }); }
    } catch {}
  } else {
    page.drawCircle({ x:62, y:logoY+34, size:28, color:theme.light, borderColor:theme.accent, borderWidth:2 });
    page.drawText((settings.school_name||'S').charAt(0).toUpperCase(),
      { x:56, y:logoY+26, size:18, font:B, color:theme.primary });
  }

  // School name
  const sName = (settings.school_name || 'YOUR SCHOOL NAME').toUpperCase();
  let sSize = 22;
  while (B.widthOfTextAtSize(sName, sSize) > contentMaxX - 115 && sSize > 12) sSize--;
  const sNameW = B.widthOfTextAtSize(sName, sSize);
  page.drawText(sName, { x:110, y:H-62, size:sSize, font:B, color:theme.primary });
  page.drawLine({ start:{x:110, y:H-68}, end:{x:110+sNameW, y:H-68}, thickness:1, color:theme.accent });

  // Subtitle
  page.drawText('EXCELLENCE IN EDUCATION', { x:110, y:H-80, size:9, font:I, color:theme.accent });

  // ── 5. Certificate Title Band ────────────────────────────────
  const bandY = H - 138;
  const bandW = contentMaxX - 28;
  page.drawRectangle({ x:28, y:bandY, width:bandW, height:36, color:theme.primary });
  // Accent line on band
  page.drawLine({ start:{x:28, y:bandY+36}, end:{x:28+bandW, y:bandY+36}, thickness:2, color:theme.accent });

  const tSize = Math.min(17, 17);
  const tW = B.widthOfTextAtSize(theme.title, tSize);
  page.drawText(theme.title, { x:28+(bandW-tW)/2, y:bandY+11, size:tSize, font:B, color:rgb(1,1,1) });

  // ── 6. Body ──────────────────────────────────────────────────
  const bL = 36;
  const bMaxW = contentMaxX - bL;

  // "This is to certify that"
  page.drawText('This is to certify that', { x:bL+8, y:bandY-26, size:12, font:I, color:rgb(0.35,0.35,0.35) });
  diamonds(page, bL+8, bandY-34, 180, theme.accent);

  // Student name
  const fullName = `${student.first_name.toUpperCase()} ${student.last_name.toUpperCase()}`;
  let nSize = 34;
  while (B.widthOfTextAtSize(fullName, nSize) > bMaxW - 10 && nSize > 18) nSize--;
  const nY = bandY - 76;
  page.drawText(fullName, { x:bL, y:nY, size:nSize, font:B, color:rgb(0.06,0.06,0.06) });

  // Double underline
  const nlY = nY - 5;
  page.drawLine({ start:{x:bL, y:nlY},   end:{x:bL+bMaxW-10, y:nlY},   thickness:2,   color:theme.primary });
  page.drawLine({ start:{x:bL, y:nlY-3}, end:{x:bL+bMaxW-10, y:nlY-3}, thickness:0.5, color:theme.accent  });

  // Line 1 (class-specific)
  page.drawText(theme.line1, { x:bL+8, y:nlY-20, size:11, font:I, color:rgb(0.30,0.30,0.30) });

  // Class highlighted band
  const classTxt = template === 'Graduation'
    ? `Graduation Programme · Academic Year ${student.year}`
    : `${template} · Academic Year ${student.year}`;
  let cSize = 15;
  while (B.widthOfTextAtSize(classTxt, cSize) > bMaxW - 30 && cSize > 10) cSize--;
  const cBandW = Math.min(B.widthOfTextAtSize(classTxt, cSize) + 28, bMaxW - 10);
  const cBandY = nlY - 52;
  page.drawRectangle({ x:bL, y:cBandY, width:cBandW, height:26, color:theme.accent });
  page.drawText(classTxt, { x:bL+14, y:cBandY+7, size:cSize, font:B, color:rgb(1,1,1) });

  // Line 2 (class-specific award text)
  const l2Lines = splitText(theme.line2, R, 10, bMaxW - 10);
  l2Lines.forEach((line, idx) => {
    page.drawText(line, { x:bL+6, y:cBandY-18-(idx*13), size:10, font:R, color:rgb(0.40,0.40,0.40) });
  });

  // Motivational quote
  const quoteY = cBandY - 18 - l2Lines.length * 13 - 10;
  if (quoteY > 70) {
    const qLines = splitText(theme.praise, I, 10, bMaxW - 30);
    qLines.forEach((line, idx) => {
      const qW = I.widthOfTextAtSize(line, 10);
      page.drawText(line, { x:bL + (bMaxW - qW)/2, y:quoteY - idx*13, size:10, font:I, color:theme.primary });
    });
  }

  // ── 7. Footer row ────────────────────────────────────────────
  const fY = 46;
  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

  // Date
  page.drawText('DATE ISSUED', { x:bL, y:fY+20, size:7, font:B, color:theme.primary });
  page.drawLine({ start:{x:bL, y:fY+16}, end:{x:bL+110, y:fY+16}, thickness:0.8, color:theme.accent });
  page.drawText(today, { x:bL, y:fY+3, size:10, font:R, color:rgb(0.2,0.2,0.2) });

  // Signature
  const sigX = bL + 160;
  page.drawText('AUTHORIZED SIGNATURE', { x:sigX, y:fY+20, size:7, font:B, color:theme.primary });
  page.drawLine({ start:{x:sigX, y:fY+16}, end:{x:sigX+140, y:fY+16}, thickness:0.8, color:theme.accent });
  if (settings.signature_url) {
    try {
      const buf = await fetchImageBuffer(settings.signature_url);
      const img = await embedImage(pdfDoc, buf);
      if (img) page.drawImage(img, { x:sigX+5, y:fY+17, width:120, height:28, opacity:0.9 });
    } catch {}
  }
  const sigName = settings.signatory_name || 'Head Teacher';
  page.drawText(sigName, { x:sigX, y:fY+3, size:10, font:R, color:rgb(0.2,0.2,0.2) });

  // Stamp (bottom near photo, right side)
  const stX = pX + pW/2;
  const stY = fY + 30;
  if (settings.stamp_url) {
    try {
      const buf = await fetchImageBuffer(settings.stamp_url);
      const img = await embedImage(pdfDoc, buf);
      if (img) page.drawImage(img, { x:stX-32, y:stY-32, width:65, height:65, opacity:0.75 });
    } catch {}
  } else {
    page.drawCircle({ x:stX, y:stY, size:32, borderColor:theme.accent, borderWidth:1.5, color:rgb(1,1,1,0) });
    page.drawCircle({ x:stX, y:stY, size:25, borderColor:theme.accent, borderWidth:0.8, color:rgb(1,1,1,0) });
    page.drawText('OFFICIAL', { x:stX-18, y:stY+5,  size:6, font:B, color:theme.accent });
    page.drawText('STAMP',    { x:stX-12, y:stY-4, size:6, font:B, color:theme.accent });
  }

  // Watermark
  try {
    const wm = (settings.school_name || 'SCHOOL').toUpperCase();
    const wmSize = 48;
    const wmW = B.widthOfTextAtSize(wm, wmSize);
    page.drawText(wm, {
      x:(W-wmW)/2, y:H/2-24, size:wmSize, font:B,
      color:rgb(theme.primary.red, theme.primary.green, theme.primary.blue),
      opacity:0.04, rotate:degrees(-28),
    });
  } catch {}

  return await pdfDoc.save();
}

// ── Utility: split long text into lines ────────────────────────
function splitText(text, font, size, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxW) { lines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ══════════════════════════════════════════════════════════════
// CONTROLLERS
// ══════════════════════════════════════════════════════════════

exports.generateCertificate = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { template }  = req.query;

    const { data: student, error: sErr } = await supabase
      .from('students').select('*')
      .eq('school_id', req.schoolId)
      .or(`id.eq.${studentId},photo_number.eq.${studentId}`)
      .single();
    if (sErr) throw new Error('Student not found');

    const settings      = req.school;
    const usedTemplate  = template || student.class || 'Top Class';
    const pdfBytes      = await generateCertificatePDF(student, usedTemplate, settings);

    await supabase.from('certificates').insert([{
      student_id:   student.id,
      school_id:    req.schoolId,
      template:     usedTemplate,
      generated_at: new Date().toISOString(),
      printed_by:   req.user.id,
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
    const { class: className, year, template } = req.query;
    let q = supabase.from('students').select('*')
      .eq('school_id', req.schoolId).eq('status', 'active');
    if (className) q = q.eq('class', className);
    if (year)      q = q.eq('year', year);

    const { data: students, error } = await q.order('photo_number');
    if (error) throw error;
    if (!students.length) return res.status(404).json({ success: false, error: 'No students found' });

    const settings   = req.school;
    const mergedPdf  = await PDFDocument.create();

    for (const student of students) {
      const usedTemplate = template || student.class || 'Top Class';
      const certBytes    = await generateCertificatePDF(student, usedTemplate, settings);
      const certDoc      = await PDFDocument.load(certBytes);
      const [certPage]   = await mergedPdf.copyPages(certDoc, [0]);
      mergedPdf.addPage(certPage);

      await supabase.from('certificates').insert([{
        student_id:   student.id,
        school_id:    req.schoolId,
        template:     usedTemplate,
        generated_at: new Date().toISOString(),
        printed_by:   req.user.id,
      }]);
    }

    const mergedBytes = await mergedPdf.save();
    const label       = className ? `${className}_` : 'all_';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="${label}certificates_${year || new Date().getFullYear()}.pdf"`);
    res.send(Buffer.from(mergedBytes));
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
      .order('generated_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
