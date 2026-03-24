const Exam = require('../models/Exam');
const { sendFormData } = require('../utils/aiClient');
const { CLASS_LEVELS, SUBJECTS } = require('../utils/constants');
const { success, created, notFound, badRequest, error } = require('../utils/response');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * POST /api/exams
 * Create exam record and upload corrected + blank images → trigger OCR
 */
const createExam = async (req, res) => {
  const { title, subject, classLevel } = req.body;

  if (!SUBJECTS.includes(subject)) {
    return badRequest(res, `Invalid subject. Must be one of: ${SUBJECTS.join(', ')}`);
  }
  if (!CLASS_LEVELS.includes(classLevel)) {
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

  // Trigger AI OCR asynchronously (don't await)
  processExamOCR(exam).catch((err) => {
    logger.error(`OCR processing failed for exam ${exam._id}:`, err);
  });

  return created(res, exam, 'Exam created. OCR processing started.');
};

/**
 * Async background function: send images to AI service for OCR
 */
async function processExamOCR(exam) {
  try {
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

    await Exam.findByIdAndUpdate(exam._id, {
      questions: result.questions,
      totalScore: result.total_score,
      status: 'active',
      ocrProcessedAt: new Date(),
    });

    logger.info(`Exam OCR completed for ${exam._id}: ${result.questions.length} questions extracted`);
  } catch (err) {
    await Exam.findByIdAndUpdate(exam._id, { status: 'draft' });
    logger.error(`Exam OCR failed for ${exam._id}:`, err);
    throw err;
  }
}

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
 * POST /api/exams/:id/reprocess
 */
const reprocessExam = async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return notFound(res, 'Exam not found');
  if (!exam.correctedExamImages.length) {
    return badRequest(res, 'No images to reprocess');
  }

  await Exam.findByIdAndUpdate(exam._id, { status: 'processing' });
  processExamOCR(exam).catch((err) => logger.error('Reprocess OCR failed:', err));

  return success(res, null, 'OCR reprocessing triggered');
};

module.exports = { createExam, getExams, getExam, updateExam, deleteExam, reprocessExam };