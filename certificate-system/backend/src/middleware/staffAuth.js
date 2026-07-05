const { supabase } = require('../supabase');

module.exports = async function requireStaffAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized — no token provided' });
  }
  const token = header.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized — empty token' });

  // ── Try 1: Staff session token ─────────────────────────────
  try {
    const { data: session, error: sesErr } = await supabase
      .from('staff_sessions')
      .select('*, staff:staff(*), school:schools(*)')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!sesErr && session?.staff) {
      req.staff    = session.staff;
      req.school   = session.school;
      req.schoolId = session.staff.school_id;
      req.role     = session.staff.role;
      req.user     = { id: session.staff.id };
      return next();
    }
  } catch (e) {
    // staff_sessions table may not exist — fall through to Supabase JWT
  }

  // ── Try 2: Supabase JWT (school admin/owner) ───────────────
  try {
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token. Please sign in again.' });
    }
    const user = authData.user;

    const { data: school, error: schoolErr } = await supabase
      .from('schools').select('*').eq('user_id', user.id).single();

    if (schoolErr || !school) {
      return res.status(403).json({ success: false, error: 'School not found for this account.' });
    }

    req.user     = user;
    req.school   = school;
    req.schoolId = school.id;
    req.role     = 'admin';
    req.staff    = {
      id:        null,
      role:      'admin',
      full_name: 'Administrator',
      school_id: school.id,
    };
    return next();
  } catch (e) {
    console.error('staffAuth JWT error:', e.message);
    return res.status(401).json({ success: false, error: 'Authentication failed: ' + e.message });
  }
};

// ── Role guard ─────────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.role) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (req.role === 'admin' || roles.includes(req.role)) return next();
    return res.status(403).json({
      success: false,
      error: `Access denied. Your role "${req.role}" cannot access this. Required: ${roles.join(' or ')}`
    });
  };
}

module.exports.requireRole = requireRole;
