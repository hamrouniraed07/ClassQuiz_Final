const logger = require('./logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
const TIMEOUT_MS = parseInt(process.env.AI_SERVICE_TIMEOUT) || 120000;

// Node 20 native fetch does NOT work with the form-data npm package.
// We must use node-fetch v3 which has built-in form-data stream support.
let _fetch;
async function getFetch() {
  if (!_fetch) {
    _fetch = (await import('node-fetch')).default;
  }
  return _fetch;
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

async function sendFormData(endpoint, formData) {
  // node-fetch automatically reads form-data streams and sets correct Content-Type with boundary
  return callAIService(endpoint, {
    method: 'POST',
    body: formData,
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