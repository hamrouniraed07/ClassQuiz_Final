/**
 * src/services/classquizClient.js
 *
 * Client HTTP vers le web-api ClassQuiz (port 3000, réseau Docker interne).
 * Deux opérations :
 *   1. resolveStudent(code)  → trouve l'étudiant par son code
 *   2. dispatchBatch(items)  → POST /api/student-exams/batch
 */
const axios    = require('axios')
const fs       = require('fs')
const path     = require('path')
const FormData = require('form-data')
const logger   = require('../utils/logger')

const api = axios.create({
  baseURL: process.env.CLASSQUIZ_API_URL || 'http://web-api:3000',
  timeout: 15000,
})

// Injecter le token admin automatiquement
api.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${process.env.CLASSQUIZ_API_TOKEN}`
  return cfg
})

/**
 * Cherche un étudiant par son code exact dans ClassQuiz.
 *
 * @param {string} code - Ex: "STU-042"
 * @returns {Promise<{_id: string, name: string, code: string, classLevel: string}|null>}
 */
async function resolveStudent(code) {
  logger.info(`[DEBUG] Searching for student: ${code}`)
  try {
    const { data } = await api.get('/api/students', {
      params: { search: code, limit: 200 },
    })

    const students = data?.data?.students || []
    logger.info(`[DEBUG] Found ${students.length} students in response`)

    // Correspondance exacte (insensible à la casse)
    const match = students.find(s => s.code.toUpperCase() === code.toUpperCase())
    
    if (match) {
      logger.info(`[DEBUG] ✓ Student found: ${match.code} - ${match.name}`)
    } else {
      logger.info(`[DEBUG] ✗ No exact match. Sample codes: ${students.slice(0, 5).map(s => s.code).join(',')}`)
    }
    
    return match || null
  } catch (err) {
    logger.error(`[DEBUG] resolveStudent error: ${err.message}`)
    throw err
  }
}

/**
 * Dispatche un batch de copies vers ClassQuiz.
 * Construit le multipart/form-data attendu par POST /api/student-exams/batch.
 *
 * @param {string} examId - ObjectId de l'exam ClassQuiz
 * @param {Array<{submission: object, filePath: string, fileName: string}>} items
 * @returns {Promise<{_id: string, status: string, totalCount: number}>}
 */
async function dispatchBatch(examId, items) {
  const form     = new FormData()
  const mappings = []

  form.append('examId', examId)

  for (const item of items) {
    if (!fs.existsSync(item.filePath)) {
      logger.warn(`[ClassQuiz] Fichier manquant: ${item.filePath} — skipped`)
      continue
    }

    const fileName = path.basename(item.filePath)

    form.append('examImages', fs.createReadStream(item.filePath), {
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
    timeout: 120000,        // 2 min pour les gros batches
    maxContentLength: Infinity,
    maxBodyLength:    Infinity,
  })

  logger.info(`[ClassQuiz] Batch accepté: ${data.data._id} (${mappings.length} copies)`)
  return data.data
}

/**
 * Vérifie que le token JWT est valide (appelé au démarrage).
 * @returns {Promise<boolean>}
 */
async function healthCheck() {
  try {
    await api.get('/health')
    return true
  } catch {
    return false
  }
}

module.exports = { resolveStudent, dispatchBatch, healthCheck }
