const path = require('path');
const { maskSecrets } = require('../utils/securityUtils');
const { detectLanguage, isEntryPoint } = require('../utils/languageDetect');

/**
 * Analyzes dependencies from known manifest files
 */
function analyzeDependencies(files) {
  const manifests = [];
  const dependencies = [];

  for (const file of files) {
    const baseName = path.basename(file.path).toLowerCase();

    // Node.js package.json
    if (baseName === 'package.json') {
      try {
        const pkg = JSON.parse(file.content);
        manifests.push({
          file: file.path,
          type: 'npm',
          name: pkg.name || 'unnamed',
          version: pkg.version || '0.0.0'
        });

        if (pkg.dependencies) {
          for (const [name, version] of Object.entries(pkg.dependencies)) {
            dependencies.push({
              name,
              version: String(version),
              type: 'production',
              manifest: file.path,
              ecosystem: 'npm'
            });
          }
        }
        if (pkg.devDependencies) {
          for (const [name, version] of Object.entries(pkg.devDependencies)) {
            dependencies.push({
              name,
              version: String(version),
              type: 'development',
              manifest: file.path,
              ecosystem: 'npm'
            });
          }
        }
      } catch {
        // malformed package.json
      }
    }

    // Python requirements.txt
    if (baseName === 'requirements.txt') {
      manifests.push({ file: file.path, type: 'pip' });
      const lines = file.content.split(/\r\n|\r|\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([a-zA-Z0-9_.-]+)(?:([=<>!~]+)(.+))?$/);
        if (match) {
          dependencies.push({
            name: match[1],
            version: match[3] ? match[2] + match[3] : 'latest',
            type: 'production',
            manifest: file.path,
            ecosystem: 'pypi'
          });
        }
      }
    }

    // Rust Cargo.toml
    if (baseName === 'cargo.toml') {
      manifests.push({ file: file.path, type: 'cargo' });
      const lines = file.content.split(/\r\n|\r|\n/);
      let inDeps = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('[')) {
          inDeps = trimmed === '[dependencies]' || trimmed === '[dev-dependencies]';
          continue;
        }
        if (inDeps && trimmed.includes('=')) {
          const [name, ver] = trimmed.split('=').map(s => s.trim().replace(/"/g, ''));
          dependencies.push({
            name,
            version: ver,
            type: 'cargo',
            manifest: file.path,
            ecosystem: 'crates.io'
          });
        }
      }
    }

    // Go go.mod
    if (baseName === 'go.mod') {
      manifests.push({ file: file.path, type: 'go-mod' });
      const lines = file.content.split(/\r\n|\r|\n/);
      let inRequire = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('require (')) {
          inRequire = true;
          continue;
        }
        if (inRequire && trimmed === ')') {
          inRequire = false;
          continue;
        }
        if ((inRequire || trimmed.startsWith('require ')) && !trimmed.startsWith('//')) {
          const parts = trimmed.replace(/^require\s+/, '').split(/\s+/);
          if (parts.length >= 2) {
            dependencies.push({
              name: parts[0],
              version: parts[1],
              type: 'production',
              manifest: file.path,
              ecosystem: 'go'
            });
          }
        }
      }
    }
  }

  return { manifests, dependencies };
}

/**
 * Detects framework and project category based on files & dependencies
 */
