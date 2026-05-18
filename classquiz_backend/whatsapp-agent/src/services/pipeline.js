const path              = require('path')
const fs                = require('fs')
const logger            = require('../utils/logger')
const Submission        = require('../models/Submission')
const Batch             = require('../models/Batch')
const ActiveExamSession = require('../models/ActiveExamSession')
const PendingPair       = require('../models/PendingPair')
const { parseCaption, isValidCodeFormat } = require('./codeParser')
const whatsapp          = require('./whatsappClient')
const classquiz         = require('./classquizClient')

const BATCH_MAX_SIZE     = parseInt(process.env.BATCH_MAX_SIZE)         || 30
const BATCH_MAX_WAIT_MIN = parseInt(process.env.BATCH_MAX_WAIT_MINUTES) || 15
const PHOTO_WAIT_MS      = (parseInt(process.env.PHOTO_WAIT_SECONDS) || 20) * 1000

// Timers en mémoire : senderPhone → setTimeout handle
const photoTimers = new Map()

async function getActiveSession() {
  return ActiveExamSession.findOne({ isActive: true }).sort({ activatedAt: -1 })
}


// handleIncomingText
async function handleIncomingText({ messageId, senderPhone, senderName, text }) {
  logger.info(`[Pipeline] 📝 Texte reçu de ${senderPhone}: "${text}"`)

  const session = await getActiveSession()
  if (!session) {
    logger.warn(`[Pipeline] Texte ignoré — aucune session active (${senderPhone})`)
    return
  }

  const { code } = parseCaption(text)
  if (!code || !isValidCodeFormat(code)) {
    logger.warn(`[Pipeline] ✗ Aucun code valide dans le texte: "${text}"`)
    return
  }

  logger.info(`[Pipeline] ✓ Code extrait: ${code} (${senderPhone})`)

  const pending = await PendingPair.findOne({ senderPhone })

  if (pending && pending.photos.length > 0) {
    // Photos déjà accumulées — on ajoute le code et on déclenche immédiatement
    pending.code = code
    pending.senderName = pending.senderName || senderName
    await pending.save()

    clearPhotoTimer(senderPhone)
    logger.info(`[Pipeline] 🔗 Code reçu après ${pending.photos.length} photo(s) — déclenchement immédiat`)
    await triggerProcessing(senderPhone, session)
  } else {
    // Pas encore de photo — on enregistre le code et on attend
    await PendingPair.findOneAndUpdate(
      { senderPhone },
      {
        senderPhone,
        senderName,
        code,
        photos: [],
        lastPhotoAt: null,
        expiresAt: new Date(Date.now() + (parseInt(process.env.PAIR_TTL_SECONDS) || 600) * 1000),
      },
      { upsert: true, new: true }
    )
    logger.info(`[Pipeline] ⏳ Code ${code} enregistré, en attente des photos (${senderPhone})`)
    await whatsapp.sendMessage(senderPhone,
      `*ClassQuiz — Code reçu ✓*\n\n` +
      `Code étudiant : *${code}*\n\n` +
      `Envoyez maintenant la/les photo(s) de la copie.\n` +
      `_(Pour un examen multi-pages, envoyez toutes les photos l'une après l'autre)_`
    )
  }
}


