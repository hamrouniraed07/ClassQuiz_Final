const express  = require('express')
const router   = express.Router()
const logger   = require('../utils/logger')
const pipeline = require('../services/pipeline')

// POST /webhook — Messages entrants WAHA
router.post('/', (req, res) => {
  res.sendStatus(200)

  try {
    handleWAHA(req.body)
  } catch (err) {
    logger.error(`[Webhook] Erreur parsing: ${err.message}`)
  }
})

// Parser WAHA
function handleWAHA(body) {
  if (body?.event !== 'message') return

  const payload = body.payload
  if (!payload) return
  if (payload.fromMe) return

  // Extraire le numéro de téléphone
  let senderPhone = null
  if (payload.from?.includes('@c.us')) {
    senderPhone = payload.from.split('@')[0]
  } else if (payload._data?.key?.remoteJidAlt?.includes('@s.whatsapp.net')) {
    senderPhone = payload._data.key.remoteJidAlt.split('@')[0]
  } else if (payload._data?.key?.remoteJidAlt?.includes('@c.us')) {
    senderPhone = payload._data.key.remoteJidAlt.split('@')[0]
  } else {
    senderPhone = payload.from?.split('@')[0] || payload.from
  }

  // Extraire le nom de l'expéditeur
  const senderName =
    payload._data?.pushName ||
    payload._data?.notifyName ||
    null

  logger.info(`[Webhook-WAHA] senderName: "${senderName}" | senderPhone: "${senderPhone}"`)

  // Image
  if (payload.hasMedia) {
    const messageData = {
      messageId:  payload.id,
      senderPhone,
      senderName,
      mediaId:    payload.id,
      mediaUrl:   payload.media?.url || null,
      mimeType:   payload.media?.mimetype || 'image/jpeg',
      caption:    payload.body || null,
    }
    logger.info(`[Webhook-WAHA] 📸 Image | from: ${senderPhone} (${senderName || 'inconnu'}) | caption: "${messageData.caption || '(vide)'}"`)
    pipeline.handleIncomingPhoto(messageData).catch(err =>
      logger.error(`[Webhook-WAHA] Erreur pipeline photo: ${err.message}`)
    )

  // Texte
  } else if (payload.type === 'chat' && payload.body) {
    logger.info(`[Webhook-WAHA] 📝 Texte | from: ${senderPhone} (${senderName || 'inconnu'}) | text: "${payload.body}"`)
    pipeline.handleIncomingText({
      messageId: payload.id,
      senderPhone,
      senderName,
      text: payload.body,
    }).catch(err =>
      logger.error(`[Webhook-WAHA] Erreur pipeline texte: ${err.message}`)
    )

  } else {
    logger.debug(`[Webhook-WAHA] Message ignoré (type: ${payload.type}, hasMedia: ${payload.hasMedia})`)
  }
}

module.exports = router