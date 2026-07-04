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
    const { student_id, term_id, academic_year_id, amount, payment_method, reference, notes } = req.body;

    // Generate receipt number
    const { count } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('school_id', req.schoolId);
    const receipt_number = `RCP-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(5, '0')}`;

    const { data: payment, error } = await supabase.from('payments').insert([{
      school_id: req.schoolId, student_id, term_id, academic_year_id,
      amount: parseFloat(amount), payment_method: payment_method || 'cash',
      reference, notes, receipt_number,
      received_by: req.staff?.id || null,
      status: 'confirmed',
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
    const { data: payment, error } = await supabase.from('payments')
      .select('*, student:student_profiles(first_name,last_name,student_id,current_class_id,classes(name)), term:terms(name)')
      .eq('id', req.params.id).eq('school_id', req.schoolId).single();
    if (error) throw error;

    const doc = await PDFDocument.create();
    const page = doc.addPage([420, 250]); // Receipt size
    const W = 420, H = 250;
    const B = await doc.embedFont(StandardFonts.HelveticaBold);
    const R = await doc.embedFont(StandardFonts.Helvetica);
    const navy = rgb(0.05, 0.14, 0.40);
    const gold = rgb(0.75, 0.55, 0.00);

    page.drawRectangle({ x:0, y:H-50, width:W, height:50, color:navy });
    page.drawText('PAYMENT RECEIPT', { x:16, y:H-28, size:16, font:B, color:rgb(1,1,1) });
    page.drawText(req.school.school_name || 'SCHOOL', { x:16, y:H-42, size:9, font:R, color:gold });
    page.drawText(payment.receipt_number, { x:W-130, y:H-28, size:10, font:B, color:gold });

    const rows = [
      ['Student:', `${payment.student?.first_name} ${payment.student?.last_name}`],
      ['Student ID:', payment.student?.student_id || '—'],
      ['Class:', payment.student?.classes?.name || '—'],
      ['Term:', payment.term?.name || '—'],
      ['Amount Paid:', `RWF ${parseFloat(payment.amount).toLocaleString()}`],
      ['Method:', payment.payment_method?.toUpperCase()],
      ['Reference:', payment.reference || '—'],
      ['Date:', new Date(payment.payment_date).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })],
    ];
    rows.forEach(([label, value], i) => {
      const y = H - 70 - i * 20;
      page.drawText(label, { x:16, y, size:9, font:B, color:navy });
      page.drawText(value, { x:150, y, size:9, font:R, color:rgb(0.1,0.1,0.1) });
    });

    page.drawRectangle({ x:0, y:0, width:W, height:22, color:navy });
    page.drawText('Thank you for your payment. Keep this receipt for your records.', { x:16, y:6, size:8, font:R, color:gold });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${payment.receipt_number}.pdf"`);
    res.send(Buffer.from(await doc.save()));
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
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
