const { supabase } = require('../supabase');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const https = require('https');
const http = require('http');

// Helper: fetch image as buffer
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Try embed image (JPEG first, then PNG)
async function embedImage(pdfDoc, buffer) {
  try { return await pdfDoc.embedJpg(buffer); } catch {}
  try { return await pdfDoc.embedPng(buffer); } catch {}
  return null;
}

// Template theme configs
const THEMES = {
  'Top Class': { primary: rgb(0.70, 0.50, 0.02), accent: rgb(0.90, 0.68, 0.10), light: rgb(0.99, 0.97, 0.88), title: 'TOP CLASS CERTIFICATE' },
  'P6':        { primary: rgb(0.07, 0.36, 0.75), accent: rgb(0.23, 0.56, 0.94), light: rgb(0.92, 0.96, 1.00), title: 'PRIMARY 6 CERTIFICATE' },
  'S3':        { primary: rgb(0.05, 0.55, 0.18), accent: rgb(0.13, 0.72, 0.30), light: rgb(0.90, 0.99, 0.92), title: 'SENIOR 3 CERTIFICATE' },
  'S6':        { primary: rgb(0.72, 0.06, 0.06), accent: rgb(0.90, 0.20, 0.20), light: rgb(0.99, 0.92, 0.92), title: 'SENIOR 6 CERTIFICATE' },
  'Nursery':   { primary: rgb(0.50, 0.05, 0.72), accent: rgb(0.68, 0.28, 0.92), light: rgb(0.97, 0.92, 1.00), title: 'NURSERY CERTIFICATE' },
  'Graduation':{ primary: rgb(0.50, 0.33, 0.00), accent: rgb(0.78, 0.56, 0.02), light: rgb(0.99, 0.96, 0.84), title: 'GRADUATION CERTIFICATE' },
};

// Draw decorative corner ornaments (publisher-style)
function drawCornerOrnaments(page, w, h, color) {
  const size = 40;
  const margin = 28;
  // Top-left
  page.drawLine({ start: { x: margin, y: h - margin }, end: { x: margin + size, y: h - margin }, thickness: 3, color });
  page.drawLine({ start: { x: margin, y: h - margin }, end: { x: margin, y: h - margin - size }, thickness: 3, color });
  // Top-right
  page.drawLine({ start: { x: w - margin, y: h - margin }, end: { x: w - margin - size, y: h - margin }, thickness: 3, color });
  page.drawLine({ start: { x: w - margin, y: h - margin }, end: { x: w - margin, y: h - margin - size }, thickness: 3, color });
  // Bottom-left
  page.drawLine({ start: { x: margin, y: margin }, end: { x: margin + size, y: margin }, thickness: 3, color });
  page.drawLine({ start: { x: margin, y: margin }, end: { x: margin, y: margin + size }, thickness: 3, color });
  // Bottom-right
  page.drawLine({ start: { x: w - margin, y: margin }, end: { x: w - margin - size, y: margin }, thickness: 3, color });
  page.drawLine({ start: { x: w - margin, y: margin }, end: { x: w - margin, y: margin + size }, thickness: 3, color });
}

// Draw decorative diamond divider
function drawDiamondDivider(page, x, y, len, color) {
  const step = 14;
  for (let i = 0; i < len; i += step) {
    const cx = x + i;
    const size = 3;
    page.drawRectangle({ x: cx, y: y - size, width: size * 1.4, height: size * 1.4, rotate: degrees(45), color, borderWidth: 0 });
  }
}

/**
 * MAIN CERTIFICATE GENERATOR — Publisher-style layout
 * A4 Landscape with:
 * - Full background image (if set)
 * - Decorative borders, ornaments, dividers
 * - Logo (top-left), School name (top-center), Stamp (top-right)
 * - Large student photo (right panel)
 * - All student info on left panel
 * - Signature area at bottom-center
 */
