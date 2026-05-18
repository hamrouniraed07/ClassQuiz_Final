const CODE_PATTERN = /^[A-Z0-9\-_]{3,20}$/

/**
 *
 * @param {string|null} caption 
 * @returns {{ code: string|null, examId: string|null, raw: string|null }}
 */
function parseCaption(caption) {
  if (!caption || !caption.trim()) {
    return { code: null, examId: null, raw: null }
  }

  const raw  = caption.trim()
  const text = raw.toUpperCase()

  // Extraction de l'examId (optionnel, format EXAM:hexid24)
  let examId = null
  const examMatch = raw.match(/EXAM[:\s]+([a-f0-9]{24})/i)
  if (examMatch) examId = examMatch[1]

 
  const labelMatch = text.match(/CODE[:\s]+([A-Z0-9\-_]{3,20})/)
  if (labelMatch) {
    const code = labelMatch[1].trim()
    if (CODE_PATTERN.test(code)) return { code, examId, raw }
  }

  
  const firstToken = text.split(/\s+/)[0]
  if (firstToken && CODE_PATTERN.test(firstToken)) {
    return { code: firstToken, examId, raw }
  }


  const tokens = text.split(/\s+/)
  for (const token of tokens) {
    const clean = token.replace(/[.,!?;:]+$/, '') // enlever ponctuation finale
    if (CODE_PATTERN.test(clean)) {
      return { code: clean, examId, raw }
    }
  }

  const noSpaces = text.replace(/\s+/g, '')
  if (CODE_PATTERN.test(noSpaces) && noSpaces.length <= 20) {
    return { code: noSpaces, examId, raw }
  }

  return { code: null, examId, raw }
}

/**
 * @param {string} code
 * @returns {boolean}
 */
function isValidCodeFormat(code) {
  return !!code && CODE_PATTERN.test(code.toUpperCase().trim())
}

module.exports = { parseCaption, isValidCodeFormat }
