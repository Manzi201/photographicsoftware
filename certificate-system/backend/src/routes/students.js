const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentsController');

router.get('/', ctrl.getStudents);
router.get('/:id', ctrl.getStudent);
router.post('/', ctrl.createStudent);
router.post('/bulk', ctrl.bulkUpload);
router.patch('/:id/photo', ctrl.updatePhoto);
router.delete('/:id', ctrl.deleteStudent);

module.exports = router;
