const axios    = require('axios')
const fs       = require('fs')
const path     = require('path')
const FormData = require('form-data')
const logger   = require('../utils/logger')

const api = axios.create({
  baseURL: process.env.CLASSQUIZ_API_URL || 'http://web-api:3000',
  timeout: 15000,
})

api.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${process.env.CLASSQUIZ_API_TOKEN}`
  return cfg
})

async function resolveStudent(code) {
  logger.info(`[ClassQuiz] Recherche étudiant: ${code}`)
  try {
    const { data } = await api.get('/api/students', {
      params: { code: code.toUpperCase(), limit: 1 },  // ← filtre exact
    })
    const students = data?.data?.students || []
    const match = students[0] || null
    if (match) logger.info(`[ClassQuiz] ✓ Étudiant trouvé: ${match.name}`)
    else logger.warn(`[ClassQuiz] ✗ Introuvable: ${code}`)
    return match
  } catch (err) {
    logger.error(`[ClassQuiz] resolveStudent error: ${err.message}`)
    throw err
  }
}

async function dispatchBatch(examId, items) {
  const form     = new FormData()
  const mappings = []

  form.append('examId', examId)

  // ── Dossier de destination partagé avec web-api 
  // uploads/ est monté comme volume partagé entre whatsapp-agent et web-api
  // web-api lit depuis uploads/student-exams/
  const sharedDir = path.join(process.cwd(), 'uploads', 'student-exams')
  fs.mkdirSync(sharedDir, { recursive: true })

  for (const item of items) {
    if (!fs.existsSync(item.filePath)) {
      logger.warn(`[ClassQuiz] Fichier manquant: ${item.filePath} — skipped`)
      continue
    }

    // ── Copier vers le dossier partagé 
    const ext      = path.extname(item.filePath) || '.jpg'
    const fileName = `wa_${Date.now()}_${path.basename(item.filePath)}`
    const destPath = path.join(sharedDir, fileName)

    fs.copyFileSync(item.filePath, destPath)
    logger.info(`[ClassQuiz] Image copiée: ${item.filePath} → ${destPath}`)

    form.append('examImages', fs.createReadStream(destPath), {
      filename:    fileName,
      contentType: item.submission.imageMimeType || 'image/jpeg',
    })

    mappings.push({
      studentId: item.submission.studentId,
      fileName,
    })
  }

  if (mappings.length === 0) {
    throw new Error('Aucun fichier valide dans le batch')
  }

  form.append('mappings', JSON.stringify(mappings))

  const { data } = await api.post('/api/student-exams/batch', form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${process.env.CLASSQUIZ_API_TOKEN}`,
    },
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength:    Infinity,
  })

  logger.info(`[ClassQuiz] Batch accepté: ${data.data._id} (${mappings.length} copies)`)
  return data.data
}

async function healthCheck() {
  try {
    await api.get('/health')
    return true
  } catch {
    return false
  }
}

module.exports = { resolveStudent, dispatchBatch, healthCheck }