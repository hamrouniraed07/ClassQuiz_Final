// src/utils/logger.js
const { createLogger, format, transports } = require('winston')
const path = require('path')
const fs   = require('fs')

const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

const fmt = format.printf(({ level, message, timestamp, stack }) =>
  `${timestamp} [wa-agent] ${level}: ${stack || message}`)

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.errors({ stack: true }), fmt),
  transports: [
    new transports.Console({ format: format.combine(format.colorize(), format.timestamp({ format: 'HH:mm:ss' }), fmt) }),
    new transports.File({ filename: path.join(logsDir, 'error.log'),    level: 'error', maxsize: 10485760, maxFiles: 3 }),
    new transports.File({ filename: path.join(logsDir, 'combined.log'),               maxsize: 10485760, maxFiles: 3 }),
  ],
})

module.exports = logger
