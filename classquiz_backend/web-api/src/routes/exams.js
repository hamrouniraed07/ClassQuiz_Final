const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { examImageUpload } = require('../middleware/upload');
const {
  createExam,
  getExams,
  getExam,
  updateExam,
  deleteExam,
  reprocessExam,
  triggerOCR,
  updateQuestions,
} = require('../controllers/examController');

router.use(authenticate);

router.route('/')
  .get(getExams)
  .post(
    examImageUpload.fields([
      { name: 'correctedExam', maxCount: 10 },
      { name: 'blankExam', maxCount: 10 },
    ]),
    createExam
  );

router.route('/:id')
  .get(getExam)
  .put(updateExam)
  .delete(deleteExam);

// OCR endpoints
router.post('/:id/ocr', triggerOCR);
router.post('/:id/reprocess', reprocessExam);
router.put('/:id/questions', updateQuestions);

module.exports = router;