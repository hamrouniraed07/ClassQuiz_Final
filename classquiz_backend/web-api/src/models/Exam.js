const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    text: { type: String, required: true, trim: true },
    maxScore: { type: Number, required: true, min: 0 },
    correctAnswer: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['multiple_choice', 'short_answer', 'long_answer', 'true_false', 'fill_blank'],
      default: 'short_answer',
    },
  },
  { _id: false }
);

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Exam title is required'],
      trim: true,
      maxlength: [200, 'Title must not exceed 200 characters'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    class: {
      type: Number,
      required: [true, 'Target class is required'],
      min: 1,
      max: 6,
    },
    totalScore: {
      type: Number,
      required: true,
      min: 0,
    },
    questions: {
      type: [questionSchema],
      default: [],
    },
    correctedExamImages: [
      {
        path: String,
        originalName: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    blankExamImages: [
      {
        path: String,
        originalName: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'processing', 'active', 'archived'],
      default: 'draft',
    },
    ocrProcessedAt: Date,
    createdBy: { type: String, default: 'admin' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

examSchema.index({ class: 1, status: 1 });
examSchema.index({ subject: 1 });
examSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Exam', examSchema);
