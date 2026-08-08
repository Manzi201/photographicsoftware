'use strict';
const { supabase }   = require('../supabase');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const https   = require('https');
const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const QRCode  = require('qrcode');

// Badge dimensions: 54mm × 85.6mm (standard ID card) in points (1mm ≈ 2.8346pt)
const CARD_W = 153; // 54mm
const CARD_H = 243; // 85.6mm
// A4 landscape = 841.89 × 595.28 — fit 4 cards per row × 3 rows = 12 per page
const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const COLS    = 3;
const ROWS    = 4;
const PAD_X   = (PAGE_W - COLS * CARD_W) / (COLS + 1);
const PAD_Y   = (PAGE_H - ROWS * CARD_H) / (ROWS + 1);

const NAVY  = rgb(0.039, 0.133, 0.337); // #0a2256
const GOLD  = rgb(0.8, 0.6, 0.1);
const WHITE = rgb(1, 1, 1);
const LGRAY = rgb(0.95, 0.95, 0.97);
const BLACK = rgb(0.05, 0.05, 0.05);

const FONTS_DIR = path.join(__dirname, '..', 'fonts');

function fetchBuf(url) {
  return new Promise((res, rej) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, r => {
      const c = [];
      r.on('data', d => c.push(d));
      r.on('end',  () => res(Buffer.concat(c)));
      r.on('error', rej);
    }).on('error', rej);
  });
}

async function embedImg(doc, buf) {
  if (!buf || !buf.length) return null;
  try { return await doc.embedJpg(buf); } catch {}
  try { return await doc.embedPng(buf); } catch {}
  return null;
}

async function loadFonts(doc) {
  doc.registerFontkit(fontkit);
  const load = async (f) => {
    try { return await doc.embedFont(fs.readFileSync(path.join(FONTS_DIR, f))); }
    catch { return await doc.embedFont(StandardFonts.Helvetica); }
  };
  return {
    bold:    await load('Montserrat-Bold.ttf'),
    semi:    await load('Montserrat-SemiBold.ttf'),
    regular: await load('Montserrat-Regular.ttf'),
  };
}