// handleIncomingPhoto
async function handleIncomingPhoto(msg) {
  const { messageId, senderPhone, senderName, mediaId, mimeType, caption, mediaUrl } = msg

  logger.info(`[Pipeline] ▶ Photo reçue de ${senderPhone} | caption: "${caption || ''}"`)

  // Vérifier session active
  const session = await getActiveSession()
  if (!session) {
    logger.warn(`[Pipeline] ✗ Aucune session active — photo de ${senderPhone} ignorée`)
    // Créer une submission failed pour traçabilité
    try {
      const sub = await Submission.create({
        whatsappMessageId: messageId,
        senderPhone,
        senderName: senderName || null,
        whatsappMediaId: mediaId,
        imageMimeType: mimeType || 'image/jpeg',
        rawCaption: caption || null,
        status: 'failed',
        failReason: 'no_active_session',
      })
    } catch (e) { /* duplicate ignore */ }
    await whatsapp.sendMessage(senderPhone,
      `⏸ *ClassQuiz — Réception suspendue*\n\n` +
      `Aucun examen n'est actuellement actif.\n` +
      `L'établissement vous informera quand la réception sera ouverte.`
    )
    return
  }

  // ── CAS 1 : Code dans la légende (mode classique — 1 seul message) ──
  const { code: captionCode } = parseCaption(caption)
  if (captionCode && isValidCodeFormat(captionCode)) {
    logger.info(`[Pipeline] ✓ Code trouvé dans la légende: ${captionCode} — traitement direct`)
    await PendingPair.deleteOne({ senderPhone })
    clearPhotoTimer(senderPhone)

    // Créer la Submission unique ici
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
      if (err.code === 11000) { logger.warn(`[Pipeline] Déjà traité: ${messageId}`); return }
      throw err
    }

    await ActiveExamSession.findByIdAndUpdate(session._id, { $inc: { receivedCount: 1 } })
    await _processWithCode(sub, captionCode, session, msg)
    return
  }

  // ── CAS 2 : Accumulation dans PendingPair (mode 2 messages / multi-pages) ──
  // On vérifie que ce messageId n'est pas déjà dans un pending (protection doublon)
  const existingPending = await PendingPair.findOne({ senderPhone, 'photos.messageId': messageId })
  if (existingPending) {
    logger.warn(`[Pipeline] Photo déjà accumulée: ${messageId}`)
    return
  }

  const photoEntry = {
    mediaId,
    mediaUrl:  mediaUrl || null,
    mimeType:  mimeType || 'image/jpeg',
    messageId,
    receivedAt: new Date(),
  }

  const pending = await PendingPair.findOneAndUpdate(
    { senderPhone },
    {
      $push: { photos: photoEntry },
      $set: {
        lastPhotoAt: new Date(),
        senderName: senderName || undefined,
        expiresAt: new Date(Date.now() + (parseInt(process.env.PAIR_TTL_SECONDS) || 600) * 1000),
      },
    },
    { upsert: true, new: true }
  )

  const photoCount = pending.photos.length
  logger.info(`[Pipeline] 📸 Photo ${photoCount} accumulée pour ${senderPhone} (code: ${pending.code || 'en attente'})`)

  if (pending.code) {
    // Code déjà connu — (re)démarrer le timer
    clearPhotoTimer(senderPhone)
    logger.info(`[Pipeline] ⏱ Timer ${PHOTO_WAIT_MS/1000}s pour ${senderPhone} (${photoCount} photo(s))`)

    await whatsapp.sendMessage(senderPhone,
      `*ClassQuiz — Photo ${photoCount} reçue ✓*\n\n` +
      `Si vous avez d'autres pages, envoyez-les maintenant.\n` +
      `Traitement automatique dans *${PHOTO_WAIT_MS/1000} secondes* si pas d'autre photo.`
    )

    const timer = setTimeout(async () => {
      photoTimers.delete(senderPhone)
      logger.info(`[Pipeline] ⏰ Timer expiré → traitement pour ${senderPhone}`)
      const freshSession = await getActiveSession()
      if (freshSession) await triggerProcessing(senderPhone, freshSession)
    }, PHOTO_WAIT_MS)
    photoTimers.set(senderPhone, timer)

  } else {
    // Pas encore de code
    if (photoCount === 1) {
      await whatsapp.sendMessage(senderPhone,
        `*ClassQuiz — Photo reçue ✓*\n\n` +
        `Si l'examen a *plusieurs pages*, envoyez les autres photos maintenant.\n` +
        `Ensuite, envoyez le *code étudiant* par message texte.\n` +
        `Exemple : *STU-2026-045*`
      )
    } else {
      await whatsapp.sendMessage(senderPhone,
        `*ClassQuiz — Photo ${photoCount} reçue ✓*\n\n` +
        `Envoyez le *code étudiant* quand toutes les pages sont envoyées.`
      )
    }
  }
}


