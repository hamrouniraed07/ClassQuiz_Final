const StudentExam = require('../models/StudentExam');
const Student = require('../models/Student');
const Exam = require('../models/Exam');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { success, notFound, badRequest, error } = require('../utils/response');
const logger = require('../utils/logger');

const CLASS_LEVEL_LABELS = {
  '1ere': '1ère année',
  '2eme': '2ème année',
  '3eme': '3ème année',
  '4eme': '4ème année',
  '5eme': '5ème année',
  '6eme': '6ème année',
};

const REPORTS_DIR = path.join(process.env.UPLOAD_DIR || './uploads', 'reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

const ARABIC_FONT_CANDIDATES = [
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
];

const ARABIC_FONT_PATH = ARABIC_FONT_CANDIDATES.find((p) => fs.existsSync(p)) || null;

function containsArabic(text) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(text || ''));
}

function applyFont(doc, text, latinFont = 'Helvetica') {
  if (ARABIC_FONT_PATH && containsArabic(text)) {
    doc.font(ARABIC_FONT_PATH);
  } else {
    doc.font(latinFont);
  }
}

function toSafeAsciiFilename(name) {
  const normalized = name
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_');

  return normalized || 'ClassQuiz_Report.pdf';
}

function encodeRFC5987Value(value) {
  return encodeURIComponent(value)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');
}

/**
 * POST /api/reports/generate/:studentExamId
 */
const generateReport = async (req, res) => {
  try {
    const output = await generateReportForStudentExam(req.params.studentExamId);

    return success(res, {
      reportPath: `/reports/${path.basename(output.filePath)}`,
      generatedAt: new Date(),
    }, 'Report generated');
  } catch (err) {
    if (err.code === 'NOT_FOUND') return notFound(res, err.message);
    if (err.code === 'BAD_STATUS') return badRequest(res, err.message);
    logger.error('PDF generation error:', err);
    return error(res, 'Failed to generate PDF report');
  }
};

/**
 * Internal helper for generating pedagogical report after evaluation.
 */
async function generateReportForStudentExam(studentExamId) {
  const studentExam = await StudentExam.findById(studentExamId)
    .populate('student')
    .populate('exam');

  if (!studentExam) {
    const e = new Error('Student exam not found');
    e.code = 'NOT_FOUND';
    throw e;
  }

  if (!['evaluated', 'report_ready'].includes(studentExam.status)) {
    const e = new Error(`Cannot generate report for exam in status: ${studentExam.status}`);
    e.code = 'BAD_STATUS';
    throw e;
  }

  const filePath = await buildPDF(studentExam);

  await StudentExam.findByIdAndUpdate(studentExam._id, {
    reportPath: filePath,
    reportGeneratedAt: new Date(),
    status: 'report_ready',
    processingError: null,
  });

  return { studentExamId: studentExam._id, filePath };
}

/**
 * GET /api/reports/download/:studentExamId
 */
