const assert = require('assert');
const { generatePdfReport } = require('../server/services/pdfService');
const { analyzeRepository } = require('../server/services/staticAnalyzer');

console.log('🧪 Running Test Suite: PDF Report Generation');

async function testPdf() {
  const mockRepo = {
    id: 'test_repo_123',
    name: 'audit-target-app',
    owner: 'test-org',
    source: 'github_url',
    url: 'https://github.com/test-org/audit-target-app',
    defaultBranch: 'main',
    files: [
      {
        path: 'src/app.js',
        name: 'app.js',
        size: 500,
        language: 'JavaScript',
        linesOfCode: 25,
        isEntryPoint: true,
        content: 'const x = 1;\nif (x == 1) { console.log(x); }'
      }
    ]
  };

  mockRepo.analysis = analyzeRepository(mockRepo);

  try {
    const pdfBuffer = await generatePdfReport(mockRepo);
    assert(Buffer.isBuffer(pdfBuffer), 'Expected PDF generation to return a Buffer');
    assert(pdfBuffer.length > 500, `Expected non-empty PDF file, got ${pdfBuffer.length} bytes`);

    // Verify PDF header %PDF-
    const header = pdfBuffer.slice(0, 5).toString('ascii');
    assert.strictEqual(header, '%PDF-', 'Buffer does not begin with %PDF- header');

    console.log(`  ✔ PDF generated successfully (${pdfBuffer.length} bytes) with %PDF- header`);
    console.log('✅ PDF Report Generation Suite: All tests passed!\n');
  } catch (err) {
    console.error('  ✖ PDF Generation failed:', err);
    process.exit(1);
  }
}

testPdf();
