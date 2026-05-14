/**
 * src/services/pipeline.js
 *
 * ══════════════════════════════════════════════════════════════════
 *  PIPELINE COMPLET — WhatsApp → ClassQuiz
 * ══════════════════════════════════════════════════════════════════
 *
 *  Étape 1 — RÉCEPTION
 *    Le parent envoie une photo avec la légende = code étudiant
 *    Ex: photo de la copie + légende "STU-042"
 *
 *  Étape 2 — EXTRACTION DU CODE (depuis la légende, pas Gemini)
 *    parseCaption("STU-042") → code = "STU-042"
 *    Si pas de code → message d'erreur au parent, STOP.
 *
 *  Étape 3 — RÉSOLUTION DE L'ÉTUDIANT
 *    GET /api/students?search=STU-042
 *    Si introuvable → message d'erreur au parent, STOP.
 *
 *  Étape 4 — TÉLÉCHARGEMENT DE L'IMAGE
 *    Télécharger via Meta Graph API → stocké dans uploads/incoming/
 *
 *  Étape 5 — MISE EN QUEUE (batch)
 *    Ajouter à un batch "open" pour l'examId
 *    → message de confirmation au parent ✅
 *
 *  Étape 6 — DISPATCH (automatique ou manuel)
 *    POST /api/student-exams/batch → ClassQuiz reçoit les copies
 *
 *  Étape 7 — OCR + GRADING (dans ClassQuiz, automatique)
 *    Gemini extrait les réponses → Llama3.2 note → rapport PDF
 * ══════════════════════════════════════════════════════════════════
 */

const logger         = require('../utils/logger')
const Submission     = require('../models/Submission')
const Batch          = require('../models/Batch')
const { parseCaption, isValidCodeFormat } = require('./codeParser')
const whatsapp       = require('./whatsappClient')
const classquiz      = require('./classquizClient')

const DEFAULT_EXAM_ID    = () => process.env.DEFAULT_EXAM_ID
const BATCH_MAX_SIZE     = parseInt(process.env.BATCH_MAX_SIZE)     || 30
const BATCH_MAX_WAIT_MIN = parseInt(process.env.BATCH_MAX_WAIT_MINUTES) || 15

// ══════════════════════════════════════════════════════════════════
// ÉTAPE PRINCIPALE — appelée par le webhook (async, non-bloquant)
// ══════════════════════════════════════════════════════════════════

/**
 * Traite un message image entrant depuis WhatsApp.
 *
 * @param {{
 *   messageId:  string,
 *   senderPhone: string,
 *   senderName:  string|null,
 *   mediaId:     string,
 *   mimeType:    string,
 *   caption:     string|null,
 * }} msg
 */
async function handleIncomingPhoto(msg) {
  const { messageId, senderPhone, senderName, mediaId, mimeType, caption } = msg

  logger.info(`[Pipeline] ▶ Nouveau message de ${senderPhone} | caption: "${caption || ''}"`)

  // ── Créer l'enregistrement de suivi ──────────────────────────────────
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
    // Doublon (même messageId) — ignorer silencieusement
    if (err.code === 11000) {
      logger.warn(`[Pipeline] Message déjà traité: ${messageId}`)
      return
    }
    throw err
  }

  // ════════════════════════════════════════════════════════════════
  // ÉTAPE 2 — Extraction du code depuis la légende
  // ════════════════════════════════════════════════════════════════
  const { code, examId: captionExamId } = parseCaption(caption)

  if (!code) {
    logger.warn(`[Pipeline] ✗ Pas de code dans la légende | phone: ${senderPhone}`)
    await fail(sub, 'no_code', 'Aucun code étudiant dans la légende')
    await whatsapp.sendError(senderPhone, 'no_code')
    return
  }

  if (!isValidCodeFormat(code)) {
    logger.warn(`[Pipeline] ✗ Code invalide: "${code}" | phone: ${senderPhone}`)
    await fail(sub, 'invalid_code', `Format invalide: ${code}`)
    await whatsapp.sendError(senderPhone, 'invalid_code')
    return
  }

  sub.extractedCode = code
  sub.status        = 'code_extracted'
  await sub.save()
  logger.info(`[Pipeline] ✓ Code extrait: ${code}`)

  // ════════════════════════════════════════════════════════════════
  // ÉTAPE 3 — Résolution de l'étudiant dans ClassQuiz
  // ════════════════════════════════════════════════════════════════
  let student
  try {
    logger.info(`[DEBUG] About to call classquiz.resolveStudent("${code}")`)
    student = await classquiz.resolveStudent(code)
    logger.info(`[DEBUG] classquiz.resolveStudent returned: ${student ? 'FOUND' : 'NOT FOUND'}`)
  } catch (err) {
    logger.error(`[Pipeline] ✗ Erreur lookup étudiant: ${err.message}`)
    await fail(sub, 'download_failed', `Erreur API ClassQuiz: ${err.message}`)
    await whatsapp.sendError(senderPhone, 'download_failed')
    return
  }

  if (!student) {
    logger.warn(`[Pipeline] ✗ Étudiant inconnu: ${code}`)
    await fail(sub, 'student_unknown', `Code ${code} introuvable dans ClassQuiz`)
    await whatsapp.sendError(senderPhone, 'student_unknown')
    return
  }

  sub.studentId   = student._id
  sub.studentName = student.name
  sub.examId      = captionExamId || DEFAULT_EXAM_ID()
  sub.status      = 'student_found'
  await sub.save()
  logger.info(`[Pipeline] ✓ Étudiant résolu: ${student.name} (${student._id})`)

  // ════════════════════════════════════════════════════════════════
  // ÉTAPE 4 — Téléchargement de l'image
  // ════════════════════════════════════════════════════════════════
  let imageInfo
  try {
    imageInfo = await whatsapp.downloadMedia(mediaId, messageId, mimeType)
  } catch (err) {
    logger.error(`[Pipeline] ✗ Téléchargement image échoué: ${err.message}`)
    await fail(sub, 'download_failed', err.message)
    await whatsapp.sendError(senderPhone, 'download_failed')
    return
  }

  sub.localImagePath = imageInfo.filePath
  await sub.save()
  logger.info(`[Pipeline] ✓ Image stockée: ${imageInfo.fileName}`)

  // ════════════════════════════════════════════════════════════════
  // ÉTAPE 5 — Mise en queue (batch)
  // ════════════════════════════════════════════════════════════════
  try {
    const batch = await enqueue(sub)

    sub.batchId = batch._id
    sub.status  = 'queued'
    await sub.save()

    logger.info(`[Pipeline] ✓ Copie de ${student.name} ajoutée au batch ${batch._id} (${batch.count}/${BATCH_MAX_SIZE})`)

    // Confirmation au parent
    await whatsapp.sendSuccess(senderPhone, student.name, sub.examId)

    // Dispatch automatique si taille max atteinte
    if (batch.count >= BATCH_MAX_SIZE) {
      logger.info(`[Pipeline] Taille max atteinte → dispatch automatique`)
      dispatch(batch._id, 'size').catch(err =>
        logger.error(`[Pipeline] Auto-dispatch échoué: ${err.message}`)
      )
    }

  } catch (err) {
    logger.error(`[Pipeline] ✗ Mise en queue échouée: ${err.message}`)
    await fail(sub, 'dispatch_failed', err.message)
  }
}

