const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const requireAuth = require('../middleware/auth');

// ── REGISTER ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, school_name, active_year } = req.body;

  if (!email || !password || !school_name) {
    return res.status(400).json({
      success: false,
      error: 'Email, password, and school name are required'
    });
  }
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 6 characters'
    });
  }

  const year = active_year || String(new Date().getFullYear());

  // Step 1: Create the auth user
  const { data, error } = await supabase.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { school_name, active_year: year },
  });

  if (error) {
    // Give specific messages for common errors
    let msg = error.message;
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      msg = 'An account with this email already exists. Please sign in instead.';
    }
    return res.status(400).json({ success: false, error: msg });
  }

  const userId = data.user.id;

  // Step 2: Manually create school row as fallback
  // (The DB trigger should do this, but we do it here too for safety)
  const { data: existingSchool } = await supabase
    .from('schools')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!existingSchool) {
    const { error: schoolError } = await supabase.from('schools').insert([{
      user_id:        userId,
      school_name:    school_name.trim(),
      signatory_name: 'Head Teacher',
      active_year:    year,
      bg_preset:      'none',
    }]);

    if (schoolError) {
      console.error('School insert error:', schoolError.message);
      // Still return success — the trigger might have beaten us to it
    }
  }

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    user: { id: userId, email: data.user.email },
  });
});

// ── LOGIN ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  // Fetch school profile
  let { data: school } = await supabase
    .from('schools')
    .select('*')
    .eq('user_id', data.user.id)
    .single();

  // If school row missing (rare), create it now
  if (!school) {
    const meta = data.user.user_metadata || {};
    const { data: newSchool } = await supabase.from('schools').insert([{
      user_id:        data.user.id,
      school_name:    meta.school_name || 'My School',
      signatory_name: 'Head Teacher',
      active_year:    meta.active_year || String(new Date().getFullYear()),
      bg_preset:      'none',
    }]).select().single();
    school = newSchool;
  }

  res.json({
    success: true,
    token:         data.session.access_token,
    refresh_token: data.session.refresh_token,
    user:   { id: data.user.id, email: data.user.email },
    school,
  });
});

// ── REFRESH TOKEN ─────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ success: false, error: 'No refresh token' });
  }
  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error) {
    return res.status(401).json({ success: false, error: 'Session expired, please login again' });
  }
  res.json({
    success: true,
    token:         data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});

// ── GET CURRENT USER + SCHOOL ─────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user:   { id: req.user.id, email: req.user.email },
    school: req.school,
  });
});

// ── LOGOUT ────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await supabase.auth.admin.signOut(req.token);
  } catch (e) { /* ignore */ }
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
