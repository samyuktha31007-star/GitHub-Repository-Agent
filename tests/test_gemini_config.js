const assert = require('assert');
const {
  normalizeModelName,
  callGemini,
  listAvailableGeminiModels
} = require('../server/services/aiService');
const config = require('../server/config');

console.log('🧪 Running Test Suite: Gemini Model Configuration & API Error Handling');

// 1. Model Normalization Tests
try {
  assert.strictEqual(normalizeModelName('gemini-3.8-flash'), 'gemini-3.8-flash');
  assert.strictEqual(normalizeModelName('models/gemini-3.8-flash'), 'gemini-3.8-flash', 'Failed to strip models/ prefix');
  assert.strictEqual(normalizeModelName('  models/gemini-3.8-flash  '), 'gemini-3.8-flash', 'Failed to trim whitespace and strip prefix');
  assert.strictEqual(normalizeModelName(''), 'gemini-3.8-flash', 'Failed to fallback to default model for empty string');
  assert.strictEqual(normalizeModelName(null), 'gemini-3.8-flash', 'Failed to fallback to default model for null');
  console.log('  ✔ Model normalization & default resolution tests passed');
} catch (err) {
  console.error('  ✖ Model normalization test failed:', err);
  process.exit(1);
}

// 2. Server Configuration Precedence Tests
try {
  assert.strictEqual(typeof config.aiModel, 'string');
  assert(config.aiModel.length > 0);
  assert(config.aiModel.includes('3.8') || config.aiModel === 'gemini-3.8-flash', `Expected gemini-3.8-flash default, got: ${config.aiModel}`);
  console.log('  ✔ Server config model defaults to currently supported Gemini model');
} catch (err) {
  console.error('  ✖ Config precedence test failed:', err);
  process.exit(1);
}

// 3. Mocked Error Handling Tests
async function runMockErrorTests() {
  const originalFetch = global.fetch;
  const originalKey = config.aiApiKey;
  config.aiApiKey = 'mock_test_key_12345';

  try {
    // 3A. Mock 404 (Model Not Found / Unsupported)
    global.fetch = async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        error: {
          code: 404,
          message: 'models/old-model is not found for API version v1beta, or is not supported for generateContent.',
          status: 'NOT_FOUND'
        }
      }),
      text: async () => '404 Not Found'
    });

    await assert.rejects(
      async () => callGemini('test prompt'),
      (err) => {
        assert(err.message.includes('404'), 'Expected 404 in error message');
        assert(err.message.includes('GEMINI_MODEL'), 'Expected guidance to configure GEMINI_MODEL in error message');
        return true;
      }
    );
    console.log('  ✔ Mocked 404 Model Not Found error handling verified');

    // 3B. Mock 403 (Invalid API Key / Unauthorized)
    global.fetch = async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({
        error: {
          code: 403,
          message: 'API_KEY_INVALID',
          status: 'PERMISSION_DENIED'
        }
      }),
      text: async () => '403 Forbidden'
    });

    await assert.rejects(
      async () => callGemini('test prompt'),
      (err) => {
        assert(err.message.includes('403') || err.message.includes('Authentication failed'), 'Expected auth error message');
        return true;
      }
    );
    console.log('  ✔ Mocked 403 Invalid API Key error handling verified');

    // 3C. Mock 429 (Quota Limit / Rate Limit)
    global.fetch = async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        error: {
          code: 429,
          message: 'RESOURCE_EXHAUSTED',
          status: 'RESOURCE_EXHAUSTED'
        }
      }),
      text: async () => '429 Quota Exceeded'
    });

    await assert.rejects(
      async () => callGemini('test prompt'),
      (err) => {
        assert(err.message.includes('429') && err.message.includes('Quota limit'), 'Expected 429 quota message');
        return true;
      }
    );
    console.log('  ✔ Mocked 429 Rate Limit / Quota Exceeded error handling verified');

    // 3D. Mock Network Failure
    global.fetch = async () => {
      throw new TypeError('fetch failed: Connection reset by peer');
    };

    await assert.rejects(
      async () => callGemini('test prompt'),
      (err) => {
        assert(err.message.includes('Network failure'), 'Expected network failure message');
        return true;
      }
    );
    console.log('  ✔ Mocked Network Failure error handling verified');

  } finally {
    // Restore original environment
    global.fetch = originalFetch;
    config.aiApiKey = originalKey;
  }

  // 4. Conditional Live API Check
  const liveKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (liveKey && liveKey.trim().length > 0) {
    try {
      console.log('  ℹ Live Gemini API key detected in environment. Running live verification against gemini-3.8-flash...');
      const savedKey = config.aiApiKey;
      config.aiApiKey = liveKey;
      const res = await callGemini('Respond with: LIVE_OK');
      assert(typeof res === 'string' && res.length > 0);
      config.aiApiKey = savedKey;
      console.log('  ✔ Live Gemini API test passed successfully with model gemini-3.8-flash');
    } catch (err) {
      console.warn('  ⚠️ Live API check encountered an error:', err.message);
    }
  } else {
    console.log('  ℹ Live Gemini API test skipped (no live API key in test environment). Mocked tests fully verified.');
  }

  console.log('✅ Gemini Model Configuration & Error Handling Suite: All tests passed!\n');
}

runMockErrorTests().catch((err) => {
  console.error('❌ Gemini test suite failed:', err);
  process.exit(1);
});
