const express = require('express');
const router  = express.Router();
const requireAuth = require('../middleware/auth');

const students  = require('../controllers/studentProfilesController');
const academic  = require('../controllers/academicController');
const marks     = require('../controllers/marksController');
const bulletins = require('../controllers/bulletinsController');
const finance   = require('../controllers/financeController');
const notif     = require('../controllers/notificationsController');

// All SMS routes require auth
router.use(requireAuth);

// ── Students ──────────────────────────────────────────────────
router.get   ('/students',        students.getStudents);
router.get   ('/students/stats',  students.getStats);
router.get   ('/students/:id',    students.getStudent);
router.post  ('/students',        students.createStudent);
router.put   ('/students/:id',    students.updateStudent);
router.delete('/students/:id',    students.deleteStudent);

// ── Academic ──────────────────────────────────────────────────
router.get ('/academic-years',        academic.getAcademicYears);
router.post('/academic-years',        academic.createAcademicYear);
router.get ('/terms',                 academic.getTerms);
router.post('/terms',                 academic.createTerm);
router.get ('/classes',               academic.getClasses);
router.post('/classes',               academic.createClass);
router.delete('/classes/:id',         academic.deleteClass);
router.get ('/subjects',              academic.getSubjects);
router.post('/subjects',              academic.createSubject);
router.delete('/subjects/:id',        academic.deleteSubject);
router.get ('/staff',                 academic.getStaff);
router.post('/staff',                 academic.createStaff);
router.put ('/staff/:id',             academic.updateStaff);

// ── Marks ─────────────────────────────────────────────────────
router.get ('/marks',                 marks.getMarks);
router.post('/marks',                 marks.upsertMark);
router.post('/marks/bulk',            marks.bulkUpsertMarks);
router.get ('/marks/class-report',    marks.classReport);

// ── Bulletins ─────────────────────────────────────────────────
router.get ('/bulletins',                    bulletins.getBulletins);
router.post('/bulletins/generate',           bulletins.generateOne);
router.post('/bulletins/generate-class',     bulletins.generateClass);

// ── Finance ───────────────────────────────────────────────────
router.get   ('/finance/fee-structure',          finance.getFeeStructure);
router.post  ('/finance/fee-structure',          finance.createFeeStructure);
router.delete('/finance/fee-structure/:id',      finance.deleteFeeStructure);
router.get   ('/finance/payments',               finance.getPayments);
router.post  ('/finance/payments',               finance.recordPayment);
router.get   ('/finance/payments/:id/receipt',   finance.generateReceipt);
router.get   ('/finance/summary',                finance.getFinanceSummary);

// ── Notifications ─────────────────────────────────────────────
router.get ('/notifications',              notif.getNotifications);
router.post('/notifications/fee-reminder', notif.sendFeeReminder);
router.post('/notifications/bulletin',     notif.notifyBulletinReady);
router.post('/notifications/custom',       notif.sendCustom);

module.exports = router;
