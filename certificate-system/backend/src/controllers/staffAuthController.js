const { supabase } = require('../supabase');
const crypto = require('crypto');

// Hash password (SHA-256 with salt)
function hashPassword(password, salt) {
  return crypto.createHmac('sha256', salt || 'schoolms_salt').update(password).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── POST /api/staff-auth/login ────────────────────────────────
// Staff login with username + password + school_code
exports.login = async (req, res) => {
  try {
    const { username, password, school_code } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required' });

    // Find school by code (school_name slug or school ID prefix)
    let schoolQuery = supabase.from('schools').select('id,school_name,logo_url,active_year');
    if (school_code) schoolQuery = schoolQuery.ilike('school_name', `%${school_code}%`);
    // Also try by school ID
    const { data: schools } = await schoolQuery.limit(5);

    let staffMember = null, school = null;

    // Try to find staff with this username across matching schools
    for (const s of (schools || [])) {
      const { data: st } = await supabase.from('staff')
        .select('*').eq('school_id', s.id).eq('username', username.toLowerCase().trim()).eq('is_active', true).single();
      if (st) { staffMember = st; school = s; break; }
    }

    // If no school_code, search all schools
    if (!staffMember) {
      const { data: st } = await supabase.from('staff')
        .select('*, school:schools(id,school_name,logo_url,active_year,city,signatory_name,signature_url,stamp_url)')
        .eq('username', username.toLowerCase().trim()).eq('is_active', true).single();
      if (st) { staffMember = st; school = st.school; }
    }

    if (!staffMember) return res.status(401).json({ success: false, error: 'Invalid username or school' });

    // Verify password
    const hash = hashPassword(password, staffMember.school_id);
    if (hash !== staffMember.password_hash) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }

    // Create session token (valid 8 hours)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await supabase.from('staff_sessions').insert([{
      staff_id: staffMember.id, school_id: staffMember.school_id, token, expires_at: expiresAt.toISOString(),
    }]);

    // Update last login
    await supabase.from('staff').update({ last_login: new Date().toISOString() }).eq('id', staffMember.id);

    // Remove sensitive data
    const { password_hash, ...safeStaff } = staffMember;

    res.json({
      success: true,
      token,
      staff: safeStaff,
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
    if (token) await supabase.from('staff_sessions').delete().eq('token', token);
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
    if (new_password.length < 6) return res.status(400).json({ success: false, error: 'Min 6 characters' });

    const { data: st } = await supabase.from('staff').select('password_hash,school_id').eq('id', req.staff.id).single();
    const currentHash = hashPassword(current_password, st.school_id);
    if (currentHash !== st.password_hash) return res.status(400).json({ success: false, error: 'Current password incorrect' });

    const newHash = hashPassword(new_password, st.school_id);
    await supabase.from('staff').update({ password_hash: newHash }).eq('id', req.staff.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
