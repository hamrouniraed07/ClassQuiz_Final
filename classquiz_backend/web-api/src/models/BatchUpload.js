const mongoose = require('mongoose');

const batchItemSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    imagePath: { type: String, required: true },
    originalName: { type: String },
    studentExamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentExam',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'success', 'failed'],
      default: 'pending',
    },
    error: { type: String, default: null },
  },
  { _id: false }
);

const batchUploadSchema = new mongoose.Schema(
  {
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },
    items: [batchItemSchema],

    totalCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    pendingCount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['created', 'processing', 'completed', 'partial', 'failed'],
      default: 'created',
    },

    uploadedBy: { type: String, default: 'admin' },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

batchUploadSchema.index({ exam: 1 });
batchUploadSchema.index({ status: 1 });

module.exports = mongoose.model('BatchUpload', batchUploadSchema);