// ── Draw one badge at position (bx, bTopY) on a page ─────────
async function drawBadge(page, F, bx, bTopY, student, school, yearName, logoImg, signImg) {
  const W = CARD_W, H = CARD_H;
  const bBot = bTopY - H;

  // ── Card background white
  page.drawRectangle({ x: bx, y: bBot, width: W, height: H, color: WHITE });

  // ── Navy header band (top 52pt)
  const HDR = 52;
  page.drawRectangle({ x: bx, y: bTopY - HDR, width: W, height: HDR, color: NAVY });

  // ── Logo in header (left)
  if (logoImg) {
    const LS = 36;
    page.drawImage(logoImg, { x: bx + 6, y: bTopY - HDR + (HDR - LS) / 2, width: LS, height: LS });
  }

  // ── School name in header
  const sName = (school.school_name || 'SCHOOL').toUpperCase();
  const sWords = sName.split(' ');
  // Split into max 2 lines of 3 words each
  const line1 = sWords.slice(0, 3).join(' ');
  const line2 = sWords.slice(3, 6).join(' ');
  const textX = bx + (logoImg ? 46 : 8);
  const textW = W - (logoImg ? 50 : 10);

  let sz = 7.5;
  while (sz > 4.5 && F.bold.widthOfTextAtSize(line1, sz) > textW) sz -= 0.5;
  page.drawText(line1, { x: textX, y: bTopY - 14, size: sz, font: F.bold, color: WHITE });
  if (line2) page.drawText(line2, { x: textX, y: bTopY - 14 - sz * 1.3, size: sz, font: F.bold, color: WHITE });

  const motto = school.school_motto || '';
  if (motto) {
    const mSz = 5.5;
    page.drawText(motto.substring(0, 35), { x: textX, y: bTopY - HDR + 5, size: mSz, font: F.regular, color: rgb(0.8, 0.85, 1) });
  }

  // ── Gold separator line
  page.drawLine({ start: { x: bx + 6, y: bTopY - HDR - 1.5 }, end: { x: bx + W - 6, y: bTopY - HDR - 1.5 }, thickness: 1, color: GOLD });

  // ── Photo area (centered, 60×72pt)
  const PW = 60, PH = 72;
  const photoX = bx + (W - PW) / 2;
  const photoY = bTopY - HDR - 8 - PH;
  page.drawRectangle({ x: photoX - 1.5, y: photoY - 1.5, width: PW + 3, height: PH + 3, color: NAVY });
  page.drawRectangle({ x: photoX, y: photoY, width: PW, height: PH, color: LGRAY });

  if (student.photo_url) {
    try {
      const photoBuf = await fetchBuf(student.photo_url);
      const photoImg = await embedImg({ embedJpg: async (b) => { /* placeholder */ }, embedPng: async (b) => { /* placeholder */ } }, photoBuf);
    } catch {}
  }
  // Try to embed photo
  if (student._photoImg) {
    page.drawImage(student._photoImg, { x: photoX, y: photoY, width: PW, height: PH });
  } else {
    // Placeholder: initials
    const init = `${(student.first_name||'')[0]||''}${(student.last_name||'')[0]||''}`.toUpperCase();
    const iSz  = 18;
    const iW   = F.bold.widthOfTextAtSize(init, iSz);
    page.drawText(init, { x: photoX + (PW - iW) / 2, y: photoY + PH / 2 - 7, size: iSz, font: F.bold, color: NAVY });
  }

  // ── Info rows (below photo)
  const infoY = photoY - 10;
  const ICON_X = bx + 6;
  const LBL_X  = bx + 20;
  const VAL_X  = bx + 65;
  const ROW_H  = 13;

  const fullName = `${(student.last_name||'').toUpperCase()} ${student.first_name||''}`.trim();
  const className = student.class_name || '—';
  const studentId = student.student_id || '—';

  const rows = [
    { label: 'NAME:',          value: fullName.substring(0, 22)  },
    { label: 'CLASS:',         value: className.substring(0, 20) },
    { label: 'STUDENT ID:',    value: studentId.substring(0, 22) },
    { label: 'ACADEMIC YEAR:', value: (yearName || '').substring(0, 14) },
  ];

  rows.forEach((row, i) => {
    const ry = infoY - i * ROW_H;
    // Circle bullet
    page.drawCircle({ x: ICON_X + 4, y: ry + 3.5, size: 4, color: NAVY });
    page.drawText(row.label, { x: LBL_X, y: ry, size: 6, font: F.bold,    color: NAVY  });
    page.drawText(row.value, { x: VAL_X, y: ry, size: 6.5, font: F.semi, color: BLACK });
  });

  // ── Navy footer band
  const FOT_H = 28;
  const fotY  = bBot;
  page.drawRectangle({ x: bx, y: fotY, width: W, height: FOT_H, color: NAVY });

  // Footer: city | phone | email
  const city  = school.city         || '';
  const phone = school.phone        || '';
  const email = school.school_email || '';
  const footerParts = [city, phone ? `✆ ${phone}` : '', email].filter(Boolean);
  const footerText  = footerParts.join('  |  ');
  if (footerText) {
    let fSz = 5;
    while (fSz > 3.5 && F.regular.widthOfTextAtSize(footerText, fSz) > W - 8) fSz -= 0.3;
    page.drawText(footerText.substring(0, 70), { x: bx + 4, y: fotY + 5, size: fSz, font: F.regular, color: rgb(0.8, 0.85, 1) });
  }

  // Signature on footer right
  if (signImg) {
    page.drawImage(signImg, { x: bx + W - 46, y: fotY + 8, width: 38, height: 16 });
    page.drawText('Head Teacher', { x: bx + W - 44, y: fotY + 4, size: 4.5, font: F.regular, color: WHITE });
  } else {
    page.drawLine({ start:{x:bx+W-44,y:fotY+12}, end:{x:bx+W-8,y:fotY+12}, thickness:0.5, color:GOLD });
    page.drawText('Head Teacher', { x: bx+W-44, y: fotY + 4, size: 4.5, font: F.regular, color: WHITE });
  }

  // QR code (student ID)
  try {
    const qrBuf = await QRCode.toBuffer(studentId, { width: 32, margin: 0, color: { dark:'#000000', light:'#ffffff' } });
    const qrImg = await embedImg(page.doc, qrBuf);
    if (qrImg) page.drawImage(qrImg, { x: bx + 4, y: fotY + 6, width: 20, height: 20 });
  } catch {}

  // Border around full card
  page.drawRectangle({ x: bx, y: bBot, width: W, height: H, borderColor: NAVY, borderWidth: 1.2 });
}

