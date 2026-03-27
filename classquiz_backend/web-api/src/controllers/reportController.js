const StudentExam = require('../models/StudentExam');
const Student = require('../models/Student');
const Exam = require('../models/Exam');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { success, notFound, badRequest, error } = require('../utils/response');
const { CLASS_LEVELS } = require('../utils/constants');
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

  if (studentExam.status !== 'evaluated') {
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
  if (!studentExam.reportPath) return badRequest(res, 'Report not yet generated');

  if (!fs.existsSync(studentExam.reportPath)) {
    return error(res, 'Report file not found on disk. Please regenerate.', 404);
  }

  const filename = `ClassQuiz_Report_${studentExam.student.code}_${studentExam.exam.subject}.pdf`
    .replace(/\s+/g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  fs.createReadStream(studentExam.reportPath).pipe(res);
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
    .select('totalScore maxPossibleScore percentage grade student status');

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

    doc.font('Helvetica').fontSize(10);
    info.forEach(([label, value]) => {
      doc.text(`${label}:  `, { continued: true }).fillColor('#333').text(value);
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

      doc
        .fillColor('#1a237e')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(`Q${answer.questionNumber}: ${questionData?.text || 'Question text unavailable'}`)
        .moveDown(0.2);

      doc.fillColor('#000').font('Helvetica').fontSize(10);

      doc.text('Student Answer: ', { continued: true })
        .fillColor('#424242')
        .text(answer.correctedText || answer.extractedText || '(no answer)');

      doc.fillColor('#1b5e20').text('Correct Answer: ', { continued: true })
        .fillColor('#424242')
        .text(questionData?.correctAnswer || 'N/A');

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