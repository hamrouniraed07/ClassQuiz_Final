const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { generateReport, downloadReport, getExamReport } = require('../controllers/reportController');

router.use(authenticate);

router.post('/generate/:studentExamId', generateReport);
router.get('/download/:studentExamId', downloadReport);
router.get('/exam/:examId', getExamReport);

module.exports = router;
