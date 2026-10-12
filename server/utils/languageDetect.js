const path = require('path');

const EXTENSION_MAP = {
  '.js': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.jsx': 'JavaScript (React)',
  '.ts': 'TypeScript',
  '.mts': 'TypeScript',
  '.cts': 'TypeScript',
  '.tsx': 'TypeScript (React)',
  '.py': 'Python',
  '.pyw': 'Python',
  '.java': 'Java',
  '.c': 'C',
  '.h': 'C/C++ Header',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.hpp': 'C++ Header',
  '.cs': 'C#',
  '.go': 'Go',
  '.rs': 'Rust',
  '.php': 'PHP',
  '.rb': 'Ruby',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.dart': 'Dart',
  '.scala': 'Scala',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'SASS',
  '.less': 'LESS',
  '.json': 'JSON',
  '.xml': 'XML',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.md': 'Markdown',
  '.markdown': 'Markdown',
  '.sh': 'Shell',
  '.bash': 'Bash',
  '.zsh': 'Zsh',
  '.ps1': 'PowerShell',
  '.bat': 'Batch',
  '.cmd': 'Batch',
  '.sql': 'SQL',
  '.graphql': 'GraphQL',
  '.gql': 'GraphQL',
  '.dockerfile': 'Dockerfile',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.lua': 'Lua',
  '.r': 'R',
  '.pl': 'Perl',
  '.pm': 'Perl'
};

const FILENAME_MAP = {
  'dockerfile': 'Dockerfile',
  'docker-compose.yml': 'Docker Compose',
  'docker-compose.yaml': 'Docker Compose',
  'makefile': 'Makefile',
  'cmakelists.txt': 'CMake',
  'jenkinsfile': 'Jenkinsfile',
  'vagrantfile': 'Vagrantfile',
  'gemfile': 'Ruby',
  'rakefile': 'Ruby'
};

const ENTRYPOINT_PATTERNS = [
  /^index\.[jt]sx?$/i,
  /^main\.[jt]sx?$/i,
  /^app\.[jt]sx?$/i,
  /^server\.[jt]sx?$/i,
  /^main\.py$/i,
  /^app\.py$/i,
  /^run\.py$/i,
  /^wsgi\.py$/i,
  /^asgi\.py$/i,
  /^manage\.py$/i,
  /^main\.go$/i,
  /^main\.rs$/i,
  /^main\.cpp$/i,
  /^main\.c$/i,
  /^application\.[jt]sx?$/i,
  /^program\.cs$/i,
  /^Main\.java$/i
];

function detectLanguage(filePath) {
  const baseName = path.basename(filePath).toLowerCase();
  if (FILENAME_MAP[baseName]) {
    return FILENAME_MAP[baseName];
  }
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] || 'Text';
}

function isEntryPoint(filePath) {
  const baseName = path.basename(filePath);
  return ENTRYPOINT_PATTERNS.some(regex => regex.test(baseName));
}

module.exports = {
  detectLanguage,
  isEntryPoint,
  EXTENSION_MAP,
  FILENAME_MAP
};
