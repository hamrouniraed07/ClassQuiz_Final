/**
 * src/services/whatsappClient.js — VERSION MISE À JOUR
 *
 * Ajout : mode test — si mediaId commence par FAKE ou LOCAL,
 * utilise answer2.png comme image de test au lieu d'appeler Meta.
 */
const axios = require('axios')
const fs    = require('fs')
const path  = require('path')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')

const BASE    = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v18.0'}`
const TOKEN   = () => process.env.WHATSAPP_ACCESS_TOKEN
const PHONE   = () => process.env.WHATSAPP_PHONE_NUMBER_ID

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'incoming')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const EXT_MAP = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/png': 'png', 'image/webp': 'webp'
}

// ── Téléchargement ────────────────────────────────────────────────────────────
async function downloadMedia(mediaId, messageId, mimeType = 'image/jpeg') {

  // ── MODE TEST — bypass Meta API ──────────────────────────────────────────
  // Si mediaId commence par FAKE, LOCAL ou TEST → utiliser une image locale
  if (mediaId.startsWith('FAKE') || mediaId.startsWith('LOCAL') || mediaId.startsWith('TEST')) {
    
    // Chercher une image de test dans uploads/incoming/
    const testImages = ['answer2.png', 'answer3.png', 'test_exam.jpg']
    let testImagePath = null

    for (const img of testImages) {
      const p = path.join(UPLOAD_DIR, img)
      if (fs.existsSync(p)) {
        testImagePath = p
        break
      }
    }

    if (testImagePath) {
      const ext      = path.extname(testImagePath)
      const fileName = `${messageId}_mock${ext}`
      const filePath = path.join(UPLOAD_DIR, fileName)
      fs.copyFileSync(testImagePath, filePath)
      logger.info(`[WA] 🧪 Mode test — image locale utilisée: ${path.basename(testImagePath)} → ${fileName}`)
      return { filePath, fileName, mimeType: ext === '.png' ? 'image/png' : 'image/jpeg' }
    } else {
      throw new Error('Mode test: aucune image de test trouvée dans uploads/incoming/')
    }
  }

  // ── MODE PRODUCTION — téléchargement Meta ────────────────────────────────
  const { data: meta } = await axios.get(`${BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
    timeout: 10000,
  })

  const ext      = EXT_MAP[mimeType] || 'jpg'
  const fileName = `${messageId}_${uuidv4()}.${ext}`
  const filePath = path.join(UPLOAD_DIR, fileName)

  const response = await axios.get(meta.url, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
    responseType: 'stream',
    timeout: 30000,
  })

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath)
    response.data.pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
  })

  logger.info(`[WA] ✓ Image téléchargée: ${fileName}`)
  return { filePath, fileName, mimeType }
}

// ── Envoi de messages ─────────────────────────────────────────────────────────
async function sendMessage(to, text) {
  try {
    await axios.post(`${BASE}/${PHONE()}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    }, {
      headers: {
        Authorization: `Bearer ${TOKEN()}`,
        'Content-Type': 'application/json'
      }
    })
  } catch (err) {
    logger.warn(`[WA] Envoi message échoué → ${to}: ${err.message}`)
  }
}

async function sendSuccessWithExam(to, studentName, examTitle) {
  await sendMessage(to,
    `✅ *ClassQuiz — Copie reçue*\n\n` +
    `La copie de *${studentName}* a bien été reçue et indexée.\n` +
    `Examen : *${examTitle || 'En cours'}*\n\n` +
    `Elle sera traitée automatiquement (OCR + correction). 📝`
  )
}

async function sendError(to, reason) {
  const msgs = {
    no_code:
      `⚠️ *ClassQuiz — Code manquant*\n\n` +
      `Aucun code étudiant n'a été trouvé dans votre message.\n\n` +
      `📸 *Comment envoyer correctement :*\n` +
      `1. Sélectionner la photo de la copie\n` +
      `2. *Avant d'envoyer*, appuyer sur "Ajouter une légende"\n` +
      `3. Taper le code de l'étudiant (ex: *STU-2026-045*)\n` +
      `4. Envoyer`,

    invalid_code:
      `⚠️ *ClassQuiz — Code invalide*\n\n` +
      `Le code envoyé ne correspond pas au format attendu.\n` +
      `Merci de vérifier le code sur la copie et réessayer.`,

    student_unknown:
      `⚠️ *ClassQuiz — Étudiant introuvable*\n\n` +
      `Le code envoyé ne correspond à aucun étudiant enregistré.\n` +
      `Veuillez vérifier le code sur la copie.`,

    download_failed:
      `⚠️ *ClassQuiz — Erreur technique*\n\n` +
      `Impossible de récupérer la photo. Merci de renvoyer votre message.`,

    no_active_session:
      `⏸ *ClassQuiz — Réception suspendue*\n\n` +
      `Aucun examen n'est actuellement actif.\n` +
      `L'établissement vous informera quand la réception sera ouverte.`,
  }
  await sendMessage(to, msgs[reason] || msgs.download_failed)
}

module.exports = { downloadMedia, sendMessage, sendSuccessWithExam, sendError }