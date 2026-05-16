/**
 * src/services/pipeline.js
 *
 * WORKFLOW MANUEL :
 *   Message reçu → code extrait → étudiant résolu → image téléchargée
 *   → statut "student_found" → STOP (l'admin assigne depuis le dashboard)
 *
 *   L'admin choisit l'examen + batch depuis WhatsappPage
 *   → PATCH /admin/submissions/:id/assign → statut "queued"
 *   → Dispatch manuel depuis le dashboard → OCR + correction
 */

const logger            = require('../utils/logger')
const Submission        = require('../models/Submission')
const Batch             = require('../models/Batch')
const ActiveExamSession = require('../models/ActiveExamSession')
const { parseCaption, isValidCodeFormat } = require('./codeParser')
const whatsapp          = require('./whatsappClient')
const classquiz         = require('./classquizClient')

const BATCH_MAX_SIZE     = parseInt(process.env.BATCH_MAX_SIZE)         || 30
const BATCH_MAX_WAIT_MIN = parseInt(process.env.BATCH_MAX_WAIT_MINUTES) || 15

// ══════════════════════════════════════════════════════════════════
// Session active
// ══════════════════════════════════════════════════════════════════
async function getActiveSession() {
  return ActiveExamSession.findOne({ isActive: true }).sort({ activatedAt: -1 })
}

// ══════════════════════════════════════════════════════════════════
// PIPELINE PRINCIPAL
// ══════════════════════════════════════════════════════════════════
async function handleIncomingPhoto(msg) {
  const { messageId, senderPhone, senderName, mediaId, mimeType, caption } = msg

  logger.info(`[Pipeline] ▶ Nouveau message de ${senderPhone} | caption: "${caption || ''}"`)

  // ── Créer l'enregistrement ────────────────────────────────────────────
  let sub
  try {
    sub = await Submission.create({
      whatsappMessageId: messageId,
      senderPhone,
      senderName: senderName || null,
      whatsappMediaId: mediaId,
      imageMimeType: mimeType || 'image/jpeg',
      rawCaption: caption || null,
      status: 'received',
    })
  } catch (err) {
    if (err.code === 11000) {
      logger.warn(`[Pipeline] Message déjà traité: ${messageId}`)
      return
    }
    throw err
  }

  // ════════════════════════════════════════════════════════════════
  // ÉTAPE 1 — Vérifier qu'une session est active
  // ════════════════════════════════════════════════════════════════
  const session = await getActiveSession()

  if (!session) {
    logger.warn(`[Pipeline] ✗ Aucune session active — photo de ${senderPhone} ignorée`)
    await fail(sub, 'no_active_session', 'Aucun examen actif sélectionné par l\'admin')
    await whatsapp.sendMessage(senderPhone,
      `⏸ *ClassQuiz — Réception suspendue*\n\n` +
      `Aucun examen n'est actuellement actif pour recevoir des copies.\n` +
      `L'établissement vous informera quand la réception sera ouverte.`
    )
    return
  }

  logger.info(`[Pipeline] Session active: "${session.examTitle}" (${session.examId})`)
  await ActiveExamSession.findByIdAndUpdate(session._id, { $inc: { receivedCount: 1 } })

  // ════════════════════════════════════════════════════════════════
  // ÉTAPE 2 — Extraction du code depuis la légende
  // ════════════════════════════════════════════════════════════════
  const { code } = parseCaption(caption)

  if (!code) {
    logger.warn(`[Pipeline] ✗ Pas de code dans la légende | phone: ${senderPhone}`)
    await fail(sub, 'no_code', 'Aucun code étudiant dans la légende')
    await ActiveExamSession.findByIdAndUpdate(session._id, { $inc: { failedCount: 1 } })
    await whatsapp.sendError(senderPhone, 'no_code')
    return
  }

  if (!isValidCodeFormat(code)) {
    logger.warn(`[Pipeline] ✗ Code invalide: "${code}"`)
    await fail(sub, 'invalid_code', `Format invalide: ${code}`)
    await ActiveExamSession.findByIdAndUpdate(session._id, { $inc: { failedCount: 1 } })
    await whatsapp.sendError(senderPhone, 'invalid_code')
    return
  }

  sub.extractedCode = code
  sub.status        = 'code_extracted'
  await sub.save()
  logger.info(`[Pipeline] ✓ Code extrait: ${code}`)

  // ════════════════════════════════════════════════════════════════
  // ÉTAPE 3 — Résolution de l'étudiant
  // ════════════════════════════════════════════════════════════════
  let student
  try {
    student = await classquiz.resolveStudent(code)
  } catch (err) {
    logger.error(`[Pipeline] ✗ Erreur lookup étudiant: ${err.message}`)
    await fail(sub, 'download_failed', `Erreur API ClassQuiz: ${err.message}`)
    await ActiveExamSession.findByIdAndUpdate(session._id, { $inc: { failedCount: 1 } })
    await whatsapp.sendError(senderPhone, 'download_failed')
    return
  }

  if (!student) {
    logger.warn(`[Pipeline] ✗ Étudiant inconnu: ${code}`)
    await fail(sub, 'student_unknown', `Code ${code} introuvable dans ClassQuiz`)
    await ActiveExamSession.findByIdAndUpdate(session._id, { $inc: { failedCount: 1 } })
    await whatsapp.sendError(senderPhone, 'student_unknown')
    return
  }

  sub.studentId   = student._id
  sub.studentName = student.name
  sub.status      = 'student_found'
  await sub.save()
  logger.info(`[Pipeline] ✓ Étudiant résolu: ${student.name} (${student._id})`)

  // ════════════════════════════════════════════════════════════════
  // ÉTAPE 4 — Téléchargement de l'image
  // ════════════════════════════════════════════════════════════════
  let imageInfo
  try {
    imageInfo = await whatsapp.downloadMedia(mediaId, messageId, mimeType, msg.mediaUrl)
  } catch (err) {
    logger.error(`[Pipeline] ✗ Téléchargement image échoué: ${err.message}`)
    await fail(sub, 'download_failed', err.message)
    await ActiveExamSession.findByIdAndUpdate(session._id, { $inc: { failedCount: 1 } })
    await whatsapp.sendError(senderPhone, 'download_failed')
    return
  }

  sub.localImagePath = imageInfo.filePath
  sub.status         = 'student_found'  // reste student_found → l'admin assigne depuis le dashboard
  await sub.save()
  logger.info(`[Pipeline] ✓ Image stockée: ${imageInfo.fileName}`)

  // ════════════════════════════════════════════════════════════════
  // FIN — Notifier l'admin (pas le parent, pas d'auto-enqueue)
  // La soumission est maintenant visible dans le dashboard WhatsApp
  // L'admin choisit l'examen et le batch manuellement
  // ════════════════════════════════════════════════════════════════
  logger.info(
    `[Pipeline] ✅ Copie de ${student.name} prête pour assignation manuelle | exam: "${session.examTitle}"`
  )
}

