const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const requireAuth = require('../middleware/auth');

// ── REGISTER ──────────────────────────────────────────────────
// POST /api/auth/register
// Body: { email, password, school_name, active_year }
router.post('/register', async (req, res) => {
  const { email, password, school_name, active_year } = req.body;

  if (!email || !password || !school_name) {
    return res.status(400).json({ success: false, error: 'Email, password, and school name are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }

  // Create auth user — trigger will auto-create school row
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email confirmation for simplicity
    user_metadata: {
      school_name,
      active_year: active_year || String(new Date().getFullYear()),
    },
  });

  if (error) {
    return res.status(400).json({ success: false, error: error.message });
  }

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    user: { id: data.user.id, email: data.user.email },
  });
});

// ── LOGIN ─────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  // Also fetch the school profile
  const { data: school } = await supabase
    .from('schools')
    .select('*')
    .eq('user_id', data.user.id)
    .single();

  res.json({
    success: true,
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: { id: data.user.id, email: data.user.email },
    school,
  });
});

// ── REFRESH TOKEN ─────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ success: false, error: 'No refresh token' });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error) return res.status(401).json({ success: false, error: 'Session expired, please login again' });

  res.json({
    success: true,
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});

// ── GET CURRENT USER + SCHOOL ─────────────────────────────────
// GET /api/auth/me  (requires token)
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: { id: req.user.id, email: req.user.email },
    school: req.school,
  });
});

// ── LOGOUT ────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  await supabase.auth.admin.signOut(req.token);
  res.json({ success: true, message: 'Logged out' });
});

// ── CHANGE PASSWORD ───────────────────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }
  const { error } = await supabase.auth.admin.updateUserById(req.user.id, { password: new_password });
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true, message: 'Password updated' });
});

module.exports = router;
