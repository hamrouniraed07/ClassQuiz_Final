const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createStudent,
  getStudents,
  getStudent,
  updateStudent,
  deleteStudent,
  getStudentPerformance,
} = require('../controllers/studentController');

router.use(authenticate);

router.route('/')
  .get(getStudents)
  .post(createStudent);

router.route('/:id')
  .get(getStudent)
  .put(updateStudent)
  .delete(deleteStudent);

router.get('/:id/performance', getStudentPerformance);

module.exports = router;
