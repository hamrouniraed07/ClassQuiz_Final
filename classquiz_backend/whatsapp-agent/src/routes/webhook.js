/**
 * src/routes/webhook.js
 *
 * Deux endpoints Meta :
 *   GET  /webhook  → vérification d'abonnement (une seule fois au setup)
 *   POST /webhook  → réception des messages en temps réel
 *
 * ⚠️ RÈGLE META : répondre 200 en moins de 5 secondes.
 *    Tout traitement lourd est délégué en ASYNC.
 */
const express  = require('express')
const router   = express.Router()
const logger   = require('../utils/logger')
const pipeline = require('../services/pipeline')

// ── GET /webhook — Vérification Meta ─────────────────────────────────────────
router.get('/', (req, res) => {
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

// ── POST /webhook — Messages entrants ────────────────────────────────────────
router.post('/', (req, res) => {
  // ① Répondre 200 IMMÉDIATEMENT à Meta (obligatoire < 5s)
  res.sendStatus(200)

  // ② Traitement asynchrone
  try {
    const body = req.body
    if (body?.object !== 'whatsapp_business_account') return

    const entry   = body.entry?.[0]
    const value   = entry?.changes?.[0]?.value
    if (!value?.messages?.length) return  // statuts de livraison, etc.

    const msg      = value.messages[0]
    const contact  = value.contacts?.[0]

    // ── Messages image uniquement ──────────────────────────────────────
    if (msg.type === 'image') {
      const messageData = {
        messageId:   msg.id,
        senderPhone: msg.from,
        senderName:  contact?.profile?.name || null,
        mediaId:     msg.image.id,
        mimeType:    msg.image.mime_type || 'image/jpeg',
        caption:     msg.image.caption   || null,  // ← CODE ÉTUDIANT ICI
      }

      logger.info(
        `[Webhook] 📸 Image reçue | from: ${msg.from} | caption: "${messageData.caption || '(vide)'}"`
      )

      // Délégation au pipeline — ne bloque pas
      pipeline.handleIncomingPhoto(messageData).catch(err =>
        logger.error(`[Webhook] Erreur pipeline: ${err.message}`, err)
      )

    } else {
      // Messages texte, audio, etc. → ignorés silencieusement
      logger.debug(`[Webhook] Message ignoré (type: ${msg.type}) depuis ${msg.from}`)
    }

  } catch (err) {
    // Ne jamais crasher sur un webhook — Meta retenterait en boucle
    logger.error(`[Webhook] Erreur parsing: ${err.message}`)
  }
})

module.exports = router
