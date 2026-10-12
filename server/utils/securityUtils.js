const path = require('path');

/**
 * Checks if a destination path is safely inside the parent directory (prevents Zip Slip)
 */
function isPathSafe(parentDir, targetPath) {
  const resolvedParent = path.resolve(parentDir);
  const resolvedTarget = path.resolve(parentDir, targetPath);
  return resolvedTarget.startsWith(resolvedParent + path.sep) || resolvedTarget === resolvedParent;
}

/**
 * Common ignored directories and patterns in repository analysis
 */
const IGNORED_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'bower_components',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  '.idea',
  '.vscode',
  '.gradle',
  'build',
  'dist',
  'out',
  'target',
  '.next',
  '.nuxt',
  'coverage',
  '.parcel-cache',
  '.turbo'
]);

const BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp', '.tiff',
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.ogg',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.xz',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pyc', '.pyo', '.class', '.jar', '.war', '.wasm'
]);

/**
 * Checks if a file path should be ignored for source code analysis
 */
function shouldIgnorePath(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  const parts = normalized.split('/');

  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) {
      return true;
    }
  }

  const ext = path.extname(relPath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  // Also ignore minified files and source maps
  if (normalized.endsWith('.min.js') || normalized.endsWith('.min.css') || normalized.endsWith('.map')) {
    return true;
  }

  return false;
}

/**
 * Masks sensitive credentials and tokens in findings and reports
 */
function maskSecrets(text) {
  if (typeof text !== 'string') return text;

  return text
    // Google Gemini / Cloud API Key (AIzaSy...)
    .replace(/(AIza[0-9A-Za-z-_]{35})/g, (m) => m.slice(0, 4) + '****************************' + m.slice(-4))
    // GitHub Personal Access Token (classic & fine-grained)
    .replace(/(ghp_[a-zA-Z0-9]{36})/g, (m) => m.slice(0, 4) + '****************************' + m.slice(-4))
    .replace(/(github_pat_[a-zA-Z0-9_]{22,})/g, (m) => m.slice(0, 11) + '****************************' + m.slice(-4))
    // AWS Access Key ID
    .replace(/(AKIA[0-9A-Z]{16})/g, (m) => m.slice(0, 4) + '************' + m.slice(-4))
    // Generic API Keys & Bearer tokens in assignments
    .replace(/((?:api[_-]?key|secret|password|access[_-]?token|private[_-]?key)\s*[:=]\s*["'])([^"']{4,})(["'])/gi, (match, prefix, secret, suffix) => {
      if (secret.length <= 6) {
        return prefix + '******' + suffix;
      }
      return prefix + secret.slice(0, 2) + '*'.repeat(Math.max(4, secret.length - 4)) + secret.slice(-2) + suffix;
    })
    // Private Key Headers
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----[^-]+-----END (?:RSA )?PRIVATE KEY-----/gs, '-----BEGIN PRIVATE KEY-----\n[REDACTED SENSITIVE PRIVATE KEY]\n-----END PRIVATE KEY-----');
}

/**
 * Sanitizes untrusted user or repository text before incorporating into AI prompts
 */
function sanitizePromptContent(content, maxChars = 15000) {
  if (typeof content !== 'string') return '';
  let cleaned = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // strip non-printable controls
  if (cleaned.length > maxChars) {
    cleaned = cleaned.slice(0, maxChars) + `\n\n...[Truncated: ${content.length - maxChars} characters omitted]...`;
  }
  return cleaned;
}

module.exports = {
  isPathSafe,
  shouldIgnorePath,
  maskSecrets,
  sanitizePromptContent,
  IGNORED_DIRS,
  BINARY_EXTENSIONS
};
