const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionNumber: { type: Number, required: true },
    extractedText: { type: String, default: '' },
    correctedText: { type: String, default: null }, // Admin override
    confidenceScore: { type: Number, min: 0, max: 100, default: null },
    score: { type: Number, min: 0, default: null },
    maxScore: { type: Number, required: true },
    feedback: { type: String, default: null },
    mistakeType: {
      type: String,
      enum: [
        'correct',
        'partial',
        'conceptual_error',
        'calculation_error',
        'incomplete',
        'off_topic',
        'no_answer',
        null,
      ],
      default: null,
    },
    evaluatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const studentExamSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },
    batchUpload: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BatchUpload',
      default: null,
    },
    examImagePath: {
      type: String,
      required: true,
    },
    examImageOriginalName: String,

    answers: [answerSchema],

    // Overall status flow: uploaded → ocr_processing → ocr_done → validation_pending
    //                      → validated → evaluating → evaluated → report_ready
    status: {
      type: String,
      enum: [
        'uploaded',
        'ocr_processing',
        'ocr_done',
        'validation_pending',
        'validated',
        'evaluating',
        'evaluated',
        'report_ready',
        'failed',
      ],
      default: 'uploaded',
    },

    totalScore: { type: Number, default: null },
    maxPossibleScore: { type: Number, default: null },
    percentage: { type: Number, default: null },
    grade: { type: String, default: null },

    ocrConfidenceAvg: { type: Number, default: null },
    requiresValidation: { type: Boolean, default: false },

    reportPath: { type: String, default: null },
    reportGeneratedAt: { type: Date, default: null },

    processingError: { type: String, default: null },
    ocrCompletedAt: { type: Date, default: null },
    evaluatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Compound index: one student can only have one entry per exam
studentExamSchema.index({ student: 1, exam: 1 }, { unique: true });
studentExamSchema.index({ exam: 1, status: 1 });
studentExamSchema.index({ student: 1 });

// Auto-compute grade based on percentage
studentExamSchema.pre('save', function (next) {
  if (this.percentage !== null) {
    if (this.percentage >= 90) this.grade = 'A';
    else if (this.percentage >= 75) this.grade = 'B';
    else if (this.percentage >= 60) this.grade = 'C';
    else if (this.percentage >= 50) this.grade = 'D';
    else this.grade = 'F';
  }
  next();
});

module.exports = mongoose.model('StudentExam', studentExamSchema);
