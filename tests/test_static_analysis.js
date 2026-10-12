const assert = require('assert');
const {
  runSecurityAnalysis,
  runBugAnalysis,
  analyzeDependencies,
  calculateLanguageBreakdown
} = require('../server/services/staticAnalyzer');

console.log('🧪 Running Test Suite: Static Analysis, Bugs, and Security Scanners');

// Sample mock repository files
const mockFiles = [
  {
    path: 'package.json',
    name: 'package.json',
    language: 'JSON',
    linesOfCode: 20,
    size: 400,
    content: JSON.stringify({
      name: 'sample-project',
      version: '1.0.0',
      dependencies: {
        'express': '^4.19.2',
        'cors': '^2.8.5'
      },
      devDependencies: {
        'jest': '^29.7.0'
      }
    }, null, 2)
  },
  {
    path: 'src/server.js',
    name: 'server.js',
    language: 'JavaScript',
    linesOfCode: 35,
    size: 800,
    isEntryPoint: true,
    content: `
const express = require('express');
const app = express();

// Hardcoded credential test
const AWS_KEY = "AKIA1234567890ABCDEF";

app.get('/unsafe', (req, res) => {
  // Vulnerable eval test
  eval("console.log('" + req.query.name + "')");
  res.send('ok');
});

function calculate(a, b) {
  // Loose equality test
  if (a == null) {
    return 0;
  }
  try {
    return a + b;
  } catch (err) {
    // Empty catch test
  }
}

app.listen(3000);
`
  }
];

// 1. Dependency Analysis Test
try {
  const { manifests, dependencies } = analyzeDependencies(mockFiles);
  assert.strictEqual(manifests.length, 1);
  assert.strictEqual(manifests[0].type, 'npm');
  assert.strictEqual(dependencies.length, 3);
  assert(dependencies.some(d => d.name === 'express'));
  assert(dependencies.some(d => d.name === 'jest'));
  console.log('  ✔ Dependency manifest extraction tests passed');
} catch (err) {
  console.error('  ✖ Dependency extraction failed:', err.message);
  process.exit(1);
}

// 2. Security Vulnerability Scan Test
try {
  const secFindings = runSecurityAnalysis(mockFiles);
  assert(secFindings.length >= 2, `Expected at least 2 security findings, got ${secFindings.length}`);
  
  const awsFinding = secFindings.find(f => f.title.includes('AWS Access Key'));
  assert(awsFinding, 'Failed to detect AWS Access Key');
  assert.strictEqual(awsFinding.severity, 'Critical');
  assert(!awsFinding.evidence.includes('AKIA1234567890ABCDEF'), 'AWS key was not masked in evidence');

  const evalFinding = secFindings.find(f => f.title.includes('eval'));
  assert(evalFinding, 'Failed to detect eval dynamic code execution');
  assert.strictEqual(evalFinding.severity, 'Critical');

  console.log('  ✔ Security vulnerability & secret scanner tests passed');
} catch (err) {
  console.error('  ✖ Security scanner failed:', err.message);
  process.exit(1);
}

// 3. Bug & Code Quality Detection Test
try {
  const bugFindings = runBugAnalysis(mockFiles);
  assert(bugFindings.length >= 2, `Expected at least 2 bug findings, got ${bugFindings.length}`);

  const looseEq = bugFindings.find(b => b.title.includes('Loose Equality'));
  assert(looseEq, 'Failed to detect loose equality ==');

  const emptyCatch = bugFindings.find(b => b.title.includes('Empty Catch Block'));
  assert(emptyCatch, 'Failed to detect empty catch block');

  console.log('  ✔ Bug & code quality pattern detector tests passed');
} catch (err) {
  console.error('  ✖ Bug scanner failed:', err.message);
  process.exit(1);
}

// 4. Language Breakdown Test
try {
  const { breakdown, totalLines } = calculateLanguageBreakdown(mockFiles);
  assert.strictEqual(totalLines, 55);
  assert(breakdown.some(b => b.language === 'JavaScript'));
  assert(breakdown.some(b => b.language === 'JSON'));
  console.log('  ✔ Language breakdown calculation tests passed');
} catch (err) {
  console.error('  ✖ Language breakdown failed:', err.message);
  process.exit(1);
}

console.log('✅ Static Analysis & Scanners Suite: All tests passed!\n');
