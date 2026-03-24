const logger = require('./logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
const TIMEOUT_MS = parseInt(process.env.AI_SERVICE_TIMEOUT) || 120000;

/**
 * Generic fetch wrapper for AI Service calls with timeout and error handling
 */
async function callAIService(endpoint, options = {}) {
  const url = `${AI_SERVICE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    logger.info(`AI Service request: ${options.method || 'GET'} ${url}`);
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ detail: 'Unknown AI service error' }));
      throw new Error(`AI Service error [${response.status}]: ${errBody.detail || JSON.stringify(errBody)}`);
    }

    const data = await response.json();
    logger.info(`AI Service response: ${response.status} from ${endpoint}`);
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`AI Service timeout after ${TIMEOUT_MS}ms for ${endpoint}`);
    }
    throw err;
  }
}

/**
 * Send multipart form data (images) to AI service
 */
async function sendFormData(endpoint, formData) {
  return callAIService(endpoint, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type header — fetch sets it with correct boundary for FormData
  });
}

/**
 * Send JSON body to AI service
 */
async function sendJSON(endpoint, body) {
  return callAIService(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

module.exports = { callAIService, sendFormData, sendJSON };
