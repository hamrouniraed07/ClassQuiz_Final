const express  = require('express')
const router   = express.Router()
const logger   = require('../utils/logger')
const pipeline = require('../services/pipeline')

const PROVIDER = process.env.WA_PROVIDER || 'meta'

// META — GET /webhook (vérification d'abonnement)
router.get('/', (req, res) => {
  if (PROVIDER !== 'meta') return res.sendStatus(200)

  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info('[Webhook] ✓ Vérification Meta acceptée')
    return res.status(200).send(challenge)
  }
  logger.warn('[Webhook] ✗ Tentative de vérification invalide')
  return res.sendStatus(403)
})

// POST /webhook — Messages entrants (META + WAHA)
router.post('/', (req, res) => {
  res.sendStatus(200)
  
  // LOG TEMPORAIRE — voir le vrai format WAHA
  console.log('=== WAHA PAYLOAD ===')
  console.log(JSON.stringify(req.body, null, 2))
  console.log('===================')

  try {
    if (PROVIDER === 'waha') {
      handleWAHA(req.body)
    } else {
      handleMeta(req.body)
    }
  } catch (err) {
    logger.error(`[Webhook] Erreur parsing: ${err.message}`)
  }
})

//  Parser META
function handleMeta(body) {
  if (body?.object !== 'whatsapp_business_account') return

  const value = body.entry?.[0]?.changes?.[0]?.value
  if (!value?.messages?.length) return

  const msg     = value.messages[0]
  const contact = value.contacts?.[0]

  if (msg.type !== 'image') {
    logger.debug(`[Webhook-META] Message ignoré (type: ${msg.type})`)
    return
  }

  const messageData = {
    messageId:   msg.id,
    senderPhone: msg.from,
    senderName:  contact?.profile?.name || null,
    mediaId:     msg.image.id,
    mimeType:    msg.image.mime_type || 'image/jpeg',
    caption:     msg.image.caption   || null,
  }

  logger.info(`[Webhook-META] 📸 Image | from: ${msg.from} | caption: "${messageData.caption || '(vide)'}"`)
  pipeline.handleIncomingPhoto(messageData).catch(err =>
    logger.error(`[Webhook-META] Erreur pipeline: ${err.message}`)
  )
}

// Parser WAHA
function handleWAHA(body) {
  if (body?.event !== 'message') return

  const payload = body.payload
  if (!payload) return
  if (payload.fromMe) return

  // ── DEBUG temporaire — voir tous les champs nom disponibles 
  logger.info(`[WAHA-DEBUG] from: ${payload.from} | notifyName: ${payload._data?.notifyName} | pushName: ${body.me?.pushName}`)

  // ── Extraire le vrai numéro de téléphone 
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

  // ── Extraire le vrai nom de l'expéditeur 
  const senderName =
  payload._data?.pushName ||       
  payload._data?.notifyName ||     
  null

  logger.info(`[WAHA-DEBUG] senderName résolu: "${senderName}" | senderPhone: "${senderPhone}"`)

  // ── Gérer image et texte 
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