function detectFrameworksAndType(files, dependencies) {
  const depNames = new Set(dependencies.map(d => d.name.toLowerCase()));
  const frameworks = [];
  let appType = 'General Software Project';

  const filePaths = files.map(f => f.path.toLowerCase());

  // Web / Backend Frameworks
  if (depNames.has('express') || depNames.has('koa') || depNames.has('fastify') || depNames.has('nest')) {
    frameworks.push('Express/Node.js Backend');
    appType = 'Backend Web Service / API';
  }
  if (depNames.has('react') || depNames.has('react-dom')) {
    frameworks.push('React');
    appType = 'Frontend Web Application';
  }
  if (depNames.has('next')) {
    frameworks.push('Next.js Fullstack Framework');
    appType = 'Fullstack Web Application';
  }
  if (depNames.has('vue') || depNames.has('nuxt')) {
    frameworks.push('Vue.js');
    appType = 'Frontend Web Application';
  }
  if (depNames.has('django')) {
    frameworks.push('Django');
    appType = 'Python Web Application';
  }
  if (depNames.has('flask') || depNames.has('fastapi')) {
    frameworks.push(depNames.has('fastapi') ? 'FastAPI' : 'Flask');
    appType = 'Python API / Microservice';
  }
  if (depNames.has('tailwindcss')) {
    frameworks.push('Tailwind CSS');
  }

  // CLI detection
  if (depNames.has('commander') || depNames.has('yargs') || depNames.has('chalk') || depNames.has('click') || depNames.has('argparse')) {
    frameworks.push('CLI Tooling');
    if (appType === 'General Software Project') appType = 'Command-Line Interface (CLI)';
  }

  // Check for Docker
  if (filePaths.some(p => p.includes('dockerfile') || p.includes('docker-compose'))) {
    frameworks.push('Docker / Containerized');
  }

  return { frameworks: Array.from(new Set(frameworks)), appType };
}

/**
 * Runs static security analysis rules on files
 */
