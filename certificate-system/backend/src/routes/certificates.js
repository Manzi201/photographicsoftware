const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/certificateController');

router.get('/', ctrl.getCertificates);
router.get('/batch', ctrl.generateBatch);
router.get('/student/:studentId', ctrl.generateCertificate);

module.exports = router;
