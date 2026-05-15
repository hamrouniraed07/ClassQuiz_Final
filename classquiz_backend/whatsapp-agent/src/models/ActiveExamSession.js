/**
 * src/models/ActiveExamSession.js
 *
 * Stocke l'examen actif choisi par l'admin depuis le dashboard.
 * Un seul document "singleton" — l'admin peut changer l'examen actif à tout moment.
 * Toutes les photos WhatsApp reçues s'indexent dans cet examen.
 */
const mongoose = require('mongoose')

const activeExamSessionSchema = new mongoose.Schema({
  // L'examen sélectionné par l'admin
  examId:     { type: String, required: true },
  examTitle:  { type: String, default: null },
  examSubject:{ type: String, default: null },
  classLevel: { type: String, default: null },

  // Admin qui a activé cet examen
  activatedBy:  { type: String, default: 'admin' },
  activatedAt:  { type: Date,   default: Date.now },

  // Stats en temps réel
  receivedCount:  { type: Number, default: 0 },
  indexedCount:   { type: Number, default: 0 },
  failedCount:    { type: Number, default: 0 },

  // Statut de la session
  isActive: { type: Boolean, default: true },

}, { timestamps: true, collection: 'wa_active_session' })

module.exports = mongoose.model('ActiveExamSession', activeExamSessionSchema)