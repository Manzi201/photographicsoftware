const { supabase } = require('../supabase');
const crypto = require('crypto');

// ── FIXED salt — do NOT use school_id as salt (it causes hash mismatches) ──
const FIXED_SALT = 'schoolms_v2_salt_2024';

function hashPassword(password) {
  return crypto.createHmac('sha256', FIXED_SALT).update(password).digest('hex');
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

    // Verify password — try new fixed-salt hash first, then legacy school_id salt
    const newHash    = hashPassword(password);
    const legacyHash = crypto.createHmac('sha256', staffMember.school_id || 'schoolms_salt').update(password).digest('hex');

    if (newHash !== staffMember.password_hash && legacyHash !== staffMember.password_hash) {
      return res.status(401).json({ success: false, error: 'Incorrect password' });
    }

    // If legacy hash matched, migrate to new hash silently
    if (legacyHash === staffMember.password_hash && newHash !== staffMember.password_hash) {
      supabase.from('staff').update({ password_hash: newHash }).eq('id', staffMember.id).then(() => {});
    }

    const school = staffMember.school;

    // Create session token
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
      console.warn('staff_sessions insert failed:', sessErr.message);
    }

    // Update last login (non-blocking)
    supabase.from('staff').update({ last_login: new Date().toISOString() }).eq('id', staffMember.id).then(() => {});

    const { password_hash, ...safeStaff } = staffMember;
    delete safeStaff.school;

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

    // Accept both new fixed-salt hash and legacy school_id salt
    const currentNewHash    = hashPassword(current_password);
    const currentLegacyHash = crypto.createHmac('sha256', st.school_id || 'schoolms_salt').update(current_password).digest('hex');

    if (currentNewHash !== st.password_hash && currentLegacyHash !== st.password_hash) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }
    const newHash = hashPassword(new_password);
    await supabase.from('staff').update({ password_hash: newHash }).eq('id', req.staff.id);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