// ══════════════════════════════════════════════════════════════════
// MISE EN QUEUE (appelée par PATCH /admin/submissions/:id/assign)
// ══════════════════════════════════════════════════════════════════
async function enqueue(sub) {
  let batch = await Batch.findOne({ examId: sub.examId, status: 'open' })
  if (!batch) {
    batch = await Batch.create({ examId: sub.examId, submissionIds: [], count: 0 })
    logger.info(`[Queue] Nouveau batch créé pour exam ${sub.examId}: ${batch._id}`)
  }
  batch.submissionIds.push(sub._id)
  batch.count += 1
  await batch.save()
  return batch
}

// ══════════════════════════════════════════════════════════════════
// DISPATCH VERS CLASSQUIZ
// ══════════════════════════════════════════════════════════════════
async function dispatch(batchId, trigger = 'manual') {
  const batch = await Batch.findById(batchId)
  if (!batch || batch.status !== 'open') {
    logger.warn(`[Dispatch] Batch ${batchId} ignoré (statut: ${batch?.status})`)
    return null
  }

  await Batch.findByIdAndUpdate(batchId, { status: 'dispatching', dispatchTrigger: trigger })

  const submissions = await Submission.find({
    _id:    { $in: batch.submissionIds },
    status: 'queued',
  })

  if (submissions.length === 0) {
    await Batch.findByIdAndUpdate(batchId, { status: 'open' })
    return null
  }

  logger.info(`[Dispatch] Envoi de ${submissions.length} copies vers ClassQuiz (trigger: ${trigger})`)

  try {
    const items = submissions
      .filter(s => s.localImagePath)
      .map(s => ({
        submission: s,
        filePath:   s.localImagePath,
        fileName:   require('path').basename(s.localImagePath),
      }))

    const result = await classquiz.dispatchBatch(batch.examId, items)

    await Batch.findByIdAndUpdate(batchId, {
      status:           'dispatched',
      classquizBatchId: result._id,
      dispatchedAt:     new Date(),
      successCount:     items.length,
    })

    await Submission.updateMany(
      { _id: { $in: submissions.map(s => s._id) } },
      { status: 'dispatched', studentExamId: result._id, dispatchedAt: new Date() }
    )

    logger.info(`[Dispatch] ✅ ClassQuiz batch ID: ${result._id} → OCR + grading lancés`)
    return result

  } catch (err) {
    const msg = err.response?.data?.message || err.message
    await Batch.findByIdAndUpdate(batchId, { status: 'failed', dispatchError: msg })
    throw err
  }
}

// ══════════════════════════════════════════════════════════════════
// CRON — Batches expirés
// ══════════════════════════════════════════════════════════════════
async function checkExpiredBatches() {
  const cutoff  = new Date(Date.now() - BATCH_MAX_WAIT_MIN * 60 * 1000)
  const expired = await Batch.find({ status: 'open', createdAt: { $lte: cutoff } })
  for (const batch of expired) {
    logger.info(`[Cron] Batch expiré → dispatch: ${batch._id}`)
    dispatch(batch._id, 'time').catch(err =>
      logger.error(`[Cron] Dispatch ${batch._id} échoué: ${err.message}`)
    )
  }
}

async function fail(sub, reason, detail) {
  sub.status      = 'failed'
  sub.failReason  = reason
  sub.errorDetail = detail
  await sub.save()
}

module.exports = { handleIncomingPhoto, dispatch, enqueue, checkExpiredBatches, getActiveSession }