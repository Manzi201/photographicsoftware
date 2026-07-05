const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/staffAuthController');
const requireStaffAuth = require('../middleware/staffAuth');

router.post('/login',           ctrl.login);
router.post('/logout',          requireStaffAuth, ctrl.logout);
router.get ('/me',              requireStaffAuth, ctrl.me);
router.post('/change-password', requireStaffAuth, ctrl.changePassword);

module.exports = router;
