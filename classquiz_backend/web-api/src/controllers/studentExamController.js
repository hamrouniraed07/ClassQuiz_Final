const StudentExam = require('../models/StudentExam');
const Student = require('../models/Student');
const Exam = require('../models/Exam');
const Validation = require('../models/Validation');
const BatchUpload = require('../models/BatchUpload');
const { sendFormData, sendJSON } = require('../utils/aiClient');
const { generateReportForStudentExam } = require('./reportController');
const { success, created, notFound, badRequest, error } = require('../utils/response');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../utils/logger');

const OCR_THRESHOLD = parseInt(process.env.OCR_CONFIDENCE_THRESHOLD) || 70;

/**
 * POST /api/student-exams
 * Upload a single student exam image → trigger OCR
 */
const uploadStudentExam = async (req, res) => {
  const { studentId, examId } = req.body;
  const file = req.file;

  if (!file) return badRequest(res, 'Exam image is required');

  const [student, exam] = await Promise.all([
    Student.findById(studentId),
    Exam.findById(examId),
  ]);

  if (!student) return notFound(res, 'Student not found');
  if (!exam) return notFound(res, 'Exam not found');
  if (exam.status !== 'active') return badRequest(res, 'Exam is not active for submissions');

  // Check for duplicate
  const existing = await StudentExam.findOne({ student: studentId, exam: examId });
  if (existing) return badRequest(res, 'This student already has an exam submission');

  const studentExam = await StudentExam.create({
    student: studentId,
    exam: examId,
    examImagePath: file.path,
    examImageOriginalName: file.originalname,
    maxPossibleScore: exam.totalScore,
    status: 'uploaded',
  });

  // Trigger OCR asynchronously
  processStudentExamOCR(studentExam, exam).catch((err) =>
    logger.error(`OCR failed for studentExam ${studentExam._id}:`, err)
  );

  return created(res, studentExam, 'Student exam uploaded. OCR processing started.');
};

/**
 * Core OCR processing flow
 */
async function processStudentExamOCR(studentExam, exam) {
  try {
    await StudentExam.findByIdAndUpdate(studentExam._id, { status: 'ocr_processing' });

    const form = new FormData();
    form.append('student_exam_image', fs.createReadStream(studentExam.examImagePath), {
      filename: studentExam.examImageOriginalName || 'exam.jpg',
    });
    form.append('questions', JSON.stringify(exam.questions));
    form.append('exam_id', exam._id.toString());

    const ocrResult = await sendFormData('/ocr/extract-answers', form);

    const answers = ocrResult.answers.map((a) => ({
      questionNumber: a.question_number,
      extractedText: a.extracted_text,
      confidenceScore: a.confidence_score,
      maxScore: exam.questions.find((q) => q.number === a.question_number)?.maxScore || 0,
    }));

    const avgConfidence =
      answers.reduce((s, a) => s + (a.confidenceScore || 0), 0) / answers.length;

    const requiresValidation = answers.some(
      (a) => (a.confidenceScore || 0) < OCR_THRESHOLD
    );

    const status = requiresValidation ? 'validation_pending' : 'ocr_done';

    await StudentExam.findByIdAndUpdate(studentExam._id, {
      answers,
      ocrConfidenceAvg: Math.round(avgConfidence * 100) / 100,
      requiresValidation,
      status,
      ocrCompletedAt: new Date(),
      processingError: null,
    });

    // Create validation record if needed
    if (requiresValidation) {
      const flaggedAnswers = answers
        .filter((a) => (a.confidenceScore || 0) < OCR_THRESHOLD)
        .map((a) => ({
          questionNumber: a.questionNumber,
          extractedText: a.extractedText,
          confidenceScore: a.confidenceScore,
        }));

      await Validation.create({
        studentExam: studentExam._id,
        exam: studentExam.exam,
        student: studentExam.student,
        flaggedAnswers,
        status: 'pending',
      });

      logger.info(
        `Validation created for studentExam ${studentExam._id}: ${flaggedAnswers.length} flagged answers`
      );
    }

    if (!requiresValidation) {
      runEvaluationAndReport(studentExam._id).catch((err) =>
        logger.error(`Auto pipeline failed for studentExam ${studentExam._id}:`, err)
      );
    }

    logger.info(`OCR completed for studentExam ${studentExam._id}, avgConfidence: ${avgConfidence.toFixed(1)}%`);
  } catch (err) {
    await StudentExam.findByIdAndUpdate(studentExam._id, {
      status: 'failed',
      processingError: err.message,
    });
    throw err;
  }
}