async function generateCertificatePDF(student, template, settings) {
  const pdfDoc = await PDFDocument.create();
  const W = 841.89, H = 595.28; // A4 Landscape
  const page = pdfDoc.addPage([W, H]);

  const theme = THEMES[template] || THEMES['Top Class'];
  const boldFont    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italicFont  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // ── 1. BACKGROUND ──────────────────────────────────────────────────────────
  if (settings.background_url) {
    try {
      const bgBuf = await fetchImageBuffer(settings.background_url);
      const bgImg = await embedImage(pdfDoc, bgBuf);
      if (bgImg) {
        // Draw background covering full page
        page.drawImage(bgImg, { x: 0, y: 0, width: W, height: H, opacity: 0.18 });
      }
    } catch {}
  } else {
    // Default: solid light background using theme color
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: theme.light });
  }

  // ── 2. COLOR PANEL — left strip (publisher look) ────────────────────────
  // Left color stripe
  page.drawRectangle({ x: 0, y: 0, width: 14, height: H, color: theme.primary });
  // Right color stripe
  page.drawRectangle({ x: W - 14, y: 0, width: 14, height: H, color: theme.primary });
  // Top stripe
  page.drawRectangle({ x: 0, y: H - 14, width: W, height: 14, color: theme.primary });
  // Bottom stripe
  page.drawRectangle({ x: 0, y: 0, width: W, height: 14, color: theme.primary });

  // Inner border lines
  page.drawRectangle({ x: 20, y: 20, width: W - 40, height: H - 40, borderColor: theme.accent, borderWidth: 1.5, color: rgb(1,1,1,0) });
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: theme.primary, borderWidth: 0.5, color: rgb(1,1,1,0) });

  // Corner ornaments
  drawCornerOrnaments(page, W, H, theme.primary);

  // ── 3. RIGHT PHOTO PANEL ────────────────────────────────────────────────
  const photoAreaX = W - 230;
  const photoAreaY = 70;
  const photoW = 175;
  const photoH = 215;

  // Photo panel background
  page.drawRectangle({ x: photoAreaX - 8, y: photoAreaY - 8, width: photoW + 16, height: photoH + 16, color: theme.light, borderColor: theme.accent, borderWidth: 2 });

  if (student.photo_url) {
    try {
      const photoBuf = await fetchImageBuffer(student.photo_url);
      const photoImg = await embedImage(pdfDoc, photoBuf);
      if (photoImg) {
        page.drawImage(photoImg, { x: photoAreaX, y: photoAreaY, width: photoW, height: photoH });
      }
    } catch {}
  } else {
    // Placeholder
    page.drawRectangle({ x: photoAreaX, y: photoAreaY, width: photoW, height: photoH, color: rgb(0.93, 0.93, 0.93) });
    const noPhotoW = regularFont.widthOfTextAtSize('NO PHOTO', 11);
    page.drawText('NO PHOTO', { x: photoAreaX + (photoW - noPhotoW) / 2, y: photoAreaY + photoH / 2, size: 11, font: regularFont, color: rgb(0.7, 0.7, 0.7) });
  }

  // Photo label
  page.drawRectangle({ x: photoAreaX, y: photoAreaY - 22, width: photoW, height: 22, color: theme.primary });
  const photoNum = `PHOTO NO: ${student.photo_number}`;
  const pnW = boldFont.widthOfTextAtSize(photoNum, 9);
  page.drawText(photoNum, { x: photoAreaX + (photoW - pnW) / 2, y: photoAreaY - 16, size: 9, font: boldFont, color: rgb(1, 1, 1) });

  // ── 4. HEADER ROW ───────────────────────────────────────────────────────
  // Logo (top-left)
  let logoDrawn = false;
  if (settings.logo_url) {
    try {
      const logoBuf = await fetchImageBuffer(settings.logo_url);
      const logoImg = await embedImage(pdfDoc, logoBuf);
      if (logoImg) {
        page.drawImage(logoImg, { x: 36, y: H - 108, width: 72, height: 72 });
        logoDrawn = true;
      }
    } catch {}
  }
  if (!logoDrawn) {
    // Draw circular placeholder for logo
    page.drawCircle({ x: 72, y: H - 72, size: 32, color: theme.light, borderColor: theme.accent, borderWidth: 2 });
    const abbrev = (settings.school_name || 'S').charAt(0).toUpperCase();
    page.drawText(abbrev, { x: 66, y: H - 80, size: 20, font: boldFont, color: theme.primary });
  }

  // School name — centered between logo and stamp
  const schoolName = (settings.school_name || 'YOUR SCHOOL NAME').toUpperCase();
  const schoolSize = 20;
  const schoolW = boldFont.widthOfTextAtSize(schoolName, schoolSize);
  const centerX = (W - 220) / 2; // center of left content area
  page.drawText(schoolName, { x: centerX - schoolW / 2 + 30, y: H - 62, size: schoolSize, font: boldFont, color: theme.primary });

  // Thin line under school name
  page.drawLine({ start: { x: 120, y: H - 70 }, end: { x: W - 240, y: H - 70 }, thickness: 1, color: theme.accent });

  // Certificate type subtitle
  const subTitle = 'EXCELLENCE IN EDUCATION';
  const subW = italicFont.widthOfTextAtSize(subTitle, 10);
  page.drawText(subTitle, { x: centerX - subW / 2 + 30, y: H - 82, size: 10, font: italicFont, color: theme.accent });

  // ── 5. MAIN TITLE BAND ──────────────────────────────────────────────────
  const titleBandY = H - 135;
  page.drawRectangle({ x: 28, y: titleBandY, width: W - 270, height: 38, color: theme.primary });

  const titleText = theme.title;
  const titleSize = 18;
  const titleW = boldFont.widthOfTextAtSize(titleText, titleSize);
  const contentW = W - 270;
  page.drawText(titleText, { x: 28 + (contentW - titleW) / 2, y: titleBandY + 11, size: titleSize, font: boldFont, color: rgb(1, 1, 1) });

  // ── 6. BODY CONTENT ─────────────────────────────────────────────────────
  const bodyLeft = 36;
  const bodyMaxW = W - 280;

  // "This is to certify that"
  page.drawText('This is to certify that', {
    x: bodyLeft + 10, y: titleBandY - 30, size: 13, font: italicFont, color: rgb(0.3, 0.3, 0.3)
  });

  // Diamond divider
  drawDiamondDivider(page, bodyLeft + 10, titleBandY - 38, 200, theme.accent);

  // Student name — very large
  const fullName = `${student.first_name.toUpperCase()} ${student.last_name.toUpperCase()}`;
  let nameSize = 36;
  while (boldFont.widthOfTextAtSize(fullName, nameSize) > bodyMaxW - 20 && nameSize > 20) nameSize -= 1;
  const nameY = titleBandY - 82;
  page.drawText(fullName, { x: bodyLeft, y: nameY, size: nameSize, font: boldFont, color: rgb(0.08, 0.08, 0.08) });

  // Name underline (double line — publisher style)
  const nameLineY = nameY - 6;
  page.drawLine({ start: { x: bodyLeft, y: nameLineY }, end: { x: bodyLeft + bodyMaxW - 20, y: nameLineY }, thickness: 2, color: theme.primary });
  page.drawLine({ start: { x: bodyLeft, y: nameLineY - 3 }, end: { x: bodyLeft + bodyMaxW - 20, y: nameLineY - 3 }, thickness: 0.5, color: theme.accent });

  // "has successfully completed"
  page.drawText('has successfully completed', {
    x: bodyLeft + 10, y: nameLineY - 22, size: 12, font: italicFont, color: rgb(0.35, 0.35, 0.35)
  });

  // Class / program highlighted box
  const classText = template === 'Graduation'
    ? `The Graduation Program — Academic Year ${student.year}`
    : `${template} — Academic Year ${student.year}`;
  const classSize = 16;
  const classBoxY = nameLineY - 60;
  const classBoxW = boldFont.widthOfTextAtSize(classText, classSize) + 32;
  page.drawRectangle({ x: bodyLeft, y: classBoxY, width: Math.min(classBoxW, bodyMaxW - 10), height: 28, color: theme.accent, borderWidth: 0 });
  page.drawText(classText, { x: bodyLeft + 16, y: classBoxY + 7, size: classSize, font: boldFont, color: rgb(1, 1, 1) });

  // Award text
  const awardText = template === 'Graduation'
    ? 'with all the rights and privileges pertaining thereto.'
    : 'at this institution with outstanding performance and dedication.';
  page.drawText(awardText, {
    x: bodyLeft + 6, y: classBoxY - 22, size: 10, font: italicFont, color: rgb(0.45, 0.45, 0.45)
  });

  // ── 7. BOTTOM INFO ROW ───────────────────────────────────────────────────
  const infoY = 52;

  // Date (left)
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  page.drawText('DATE ISSUED', { x: bodyLeft, y: infoY + 22, size: 8, font: boldFont, color: theme.primary });
  page.drawLine({ start: { x: bodyLeft, y: infoY + 18 }, end: { x: bodyLeft + 120, y: infoY + 18 }, thickness: 0.8, color: theme.accent });
  page.drawText(today, { x: bodyLeft, y: infoY + 4, size: 11, font: regularFont, color: rgb(0.2, 0.2, 0.2) });

  // Signature (center)
  const sigX = W / 2 - 170;
  page.drawText('AUTHORIZED SIGNATURE', { x: sigX, y: infoY + 22, size: 8, font: boldFont, color: theme.primary });
  page.drawLine({ start: { x: sigX, y: infoY + 18 }, end: { x: sigX + 150, y: infoY + 18 }, thickness: 0.8, color: theme.accent });

  // Signature image
  if (settings.signature_url) {
    try {
      const sigBuf = await fetchImageBuffer(settings.signature_url);
      const sigImg = await embedImage(pdfDoc, sigBuf);
      if (sigImg) page.drawImage(sigImg, { x: sigX + 10, y: infoY + 20, width: 120, height: 30, opacity: 0.9 });
    } catch {}
  }

  const sigName = settings.signatory_name || 'Head Teacher';
  page.drawText(sigName, { x: sigX, y: infoY + 4, size: 11, font: regularFont, color: rgb(0.2, 0.2, 0.2) });

  // Stamp (right bottom area, near photo)
  const stampX = W - 215;
  const stampY = infoY - 10;
  if (settings.stamp_url) {
    try {
      const stBuf = await fetchImageBuffer(settings.stamp_url);
      const stImg = await embedImage(pdfDoc, stBuf);
      if (stImg) page.drawImage(stImg, { x: stampX + 5, y: stampY + 5, width: 65, height: 65, opacity: 0.8 });
    } catch {}
  } else {
    page.drawCircle({ x: stampX + 40, y: stampY + 38, size: 38, borderColor: theme.accent, borderWidth: 2, color: rgb(1,1,1,0) });
    page.drawCircle({ x: stampX + 40, y: stampY + 38, size: 30, borderColor: theme.accent, borderWidth: 0.8, color: rgb(1,1,1,0) });
    page.drawText('OFFICIAL', { x: stampX + 18, y: stampY + 44, size: 7, font: boldFont, color: theme.accent });
    page.drawText('STAMP', { x: stampX + 23, y: stampY + 34, size: 7, font: boldFont, color: theme.accent });
  }

  // ── 8. WATERMARK (subtle) ────────────────────────────────────────────────
  const wmText = (settings.school_name || 'SCHOOL').toUpperCase();
  const wmSize = 52;
  const wmW = boldFont.widthOfTextAtSize(wmText, wmSize);
  page.drawText(wmText, {
    x: (W - wmW) / 2, y: H / 2 - 30,
    size: wmSize, font: boldFont,
    color: rgb(theme.primary.red, theme.primary.green, theme.primary.blue),
    opacity: 0.04,
    rotate: degrees(-30),
  });

  return await pdfDoc.save();
}

