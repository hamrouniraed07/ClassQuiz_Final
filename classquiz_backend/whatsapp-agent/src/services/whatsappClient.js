const axios  = require('axios')
const fs     = require('fs')
const path   = require('path')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'incoming')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

// CONFIG WAHA
const WAHA_BASE    = process.env.WAHA_URL     || 'http://waha:3000'
const WAHA_KEY     = () => process.env.WAHA_API_KEY
const WAHA_SESSION = process.env.WAHA_SESSION || 'classquiz'

const wahaApi = axios.create({
  baseURL: WAHA_BASE,
  headers: { 'X-Api-Key': WAHA_KEY() },
  timeout: 15000,
})

const EXT_MAP = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/png':  'png', 'image/webp': 'webp',
}

logger.info(`[WA] Provider: WAHA — session: ${WAHA_SESSION}`)


// DOWNLOAD MEDIA
async function downloadMedia(mediaId, messageId, mimeType = 'image/jpeg', mediaUrl = null) {

  // MODE TEST
  if (mediaId?.startsWith('FAKE') || mediaId?.startsWith('LOCAL')) {
    const testPath = path.join(UPLOAD_DIR, 'test_image.jpg')
    return { filePath: testPath, fileName: 'test_image.jpg', mimeType }
  }

  const ext      = EXT_MAP[mimeType] || 'jpg'
  const fileName = `${messageId}_${uuidv4()}.${ext}`
  const filePath = path.join(UPLOAD_DIR, fileName)

  // L'URL WAHA interne Docker : remplacer localhost:3000 par waha:3000
  const url = (mediaUrl || '').replace('http://localhost:3000', 'http://waha:3000')

  const response = await axios.get(url, {
    responseType: 'stream',
    headers: { 'X-Api-Key': WAHA_KEY() },
    timeout: 30000,
  })

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath)
    response.data.pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
  })

  logger.info(`[WA-WAHA] ✓ Image téléchargée: ${fileName}`)
  return { filePath, fileName, mimeType }
}


// SEND MESSAGE
async function sendMessage(to, text) {
  try {
    await wahaApi.post('/api/sendText', {
      session: WAHA_SESSION,
      chatId:  `${to}@c.us`,
      text,
    })
    logger.info(`[WA-WAHA] ✓ Message envoyé → ${to}`)
  } catch (err) {
    logger.warn(`[WA-WAHA] Envoi message échoué → ${to}: ${err.message}`)
  }
}


// MESSAGES PRÉDÉFINIS
async function sendSuccessWithExam(to, studentName, examTitle) {
  await sendMessage(to,
    `*ClassQuiz — Copie reçue*\n\n` +
    `La copie de *${studentName}* a bien été reçue et indexée.\n` +
    `Examen : *${examTitle || 'En cours'}*\n\n` +
    `Elle sera traitée automatiquement (OCR + correction). 📝`
  )
}

async function sendError(to, reason) {
  const msgs = {
    no_code:
      ` *ClassQuiz — Code manquant*\n\n` +
      `Aucun code étudiant n'a été trouvé dans votre message.\n\n` +
      `*Comment envoyer correctement :*\n` +
      `1. Sélectionner la photo de la copie\n` +
      `2. *Avant d'envoyer*, appuyer sur "Ajouter une légende"\n` +
      `3. Taper le code de l'étudiant (ex: *STU-2026-045*)\n` +
      `4. Envoyer`,
    invalid_code:
      ` *ClassQuiz — Code invalide*\n\n` +
      `Le code envoyé ne correspond pas au format attendu.\n` +
      `Merci de vérifier le code sur la copie et réessayer.`,
    student_unknown:
      ` *ClassQuiz — Étudiant introuvable*\n\n` +
      `Le code envoyé ne correspond à aucun étudiant enregistré.\n` +
      `Veuillez vérifier le code sur la copie.`,
    download_failed:
      ` *ClassQuiz — Erreur technique*\n\n` +
      `Impossible de récupérer la photo. Merci de renvoyer votre message.`,
    no_active_session:
      `⏸ *ClassQuiz — Réception suspendue*\n\n` +
      `Aucun examen n'est actuellement actif.\n` +
      `L'établissement vous informera quand la réception sera ouverte.`,
  }
  await sendMessage(to, msgs[reason] || msgs.download_failed)
}

module.exports = { downloadMedia, sendMessage, sendSuccessWithExam, sendError }