// ══════════════════════════════════════════════════════════════════
// MISE EN QUEUE
// ══════════════════════════════════════════════════════════════════

async function enqueue(sub) {
  // Chercher un batch ouvert pour cet examId
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

/**
 * Envoie un batch ouvert à ClassQuiz via POST /api/student-exams/batch.
 * Déclenche automatiquement OCR + grading dans ClassQuiz.
 *
 * @param {string|ObjectId} batchId
 * @param {'size'|'time'|'schedule'|'manual'} trigger
 */
async function dispatch(batchId, trigger = 'manual') {
  const batch = await Batch.findById(batchId)
  if (!batch || batch.status !== 'open') {
    logger.warn(`[Dispatch] Batch ${batchId} ignoré (statut: ${batch?.status})`)
    return null
  }

  // Marquer en cours
  await Batch.findByIdAndUpdate(batchId, { status: 'dispatching', dispatchTrigger: trigger })

  // Charger les soumissions prêtes
  const submissions = await Submission.find({
    _id:    { $in: batch.submissionIds },
    status: 'queued',
  })

  if (submissions.length === 0) {
    await Batch.findByIdAndUpdate(batchId, { status: 'open' }) // revert
    logger.warn(`[Dispatch] Aucune soumission prête dans batch ${batchId}`)
    return null
  }

  logger.info(`[Dispatch] Envoi de ${submissions.length} copies vers ClassQuiz (trigger: ${trigger})`)

  try {
    // Construire les items pour classquizClient.dispatchBatch
    const items = submissions
      .filter(s => s.localImagePath)
      .map(s => ({ submission: s, filePath: s.localImagePath, fileName: require('path').basename(s.localImagePath) }))

    const result = await classquiz.dispatchBatch(batch.examId, items)

    // Mise à jour batch
    await Batch.findByIdAndUpdate(batchId, {
      status:           'dispatched',
      classquizBatchId: result._id,
      dispatchedAt:     new Date(),
      successCount:     items.length,
    })

    // Mise à jour soumissions
    await Submission.updateMany(
      { _id: { $in: submissions.map(s => s._id) } },
      { status: 'dispatched', studentExamId: result._id, dispatchedAt: new Date() }
    )

    logger.info(`[Dispatch] ✅ Batch dispatché → ClassQuiz batch ID: ${result._id}`)
    logger.info(`[Dispatch] → ClassQuiz lance OCR + grading automatiquement`)

    return result

  } catch (err) {
    const msg = err.response?.data?.message || err.message
    logger.error(`[Dispatch] ✗ Échec dispatch: ${msg}`)

    await Batch.findByIdAndUpdate(batchId, { status: 'failed', dispatchError: msg })
    throw err
  }
}

// ══════════════════════════════════════════════════════════════════
// VÉRIFICATION DES BATCHES EXPIRÉS (appelé par cron)
// ══════════════════════════════════════════════════════════════════

async function checkExpiredBatches() {
  const cutoff = new Date(Date.now() - BATCH_MAX_WAIT_MIN * 60 * 1000)
  const expired = await Batch.find({ status: 'open', createdAt: { $lte: cutoff } })

  for (const batch of expired) {
    logger.info(`[Cron] Batch expiré → dispatch: ${batch._id}`)
    dispatch(batch._id, 'time').catch(err =>
      logger.error(`[Cron] Dispatch batch ${batch._id} échoué: ${err.message}`)
    )
  }
}

// ── Helper interne ────────────────────────────────────────────────────────────
async function fail(sub, reason, detail) {
  sub.status      = 'failed'
  sub.failReason  = reason
  sub.errorDetail = detail
  await sub.save()
}

module.exports = { handleIncomingPhoto, dispatch, checkExpiredBatches }
