const mongoose = require('mongoose')
const pendingPairSchema = new mongoose.Schema({
  senderPhone: { type: String, required: true, index: true },
  senderName:  { type: String, default: null },
  code: { type: String, uppercase: true, default: null },

  // Photos accumulées (tableau pour multi-pages)
  photos: [{
    mediaId:   { type: String },
    mediaUrl:  { type: String },
    mimeType:  { type: String, default: 'image/jpeg' },
    messageId: { type: String },
    receivedAt:{ type: Date, default: Date.now },
  }],

  // Dernier moment où une photo a été reçue
  lastPhotoAt: { type: Date, default: null },

  // TTL automatique — document supprimé après PAIR_TTL_SECONDS (défaut: 10 min)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + (parseInt(process.env.PAIR_TTL_SECONDS) || 600) * 1000),
    expires: 0,
  },
}, { timestamps: true, collection: 'wa_pending_pairs' })

pendingPairSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
pendingPairSchema.index({ senderPhone: 1 })

module.exports = mongoose.model('PendingPair', pendingPairSchema)