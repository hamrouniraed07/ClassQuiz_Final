const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { studentExamUpload, batchUpload } = require('../middleware/upload');
const {
  uploadStudentExam,
  evaluateStudentExam,
  getStudentExams,
  getStudentExam,
  batchUploadExams,
  getBatch,
} = require('../controllers/studentExamController');

router.use(authenticate);

router.route('/')
  .get(getStudentExams)
  .post(studentExamUpload.single('examImage'), uploadStudentExam);

router.post(
  '/batch',
  batchUpload.array('examImages', 50),
  batchUploadExams
);

router.get('/batch/:batchId', getBatch);

router.route('/:id').get(getStudentExam);

router.post('/:id/evaluate', evaluateStudentExam);

module.exports = router;
