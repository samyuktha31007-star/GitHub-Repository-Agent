const { execSync } = require('child_process');
const path = require('path');

console.log('========================================================');
console.log('🏁 RUNNING GITHUB REPOSITORY AGENT AUTOMATED TEST SUITE');
console.log('========================================================\n');

const testFiles = [
  'test_ingest.js',
  'test_static_analysis.js',
  'test_pdf_report.js',
  'test_gemini_config.js',
  'test_e2e_api.js'
];

let allPassed = true;

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);
  try {
    execSync(`node "${filePath}"`, { stdio: 'inherit' });
  } catch (err) {
    allPassed = false;
    console.error(`❌ Suite ${file} failed with exit code ${err.status}`);
    break;
  }
}

if (allPassed) {
  console.log('========================================================');
  console.log('🎉 ALL AUTOMATED TEST SUITES PASSED SUCCESSFULLY!');
  console.log('========================================================');
  process.exit(0);
} else {
  process.exit(1);
}