/**
* POST /api/student-exams/:id/evaluate
* Trigger Ollama Llama3.2 evaluation
 */
const evaluateStudentExam = async (req, res) => {
  const studentExam = await StudentExam.findById(req.params.id).populate('exam').populate('student');
  if (!studentExam) return notFound(res, 'Student exam not found');

  const allowedStatuses = ['ocr_done', 'validated'];
  if (!allowedStatuses.includes(studentExam.status)) {
    return badRequest(res, `Cannot evaluate exam in status: ${studentExam.status}`);
  }

  runEvaluationAndReport(studentExam._id).catch((err) =>
    logger.error(`Evaluation failed for studentExam ${studentExam._id}:`, err)
  );

  return success(res, null, 'Evaluation started');
};

async function runEvaluationAndReport(studentExamId) {
  const current = await StudentExam.findById(studentExamId).populate('exam').populate('student');
  if (!current) throw new Error('Student exam not found');

  const allowedStatuses = ['ocr_done', 'validated'];
  if (!allowedStatuses.includes(current.status)) {
    throw new Error(`Cannot auto-evaluate exam in status: ${current.status}`);
  }

  await StudentExam.findByIdAndUpdate(studentExamId, {
    status: 'evaluating',
    processingError: null,
  });

  await evaluateWithAI(current);

  try {
    await generateReportForStudentExam(studentExamId);
    logger.info(`Auto report generated for studentExam ${studentExamId}`);
  } catch (err) {
    await StudentExam.findByIdAndUpdate(studentExamId, {
      processingError: `Report generation failed: ${err.message}`,
    });
    logger.warn(`Auto report generation failed for studentExam ${studentExamId}: ${err.message}`);
  }
}

/**
 * Core evaluation flow
 */
async function evaluateWithAI(studentExam) {
  try {
    const exam = studentExam.exam;

    const payload = {
      student_exam_id: studentExam._id.toString(),
      questions: exam.questions.map((q) => ({
        number: q.number,
        text: q.text,
        correct_answer: q.correctAnswer,
        max_score: q.maxScore,
        type: q.type,
      })),
      student_answers: studentExam.answers.map((a) => ({
        question_number: a.questionNumber,
        answer_text: a.correctedText || a.extractedText,
        max_score: a.maxScore,
      })),
    };

    const evalResult = await sendJSON('/evaluate/grade', payload);

    // Map results back
    const updatedAnswers = studentExam.answers.map((answer) => {
      const result = evalResult.results.find(
        (r) => r.question_number === answer.questionNumber
      );
      if (result) {
        return {
          ...answer.toObject(),
          score: result.score,
          feedback: result.feedback,
          mistakeType: result.mistake_type,
          evaluatedAt: new Date(),
        };
      }
      return answer.toObject();
    });

    const totalScore = updatedAnswers.reduce((s, a) => s + (a.score || 0), 0);
    const percentage =
      studentExam.maxPossibleScore > 0
        ? Math.round((totalScore / studentExam.maxPossibleScore) * 10000) / 100
        : 0;

    await StudentExam.findByIdAndUpdate(studentExam._id, {
      answers: updatedAnswers,
      totalScore,
      percentage,
      status: 'evaluated',
      evaluatedAt: new Date(),
    });

    logger.info(
      `Evaluation completed for studentExam ${studentExam._id}: ${totalScore}/${studentExam.maxPossibleScore} (${percentage}%)`
    );
  } catch (err) {
    // Keep the item in its post-OCR state so OCR results remain accessible,
    // even when grading/report steps fail (e.g., external API key issues).
    const fallbackStatus = studentExam.status === 'validated' ? 'validated' : 'ocr_done';
    await StudentExam.findByIdAndUpdate(studentExam._id, {
      status: fallbackStatus,
      processingError: `Evaluation failed: ${err.message}`,
    });
    throw err;
  }
}

/**
 * GET /api/student-exams
 */