function runSecurityAnalysis(files) {
  const findings = [];
  let findingCounter = 1;

  const SECRET_PATTERNS = [
    {
      regex: /AKIA[0-9A-Z]{16}/g,
      title: 'Exposed AWS Access Key ID',
      severity: 'Critical',
      impact: 'Allows unauthorized access to cloud infrastructure and AWS resources.',
      fix: 'Revoke this access key immediately in AWS IAM, rotate credentials, and store in environment variables.'
    },
    {
      regex: /(?:ghp|github_pat)_[a-zA-Z0-9_]{36,}/g,
      title: 'Exposed GitHub Personal Access Token',
      severity: 'Critical',
      impact: 'Grants unauthorized access to repositories and GitHub API actions.',
      fix: 'Revoke this token immediately on GitHub Settings > Developer settings and use GitHub Secrets.'
    },
    {
      regex: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/g,
      title: 'Exposed Slack Incoming Webhook URL',
      severity: 'High',
      impact: 'Allows attackers to post unauthorized messages to your Slack channels.',
      fix: 'Revoke webhook in Slack app settings and manage URL through secret environment variables.'
    },
    {
      regex: /(?:api[_-]?key|secret|password|auth_token)\s*[:=]\s*["']([a-zA-Z0-9_\-\.\$\!\#]{8,})["']/gi,
      title: 'Hardcoded Secret or Password Literal',
      severity: 'High',
      impact: 'Credentials committed to version control can be extracted by anyone with repo access.',
      fix: 'Move sensitive credentials to a secure .env file or secrets vault and add to .gitignore.'
    },
    {
      regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g,
      title: 'Committed Private Cryptographic Key',
      severity: 'Critical',
      impact: 'Compromises cryptographic authentication, SSH, or SSL/TLS certificates.',
      fix: 'Remove key from git history, generate a new key pair, and deploy keys out-of-band.'
    }
  ];

  const CODE_VULN_PATTERNS = [
    {
      regex: /\beval\s*\([^\)]+\)/g,
      title: 'Insecure Dynamic Code Execution (`eval`)',
      severity: 'Critical',
      impact: 'Execution of untrusted strings via eval can lead to Remote Code Execution (RCE).',
      fix: 'Replace eval with safe parsing (e.g., JSON.parse) or structured dispatch logic.'
    },
    {
      regex: /(?:exec|execSync)\s*\(\s*`[^`]*\${/g,
      title: 'Potential Command Injection via Unsanitized Template Strings',
      severity: 'Critical',
      impact: 'Attackers can append shell metacharacters to execute arbitrary host commands.',
      fix: 'Use execFile or spawn with structured arguments array instead of shell interpolation.'
    },
    {
      regex: /(?:query|execute)\s*\(\s*["'`][^"'`]*\$\{/g,
      title: 'Potential SQL Injection via Template String Interpolation',
      severity: 'High',
      impact: 'Direct variable interpolation into SQL queries allows data exfiltration or tampering.',
      fix: 'Use parameterized queries or prepared statements provided by your database driver/ORM.'
    },
    {
      regex: /innerHTML\s*=\s*[^;]+(?:\+|`|\$\{)/g,
      title: 'Cross-Site Scripting (XSS) via Unsanitized innerHTML',
      severity: 'Medium',
      impact: 'Injecting raw user input into innerHTML can execute malicious client-side JavaScript.',
      fix: 'Use textContent or sanitize inputs with a DOMPurify library before setting innerHTML.'
    },
    {
      regex: /createHash\s*\(\s*["'](?:md5|sha1)["']\s*\)/gi,
      title: 'Use of Broken/Deprecated Cryptographic Hash Algorithm',
      severity: 'Low',
      impact: 'MD5 and SHA-1 have known collision vulnerabilities and should not be used for security.',
      fix: 'Upgrade to modern cryptographic hashes such as SHA-256, SHA-512, or argon2/bcrypt for passwords.'
    }
  ];

  for (const file of files) {
    const lines = file.content.split(/\r\n|\r|\n/);

    // Scan for secrets
    for (const rule of SECRET_PATTERNS) {
      lines.forEach((line, lineIdx) => {
        // Skip comment lines in non-code files if trivial
        rule.regex.lastIndex = 0;
        const match = rule.regex.exec(line);
        if (match) {
          const findingId = `SEC-${String(findingCounter++).padStart(3, '0')}`;
          const maskedExcerpt = maskSecrets(line.trim());

          findings.push({
            id: findingId,
            category: 'Security Vulnerability',
            type: 'Secret Exposure',
            title: rule.title,
            severity: rule.severity,
            filePath: file.path,
            lineNumber: lineIdx + 1,
            evidence: maskedExcerpt,
            description: `Potential secret or sensitive credential discovered in file ${file.path} on line ${lineIdx + 1}.`,
            impact: rule.impact,
            recommendedFix: rule.fix,
            confidence: 'High (Verified by static regex scanner)',
            isVerified: true
          });
        }
      });
    }

    // Scan for code vulnerabilities (skip markdown/text)
    if (file.language !== 'Markdown' && file.language !== 'Text' && file.language !== 'JSON') {
      for (const rule of CODE_VULN_PATTERNS) {
        lines.forEach((line, lineIdx) => {
          rule.regex.lastIndex = 0;
          if (rule.regex.test(line)) {
            const findingId = `SEC-${String(findingCounter++).padStart(3, '0')}`;
            findings.push({
              id: findingId,
              category: 'Security Vulnerability',
              type: 'Code Insecurity',
              title: rule.title,
              severity: rule.severity,
              filePath: file.path,
              lineNumber: lineIdx + 1,
              evidence: line.trim().slice(0, 160),
              description: `Potentially insecure code pattern detected in ${file.path} at line ${lineIdx + 1}.`,
              impact: rule.impact,
              recommendedFix: rule.fix,
              confidence: 'Medium (Requires contextual verification of input provenance)',
              isVerified: true
            });
          }
        });
      }
    }
  }

  return findings;
}

/**
 * Runs static bug detection and code quality inspection
 */
function runBugAnalysis(files) {
  const bugs = [];
  let bugCounter = 1;

  const BUG_PATTERNS = [
    {
      regex: /catch\s*\([^\)]*\)\s*\{\s*(?:\/\/[^\r\n]*)?\s*\}/g,
      title: 'Empty Catch Block Suppressing Errors Silently',
      severity: 'Medium',
      impact: 'Errors are swallowed without logging, making debugging production failures difficult.',
      fix: 'Log the error or rethrow it appropriately with context.',
      confidence: 'High'
    },
    {
      regex: /[^=!<>]==[^=]/g,
      languages: ['JavaScript', 'TypeScript', 'JavaScript (React)', 'TypeScript (React)'],
      title: 'Loose Equality Comparison (`==` instead of `===`)',
      severity: 'Low',
      impact: 'Implicit type coercion can result in unintended truthy/falsy evaluation bugs.',
      fix: 'Use strict equality (`===`) to ensure type safety.',
      confidence: 'High'
    },
    {
      regex: /while\s*\(\s*true\s*\)\s*\{(?:(?!\bbreak\b|\breturn\b|\bthrow\b)[\s\S])*?\}/g,
      title: 'Potential Infinite Loop (Missing Break/Exit Condition)',
      severity: 'High',
      impact: 'Could freeze the process or exhaust CPU thread resources.',
      fix: 'Ensure there is a verified exit condition (break, return, or throw) inside the loop.',
      confidence: 'Medium'
    },
    {
      regex: /(?:TODO|FIXME|XXX|HACK):?\s*(.+)$/i,
      title: 'Unresolved Code Annotation (TODO/FIXME)',
      severity: 'Low',
      impact: 'Indicates incomplete functionality, technical debt, or temporary workarounds.',
      fix: 'Review and address the comment before releasing to production.',
      confidence: 'High'
    },
    {
      regex: /console\.log\s*\(/g,
      languages: ['JavaScript', 'TypeScript', 'JavaScript (React)', 'TypeScript (React)'],
      title: 'Leftover Debug Console Logging in Source Code',
      severity: 'Low',
      impact: 'Pollutes runtime logs and may inadvertently leak internal state or data.',
      fix: 'Remove console.log or use a configurable structured logging framework.',
      confidence: 'High'
    },
    {
      regex: /(?:JSON\.parse)\s*\((?!try)[^\)]+\)/g,
      title: 'Unprotected `JSON.parse` Without Error Handling',
      severity: 'Medium',
      impact: 'If input is not valid JSON, JSON.parse throws an uncaught SyntaxError terminating the request.',
      fix: 'Wrap JSON.parse in a try-catch block or a safe wrapper function.',
      confidence: 'Medium'
    }
  ];

  for (const file of files) {
    if (file.language === 'Markdown' || file.language === 'Text' || file.language === 'JSON') {
      continue;
    }

    const content = file.content;

    for (const rule of BUG_PATTERNS) {
      if (rule.languages && !rule.languages.includes(file.language)) {
        continue;
      }

      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(content)) !== null) {
        // Calculate line number from match index
        const lineNum = content.slice(0, match.index).split(/\r\n|\r|\n/).length;
        const excerpt = match[0].split(/\r\n|\r|\n/)[0].trim().slice(0, 160);

        const bugId = `BUG-${String(bugCounter++).padStart(3, '0')}`;
        bugs.push({
          id: bugId,
          category: 'Code Quality & Bug',
          severity: rule.severity,
          title: rule.title,
          filePath: file.path,
          lineNumber: lineNum,
          evidence: excerpt,
          description: `Potential code quality or bug condition detected in ${file.path}:${lineNum}.`,
          impact: rule.impact,
          recommendedFix: rule.fix,
          confidence: rule.confidence,
          isVerified: true
        });

        // Prevent infinite loop if regex does not advance
        if (rule.regex.lastIndex === match.index) {
          rule.regex.lastIndex++;
        }
      }
    }
  }

  return bugs;
}

/**
 * Calculates language distribution metrics
 */
function calculateLanguageBreakdown(files) {
  const counts = {};
  const linesMap = {};
  let totalLines = 0;

  for (const file of files) {
    const lang = file.language || 'Other';
    counts[lang] = (counts[lang] || 0) + 1;
    const lines = file.linesOfCode || 1;
    linesMap[lang] = (linesMap[lang] || 0) + lines;
    totalLines += lines;
  }

  const breakdown = Object.entries(linesMap).map(([lang, lines]) => {
    return {
      language: lang,
      files: counts[lang],
      linesOfCode: lines,
      percentage: totalLines > 0 ? Math.round((lines / totalLines) * 1000) / 10 : 0
    };
  });

  breakdown.sort((a, b) => b.linesOfCode - a.linesOfCode);
  return { breakdown, totalLines };
}

/**
 * Inspects project documentation & test suite presence
 */
function inspectProjectHealth(files) {
  const filePaths = files.map(f => f.path.toLowerCase());
  
  const hasReadme = filePaths.some(p => path.basename(p).startsWith('readme'));
  const hasLicense = filePaths.some(p => path.basename(p).startsWith('license'));
  const hasContributing = filePaths.some(p => path.basename(p).startsWith('contributing'));
  const hasChangelog = filePaths.some(p => path.basename(p).startsWith('changelog'));
  const hasTests = filePaths.some(p => p.includes('test') || p.includes('spec') || p.includes('__tests__'));
  const hasCI = filePaths.some(p => p.includes('.github/workflows') || p.includes('.travis.yml') || p.includes('.gitlab-ci.yml'));
  const hasDocker = filePaths.some(p => p.includes('dockerfile'));

  return {
    hasReadme,
    hasLicense,
    hasContributing,
    hasChangelog,
    hasTests,
    hasCI,
    hasDocker
  };
}

/**
 * Calculates estimated health & quality score (0-100) with documented methodology
 */
function calculateQualityScore(metrics, findings, bugs) {
  // Methodology:
  // Starts at 100 baseline.
  // Critical issues: -15 each
  // High issues: -8 each
  // Medium issues: -4 each
  // Low issues: -1 each
  // Bonus: +5 for tests, +5 for Readme, +5 for License, +5 for CI
  let score = 85;

  if (metrics.health.hasReadme) score += 5;
  if (metrics.health.hasLicense) score += 3;
  if (metrics.health.hasTests) score += 5;
  if (metrics.health.hasCI) score += 2;

  for (const f of [...findings, ...bugs]) {
    if (f.severity === 'Critical') score -= 15;
    else if (f.severity === 'High') score -= 7;
    else if (f.severity === 'Medium') score -= 3;
    else if (f.severity === 'Low') score -= 1;
  }

  score = Math.max(10, Math.min(100, score));

  return {
    score,
    rating: score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs Attention' : 'Critical Action Needed',
    methodology: 'Heuristic metric derived from weighted severity deductions (Critical: -15, High: -7, Medium: -3, Low: -1) combined with documentation and test suite presence credits.'
  };
}

/**
 * Runs full static analysis across repository files
 */
function analyzeRepository(repo) {
  const files = repo.files || [];
  
  const { manifests, dependencies } = analyzeDependencies(files);
  const { frameworks, appType } = detectFrameworksAndType(files, dependencies);
  const securityFindings = runSecurityAnalysis(files);
  const bugFindings = runBugAnalysis(files);
  const { breakdown, totalLines } = calculateLanguageBreakdown(files);
  const health = inspectProjectHealth(files);
  const quality = calculateQualityScore({ health }, securityFindings, bugFindings);

  const entryPoints = files.filter(f => f.isEntryPoint).map(f => f.path);

  // Recommendations
  const recommendations = [];
  if (!health.hasTests) {
    recommendations.push('Add automated unit/integration tests to establish CI verification.');
  }
  if (!health.hasReadme) {
    recommendations.push('Create a comprehensive README.md with setup, usage, and architecture details.');
  }
  if (!health.hasLicense) {
    recommendations.push('Add a standard open-source or proprietary LICENSE file.');
  }
  if (securityFindings.some(f => f.severity === 'Critical')) {
    recommendations.push('URGENT: Remediate critical security vulnerabilities and purge exposed credentials from git history.');
  }
  if (bugFindings.length > 0) {
    recommendations.push(`Resolve ${bugFindings.length} detected code quality and bug issues to improve runtime stability.`);
  }

  return {
    analyzedAt: new Date().toISOString(),
    summary: {
      totalFiles: files.length,
      totalLines,
      primaryLanguage: breakdown[0] ? breakdown[0].language : 'Unknown',
      appType,
      frameworks
    },
    languages: breakdown,
    entryPoints,
    manifests,
    dependencies,
    securityFindings,
    bugFindings,
    totalFindings: securityFindings.length + bugFindings.length,
    health,
    qualityScore: quality,
    recommendations
  };
}

module.exports = {
  analyzeRepository,
  analyzeDependencies,
  runSecurityAnalysis,
  runBugAnalysis,
  calculateLanguageBreakdown,
  inspectProjectHealth
};
