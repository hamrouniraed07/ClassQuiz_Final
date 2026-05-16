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
const path       = require('path')
const fs         = require('fs')

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

// ── Servir l'image d'une soumission ──────────────────────────────────────────
// GET /admin/submissions/:id/image
router.get('/submissions/:id/image', auth, async (req, res) => {
  const sub = await Submission.findById(req.params.id)
  if (!sub) return res.status(404).json({ success: false, message: 'Soumission introuvable' })

  if (!sub.localImagePath || !fs.existsSync(sub.localImagePath)) {
    return res.status(404).json({ success: false, message: 'Image non trouvée sur le disque' })
  }

  const ext     = path.extname(sub.localImagePath).toLowerCase()
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
  const mime    = mimeMap[ext] || 'image/jpeg'

  res.setHeader('Content-Type', mime)
  res.setHeader('Cache-Control', 'public, max-age=86400')
  fs.createReadStream(sub.localImagePath).pipe(res)
})

// ── Assigner une soumission à un examen + batch ───────────────────────────────
// PATCH /admin/submissions/:id/assign
// Body: { examId, examTitle, batchId? }
//   → batchId absent = chercher un batch ouvert existant ou en créer un nouveau
router.patch('/submissions/:id/assign', auth, async (req, res) => {
  const { examId, examTitle, batchId } = req.body

  if (!examId) {
    return res.status(400).json({ success: false, message: 'examId est requis' })
  }

  const sub = await Submission.findById(req.params.id)
  if (!sub) {
    return res.status(404).json({ success: false, message: 'Soumission introuvable' })
  }

  if (sub.status === 'dispatched') {
    return res.status(400).json({ success: false, message: 'Cette soumission a déjà été dispatchée' })
  }

  // Retirer du batch précédent si la soumission était déjà dans un batch
  if (sub.batchId) {
    await Batch.findByIdAndUpdate(sub.batchId, {
      $pull: { submissionIds: sub._id },
      $inc:  { count: -1 },
    })
    logger.info(`[Admin] Soumission ${sub._id} retirée du batch ${sub.batchId}`)
  }

  // Trouver ou créer le batch cible
  let targetBatch
  if (batchId) {
    targetBatch = await Batch.findOne({ _id: batchId, status: 'open' })
    if (!targetBatch) {
      return res.status(400).json({ success: false, message: 'Batch introuvable ou déjà dispatchée' })
    }
  } else {
    // Chercher un batch ouvert pour cet examen, sinon en créer un nouveau
    targetBatch = await Batch.findOne({ examId, status: 'open' })
    if (!targetBatch) {
      targetBatch = await Batch.create({ examId, submissionIds: [], count: 0 })
      logger.info(`[Admin] Nouveau batch créé pour exam ${examId}: ${targetBatch._id}`)
    }
  }

  // Ajouter la soumission au batch cible
  targetBatch.submissionIds.push(sub._id)
  targetBatch.count += 1
  await targetBatch.save()

  // Mettre à jour la soumission
  sub.examId  = examId
  sub.batchId = targetBatch._id
  // Si l'étudiant est déjà résolu → queued, sinon on garde student_found
  sub.status  = sub.studentId ? 'queued' : 'student_found'
  await sub.save()

  logger.info(`[Admin] ✓ Soumission ${sub._id} assignée → exam: ${examId} | batch: ${targetBatch._id}`)

  res.json({
    success: true,
    data: {
      submission: sub,
      batch: targetBatch,
    },
  })
})

module.exports = router