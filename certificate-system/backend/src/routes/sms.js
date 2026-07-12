const express = require('express');
const router  = express.Router();
const requireStaffAuth = require('../middleware/staffAuth');
const { requireRole } = require('../middleware/staffAuth');

const students   = require('../controllers/studentProfilesController');
const academic   = require('../controllers/academicController');
const marks      = require('../controllers/marksController');
const bulletins  = require('../controllers/bulletinsController');
const finance    = require('../controllers/financeController');
const notif      = require('../controllers/notificationsController');
const staffMgmt  = require('../controllers/staffMgmtController');
const promotion  = require('../controllers/promotionController');
const excel       = require('../controllers/excelController');
const annualRpt   = require('../controllers/annualReportController');

// All routes use staff auth (supports both Supabase JWT + staff session token)
router.use(requireStaffAuth);

// ── Students ──────────────────────────────────────────────────
// READ: all authenticated staff can view students
router.get   ('/students',        students.getStudents);
router.get   ('/students/stats',  students.getStats);
router.get   ('/students/:id',    students.getStudent);
// WRITE: only secretary, dos, finance (accountant), admin
router.post  ('/students',        requireRole('admin','secretary','dos','finance'), students.createStudent);
router.put   ('/students/:id',    requireRole('admin','secretary','dos','finance'), students.updateStudent);
router.delete('/students/:id',    requireRole('admin','secretary','dos','finance'), students.deleteStudent);
// BULK IMPORT from Excel
router.post  ('/students/import', requireRole('admin','secretary','dos','finance'), students.importStudents);

// ── Academic ──────────────────────────────────────────────────
router.get   ('/academic-years',        academic.getAcademicYears);
router.post  ('/academic-years',        academic.createAcademicYear);
router.put   ('/academic-years/:id',    academic.updateAcademicYear);
router.delete('/academic-years/:id',    academic.deleteAcademicYear);
router.get   ('/terms',                 academic.getTerms);
router.post  ('/terms',                 academic.createTerm);
router.put   ('/terms/:id',             academic.updateTerm);
router.delete('/terms/:id',             academic.deleteTerm);
router.get   ('/classes',               academic.getClasses);
router.post  ('/classes',               academic.createClass);
router.put   ('/classes/:id',           academic.updateClass);
router.delete('/classes/:id',           academic.deleteClass);
router.get   ('/subjects',              academic.getSubjects);
router.post  ('/subjects',              academic.createSubject);
router.put   ('/subjects/:id',          academic.updateSubject);
router.delete('/subjects/:id',          academic.deleteSubject);
router.get   ('/class-subjects',        academic.getClassSubjects);
router.post  ('/class-subjects',        academic.assignSubject);
router.delete('/class-subjects/:id',    academic.unassignSubject);
router.get   ('/staff',                 academic.getStaff);
router.post  ('/staff',                 academic.createStaff);
router.put   ('/staff/:id',             academic.updateStaff);

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

// ── Admin: Staff Management (admin only) ──────────────────────
router.get   ('/admin/staff',               requireRole('admin'), staffMgmt.getStaff);
router.get   ('/admin/roles',               staffMgmt.getRoles);
router.post  ('/admin/staff',               requireRole('admin'), staffMgmt.createStaff);
router.put   ('/admin/staff/:id',           requireRole('admin'), staffMgmt.updateStaff);
router.delete('/admin/staff/:id',           requireRole('admin'), staffMgmt.deactivateStaff);
router.post  ('/admin/staff/:id/reset-password', requireRole('admin'), staffMgmt.resetPassword);

// ── Promotion (DoS + admin) ───────────────────────────────────
router.get ('/promotion/report',    requireRole('admin','dos'), promotion.getPromotionReport);
router.post('/promotion/apply',     requireRole('admin','dos'), promotion.applyPromotion);
router.get ('/promotion/history',   requireRole('admin','dos'), promotion.getHistory);

// ── Excel Export ──────────────────────────────────────────────
router.get('/excel/students',     requireRole('admin','secretary','finance'), excel.exportStudents);
router.get('/excel/finance',      requireRole('admin','finance'),             excel.exportFinance);
router.get('/excel/class-report', requireRole('admin','dos','secretary','teacher'), excel.exportClassReport);

// ── Annual Report (Progressive School Report) ─────────────────
router.get('/excel/annual-report',         requireRole('admin','dos','secretary'), annualRpt.generateAnnualReport);
router.get('/excel/annual-report/student', requireRole('admin','dos','secretary'), annualRpt.generateOneAnnualReport);

// ── Documents (Secretary + Admin) ─────────────────────────────
const docs = require('../controllers/documentsController');
router.get   ('/documents/folders',      requireRole('admin','secretary'), docs.getFolders);
router.post  ('/documents/folders',      requireRole('admin','secretary'), docs.createFolder);
router.put   ('/documents/folders/:id',  requireRole('admin','secretary'), docs.updateFolder);
router.delete('/documents/folders/:id',  requireRole('admin','secretary'), docs.deleteFolder);
router.get   ('/documents',              requireRole('admin','secretary'), docs.getDocuments);
router.post  ('/documents',              requireRole('admin','secretary'), docs.uploadDocument);
router.delete('/documents/:id',          requireRole('admin','secretary'), docs.deleteDocument);

module.exports = router;