// ── Build PDF ─────────────────────────────────────────────────
async function buildBadgePDF(students, school, yearName) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const F = await loadFonts(doc);

  // Embed logo & signature
  let logoImg = null, signImg = null;
  if (school.logo_url) {
    try { const buf = await fetchBuf(school.logo_url); logoImg = await embedImg(doc, buf); } catch {}
  }
  if (school.signature_url) {
    try { const buf = await fetchBuf(school.signature_url); signImg = await embedImg(doc, buf); } catch {}
  }

  // Pre-fetch all student photos and attach to student objects
  await Promise.all(students.map(async (st) => {
    if (st.photo_url) {
      try {
        const buf = await fetchBuf(st.photo_url);
        st._photoImg = await embedImg(doc, buf);
      } catch { st._photoImg = null; }
    }
  }));

  let idx = 0;
  while (idx < students.length) {
    const pg = doc.addPage([PAGE_W, PAGE_H]);

    for (let row = 0; row < ROWS && idx < students.length; row++) {
      for (let col = 0; col < COLS && idx < students.length; col++) {
        const bx    = PAD_X + col * (CARD_W + PAD_X);
        const bTopY = PAGE_H - PAD_Y - row * (CARD_H + PAD_Y);
        await drawBadge(pg, F, bx, bTopY, students[idx], school, yearName, logoImg, signImg);
        idx++;
      }
    }
  }

  return doc.save();
}

// ── GET /api/sms/badges/class — generate all badges for a class
exports.generateClassBadges = async (req, res) => {
  try {
    const { class_id, academic_year_id } = req.query;
    if (!class_id) return res.status(400).json({ success: false, error: 'class_id required' });

    const schoolId = req.schoolId;

    const [
      { data: students },
      { data: cls       },
      { data: school    },
      { data: year      },
    ] = await Promise.all([
      supabase.from('student_profiles')
        .select('id, first_name, last_name, student_id, photo_url, current_class_id')
        .eq('school_id', schoolId).eq('current_class_id', class_id).eq('status', 'active')
        .order('last_name').order('first_name'),
      supabase.from('classes').select('name,level').eq('id', class_id).single(),
      supabase.from('schools').select('school_name,city,phone,school_email,logo_url,signature_url,school_motto').eq('id', schoolId).single(),
      academic_year_id
        ? supabase.from('academic_years').select('name').eq('id', academic_year_id).single()
        : Promise.resolve({ data: null }),
    ]);

    if (!students?.length) return res.status(404).json({ success: false, error: 'No active students in this class' });

    const className = cls?.name || '';
    students.forEach(st => { st.class_name = className; });

    const yearName = year?.name || '';
    const pdfBytes = await buildBadgePDF(students, school || {}, yearName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="badges_${className.replace(/\s/g,'_')}.pdf"`);
    res.end(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('generateClassBadges:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/sms/badges/student — single student badge
exports.generateStudentBadge = async (req, res) => {
  try {
    const { student_id, academic_year_id } = req.query;
    if (!student_id) return res.status(400).json({ success: false, error: 'student_id required' });

    const schoolId = req.schoolId;
    const [
      { data: student },
      { data: school  },
      { data: year    },
    ] = await Promise.all([
      supabase.from('student_profiles')
        .select('id, first_name, last_name, student_id, photo_url, current_class_id, class:classes!student_profiles_current_class_id_fkey(name)')
        .eq('id', student_id).eq('school_id', schoolId).single(),
      supabase.from('schools').select('school_name,city,phone,school_email,logo_url,signature_url,school_motto').eq('id', schoolId).single(),
      academic_year_id
        ? supabase.from('academic_years').select('name').eq('id', academic_year_id).single()
        : Promise.resolve({ data: null }),
    ]);

    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    student.class_name = student.class?.name || '';

    const yearName = year?.name || '';
    const pdfBytes = await buildBadgePDF([student], school || {}, yearName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="badge_${student.student_id}.pdf"`);
    res.end(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('generateStudentBadge:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
