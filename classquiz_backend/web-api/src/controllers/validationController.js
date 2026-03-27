const Validation = require('../models/Validation');
const StudentExam = require('../models/StudentExam');
const { runEvaluationAndReport } = require('./studentExamController');
const { success, notFound, badRequest } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * GET /api/validations
 * List validations with optional filters
 */
const getValidations = async (req, res) => {
  const { status, examId, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (examId) filter.exam = examId;

  const [validations, total] = await Promise.all([
    Validation.find(filter)
      .populate('student', 'name code class')
      .populate('exam', 'title subject')
      .populate('studentExam', 'examImagePath ocrConfidenceAvg status')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit)),
    Validation.countDocuments(filter),
  ]);

  return success(res, {
    validations,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
};

/**
 * GET /api/validations/:id
 */
const getValidation = async (req, res) => {
  const validation = await Validation.findById(req.params.id)
    .populate('student', 'name code class')
    .populate('exam', 'title subject questions')
    .populate('studentExam', 'examImagePath answers ocrConfidenceAvg');

  if (!validation) return notFound(res, 'Validation not found');
  return success(res, validation);
};

/**
 * POST /api/validations/:id/review
 * Admin submits corrections for flagged answers
 */
const submitReview = async (req, res) => {
  const { corrections, notes } = req.body;
  // corrections: [{ questionNumber, correctedText }]

  const validation = await Validation.findById(req.params.id).populate('studentExam');
  if (!validation) return notFound(res, 'Validation not found');

  if (validation.status === 'completed') {
    return badRequest(res, 'Validation already completed');
  }

  if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
    return badRequest(res, 'Corrections array is required');
  }

  // Update validation record
  validation.corrections = corrections;
  validation.notes = notes || null;
  validation.status = 'completed';
  validation.reviewedBy = req.user.username;
  validation.reviewedAt = new Date();
  validation.correctionCount = corrections.length;
  await validation.save();

  // Apply corrections to StudentExam answers
  const studentExam = validation.studentExam;
  const updatedAnswers = studentExam.answers.map((answer) => {
    const correction = corrections.find(
      (c) => c.questionNumber === answer.questionNumber
    );
    if (correction) {
      return {
        ...answer.toObject(),
        correctedText: correction.correctedText,
      };
    }
    return answer.toObject();
  });

  await StudentExam.findByIdAndUpdate(studentExam._id, {
    answers: updatedAnswers,
    status: 'validated',
    processingError: null,
  });

  runEvaluationAndReport(studentExam._id).catch((err) =>
    logger.error(`Auto pipeline failed after validation for studentExam ${studentExam._id}:`, err)
  );

  logger.info(
    `Validation ${validation._id} completed by ${req.user.username}: ${corrections.length} corrections applied`
  );

  return success(res, validation, 'Review submitted and corrections applied');
};

/**
 * POST /api/validations/:id/skip
 * Skip validation — mark OCR as good enough
 */
const skipValidation = async (req, res) => {
  const validation = await Validation.findById(req.params.id);
  if (!validation) return notFound(res, 'Validation not found');

  validation.status = 'skipped';
  validation.reviewedBy = req.user.username;
  validation.reviewedAt = new Date();
  await validation.save();

  await StudentExam.findByIdAndUpdate(validation.studentExam, {
    status: 'validated',
    processingError: null,
  });

  runEvaluationAndReport(validation.studentExam).catch((err) =>
    logger.error(`Auto pipeline failed after skip for studentExam ${validation.studentExam}:`, err)
  );

  return success(res, null, 'Validation skipped. Exam marked as validated.');
};

/**
 * GET /api/validations/stats
 * Pending/completed counts
 */
const getValidationStats = async (req, res) => {
  const stats = await Validation.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const result = { pending: 0, in_review: 0, completed: 0, skipped: 0 };
  stats.forEach((s) => {
    result[s._id] = s.count;
  });

  return success(res, result);
};

module.exports = {
  getValidations,
  getValidation,
  submitReview,
  skipValidation,
  getValidationStats,
};
