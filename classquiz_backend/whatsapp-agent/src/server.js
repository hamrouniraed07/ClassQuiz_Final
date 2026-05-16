/**
 * src/server.js — VERSION MISE À JOUR
 * Fix CORS : ajout de PATCH dans les méthodes autorisées
 */
require('dotenv').config()
require('express-async-errors')

const express  = require('express')
const helmet   = require('helmet')
const cors     = require('cors')
const morgan   = require('morgan')
const mongoose = require('mongoose')
const cron     = require('node-cron')
const path     = require('path')
const fs       = require('fs')
const logger   = require('./utils/logger')
const pipeline = require('./services/pipeline')

const app  = express()
const PORT = process.env.PORT || 4000

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost,http://localhost:80').split(',')

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origine non autorisée: ${origin}`))
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],   // ← PATCH ajouté
  allowedHeaders: ['Content-Type', 'x-agent-key', 'Authorization'],
  credentials: true,
}))

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(express.json({ limit: '2mb' }))
app.use(morgan('combined', { stream: { write: m => logger.info(m.trim()) } }))

// ── Dossiers ──────────────────────────────────────────────────────────────────
fs.mkdirSync(path.join(process.cwd(), 'uploads', 'incoming'), { recursive: true })
fs.mkdirSync(path.join(process.cwd(), 'logs'),               { recursive: true })

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/webhook', require('./routes/webhook'))
app.use('/admin',   require('./routes/admin'))
app.use('/session', require('./routes/session'))

app.get('/health', async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1

  let activeSession = null
  try {
    const { getActiveSession } = require('./services/pipeline')
    activeSession = await getActiveSession()
  } catch {}

  res.json({
    status:  mongoOk ? 'ok' : 'degraded',
    service: 'classquiz-whatsapp-agent',
    version: '2.0.0',
    uptime:  Math.floor(process.uptime()),
    mongo:   mongoOk ? 'connected' : 'disconnected',
    activeExam: activeSession ? {
      examId:    activeSession.examId,
      examTitle: activeSession.examTitle,
      received:  activeSession.receivedCount,
      indexed:   activeSession.indexedCount,
    } : null,
  })
})

// ── Erreurs globales ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, err)
  res.status(500).json({ success: false, message: 'Internal server error' })
})

// ── Démarrage ─────────────────────────────────────────────────────────────────
async function start() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/classquiz', {
    serverSelectionTimeoutMS: 10000,
  })
  logger.info('[Server] ✓ MongoDB connecté')

  cron.schedule('*/2 * * * *', () => {
    pipeline.checkExpiredBatches().catch(err =>
      logger.error(`[Cron] checkExpiredBatches échoué: ${err.message}`)
    )
  })
  logger.info('[Server] ✓ Cron batch expiry démarré (*/2 min)')

  const [h, m] = (process.env.BATCH_SCHEDULE_TIME || '08:00').split(':')
  cron.schedule(`${m} ${h} * * *`, async () => {
    logger.info('[Cron] Dispatch planifié quotidien')
    const openBatches = await require('./models/Batch').find({ status: 'open' })
    for (const b of openBatches) {
      pipeline.dispatch(b._id, 'schedule').catch(err =>
        logger.error(`[Cron] Scheduled dispatch ${b._id} échoué: ${err.message}`)
      )
    }
  })

  app.listen(PORT, () => {
    logger.info(`[Server] ✓ WhatsApp Agent v2.1 démarré sur port ${PORT}`)
    logger.info(`[Server]   POST   /webhook            — réception images WhatsApp`)
    logger.info(`[Server]   GET    /admin              — monitoring & dispatch`)
    logger.info(`[Server]   PATCH  /admin/submissions/:id/assign — assignation manuelle`)
    logger.info(`[Server]   GET    /admin/submissions/:id/image  — aperçu image`)
    logger.info(`[Server]   GET    /session            — session exam active`)
    logger.info(`[Server]   POST   /session/activate   — activer un examen`)
    logger.info(`[Server]   DELETE /session/deactivate — désactiver`)
    logger.info(`[Server]   CORS activé pour: ${allowedOrigins.join(', ')}`)
  })
}

process.on('SIGTERM', async () => {
  logger.info('[Server] SIGTERM → arrêt gracieux')
  await mongoose.connection.close()
  process.exit(0)
})

start().catch(err => {
  logger.error(`[Server] Démarrage échoué: ${err.message}`)
  process.exit(1)
})