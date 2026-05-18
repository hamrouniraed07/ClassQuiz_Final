/**
 * src/routes/session.js
 *
 * API de gestion de la session d'examen active.
 * L'admin choisit quel examen reçoit les photos WhatsApp.
 *
 * Routes :
 *   GET    /session          → session active actuelle
 *   POST   /session/activate → activer un examen
 *   DELETE /session/deactivate → désactiver (pause)
 */
const express  = require('express')
const router   = express.Router()
const axios    = require('axios')
const logger   = require('../utils/logger')
const ActiveExamSession = require('../models/ActiveExamSession')

// Auth
function auth(req, res, next) {
  const key = req.headers['x-agent-key'] || req.query.key
  if (key !== process.env.AGENT_ADMIN_API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }
  next()
}

// GET /session 
router.get('/', auth, async (req, res) => {
  const session = await ActiveExamSession.findOne().sort({ createdAt: -1 })
  res.json({ success: true, data: session })
})

// POST /session/activate
router.post('/activate', auth, async (req, res) => {
  const { examId, examTitle, examSubject, classLevel } = req.body

  if (!examId) {
    return res.status(400).json({ success: false, message: 'examId is required' })
  }

  // Vérifier que l'examen existe et est actif dans ClassQuiz
  try {
    const apiUrl   = process.env.CLASSQUIZ_API_URL
    const token    = process.env.CLASSQUIZ_API_TOKEN
    const { data } = await axios.get(`${apiUrl}/api/exams/${examId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    })
    const exam = data?.data
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found in ClassQuiz' })
    }
    if (exam.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Exam status is "${exam.status}". Only active exams can receive WhatsApp submissions.`
      })
    }
  } catch (err) {
    logger.warn(`[Session] Impossible de vérifier l'examen: ${err.message}`)
  }

  await ActiveExamSession.updateMany({}, { isActive: false })

  const session = await ActiveExamSession.create({
    examId,
    examTitle:   examTitle   || null,
    examSubject: examSubject || null,
    classLevel:  classLevel  || null,
    activatedAt: new Date(),
    isActive:    true,
    receivedCount: 0,
    indexedCount:  0,
    failedCount:   0,
  })

  logger.info(`[Session] Examen activé: ${examTitle || examId}`)
  res.json({ success: true, data: session })
})

// DELETE /session/deactivate
router.delete('/deactivate', auth, async (req, res) => {
  await ActiveExamSession.updateMany({ isActive: true }, { isActive: false })
  logger.info('[Session] ⏸ Session désactivée')
  res.json({ success: true, message: 'Session deactivated. WhatsApp submissions are paused.' })
})

module.exports = router