// triggerProcessing — crée UNE SEULE Submission et traite toutes les photos
async function triggerProcessing(senderPhone, session) {
  const pending = await PendingPair.findOne({ senderPhone })
  if (!pending || !pending.code || pending.photos.length === 0) {
    logger.warn(`[Pipeline] triggerProcessing: données incomplètes pour ${senderPhone}`)
    return
  }

  const { code, photos, senderName } = pending
  const firstPhoto = photos[0]

  logger.info(`[Pipeline] 🚀 Traitement: ${photos.length} photo(s), code ${code}, phone ${senderPhone}`)

  // Supprimer le pending AVANT de créer la Submission (évite doublons si appelé 2x)
  await PendingPair.deleteOne({ senderPhone })

  // Créer UNE SEULE Submission pour tout le groupe de photos
  let sub
  try {
    sub = await Submission.create({
      whatsappMessageId: firstPhoto.messageId,
      senderPhone,
      senderName: senderName || null,
      whatsappMediaId: firstPhoto.mediaId,
      imageMimeType: firstPhoto.mimeType || 'image/jpeg',
      rawCaption: null,
      status: 'received',
    })
  } catch (err) {
    if (err.code === 11000) {
      // Submission déjà créée pour ce messageId — la récupérer
      sub = await Submission.findOne({ whatsappMessageId: firstPhoto.messageId })
      if (!sub) { logger.error(`[Pipeline] Impossible de récupérer la submission existante`); return }
      logger.warn(`[Pipeline] Submission existante récupérée: ${sub._id}`)
    } else {
      throw err
    }
  }

  await ActiveExamSession.findByIdAndUpdate(session._id, { $inc: { receivedCount: 1 } })

  const msg = {
    messageId: firstPhoto.messageId,
    senderPhone,
    senderName,
    mediaId:   firstPhoto.mediaId,
    mediaUrl:  firstPhoto.mediaUrl,
    mimeType:  firstPhoto.mimeType,
    allPhotos: photos,
  }

  await _processWithCode(sub, code, session, msg)
}


// _processWithCode — résolution étudiant + téléchargement + fusion images
async function _processWithCode(sub, code, session, msg) {
  const { senderPhone } = msg
  const allPhotos = msg.allPhotos || [{
    mediaId: msg.mediaId, mediaUrl: msg.mediaUrl,
    mimeType: msg.mimeType, messageId: msg.messageId,
  }]

  sub.extractedCode = code
  sub.status        = 'code_extracted'
  await sub.save()

  // Résolution étudiant
  let student
  try {
    student = await classquiz.resolveStudent(code)
  } catch (err) {
    logger.error(`[Pipeline] ✗ Lookup étudiant échoué: ${err.message}`)
    await fail(sub, 'download_failed', `Erreur API ClassQuiz: ${err.message}`)
    await ActiveExamSession.findByIdAndUpdate(session._id, { $inc: { failedCount: 1 } })
    await whatsapp.sendError(senderPhone, 'download_failed')
    return
  }

  if (!student) {
    logger.warn(`[Pipeline] ✗ Étudiant inconnu: ${code}`)
    await fail(sub, 'student_unknown', `Code ${code} introuvable`)
    await ActiveExamSession.findByIdAndUpdate(session._id, { $inc: { failedCount: 1 } })
    await whatsapp.sendError(senderPhone, 'student_unknown')
    return
  }

  sub.studentId   = student._id
  sub.studentName = student.name
  sub.examId      = session.examId
  sub.status      = 'student_found'
  await sub.save()
  logger.info(`[Pipeline] ✓ Étudiant: ${student.name} (${student._id})`)

  // Téléchargement de toutes les images
  const downloadedPaths = []
  for (const photo of allPhotos) {
    try {
      const imageInfo = await whatsapp.downloadMedia(photo.mediaId, photo.messageId, photo.mimeType, photo.mediaUrl)
      downloadedPaths.push(imageInfo.filePath)
      logger.info(`[Pipeline] ✓ Image téléchargée: ${imageInfo.fileName}`)
    } catch (err) {
      logger.error(`[Pipeline] ✗ Téléchargement échoué: ${err.message}`)
    }
  }

  if (downloadedPaths.length === 0) {
    await fail(sub, 'download_failed', 'Aucune image téléchargée')
    await ActiveExamSession.findByIdAndUpdate(session._id, { $inc: { failedCount: 1 } })
    await whatsapp.sendError(senderPhone, 'download_failed')
    return
  }

  // Fusion si multi-pages
  const finalImagePath = downloadedPaths.length > 1
    ? await mergeImages(downloadedPaths)
    : downloadedPaths[0]

  sub.localImagePath = finalImagePath
  sub.status         = 'student_found'
  await sub.save()

  const pageInfo = allPhotos.length > 1 ? ` (${allPhotos.length} pages fusionnées)` : ''
  logger.info(`[Pipeline] ✅ Copie de ${student.name} prête${pageInfo} | exam: "${session.examTitle}"`)
}


