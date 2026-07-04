const { supabase } = require('../supabase');

/**
 * Middleware: verifies staff session token (not Supabase auth)
 * Used for: teachers, secretary, finance, DoS logins
 * Also accepts Supabase JWT (for school admin/owner)
 */
module.exports = async function requireStaffAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized — no token' });
  }
  const token = header.replace('Bearer ', '').trim();

  // Try staff session token first
  let session = null;
  try {
    const { data } = await supabase
      .from('staff_sessions')
      .select('*, staff:staff(*), school:schools(*)')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();
    session = data;
  } catch { /* table may not exist yet */ }

  if (session?.staff) {
    req.staff    = session.staff;
    req.school   = session.school;
    req.schoolId = session.staff.school_id;
    req.role     = session.staff.role;
    req.user     = { id: session.staff.id }; // compatibility
    return next();
  }

  // Fall back to Supabase JWT (school admin/owner)
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ success: false, error: 'Invalid token' });

    const { data: school } = await supabase.from('schools').select('*').eq('user_id', user.id).single();
    if (!school) return res.status(403).json({ success: false, error: 'School not found' });

    // School owner = admin role
    req.user     = user;
    req.school   = school;
    req.schoolId = school.id;
    req.role     = 'admin';
    req.staff    = { id: null, role: 'admin', full_name: 'Administrator', school_id: school.id };
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// Permission checker helper
function requireRole(...roles) {
  return (req, res, next) => {
    if (req.role === 'admin' || roles.includes(req.role)) return next();
    return res.status(403).json({ success: false, error: `Access denied. Required: ${roles.join(' or ')}` });
  };
}

module.exports.requireRole = requireRole;
