const Exam = require('../models/Exam');
const { sendFormData } = require('../utils/aiClient');
const { CLASS_LEVELS, SUBJECTS } = require('../utils/constants');
const { success, created, notFound, badRequest, error } = require('../utils/response');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const OCR_THRESHOLD = parseInt(process.env.OCR_CONFIDENCE_THRESHOLD) || 70;
const OCR_MAX_RETRIES = 3;

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.tiff': 'image/tiff', '.tif': 'image/tiff' };
  return map[ext] || 'image/jpeg';
}

const createExam = async (req, res) => {
  const { title, subject, classLevel } = req.body;
  if (subject && !SUBJECTS.includes(subject)) return badRequest(res, `Invalid subject. Must be one of: ${SUBJECTS.join(', ')}`);
  if (classLevel && !CLASS_LEVELS.includes(classLevel)) return badRequest(res, `Invalid class level. Must be one of: ${CLASS_LEVELS.join(', ')}`);

  const correctedFiles = req.files?.correctedExam || [];
  const blankFiles = req.files?.blankExam || [];
  if (!correctedFiles.length) return badRequest(res, 'At least one corrected exam image is required');

  const exam = await Exam.create({
    title, subject, classLevel, totalScore: 0, questions: [], status: 'draft',
    correctedExamImages: correctedFiles.map((f) => ({ path: f.path, originalName: f.originalname })),
    blankExamImages: blankFiles.map((f) => ({ path: f.path, originalName: f.originalname })),
  });

  return created(res, exam, 'Exam created. Use POST /exams/:id/ocr to extract questions.');
};

function buildOCRFormData(exam) {
  const form = new FormData();

  // Add corrected images (required)
  for (const img of exam.correctedExamImages) {
    if (!fs.existsSync(img.path)) {
      throw new Error(`File not found: ${img.originalName}`);
    }
    form.append('corrected_images', fs.createReadStream(img.path), {
      filename: img.originalName || path.basename(img.path),
      contentType: getMimeType(img.path),
    });
  }

  // NOTE: blank_images are intentionally NOT sent.
  // FastAPI's Optional[List[UploadFile]] has issues with single-file uploads from Node.
  // The OCR works well without blank images — they only marginally improve accuracy.

  return form;
}

async function callOCRWithRetry(exam, maxRetries = OCR_MAX_RETRIES) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`OCR attempt ${attempt}/${maxRetries} for exam ${exam._id}`);
      const form = buildOCRFormData(exam);
      const result = await sendFormData('/ocr/extract-exam', form);
      return result;
    } catch (err) {
      lastError = err;
      logger.warn(`OCR attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastError;
}

const triggerOCR = async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return notFound(res, 'Exam not found');
  if (!exam.correctedExamImages || !exam.correctedExamImages.length) return badRequest(res, 'No corrected exam images');

  await Exam.findByIdAndUpdate(exam._id, { status: 'processing' });
raed
  try {
    const result = await callOCRWithRetry(exam);
    const overallConfidence = result.confidence_score || 0;

    const extractedQuestions = (result.questions || []).map((q) => ({
      number: q.number,
      text: q.text,
      correctAnswer: q.correct_answer,
      maxScore: q.max_score,
      type: q.type || 'short_answer',
      confidence: Math.round((q.confidence_score != null ? q.confidence_score : overallConfidence) * 100) / 100,
      needsValidation: (q.confidence_score != null ? q.confidence_score : overallConfidence) < OCR_THRESHOLD,
    }));

    await Exam.findByIdAndUpdate(exam._id, { status: 'draft' });

    logger.info(`OCR done for exam ${exam._id}: ${extractedQuestions.length} questions, confidence: ${overallConfidence.toFixed(1)}%`);

    return success(res, {
      examId: exam._id,
      questions: extractedQuestions,
      totalScore: result.total_score || extractedQuestions.reduce((s, q) => s + q.maxScore, 0),
      overallConfidence: Math.round(overallConfidence * 100) / 100,
      notes: result.notes || null,
      pageCount: result.page_count || 1,
    }, 'OCR extraction complete. Review and confirm to save.');
  } catch (err) {
    await Exam.findByIdAndUpdate(exam._id, { status: 'draft' });
    logger.error(`OCR failed for exam ${exam._id}: ${err.message}`);
    return error(res, `OCR processing failed: ${err.message}`, 500);
  }
};

const confirmExam = async (req, res) => {
  const { questions } = req.body;
  if (!questions || !Array.isArray(questions) || !questions.length) return badRequest(res, 'questions array is required');

  const exam = await Exam.findById(req.params.id);
  if (!exam) return notFound(res, 'Exam not found');

  const savedQuestions = questions.map((q, i) => ({
    number: q.number || i + 1, text: q.text, correctAnswer: q.correctAnswer,
    maxScore: q.maxScore || 0, type: q.type || 'short_answer',
  }));
  const totalScore = savedQuestions.reduce((s, q) => s + q.maxScore, 0);

  const updated = await Exam.findByIdAndUpdate(req.params.id,
    { questions: savedQuestions, totalScore, status: 'active', ocrProcessedAt: new Date() },
    { new: true, runValidators: true });

  logger.info(`Exam ${exam._id} confirmed: ${savedQuestions.length} questions, ${totalScore} pts`);
  return success(res, updated, 'Exam confirmed and activated');
};

const reprocessExam = async (req, res) => triggerOCR(req, res);

const getExams = async (req, res) => {
  const { classLevel, status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (classLevel) filter.classLevel = classLevel;
  if (status) filter.status = status;
  const [exams, total] = await Promise.all([
    Exam.find(filter).sort({ createdAt: -1 }).skip((parseInt(page) - 1) * parseInt(limit)).limit(parseInt(limit)).select('-questions'),
    Exam.countDocuments(filter),
  ]);
  return success(res, { exams, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
};

const getExam = async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return notFound(res, 'Exam not found');
  return success(res, exam);
};

const updateExam = async (req, res) => {
  const { title, subject, classLevel, questions, status } = req.body;
  const exam = await Exam.findByIdAndUpdate(req.params.id, {
    ...(title && { title }), ...(subject && { subject }), ...(classLevel && { classLevel }),
    ...(questions && { questions, totalScore: questions.reduce((s, q) => s + q.maxScore, 0) }),
    ...(status && { status }),
  }, { new: true, runValidators: true });
  if (!exam) return notFound(res, 'Exam not found');
  return success(res, exam, 'Exam updated');
};

const deleteExam = async (req, res) => {
  const exam = await Exam.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
  if (!exam) return notFound(res, 'Exam not found');
  return success(res, null, 'Exam archived');
};

module.exports = { createExam, getExams, getExam, updateExam, deleteExam, reprocessExam, triggerOCR, confirmExam };