// mergeImages — fusionne plusieurs images verticalement avec sharp
async function mergeImages(filePaths) {
  if (filePaths.length === 1) return filePaths[0]
  try {
    const sharp = require('sharp')
    const images = await Promise.all(filePaths.map(p => sharp(p).toBuffer({ resolveWithObject: true })))

    const totalWidth  = Math.max(...images.map(i => i.info.width))
    const totalHeight = images.reduce((sum, i) => sum + i.info.height, 0)

    let offsetY = 0
    const compositeInput = []
    for (const img of images) {
      compositeInput.push({ input: img.data, top: offsetY, left: 0 })
      offsetY += img.info.height
    }

    const outputPath = filePaths[0].replace(/(\.[^.]+)$/, '_merged.jpg')
    await sharp({
      create: { width: totalWidth, height: totalHeight, channels: 3, background: { r: 255, g: 255, b: 255 } }
    }).composite(compositeInput).jpeg({ quality: 90 }).toFile(outputPath)

    logger.info(`[Pipeline] 🖼 ${filePaths.length} images fusionnées → ${path.basename(outputPath)}`)
    return outputPath
  } catch (err) {
    logger.warn(`[Pipeline] ⚠️ Fusion impossible (${err.message}) — 1ère image utilisée`)
    return filePaths[0]
  }
}

function clearPhotoTimer(senderPhone) {
  if (photoTimers.has(senderPhone)) {
    clearTimeout(photoTimers.get(senderPhone))
    photoTimers.delete(senderPhone)
  }
}

async function enqueue(sub) {
  let batch = await Batch.findOne({ examId: sub.examId, status: 'open' })
  if (!batch) {
    batch = await Batch.create({ examId: sub.examId, submissionIds: [], count: 0 })
    logger.info(`[Queue] Nouveau batch créé: ${batch._id}`)
  }
  batch.submissionIds.push(sub._id)
  batch.count += 1
  await batch.save()
  return batch
}

async function dispatch(batchId, trigger = 'manual') {
  const batch = await Batch.findById(batchId)
  if (!batch || batch.status !== 'open') {
    logger.warn(`[Dispatch] Batch ${batchId} ignoré (statut: ${batch?.status})`)
    return null
  }
  await Batch.findByIdAndUpdate(batchId, { status: 'dispatching', dispatchTrigger: trigger })
  const submissions = await Submission.find({ _id: { $in: batch.submissionIds }, status: 'queued' })
  if (submissions.length === 0) {
    await Batch.findByIdAndUpdate(batchId, { status: 'open' })
    return null
  }
  logger.info(`[Dispatch] Envoi de ${submissions.length} copies (trigger: ${trigger})`)
  try {
    const items = submissions.filter(s => s.localImagePath).map(s => ({
      submission: s,
      filePath:   s.localImagePath,
      fileName:   require('path').basename(s.localImagePath),
    }))
    const result = await classquiz.dispatchBatch(batch.examId, items)
    await Batch.findByIdAndUpdate(batchId, { status: 'dispatched', classquizBatchId: result._id, dispatchedAt: new Date(), successCount: items.length })
    await Submission.updateMany({ _id: { $in: submissions.map(s => s._id) } }, { status: 'dispatched', studentExamId: result._id, dispatchedAt: new Date() })
    logger.info(`[Dispatch] ✓ Batch ClassQuiz: ${result._id}`)
    return result
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message
    await Batch.findByIdAndUpdate(batchId, { status: 'failed', dispatchError: errMsg })
    throw err
  }
}

async function checkExpiredBatches() {
  const cutoff  = new Date(Date.now() - BATCH_MAX_WAIT_MIN * 60 * 1000)
  const expired = await Batch.find({ status: 'open', createdAt: { $lte: cutoff } })
  for (const batch of expired) {
    logger.info(`[Cron] Batch expiré → dispatch: ${batch._id}`)
    dispatch(batch._id, 'time').catch(err => logger.error(`[Cron] Dispatch ${batch._id} échoué: ${err.message}`))
  }
}

async function fail(sub, reason, detail) {
  sub.status      = 'failed'
  sub.failReason  = reason
  sub.errorDetail = detail
  await sub.save()
}

module.exports = { handleIncomingPhoto, handleIncomingText, dispatch, enqueue, checkExpiredBatches, getActiveSession }