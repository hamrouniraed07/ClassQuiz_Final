const logger = require('./logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
const TIMEOUT_MS = parseInt(process.env.AI_SERVICE_TIMEOUT) || 120000;

// Use node-fetch (v3, ESM-compatible) which natively supports form-data streams.
// Node 20's native fetch does NOT work with the form-data npm package.
let nodeFetch;
async function getFetch() {
  if (!nodeFetch) {
    nodeFetch = (await import('node-fetch')).default;
  }
  return nodeFetch;
}

async function callAIService(endpoint, options = {}) {
  const fetch = await getFetch();
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
      let errorMessage = `AI Service error [${response.status}]`;
      try {
        const errBody = await response.json();
        if (typeof errBody.detail === 'string') {
          errorMessage += `: ${errBody.detail}`;
        } else if (errBody.detail) {
          errorMessage += `: ${JSON.stringify(errBody.detail)}`;
        } else {
          errorMessage += `: ${JSON.stringify(errBody)}`;
        }
      } catch {
        errorMessage += ': Unknown error';
      }
      throw new Error(errorMessage);
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
 * Send multipart form data to AI service.
 * Uses node-fetch which natively supports form-data streams — no buffer conversion needed.
 */
async function sendFormData(endpoint, formData) {
  return callAIService(endpoint, {
    method: 'POST',
    body: formData,
    // node-fetch automatically sets Content-Type with correct boundary from form-data
  });
}

async function sendJSON(endpoint, body) {
  return callAIService(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

module.exports = { callAIService, sendFormData, sendJSON };