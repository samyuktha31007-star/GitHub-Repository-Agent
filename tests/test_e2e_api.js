const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('../server/index');

console.log('🧪 Running Test Suite: End-to-End API Routes & Ingestion');

async function runE2eTests() {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Test Ingest ZIP Archive
    const zipPath = path.join(__dirname, 'sample_repos', 'sample_ecommerce_api.zip');
    const zipBuffer = fs.readFileSync(zipPath);

    const formData = new FormData();
    const blob = new Blob([zipBuffer], { type: 'application/zip' });
    formData.append('archive', blob, 'sample_ecommerce_api.zip');

    const ingestRes = await fetch(`${baseUrl}/api/ingest/zip`, {
      method: 'POST',
      body: formData
    });

    assert.strictEqual(ingestRes.status, 201, 'Expected 201 Created for ZIP ingestion');
    const ingestData = await ingestRes.json();
    assert(ingestData.success, 'Ingestion response success should be true');
    const repoId = ingestData.repo.id;
    console.log(`  ✔ Ingested sample ZIP repo successfully: ${repoId} (${ingestData.repo.fileCount} files)`);

    // 2. Test Get Repositories
    const reposRes = await fetch(`${baseUrl}/api/repos`);
    const reposData = await reposRes.json();
    assert(reposData.repos.length >= 1, 'Repositories list should contain at least 1 repo');
    console.log(`  ✔ GET /api/repos returned ${reposData.repos.length} repository entries`);

    // 3. Test Get Repo Details
    const detailsRes = await fetch(`${baseUrl}/api/repos/${repoId}`);
    const detailsData = await detailsRes.json();
    assert.strictEqual(detailsData.repo.name, 'sample_ecommerce_api');
    assert(detailsData.repo.analysis, 'Repo analysis should be populated');
    assert(detailsData.repo.analysis.securityFindings.length > 0, 'Security findings should detect JWT secret');
    console.log(`  ✔ GET /api/repos/:id verified metrics and findings (${detailsData.repo.analysis.totalFindings} total findings)`);

    // 4. Test View File Content
    const fileRes = await fetch(`${baseUrl}/api/repos/${repoId}/file?path=src/index.js`);
    const fileData = await fileRes.json();
    assert(fileData.file.content.includes('express()'), 'File content should match src/index.js');
    console.log('  ✔ GET /api/repos/:id/file retrieved file content successfully');

    // 5. Test Chatbot grounded response
    const chatRes = await fetch(`${baseUrl}/api/repos/${repoId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What does this project do?' })
    });
    const chatData = await chatRes.json();
    assert(chatData.success, 'Chat response success should be true');
    assert(chatData.reply.content.length > 20, 'Chatbot reply should be meaningful');
    console.log('  ✔ POST /api/repos/:id/chat answered question with grounded repository context');

    // 6. Test Documentation Generator
    const docRes = await fetch(`${baseUrl}/api/repos/${repoId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType: 'readme' })
    });
    const docData = await docRes.json();
    assert(docData.markdown.includes('sample_ecommerce_api'), 'Generated README should reference repo name');
    console.log('  ✔ POST /api/repos/:id/generate successfully generated README.md');

    // 7. Test PDF Report Download
    const pdfRes = await fetch(`${baseUrl}/api/repos/${repoId}/pdf`);
    assert.strictEqual(pdfRes.status, 200);
    assert.strictEqual(pdfRes.headers.get('content-type'), 'application/pdf');
    const pdfBuf = await pdfRes.arrayBuffer();
    assert(pdfBuf.byteLength > 1000, 'PDF buffer should be non-empty');
    console.log(`  ✔ GET /api/repos/:id/pdf generated downloadable PDF (${pdfBuf.byteLength} bytes)`);

    // 8. Test Settings & Health
    const healthRes = await fetch(`${baseUrl}/api/settings/health`);
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'healthy');
    console.log('  ✔ GET /api/settings/health returned system healthy status');

    console.log('✅ End-to-End API Integration Suite: All tests passed!\n');
  } catch (err) {
    console.error('❌ E2E API Test failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runE2eTests();
