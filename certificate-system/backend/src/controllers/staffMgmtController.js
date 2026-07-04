const { supabase } = require('../supabase');
const crypto = require('crypto');

function hashPassword(password, salt) {
  return crypto.createHmac('sha256', salt || 'schoolms_salt').update(password).digest('hex');
}

const ROLES = { admin:'Admin', dos:'Director of Studies', teacher:'Teacher', secretary:'Secretary', finance:'Finance' };

// GET /api/sms/admin/staff
exports.getStaff = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.school?.id;
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID missing' });
    const { data, error } = await supabase.from('staff')
      .select('id,full_name,email,phone,role,username,is_active,last_login,created_at')
      .eq('school_id', schoolId).order('role').order('full_name');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/sms/admin/staff — create staff account
exports.createStaff = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.school?.id;
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID missing' });
    const { full_name, email, phone, role, username, password, permissions } = req.body;
    if (!full_name || !username || !password || !role) {
      return res.status(400).json({ success: false, error: 'full_name, username, password, role required' });
    }
    const { data: existing } = await supabase.from('staff')
      .select('id').eq('username', username.toLowerCase().trim()).eq('school_id', schoolId).single();
    if (existing) return res.status(400).json({ success: false, error: 'Username already taken in this school' });

    const password_hash = hashPassword(password, schoolId);
    const { data, error } = await supabase.from('staff').insert([{
      school_id: schoolId, full_name, email, phone, role,
      username: username.toLowerCase().trim(), password_hash,
      permissions: permissions || getDefaultPermissions(role), is_active: true,
    }]).select('id,full_name,email,phone,role,username,is_active,created_at').single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/sms/admin/staff/:id
exports.updateStaff = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.school?.id;
    const { password, ...rest } = req.body;
    const update = { ...rest };
    if (password) update.password_hash = hashPassword(password, schoolId);
    if (rest.username) update.username = rest.username.toLowerCase().trim();

    const { data, error } = await supabase.from('staff')
      .update(update).eq('id', req.params.id).eq('school_id', schoolId)
      .select('id,full_name,email,phone,role,username,is_active').single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// DELETE /api/sms/admin/staff/:id (deactivate)
exports.deactivateStaff = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.school?.id;
    await supabase.from('staff').update({ is_active: false }).eq('id', req.params.id).eq('school_id', schoolId);
    await supabase.from('staff_sessions').delete().eq('staff_id', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/sms/admin/staff/:id/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.school?.id;
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) return res.status(400).json({ success: false, error: 'Min 6 chars' });
    const hash = hashPassword(new_password, schoolId);
    await supabase.from('staff').update({ password_hash: hash }).eq('id', req.params.id).eq('school_id', schoolId);
    await supabase.from('staff_sessions').delete().eq('staff_id', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

function getDefaultPermissions(role) {
  const p = {
    admin:     { can_manage_staff:true, can_manage_classes:true, can_enter_marks:true, can_print_bulletins:true, can_manage_finance:true, can_register_students:true, can_promote:true },
    dos:       { can_manage_classes:true, can_enter_marks:true, can_promote:true, can_edit_marks:true },
    teacher:   { can_enter_marks:true },
    secretary: { can_register_students:true, can_print_bulletins:true, can_edit_marks:true, can_upload_csv:true },
    finance:   { can_manage_finance:true, can_download_excel:true },
  };
  return p[role] || {};
}

exports.getRoles = (req, res) => res.json({ success: true, data: ROLES });
