const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/staffAuthController');
const requireStaffAuth = require('../middleware/staffAuth');

router.post('/login',           ctrl.login);
router.post('/logout',          requireStaffAuth, ctrl.logout);
router.get ('/me',              requireStaffAuth, ctrl.me);
router.post('/change-password', requireStaffAuth, ctrl.changePassword);

// ── Temporary debug: check hash for a username (remove after fixing) ──
router.post('/debug-hash', async (req, res) => {
  const { supabase } = require('../supabase');
  const crypto = require('crypto');
  const { username, password } = req.body;
  if (!username) return res.json({ error: 'username required' });

  const { data: rows } = await supabase.from('staff').select('id,username,password_hash,school_id,is_active').eq('username', username.toLowerCase().trim()).limit(1);
  const staff = rows?.[0];
  if (!staff) return res.json({ error: 'username not found', username });

  const FIXED_SALT = 'schoolms_v2_salt_2024';
  const newHash    = crypto.createHmac('sha256', FIXED_SALT).update(password || '').digest('hex');
  const legacyHash = crypto.createHmac('sha256', staff.school_id || 'schoolms_salt').update(password || '').digest('hex');
  const oldFallback= crypto.createHmac('sha256', 'schoolms_salt').update(password || '').digest('hex');

  res.json({
    username:       staff.username,
    is_active:      staff.is_active,
    school_id:      staff.school_id,
    stored_hash:    staff.password_hash,
    new_hash:       newHash,
    legacy_hash:    legacyHash,
    old_hash:       oldFallback,
    new_match:      newHash    === staff.password_hash,
    legacy_match:   legacyHash === staff.password_hash,
    old_match:      oldFallback=== staff.password_hash,
  });
});

module.exports = router;
