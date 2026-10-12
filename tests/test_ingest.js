const assert = require('assert');
const { parseGitHubUrl } = require('../server/services/githubService');
const { isPathSafe, maskSecrets } = require('../server/utils/securityUtils');

console.log('🧪 Running Test Suite: Repository Ingestion & Security Validation');

// 1. URL Parsing Tests
try {
  const valid1 = parseGitHubUrl('https://github.com/expressjs/express');
  assert.strictEqual(valid1.owner, 'expressjs');
  assert.strictEqual(valid1.repo, 'express');

  const valid2 = parseGitHubUrl('github.com/facebook/react.git');
  assert.strictEqual(valid2.owner, 'facebook');
  assert.strictEqual(valid2.repo, 'react');

  assert.throws(() => parseGitHubUrl('https://gitlab.com/user/project'), /Invalid GitHub URL/);
  assert.throws(() => parseGitHubUrl(''), /Please provide a valid GitHub repository URL/);
  console.log('  ✔ GitHub URL Parsing tests passed');
} catch (err) {
  console.error('  ✖ GitHub URL Parsing failed:', err.message);
  process.exit(1);
}

// 2. Path Traversal & Zip Slip Prevention Tests
try {
  const baseDir = 'C:\\temp_repos';
  assert.strictEqual(isPathSafe(baseDir, 'safe/sub/path.js'), true);
  assert.strictEqual(isPathSafe(baseDir, '../../windows/system32/cmd.exe'), false);
  console.log('  ✔ Path Traversal & Zip Slip defense tests passed');
} catch (err) {
  console.error('  ✖ Path Traversal defense failed:', err.message);
  process.exit(1);
}

// 3. Secret Masking Tests
try {
  const sampleSecret = 'const token = "ghp_1234567890abcdef1234567890abcdef1234";';
  const masked = maskSecrets(sampleSecret);
  assert(!masked.includes('1234567890abcdef1234567890abcdef1234'), 'Secret was not redacted!');
  assert(masked.includes('****'), 'Masking asterisks missing');
  console.log('  ✔ Secret Redaction & Masking tests passed');
} catch (err) {
  console.error('  ✖ Secret Masking failed:', err.message);
  process.exit(1);
}

console.log('✅ Ingestion & Security Validation Suite: All tests passed!\n');
