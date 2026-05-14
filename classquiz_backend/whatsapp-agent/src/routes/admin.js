/**
 * src/routes/admin.js
 * API de monitoring et dispatch manuel
 */
const express  = require('express')
const router   = express.Router()
const logger   = require('../utils/logger')
const pipeline = require('../services/pipeline')
const Submission = require('../models/Submission')
const Batch      = require('../models/Batch')

// Auth simple par clé API
function auth(req, res, next) {
  const key = req.headers['x-agent-key'] || req.query.key
  if (key !== process.env.AGENT_ADMIN_API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }
  next()
}

// ── Stats globales ────────────────────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  const [subStats, batchStats] = await Promise.all([
    Submission.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Batch.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$count' } } }]),
  ])
  res.json({ success: true, data: { submissions: subStats, batches: batchStats } })
})

// ── Liste des batches ─────────────────────────────────────────────────────────
router.get('/batches', auth, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const filter = {}
  if (status) filter.status = status

  const [batches, total] = await Promise.all([
    Batch.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(+limit),
    Batch.countDocuments(filter),
  ])
  res.json({ success: true, data: { batches, pagination: { total, page: +page, limit: +limit } } })
})

// ── Détail d'un batch ─────────────────────────────────────────────────────────
router.get('/batches/:id', auth, async (req, res) => {
  const batch = await Batch.findById(req.params.id).populate('submissionIds')
  if (!batch) return res.status(404).json({ success: false, message: 'Not found' })
  res.json({ success: true, data: batch })
})

// ── Dispatch manuel ───────────────────────────────────────────────────────────
router.post('/batches/:id/dispatch', auth, async (req, res) => {
  try {
    const result = await pipeline.dispatch(req.params.id, 'manual')
    res.json({ success: true, data: result })
  } catch (err) {
    logger.error(`[Admin] Dispatch manuel échoué: ${err.message}`)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── Liste des soumissions ─────────────────────────────────────────────────────
router.get('/submissions', auth, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const filter = {}
  if (status) filter.status = status

  const [submissions, total] = await Promise.all([
    Submission.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(+limit),
    Submission.countDocuments(filter),
  ])
  res.json({ success: true, data: { submissions, pagination: { total, page: +page, limit: +limit } } })
})

module.exports = router
