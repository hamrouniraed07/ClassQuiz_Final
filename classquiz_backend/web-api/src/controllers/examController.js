const Exam = require('../models/Exam');
const { sendFormData } = require('../utils/aiClient');
const { CLASS_LEVELS, SUBJECTS } = require('../utils/constants');
const { success, created, notFound, badRequest, error } = require('../utils/response');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../utils/logger');

const OCR_THRESHOLD = parseInt(process.env.OCR_CONFIDENCE_THRESHOLD) || 70;

/**
 * POST /api/exams
 */
const createExam = async (req, res) => {
  const { title, subject, classLevel } = req.body;

  if (subject && !SUBJECTS.includes(subject)) {
    return badRequest(res, `Invalid subject. Must be one of: ${SUBJECTS.join(', ')}`);
  }
  if (classLevel && !CLASS_LEVELS.includes(classLevel)) {
    return badRequest(res, `Invalid class level. Must be one of: ${CLASS_LEVELS.join(', ')}`);
  }

  const correctedFiles = req.files?.correctedExam || [];
  const blankFiles = req.files?.blankExam || [];

  if (!correctedFiles.length) {
    return badRequest(res, 'At least one corrected exam image is required');
  }

  const exam = await Exam.create({
    title,
    subject,
    classLevel,
    totalScore: 0,
    questions: [],
    status: 'processing',
    correctedExamImages: correctedFiles.map((f) => ({
      path: f.path,
      originalName: f.originalname,
    })),
    blankExamImages: blankFiles.map((f) => ({
      path: f.path,
      originalName: f.originalname,
    })),
  });

  // Trigger AI OCR asynchronously
  processExamOCR(exam._id).catch((err) => {
    logger.error(`OCR processing failed for exam ${exam._id}:`, err);
  });

  return created(res, exam, 'Exam created. OCR processing started.');
};

/**
 * Core OCR processing — stores per-question confidence + exam-level confidence
 */
async function processExamOCR(examId) {
  const exam = await Exam.findById(examId);
  if (!exam) throw new Error(`Exam ${examId} not found`);

  try {
    await Exam.findByIdAndUpdate(examId, { status: 'processing' });

    const form = new FormData();

    for (const img of exam.correctedExamImages) {
      form.append('corrected_images', fs.createReadStream(img.path), {
        filename: img.originalName,
      });
    }

    for (const img of exam.blankExamImages) {
      form.append('blank_images', fs.createReadStream(img.path), {
        filename: img.originalName,
      });
    }

    const result = await sendFormData('/ocr/extract-exam', form);

    // Map AI response to our question schema, enriching with confidence
    const overallConfidence = result.confidence_score || 0;
    const questions = (result.questions || []).map((q) => {
      // AI service returns confidence_score at overall level.
      // We simulate per-question confidence based on overall + text quality heuristics.
      // If the AI service later adds per-question confidence, we use it directly.
      const qConfidence = q.confidence_score != null
        ? q.confidence_score
        : overallConfidence;

      return {
        number: q.number,
        text: q.text,
        correctAnswer: q.correct_answer,
        maxScore: q.max_score,
        type: q.type || 'short_answer',
        confidence: Math.round(qConfidence * 100) / 100,
        needsValidation: qConfidence < OCR_THRESHOLD,
      };
    });

    const totalScore = questions.reduce((s, q) => s + q.maxScore, 0);
    const hasLowConfidence = questions.some((q) => q.needsValidation);

    await Exam.findByIdAndUpdate(examId, {
      questions,
      totalScore,
      ocrConfidence: Math.round(overallConfidence * 100) / 100,
      ocrNotes: result.notes || null,
      status: hasLowConfidence ? 'draft' : 'active',
      ocrProcessedAt: new Date(),
    });

    logger.info(
      `Exam OCR completed for ${examId}: ${questions.length} questions, confidence: ${overallConfidence.toFixed(1)}%`
    );
  } catch (err) {
    await Exam.findByIdAndUpdate(examId, {
      status: 'draft',
      ocrNotes: `OCR failed: ${err.message}`,
    });
    logger.error(`Exam OCR failed for ${examId}:`, err);
    throw err;
  }
}

