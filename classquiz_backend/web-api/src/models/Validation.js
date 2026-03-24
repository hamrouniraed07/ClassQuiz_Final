const mongoose = require('mongoose');

const correctionSchema = new mongoose.Schema(
  {
    questionNumber: { type: Number, required: true },
    originalText: { type: String, default: '' },
    correctedText: { type: String, required: true },
    originalConfidence: { type: Number, default: null },
  },
  { _id: false }
);

const validationSchema = new mongoose.Schema(
  {
    studentExam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentExam',
      required: true,
      unique: true, // One validation record per student exam
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },

    // Which answers triggered validation (confidence < threshold)
    flaggedAnswers: [
      {
        questionNumber: Number,
        extractedText: String,
        confidenceScore: Number,
        _id: false,
      },
    ],

    // Admin corrections
    corrections: [correctionSchema],

    status: {
      type: String,
      enum: ['pending', 'in_review', 'completed', 'skipped'],
      default: 'pending',
    },

    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    notes: { type: String, default: null },

    // Track how many answers improved
    correctionCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

validationSchema.index({ status: 1 });
validationSchema.index({ exam: 1 });
validationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Validation', validationSchema);
