const { supabase } = require('../supabase');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// ── GET fee structure ─────────────────────────────────────────
exports.getFeeStructure = async (req, res) => {
  try {
    const { academic_year_id, term_id, class_level } = req.query;
    let q = supabase.from('fee_structure').select('*, term:terms(name,number), academic_year:academic_years(name)').eq('school_id', req.schoolId);
    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    if (term_id)          q = q.eq('term_id', term_id);
    if (class_level)      q = q.eq('class_level', class_level);
    const { data, error } = await q.order('class_level').order('fee_type');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.createFeeStructure = async (req, res) => {
  try {
    const { data, error } = await supabase.from('fee_structure').insert([{ school_id: req.schoolId, ...req.body }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deleteFeeStructure = async (req, res) => {
  try {
    await supabase.from('fee_structure').delete().eq('id', req.params.id).eq('school_id', req.schoolId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── GET payments ──────────────────────────────────────────────
exports.getPayments = async (req, res) => {
  try {
    const { student_id, term_id, status } = req.query;
    let q = supabase.from('payments')
      .select('*, student:student_profiles(id,first_name,last_name,student_id,current_class_id,parent_phone), term:terms(name)')
      .eq('school_id', req.schoolId);
    if (student_id) q = q.eq('student_id', student_id);
    if (term_id)    q = q.eq('term_id', term_id);
    if (status)     q = q.eq('status', status);
    const { data, error } = await q.order('payment_date', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/sms/finance/payments — record a payment
exports.recordPayment = async (req, res) => {
  try {
    const {
      student_id, amount, payment_method, reference, notes,
    } = req.body;

    // Sanitize UUID fields — empty string → null (Postgres rejects "" for uuid type)
    const term_id         = req.body.term_id         || null;
    const academic_year_id = req.body.academic_year_id || null;

    if (!student_id) return res.status(400).json({ success: false, error: 'student_id required' });
    if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ success: false, error: 'Valid amount required' });

    // Generate receipt number
    const { count } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('school_id', req.schoolId);
    const receipt_number = `RCP-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(5, '0')}`;

    const { data: payment, error } = await supabase.from('payments').insert([{
      school_id:      req.schoolId,
      student_id,
      term_id,
      academic_year_id,
      amount:         parseFloat(amount),
      payment_method: payment_method || 'cash',
      reference:      reference || null,
      notes:          notes     || null,
      receipt_number,
      received_by:    req.staff?.id || null,
      status:         'confirmed',
    }]).select().single();
    if (error) throw error;

    // Update student fee balance & status
    const { data: student } = await supabase.from('student_profiles').select('fee_balance').eq('id', student_id).single();
    const newBalance = Math.max(0, (student?.fee_balance || 0) - parseFloat(amount));
    const feeStatus = newBalance === 0 ? 'paid' : newBalance < (student?.fee_balance || 0) ? 'partial' : 'unpaid';
    await supabase.from('student_profiles').update({ fee_balance: newBalance, fee_status: feeStatus }).eq('id', student_id);

    res.status(201).json({ success: true, data: payment, receipt_number });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/sms/finance/payments/:id/receipt — generate receipt PDF
exports.generateReceipt = async (req, res) => {
  try {
    // Fetch payment with safe joins
    const { data: payment, error } = await supabase.from('payments')
      .select('*, student:student_profiles(first_name,last_name,student_id,current_class_id), term:terms(name)')
      .eq('id', req.params.id).eq('school_id', req.schoolId).single();
    if (error) throw error;
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });

    // Fetch class name separately (avoids ambiguous FK join)
    let className = '—';
    if (payment.student?.current_class_id) {
      const { data: cls } = await supabase.from('classes')
        .select('name').eq('id', payment.student.current_class_id).single();
      className = cls?.name || '—';
    }

    // Fetch school info
    const { data: school } = await supabase.from('schools')
      .select('school_name').eq('id', req.schoolId).single();
    const schoolName = school?.school_name || 'SCHOOL';

    // Safe value helper — ensure no undefined passed to pdf-lib
    const safe = (v) => String(v ?? '—');

    const doc  = await PDFDocument.create();
    const page = doc.addPage([420, 260]);
    const W = 420, H = 260;
    const B = await doc.embedFont(StandardFonts.HelveticaBold);
    const R = await doc.embedFont(StandardFonts.Helvetica);
    const navy = rgb(0.05, 0.14, 0.40);
    const gold = rgb(0.75, 0.55, 0.00);
    const white = rgb(1, 1, 1);
    const dark  = rgb(0.1, 0.1, 0.1);

    // Header bar
    page.drawRectangle({ x:0, y:H-52, width:W, height:52, color:navy });
    page.drawText('PAYMENT RECEIPT', { x:16, y:H-28, size:15, font:B, color:white });
    page.drawText(schoolName.substring(0, 45), { x:16, y:H-44, size:8, font:R, color:gold });
    const receiptNum = safe(payment.receipt_number);
    const rnW = B.widthOfTextAtSize(receiptNum, 9);
    page.drawText(receiptNum, { x: W - rnW - 12, y:H-26, size:9, font:B, color:gold });

    // Date
    const dateStr = payment.payment_date || payment.created_at
      ? new Date(payment.payment_date || payment.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })
      : '—';

    const rows = [
      ['Student:',    `${safe(payment.student?.first_name)} ${safe(payment.student?.last_name)}`.trim()],
      ['Student ID:', safe(payment.student?.student_id)],
      ['Class:',      className],
      ['Term:',       safe(payment.term?.name)],
      ['Amount Paid:',`RWF ${parseFloat(payment.amount || 0).toLocaleString()}`],
      ['Method:',     safe(payment.payment_method).toUpperCase()],
      ['Reference:',  payment.reference || '—'],
      ['Date:',       dateStr],
      ['Status:',     safe(payment.status).toUpperCase()],
    ];

    rows.forEach(([label, value], i) => {
      const y = H - 68 - i * 18;
      if (y < 28) return; // don't overflow footer
      page.drawText(label, { x:16,  y, size:8.5, font:B, color:navy });
      page.drawText(safe(value).substring(0, 55), { x:140, y, size:8.5, font:R, color:dark });
    });

    // Footer
    page.drawRectangle({ x:0, y:0, width:W, height:22, color:navy });
    page.drawText('Thank you for your payment. Please keep this receipt for your records.', { x:12, y:6, size:7.5, font:R, color:gold });

    const pdfBytes = await doc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${receiptNum}.pdf"`);
    res.end(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('generateReceipt error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/sms/finance/summary
exports.getFinanceSummary = async (req, res) => {
  try {
    const { term_id } = req.query;
    let q = supabase.from('payments').select('amount,status,payment_method').eq('school_id', req.schoolId).eq('status', 'confirmed');
    if (term_id) q = q.eq('term_id', term_id);
    const { data: payments } = await q;

    const totalCollected = (payments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const { data: students } = await supabase.from('student_profiles').select('fee_balance,fee_status').eq('school_id', req.schoolId).eq('status', 'active');
    const totalOutstanding = (students || []).reduce((s, st) => s + parseFloat(st.fee_balance || 0), 0);
    const paidCount    = (students || []).filter(s => s.fee_status === 'paid').length;
    const partialCount = (students || []).filter(s => s.fee_status === 'partial').length;
    const unpaidCount  = (students || []).filter(s => s.fee_status === 'unpaid').length;

    const byMethod = {};
    (payments || []).forEach(p => {
      byMethod[p.payment_method] = (byMethod[p.payment_method] || 0) + parseFloat(p.amount || 0);
    });

    res.json({ success: true, data: { totalCollected, totalOutstanding, paidCount, partialCount, unpaidCount, byMethod } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
