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
  confirmExam,
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

// OCR: extract only (does NOT save to DB)
router.post('/:id/ocr', triggerOCR);
router.post('/:id/reprocess', reprocessExam);

// Confirm: admin-validated questions → saved to DB
router.post('/:id/confirm', confirmExam);

module.exports = router;