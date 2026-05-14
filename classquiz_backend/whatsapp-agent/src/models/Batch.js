/**
 * src/models/Batch.js
 * Un batch = groupe de copies prêtes pour POST /api/student-exams/batch
 */
const mongoose = require('mongoose')

const batchSchema = new mongoose.Schema({
  examId:            { type: String, required: true, index: true },
  submissionIds:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Submission' }],
  count:             { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['open', 'dispatching', 'dispatched', 'failed'],
    default: 'open',
    index: true,
  },

  // Référence ClassQuiz
  classquizBatchId:  { type: String, default: null },
  dispatchTrigger:   { type: String, enum: ['size', 'time', 'schedule', 'manual', null], default: null },
  dispatchedAt:      { type: Date, default: null },
  successCount:      { type: Number, default: 0 },
  failedCount:       { type: Number, default: 0 },
  dispatchError:     { type: String, default: null },

}, { timestamps: true, collection: 'wa_batches' })

module.exports = mongoose.model('Batch', batchSchema)
