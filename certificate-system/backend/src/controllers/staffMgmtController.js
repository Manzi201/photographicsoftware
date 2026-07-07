const { supabase } = require('../supabase');
const crypto = require('crypto');

const FIXED_SALT = 'schoolms_v2_salt_2024';
function hashPassword(password) {
  return crypto.createHmac('sha256', FIXED_SALT).update(password).digest('hex');
}

const ROLES = {
  admin:     'Admin',
  dos:       'Director of Studies',
  teacher:   'Teacher',
  secretary: 'Secretary',
  finance:   'Finance',
};

const ROLE_CODE = {
  admin:     'ADM',
  dos:       'DOS',
  teacher:   'TCH',
  secretary: 'SEC',
  finance:   'FIN',
};

// Generate staff ID: SCHOOLCODE/ROLECODE/SEQ  e.g. ELA/TCH/001
async function generateStaffId(schoolId, schoolName, role) {
  // School code = first 3 letters of school name (uppercase, no spaces)
  const schoolCode = (schoolName || 'SCH')
    .replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'SCH';
  const roleCode   = ROLE_CODE[role] || 'STF';

  // Count existing staff of this role in school
  const { count } = await supabase
    .from('staff')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('role', role);

  const seq = String((count || 0) + 1).padStart(3, '0');
  return `${schoolCode}/${roleCode}/${seq}`;
}

// GET /api/sms/admin/staff
exports.getStaff = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.school?.id;
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID missing' });
    const { data, error } = await supabase
      .from('staff')
      .select('id,full_name,email,phone,role,username,staff_id,is_active,last_login,created_at')
      .eq('school_id', schoolId)
      .order('role').order('full_name');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/sms/admin/staff — create staff account
exports.createStaff = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.school?.id;
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID missing' });

    const { full_name, email, phone, role, password, permissions } = req.body;
    if (!full_name || !password || !role) {
      return res.status(400).json({ success: false, error: 'full_name, password, role required' });
    }

    // Get school name for ID generation
    const schoolName = req.school?.school_name || '';

    // Generate unique staff_id
    let staff_id = await generateStaffId(schoolId, schoolName, role);

    // Ensure uniqueness (retry if collision)
    let tries = 0;
    while (tries < 10) {
      const { data: exists } = await supabase
        .from('staff').select('id').eq('staff_id', staff_id).eq('school_id', schoolId).maybeSingle();
      if (!exists) break;
      tries++;
      const schoolCode = (schoolName || 'SCH').replace(/[^A-Za-z]/g,'').substring(0,3).toUpperCase() || 'SCH';
      const roleCode   = ROLE_CODE[role] || 'STF';
      staff_id = `${schoolCode}/${roleCode}/${String(Date.now()).slice(-3)}`;
    }

    const password_hash = hashPassword(password);

    const { data, error } = await supabase
      .from('staff')
      .insert([{
        school_id:   schoolId,
        full_name,
        email:       email || null,
        phone:       phone || null,
        role,
        staff_id,                        // ← new: unique staff ID
        username:    staff_id,           // ← keep username = staff_id for login lookup
        password_hash,
        permissions: permissions || getDefaultPermissions(role),
        is_active:   true,
      }])
      .select('id,full_name,email,phone,role,username,staff_id,is_active,created_at')
      .single();
    if (error) throw error;

    res.status(201).json({ success: true, data, staff_id });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/sms/admin/staff/:id
exports.updateStaff = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.school?.id;
    const { password, staff_id, username, ...rest } = req.body; // don't allow changing staff_id
    const update = { ...rest };
    if (password) update.password_hash = hashPassword(password);

    const { data, error } = await supabase
      .from('staff')
      .update(update)
      .eq('id', req.params.id)
      .eq('school_id', schoolId)
      .select('id,full_name,email,phone,role,username,staff_id,is_active')
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// DELETE /api/sms/admin/staff/:id (soft deactivate)
exports.deactivateStaff = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.school?.id;
    await supabase.from('staff')
      .update({ is_active: false })
      .eq('id', req.params.id).eq('school_id', schoolId);
    await supabase.from('staff_sessions').delete().eq('staff_id', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/sms/admin/staff/:id/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.school?.id;
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, error: 'Minimum 6 characters required' });
    }
    const hash = hashPassword(new_password);
    await supabase.from('staff').update({ password_hash: hash }).eq('id', req.params.id).eq('school_id', schoolId);
    await supabase.from('staff_sessions').delete().eq('staff_id', req.params.id);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

function getDefaultPermissions(role) {
  const map = {
    admin:     { can_manage_staff:true, can_manage_classes:true, can_enter_marks:true, can_print_bulletins:true, can_manage_finance:true, can_register_students:true, can_promote:true },
    dos:       { can_manage_classes:true, can_enter_marks:true, can_promote:true, can_edit_marks:true },
    teacher:   { can_enter_marks:true },
    secretary: { can_register_students:true, can_print_bulletins:true, can_edit_marks:true, can_upload_csv:true },
    finance:   { can_manage_finance:true, can_download_excel:true },
  };
  return map[role] || {};
}

exports.getRoles = (req, res) => res.json({ success: true, data: ROLES });