/**
 * POST /api/exams/:id/ocr
 * Manually trigger OCR processing for an exam.
 * Returns immediately with status; client polls GET /exams/:id for results.
 */
const triggerOCR = async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return notFound(res, 'Exam not found');

  if (!exam.correctedExamImages.length) {
    return badRequest(res, 'No corrected exam images to process');
  }

  // Reset state for re-processing
  await Exam.findByIdAndUpdate(exam._id, {
    status: 'processing',
    questions: [],
    totalScore: 0,
    ocrConfidence: null,
    ocrNotes: null,
    ocrProcessedAt: null,
  });

  // Fire OCR asynchronously
  processExamOCR(exam._id).catch((err) =>
    logger.error(`OCR trigger failed for exam ${exam._id}:`, err)
  );

  return success(res, { examId: exam._id, status: 'processing' }, 'OCR processing started. Poll GET /exams/:id for results.');
};

/**
 * PUT /api/exams/:id/questions
 * Admin edits/validates extracted questions (e.g. after low-confidence OCR).
 * Accepts the full questions array; marks edited questions as validated.
 */
const updateQuestions = async (req, res) => {
  const { questions } = req.body;
  if (!questions || !Array.isArray(questions)) {
    return badRequest(res, 'questions array is required');
  }

  const exam = await Exam.findById(req.params.id);
  if (!exam) return notFound(res, 'Exam not found');

  // Map incoming questions — mark all as validated (confidence 100, needsValidation false)
  const updatedQuestions = questions.map((q) => ({
    number: q.number,
    text: q.text,
    correctAnswer: q.correctAnswer,
    maxScore: q.maxScore,
    type: q.type || 'short_answer',
    confidence: 100, // Admin-validated = full confidence
    needsValidation: false,
  }));

  const totalScore = updatedQuestions.reduce((s, q) => s + q.maxScore, 0);

  const updated = await Exam.findByIdAndUpdate(
    req.params.id,
    {
      questions: updatedQuestions,
      totalScore,
      status: 'active', // All questions validated → activate
    },
    { new: true, runValidators: true }
  );

  return success(res, updated, 'Questions validated and exam activated');
};

/**
 * GET /api/exams
 */
const getExams = async (req, res) => {
  const { classLevel, status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (classLevel) filter.classLevel = classLevel;
  if (status) filter.status = status;

  const [exams, total] = await Promise.all([
    Exam.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .select('-questions'),
    Exam.countDocuments(filter),
  ]);

  return success(res, {
    exams,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

/**
 * GET /api/exams/:id
 */
const getExam = async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return notFound(res, 'Exam not found');
  return success(res, exam);
};

/**
 * PUT /api/exams/:id
 */
const updateExam = async (req, res) => {
  const { title, subject, classLevel, questions, status } = req.body;

  if (subject && !SUBJECTS.includes(subject)) {
    return badRequest(res, `Invalid subject. Must be one of: ${SUBJECTS.join(', ')}`);
  }
  if (classLevel && !CLASS_LEVELS.includes(classLevel)) {
    return badRequest(res, `Invalid class level. Must be one of: ${CLASS_LEVELS.join(', ')}`);
  }

  const exam = await Exam.findByIdAndUpdate(
    req.params.id,
    {
      ...(title && { title }),
      ...(subject && { subject }),
      ...(classLevel && { classLevel }),
      ...(questions && {
        questions,
        totalScore: questions.reduce((s, q) => s + q.maxScore, 0),
      }),
      ...(status && { status }),
    },
    { new: true, runValidators: true }
  );

  if (!exam) return notFound(res, 'Exam not found');
  return success(res, exam, 'Exam updated');
};

/**
 * DELETE /api/exams/:id
 */
const deleteExam = async (req, res) => {
  const exam = await Exam.findByIdAndUpdate(
    req.params.id,
    { status: 'archived' },
    { new: true }
  );
  if (!exam) return notFound(res, 'Exam not found');
  return success(res, null, 'Exam archived');
};

/**
 * POST /api/exams/:id/reprocess — alias kept for backward compatibility
 */
const reprocessExam = async (req, res) => {
  return triggerOCR(req, res);
};

module.exports = {
  createExam,
  getExams,
  getExam,
  updateExam,
  deleteExam,
  reprocessExam,
  triggerOCR,
  updateQuestions,
};