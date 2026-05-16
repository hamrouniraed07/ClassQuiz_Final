/**
 * src/routes/webhook.js
 * 
 * Switch automatique META ↔ WAHA selon WA_PROVIDER dans .env
 */
const express  = require('express')
const router   = express.Router()
const logger   = require('../utils/logger')
const pipeline = require('../services/pipeline')

const PROVIDER = process.env.WA_PROVIDER || 'meta'

// ══════════════════════════════════════════════════════
// META — GET /webhook (vérification d'abonnement)
// ══════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════
// POST /webhook — Messages entrants (META + WAHA)
// ══════════════════════════════════════════════════════
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

// ── Parser META ───────────────────────────────────────
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

// ── Parser WAHA ───────────────────────────────────────
function handleWAHA(body) {
  if (body?.event !== 'message') return

  const payload = body.payload
  if (!payload) return
  if (payload.fromMe) return

  // WAHA envoie hasMedia=true pour les images
  if (!payload.hasMedia) {
    logger.debug(`[Webhook-WAHA] Message ignoré (pas de media)`)
    return
  }

  // format @lid ou @c.us → extraire juste le numéro
  const senderPhone = payload.from?.split('@')[0] || payload.from

  const messageData = {
    messageId:   payload.id,
    senderPhone: senderPhone,
    senderName:  payload._data?.notifyName || body.me?.pushName || null,
    mediaId:     payload.id,
    // URL directe WAHA — contient déjà l'image téléchargée
    mediaUrl:    payload.media?.url,
    mimeType:    payload.media?.mimetype || 'image/jpeg',
    caption:     payload.body || null,   // ← caption est dans body pas media
  }

  logger.info(`[Webhook-WAHA] 📸 Image | from: ${senderPhone} | caption: "${messageData.caption || '(vide)'}"`)
  pipeline.handleIncomingPhoto(messageData).catch(err =>
    logger.error(`[Webhook-WAHA] Erreur pipeline: ${err.message}`)
  )
}
module.exports = router