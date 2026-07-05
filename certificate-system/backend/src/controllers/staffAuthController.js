const { supabase } = require('../supabase');
const crypto = require('crypto');

function hashPassword(password, salt) {
  return crypto.createHmac('sha256', salt || 'schoolms_salt').update(password).digest('hex');
}
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── POST /api/staff-auth/login ────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const uname = username.toLowerCase().trim();

    // Search for staff by username across all schools
    const { data: staffRows, error: staffErr } = await supabase
      .from('staff')
      .select('*, school:schools(id,school_name,logo_url,active_year,city,signatory_name,signature_url,stamp_url,bg_preset,cert_line1,cert_line2,cert_purpose,cert_done_text,cert_template_url,cert_template_mode)')
      .eq('username', uname)
      .eq('is_active', true)
      .limit(1);

    if (staffErr) {
      console.error('Staff lookup error:', staffErr.message);
      return res.status(500).json({ success: false, error: 'Database error: ' + staffErr.message });
    }

    const staffMember = staffRows?.[0];
    if (!staffMember) {
      return res.status(401).json({ success: false, error: 'Username not found or account inactive' });
    }

    // Verify password hash
    const hash = hashPassword(password, staffMember.school_id);
    if (hash !== staffMember.password_hash) {
      return res.status(401).json({ success: false, error: 'Incorrect password' });
    }

    const school = staffMember.school;

    // Create session token — ignore if staff_sessions table missing
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    try {
      await supabase.from('staff_sessions').insert([{
        staff_id:   staffMember.id,
        school_id:  staffMember.school_id,
        token,
        expires_at: expiresAt.toISOString(),
      }]);
    } catch (sessErr) {
      // staff_sessions table may not exist yet — login still works
      console.warn('staff_sessions insert failed (table may not exist):', sessErr.message);
    }

    // Update last login (non-blocking)
    supabase.from('staff').update({ last_login: new Date().toISOString() }).eq('id', staffMember.id).then(() => {});

    // Return without sensitive data
    const { password_hash, ...safeStaff } = staffMember;
    delete safeStaff.school; // already in school field

    res.json({
      success:    true,
      token,
      staff:      safeStaff,
      school,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error('Staff login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/staff-auth/logout ───────────────────────────────
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try { await supabase.from('staff_sessions').delete().eq('token', token); } catch {}
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── GET /api/staff-auth/me ────────────────────────────────────
exports.me = async (req, res) => {
  res.json({ success: true, staff: req.staff, school: req.school });
};

// ── POST /api/staff-auth/change-password ─────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }
    const { data: st } = await supabase.from('staff')
      .select('password_hash,school_id').eq('id', req.staff.id).single();
    if (!st) return res.status(404).json({ success: false, error: 'Staff not found' });

    const currentHash = hashPassword(current_password, st.school_id);
    if (currentHash !== st.password_hash) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }
    const newHash = hashPassword(new_password, st.school_id);
    await supabase.from('staff').update({ password_hash: newHash }).eq('id', req.staff.id);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
