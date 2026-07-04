const { supabase } = require('../supabase');
require('dotenv').config();

// ── Send SMS via Africa's Talking ─────────────────────────────
async function sendSMS(to, message, school_id) {
  try {
    const AT = require('africastalking');
    const at = AT({ apiKey: process.env.AT_API_KEY || 'sandbox', username: process.env.AT_USERNAME || 'sandbox' });
    const result = await at.SMS.send({ to: [to], message, from: process.env.AT_SENDER_ID });
    await supabase.from('notifications').insert([{
      school_id, type: 'sms', recipient: to, message, status: 'sent',
    }]);
    return { success: true, result };
  } catch (err) {
    await supabase.from('notifications').insert([{
      school_id, type: 'sms', recipient: to, message, status: 'failed',
    }]);
    return { success: false, error: err.message };
  }
}

// ── Send Email via Resend ─────────────────────────────────────
async function sendEmail(to, subject, html, school_id, student_id) {
  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: 'noreply@certsystem.app', to, subject, html });
    await supabase.from('notifications').insert([{
      school_id, type: 'email', recipient: to, subject, message: html, status: 'sent', student_id,
    }]);
    return { success: true };
  } catch (err) {
    await supabase.from('notifications').insert([{
      school_id, type: 'email', recipient: to, subject, message: html, status: 'failed', student_id,
    }]);
    return { success: false, error: err.message };
  }
}

// POST /api/sms/notifications/fee-reminder — send fee payment reminder
exports.sendFeeReminder = async (req, res) => {
  try {
    const { student_ids, term_id, message_template } = req.body;
    const { data: students } = await supabase.from('student_profiles')
      .select('id,first_name,last_name,parent_phone,parent_phone2,parent_email,fee_balance,fee_status')
      .in('id', student_ids).eq('school_id', req.schoolId);

    const { data: term } = await supabase.from('terms').select('name').eq('id', term_id).single();
    const school = req.school;
    let sent = 0, failed = 0;

    for (const st of (students || [])) {
      const msg = (message_template || `Dear Parent, {name}'s school fees balance for {term} is RWF {balance}. Please pay at {school}. Thank you.`)
        .replace('{name}',    `${st.first_name} ${st.last_name}`)
        .replace('{term}',    term?.name || '')
        .replace('{balance}', parseFloat(st.fee_balance || 0).toLocaleString())
        .replace('{school}',  school.school_name || '');

      // SMS
      if (st.parent_phone) {
        const r = await sendSMS(st.parent_phone, msg, req.schoolId);
        r.success ? sent++ : failed++;
      }
      if (st.parent_phone2) await sendSMS(st.parent_phone2, msg, req.schoolId);

      // Email
      if (st.parent_email) {
        const html = `<p>${msg.replace(/\n/g,'<br>')}</p>`;
        await sendEmail(st.parent_email, `Fee Reminder — ${school.school_name}`, html, req.schoolId, st.id);
      }
    }
    res.json({ success: true, sent, failed });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/sms/notifications/bulletin-ready — notify parents bulletin is ready
exports.notifyBulletinReady = async (req, res) => {
  try {
    const { class_id, term_id } = req.body;
    const { data: students } = await supabase.from('student_profiles')
      .select('id,first_name,last_name,parent_phone,parent_email')
      .eq('current_class_id', class_id).eq('status', 'active').eq('school_id', req.schoolId);
    const { data: term } = await supabase.from('terms').select('name').eq('id', term_id).single();
    const school = req.school;
    let sent = 0;

    for (const st of (students || [])) {
      const msg = `Dear Parent, the ${term?.name} report card for ${st.first_name} ${st.last_name} is ready. Please collect it from ${school.school_name}. Thank you.`;
      if (st.parent_phone) { await sendSMS(st.parent_phone, msg, req.schoolId); sent++; }
      if (st.parent_email) {
        await sendEmail(st.parent_email, `Report Card Ready — ${school.school_name}`,
          `<p>${msg}</p>`, req.schoolId, st.id);
      }
    }
    res.json({ success: true, sent });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/sms/notifications/custom — send custom message
exports.sendCustom = async (req, res) => {
  try {
    const { student_ids, message, subject, type } = req.body; // type: sms|email|both
    const { data: students } = await supabase.from('student_profiles')
      .select('id,first_name,last_name,parent_phone,parent_email')
      .in('id', student_ids).eq('school_id', req.schoolId);

    let sent = 0, failed = 0;
    for (const st of (students || [])) {
      const finalMsg = message.replace('{name}', `${st.first_name} ${st.last_name}`);
      if ((type === 'sms' || type === 'both') && st.parent_phone) {
        const r = await sendSMS(st.parent_phone, finalMsg, req.schoolId);
        r.success ? sent++ : failed++;
      }
      if ((type === 'email' || type === 'both') && st.parent_email) {
        await sendEmail(st.parent_email, subject || 'School Notice',
          `<p>${finalMsg}</p>`, req.schoolId, st.id);
      }
    }
    res.json({ success: true, sent, failed });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/sms/notifications — get notification history
exports.getNotifications = async (req, res) => {
  try {
    const { type, status } = req.query;
    let q = supabase.from('notifications').select('*').eq('school_id', req.schoolId);
    if (type)   q = q.eq('type', type);
    if (status) q = q.eq('status', status);
    const { data, error } = await q.order('sent_at', { ascending: false }).limit(200);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