// ── CONTROLLERS ──────────────────────────────────────────────────────────────

exports.generateCertificate = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { template } = req.query;

    const { data: student, error: sErr } = await supabase
      .from('students').select('*')
      .eq('school_id', req.schoolId)
      .or(`id.eq.${studentId},photo_number.eq.${studentId}`)
      .single();
    if (sErr) throw new Error('Student not found');

    // Use school settings from auth middleware (req.school)
    const settings = req.school;
    const usedTemplate = template || student.class || 'Top Class';
    const pdfBytes = await generateCertificatePDF(student, usedTemplate, settings);

    await supabase.from('certificates').insert([{
      student_id: student.id,
      school_id: req.schoolId,
      template: usedTemplate,
      generated_at: new Date().toISOString(),
      printed_by: req.user.id,
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
    let query = supabase.from('students').select('*')
      .eq('school_id', req.schoolId)
      .eq('status', 'active');
    if (className) query = query.eq('class', className);
    if (year)      query = query.eq('year', year);

    const { data: students, error } = await query.order('photo_number');
    if (error) throw error;
    if (!students.length) return res.status(404).json({ success: false, error: 'No students found' });

    const settings = req.school;
    const mergedPdf = await PDFDocument.create();

    for (const student of students) {
      const usedTemplate = template || student.class || 'Top Class';
      const certBytes = await generateCertificatePDF(student, usedTemplate, settings);
      const certDoc = await PDFDocument.load(certBytes);
      const [certPage] = await mergedPdf.copyPages(certDoc, [0]);
      mergedPdf.addPage(certPage);

      await supabase.from('certificates').insert([{
        student_id: student.id,
        school_id: req.schoolId,
        template: usedTemplate,
        generated_at: new Date().toISOString(),
        printed_by: req.user.id,
      }]);
    }

    const mergedBytes = await mergedPdf.save();
    const label = className ? `${className}_` : 'all_';
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
