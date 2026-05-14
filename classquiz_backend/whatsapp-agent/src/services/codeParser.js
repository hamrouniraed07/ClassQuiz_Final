/**
 * src/services/codeParser.js
 *
 * Extraction du code étudiant depuis la légende WhatsApp.
 * Pas de Vision OCR — le code vient directement du texte tapé par le parent.
 *
 * Formats supportés :
 *   "STU-042"                  → code = STU-042
 *   "stu042"                   → code = STU042   (normalisé)
 *   "CODE: STU-042"            → code = STU-042
 *   "STU-042 EXAM:abc123def"   → code = STU-042, examId = abc123def
 *   "  STU 042  "              → code = STU042   (espaces nettoyés)
 *   "La copie de STU-042"      → code = STU-042  (extraction dans phrase)
 */

// Pattern identique à Student.code dans web-api/src/models/Student.js
const CODE_PATTERN = /^[A-Z0-9\-_]{3,20}$/

/**
 * Parse la légende et extrait le code étudiant + l'examId optionnel.
 *
 * @param {string|null} caption - Texte de la légende WhatsApp
 * @returns {{ code: string|null, examId: string|null, raw: string|null }}
 */
function parseCaption(caption) {
  if (!caption || !caption.trim()) {
    return { code: null, examId: null, raw: null }
  }

  const raw  = caption.trim()
  const text = raw.toUpperCase()

  // ── Extraction de l'examId (optionnel, format EXAM:hexid24) ───────────
  let examId = null
  const examMatch = raw.match(/EXAM[:\s]+([a-f0-9]{24})/i)
  if (examMatch) examId = examMatch[1]

  // ── Extraction du code étudiant ───────────────────────────────────────

  // Priorité 1 : label explicite "CODE: xxx" ou "CODE xxx"
  const labelMatch = text.match(/CODE[:\s]+([A-Z0-9\-_]{3,20})/)
  if (labelMatch) {
    const code = labelMatch[1].trim()
    if (CODE_PATTERN.test(code)) return { code, examId, raw }
  }

  // Priorité 2 : premier token qui ressemble à un code (avant tout espace)
  // Gère "STU-042", "STU-042 EXAM:...", "STU042"
  const firstToken = text.split(/\s+/)[0]
  if (firstToken && CODE_PATTERN.test(firstToken)) {
    return { code: firstToken, examId, raw }
  }

  // Priorité 3 : chercher n'importe quel token valide dans la phrase
  // Gère "La copie de STU-042" ou "Copie STU-042 maths"
  const tokens = text.split(/\s+/)
  for (const token of tokens) {
    const clean = token.replace(/[.,!?;:]+$/, '') // enlever ponctuation finale
    if (CODE_PATTERN.test(clean)) {
      return { code: clean, examId, raw }
    }
  }

  // Priorité 4 : essayer de nettoyer les espaces dans le code
  // Gère "STU 042" → "STU042"
  const noSpaces = text.replace(/\s+/g, '')
  if (CODE_PATTERN.test(noSpaces) && noSpaces.length <= 20) {
    return { code: noSpaces, examId, raw }
  }

  return { code: null, examId, raw }
}

/**
 * Vérifie si un code a le bon format (sans appel API).
 * @param {string} code
 * @returns {boolean}
 */
function isValidCodeFormat(code) {
  return !!code && CODE_PATTERN.test(code.toUpperCase().trim())
}

module.exports = { parseCaption, isValidCodeFormat }