const getStudentExams = async (req, res) => {
  const { examId, studentId, status, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (examId) filter.exam = examId;
  if (studentId) filter.student = studentId;
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    StudentExam.find(filter)
      .populate('student', 'name code class')
      .populate('exam', 'title subject class')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .select('-answers'), // Omit answers in list
    StudentExam.countDocuments(filter),
  ]);

  return success(res, {
    studentExams: items,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

/**
 * GET /api/student-exams/:id
 */
const getStudentExam = async (req, res) => {
  const studentExam = await StudentExam.findById(req.params.id)
    .populate('student', 'name code class')
    .populate('exam', 'title subject class questions totalScore');

  if (!studentExam) return notFound(res, 'Student exam not found');
  return success(res, studentExam);
};

/**
 * POST /api/student-exams/batch
 * Upload multiple student exams at once
 */
const batchUploadExams = async (req, res) => {
  const { examId, mappings } = req.body; // mappings: JSON string [{ studentId, fileName }]
  const files = req.files || [];

  if (!files.length) return badRequest(res, 'No files uploaded');

  const exam = await Exam.findById(examId);
  if (!exam) return notFound(res, 'Exam not found');
  if (exam.status !== 'active') return badRequest(res, 'Exam is not active');

  let parsedMappings;
  try {
    parsedMappings = typeof mappings === 'string' ? JSON.parse(mappings) : mappings;
  } catch {
    return badRequest(res, 'Invalid mappings JSON');
  }

  if (parsedMappings.length !== files.length) {
    return badRequest(res, `Mismatch: ${files.length} files but ${parsedMappings.length} mappings`);
  }

  // Create batch record
  const batchItems = parsedMappings.map((m, i) => ({
    studentId: m.studentId,
    imagePath: files[i].path,
    originalName: files[i].originalname,
    status: 'pending',
  }));

  const batch = await BatchUpload.create({
    exam: examId,
    items: batchItems,
    totalCount: batchItems.length,
    pendingCount: batchItems.length,
    status: 'created',
  });

  // Process batch asynchronously
  processBatch(batch, exam).catch((err) =>
    logger.error(`Batch ${batch._id} processing failed:`, err)
  );

  return created(res, batch, 'Batch upload created. Processing started.');
};

async function processBatch(batch, exam) {
  await BatchUpload.findByIdAndUpdate(batch._id, { status: 'processing' });

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < batch.items.length; i++) {
    const item = batch.items[i];
    try {
      const student = await Student.findById(item.studentId);
      if (!student) throw new Error('Student not found');

      const existing = await StudentExam.findOne({
        student: item.studentId,
        exam: batch.exam,
      });
      if (existing) throw new Error('Duplicate submission for this student');

      const se = await StudentExam.create({
        student: item.studentId,
        exam: batch.exam,
        batchUpload: batch._id,
        examImagePath: item.imagePath,
        examImageOriginalName: item.originalName,
        maxPossibleScore: exam.totalScore,
        status: 'uploaded',
      });

      batch.items[i].studentExamId = se._id;
      batch.items[i].status = 'success';
      successCount++;

      // Fire OCR without waiting
      processStudentExamOCR(se, exam).catch((err) =>
        logger.error(`Batch OCR error for item ${i}:`, err)
      );
    } catch (err) {
      batch.items[i].status = 'failed';
      batch.items[i].error = err.message;
      failedCount++;
      logger.warn(`Batch item ${i} failed: ${err.message}`);
    }
  }

  const finalStatus =
    failedCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'partial';

  await BatchUpload.findByIdAndUpdate(batch._id, {
    items: batch.items,
    successCount,
    failedCount,
    pendingCount: 0,
    status: finalStatus,
    completedAt: new Date(),
  });

  logger.info(`Batch ${batch._id} done: ${successCount} ok, ${failedCount} failed`);
}

/**
 * GET /api/student-exams/batch/:batchId
 */
const getBatch = async (req, res) => {
  const batch = await BatchUpload.findById(req.params.batchId)
    .populate('exam', 'title subject')
    .populate('items.studentId', 'name code class')
    .populate('items.studentExamId', 'status totalScore percentage');

  if (!batch) return notFound(res, 'Batch not found');
  return success(res, batch);
};

module.exports = {
  uploadStudentExam,
  evaluateStudentExam,
  getStudentExams,
  getStudentExam,
  batchUploadExams,
  getBatch,
};
