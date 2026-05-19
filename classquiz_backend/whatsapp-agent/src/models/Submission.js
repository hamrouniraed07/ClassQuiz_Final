const mongoose = require('mongoose')

const submissionSchema = new mongoose.Schema({

  // Identité WhatsApp
  whatsappMessageId: { type: String, required: true, unique: true, index: true },
  senderPhone:       { type: String, required: true },
  senderName:        { type: String, default: null },

  // Image
  whatsappMediaId:   { type: String, required: true },
  localImagePath:    { type: String, default: null },   // chemin disque après téléchargement
  imageMimeType:     { type: String, default: 'image/jpeg' },

  // Code étudiant (extrait de la légende) 
  rawCaption:        { type: String, default: null },   // texte brut envoyé par le parent
  extractedCode:     { type: String, uppercase: true, default: null },

  // Étudiant résolu (lookup ClassQuiz)
  studentId:         { type: String, default: null },   // _id MongoDB de Student
  studentName:       { type: String, default: null },

  // Exam ciblé
  examId:            { type: String, default: null },   // _id MongoDB de Exam

  // Batch
  batchId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null },
  allImagePaths: [{ type: String }],

  // Résultat ClassQuiz
  studentExamId:     { type: String, default: null },   // _id du StudentExam créé dans ClassQuiz
  dispatchedAt:      { type: Date,   default: null },

  // Statut du pipeline
  status: {
    type: String,
    enum: [
      'received',        // webhook reçu, traitement en attente
      'code_extracted',  // code extrait de la légende
      'student_found',   // étudiant vérifié dans ClassQuiz
      'queued',          // ajouté au batch, attend dispatch
      'dispatched',      // envoyé à ClassQuiz, OCR+grading en cours
      'failed',          // erreur à une étape
    ],
    default: 'received',
    index: true,
  },

  //  Erreur
  failReason: { type: String, default: null },
  errorDetail: { type: String, default: null },

}, { timestamps: true, collection: 'wa_submissions' })

submissionSchema.index({ status: 1, examId: 1 })
submissionSchema.index({ extractedCode: 1 })
submissionSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Submission', submissionSchema)
