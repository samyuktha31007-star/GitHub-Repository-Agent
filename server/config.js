const path = require('path');
const fs = require('fs');

// Load environment variables from server/.env, root .env, and cwd
const serverEnv = path.join(__dirname, '.env');
const rootEnv = path.join(__dirname, '..', '.env');

if (fs.existsSync(serverEnv)) {
  require('dotenv').config({ path: serverEnv });
}
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
}
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10) * 1024 * 1024, // 25MB default
  maxZipFiles: parseInt(process.env.MAX_ZIP_FILES || '1000', 10), // Limit files inside ZIP
  maxUncompressedSize: parseInt(process.env.MAX_UNCOMPRESSED_SIZE_MB || '100', 10) * 1024 * 1024,
  tempDir: path.join(__dirname, '..', 'temp_repos'),
  githubToken: process.env.GITHUB_TOKEN || '',
  aiProvider: process.env.AI_PROVIDER || 'gemini', // 'gemini', 'openai', 'anthropic', 'heuristic'
  aiApiKey: process.env.GEMINI_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
  aiModel: process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-3.8-flash',
  aiBaseUrl: process.env.AI_BASE_URL || ''
};