const downloadReport = async (req, res) => {
  const studentExam = await StudentExam.findById(req.params.studentExamId)
    .populate('student')
    .populate('exam');

  if (!studentExam) return notFound(res, 'Student exam not found');

  if (!['evaluated', 'report_ready'].includes(studentExam.status)) {
    return badRequest(res, `Cannot download report for exam in status: ${studentExam.status}`);
  }

  // Always rebuild report before download so fixes (e.g., Arabic font rendering)
  // apply to previously generated files as well.
  const refreshedPath = await buildPDF(studentExam);

  await StudentExam.findByIdAndUpdate(studentExam._id, {
    reportPath: refreshedPath,
    reportGeneratedAt: new Date(),
    status: 'report_ready',
    processingError: null,
  });

  if (!fs.existsSync(refreshedPath)) {
    return error(res, 'Report file not found on disk. Please regenerate.', 404);
  }

  const studentCode = studentExam.student?.code || 'student';
  const subject = studentExam.exam?.subject || 'exam';
  const utf8Filename = `ClassQuiz_Report_${studentCode}_${subject}.pdf`.replace(/\s+/g, '_');
  const asciiFilename = toSafeAsciiFilename(utf8Filename);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeRFC5987Value(utf8Filename)}`
  );
  fs.createReadStream(refreshedPath).pipe(res);
};

/**
 * GET /api/reports/exam/:examId
 */
const getExamReport = async (req, res) => {
  const exam = await Exam.findById(req.params.examId);
  if (!exam) return notFound(res, 'Exam not found');

  const studentExams = await StudentExam.find({
    exam: req.params.examId,
    status: { $in: ['evaluated', 'report_ready'] },
  })
    .populate('student', 'name code classLevel')
    .select('totalScore maxPossibleScore percentage grade student status reportPath reportGeneratedAt');

  if (!studentExams.length) {
    return success(res, { exam, summary: null, students: [] });
  }

  const scores = studentExams.map((se) => se.percentage || 0);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const gradeDistribution = studentExams.reduce((acc, se) => {
    acc[se.grade || 'N/A'] = (acc[se.grade || 'N/A'] || 0) + 1;
    return acc;
  }, {});

  return success(res, {
    exam: { _id: exam._id, title: exam.title, subject: exam.subject, classLevel: exam.classLevel },
    summary: {
      totalStudents: studentExams.length,
      averagePercentage: Math.round(avg * 100) / 100,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      passRate: Math.round((scores.filter((s) => s >= 50).length / scores.length) * 100),
      gradeDistribution,
    },
    students: studentExams.sort((a, b) => (b.percentage || 0) - (a.percentage || 0)),
  });
};

/**
 * Build PDF using PDFKit
 */
async function buildPDF(studentExam) {
  return new Promise((resolve, reject) => {
    const student = studentExam.student;
    const exam = studentExam.exam;
    const filePath = path.join(REPORTS_DIR, `report_${studentExam._id}.pdf`);
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fillColor('#1a237e')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('ClassQuiz — Exam Report', { align: 'center' })
      .moveDown(0.5);

    doc
      .strokeColor('#1a237e')
      .lineWidth(2)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(1);

    // ── Student Info ─────────────────────────────────────────────────────────
    doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('Student Information');
    doc.moveDown(0.3);

    const classLabel = CLASS_LEVEL_LABELS[student.classLevel] || student.classLevel;

    const info = [
      ['Name', student.name],
      ['Code', student.code],
      ['Class', classLabel],
      ['Exam', exam.title],
      ['Subject', exam.subject],
      ['Date', new Date(studentExam.evaluatedAt).toLocaleDateString('en-US', { dateStyle: 'long' })],
    ];

    doc.fontSize(10);
    info.forEach(([label, value]) => {
      doc.font('Helvetica').text(`${label}:  `, { continued: true });
      applyFont(doc, value, 'Helvetica');
      doc.fillColor('#333').text(String(value));
      doc.fillColor('#000');
    });

    doc.moveDown(1);

    // ── Score Summary ────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(14).text('Score Summary');
    doc.moveDown(0.3);

    const gradeColor =
      studentExam.percentage >= 75 ? '#1b5e20' :
      studentExam.percentage >= 50 ? '#e65100' : '#b71c1c';

    doc
      .fillColor(gradeColor)
      .fontSize(28)
      .font('Helvetica-Bold')
      .text(
        `${studentExam.totalScore} / ${studentExam.maxPossibleScore}  (${studentExam.percentage}%)  — Grade: ${studentExam.grade}`,
        { align: 'center' }
      );

    doc.fillColor('#000').moveDown(1);

    // ── Per-Question Breakdown ───────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(14).text('Answer Breakdown').moveDown(0.5);

    studentExam.answers.forEach((answer) => {
      const questionData = exam.questions.find((q) => q.number === answer.questionNumber);

      const questionText = questionData?.text || 'Question text unavailable';

      doc.fillColor('#1a237e').font('Helvetica-Bold').fontSize(11).text(`Q${answer.questionNumber}: `, { continued: true });
      applyFont(doc, questionText, 'Helvetica-Bold');
      doc.text(String(questionText)).moveDown(0.2);

      doc.fillColor('#000').font('Helvetica').fontSize(10);

      doc.text('Student Answer: ', { continued: true });
      const studentAnswerText = answer.correctedText || answer.extractedText || '(no answer)';
      applyFont(doc, studentAnswerText);
      doc.fillColor('#424242').text(String(studentAnswerText));

      doc.fillColor('#1b5e20').font('Helvetica').text('Correct Answer: ', { continued: true });
      const correctAnswerText = questionData?.correctAnswer || 'N/A';
      applyFont(doc, correctAnswerText);
      doc.fillColor('#424242').text(String(correctAnswerText));

      doc.fillColor('#000').text('Score: ', { continued: true })
        .text(`${answer.score ?? '?'} / ${answer.maxScore}`);

      if (answer.mistakeType && answer.mistakeType !== 'correct') {
        doc.fillColor('#b71c1c').text(`Mistake Type: ${answer.mistakeType.replace('_', ' ')}`);
        doc.fillColor('#000');
      }

      if (answer.feedback) {
        doc.fillColor('#37474f')
          .font('Helvetica-Oblique')
          .fontSize(9)
          .text(`Feedback: ${answer.feedback}`);
        doc.font('Helvetica').fillColor('#000').fontSize(10);
      }

      doc
        .strokeColor('#e0e0e0')
        .lineWidth(0.5)
        .moveTo(50, doc.y + 5)
        .lineTo(545, doc.y + 5)
        .stroke()
        .moveDown(1);
    });

    // ── Footer ───────────────────────────────────────────────────────────────
    doc
      .fillColor('#9e9e9e')
      .fontSize(8)
      .text(
        `Generated by ClassQuiz on ${new Date().toISOString()}`,
        50,
        doc.page.height - 40,
        { align: 'center' }
      );

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

module.exports = { generateReport, downloadReport, getExamReport, generateReportForStudentExam };