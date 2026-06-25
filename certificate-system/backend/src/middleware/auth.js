const { supabase } = require('../supabase');

/**
 * Middleware: verifies Supabase JWT token and attaches
 * req.user (auth user) and req.schoolId to every protected request.
 */
module.exports = async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized — no token' });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Verify token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ success: false, error: 'Unauthorized — invalid token' });
  }

  // Fetch school linked to this user
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('id, school_name, active_year, logo_url, signature_url, stamp_url, background_url, bg_preset, signatory_name')
    .eq('user_id', user.id)
    .single();

  if (schoolErr || !school) {
    return res.status(403).json({ success: false, error: 'School profile not found. Contact support.' });
  }

  req.user = user;
  req.school = school;
  req.schoolId = school.id;
  req.token = token;
  next();
};
