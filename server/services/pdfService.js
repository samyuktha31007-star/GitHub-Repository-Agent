const PDFDocument = require('pdfkit');

/**
 * Generates a comprehensive, professional PDF report for a repository
 * and returns it as a Buffer
 */
function generatePdfReport(repo) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        info: {
          Title: `Repository Analysis Report - ${repo.name}`,
          Author: 'GitHub Repository Agent',
          Subject: 'Code Quality and Security Audit'
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const analysis = repo.analysis || {};
      const summary = analysis.summary || {};
      const quality = analysis.qualityScore || { score: 'N/A', rating: 'Unrated' };
      const securityFindings = analysis.securityFindings || [];
      const bugFindings = analysis.bugFindings || [];
      const dependencies = analysis.dependencies || [];
      const languages = analysis.languages || [];

      // Helpers
      function drawHeader(title) {
        doc.fontSize(16).fillColor('#1e293b').font('Helvetica-Bold').text(title);
        doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor('#cbd5e1').lineWidth(1).stroke();
        doc.moveDown(0.8);
      }

      function drawSubHeader(title) {
        doc.fontSize(12).fillColor('#334155').font('Helvetica-Bold').text(title);
        doc.moveDown(0.4);
      }

      // Title & Cover Header
      doc.fontSize(22).fillColor('#0f172a').font('Helvetica-Bold').text('GitHub Repository Agent');
      doc.fontSize(14).fillColor('#3b82f6').font('Helvetica').text('Automated Repository & Security Analysis Report');
      doc.moveDown(0.5);

      doc.fontSize(9).fillColor('#64748b').text(`Generated on: ${new Date().toUTCString()}`);
      doc.text(`Report ID: REP-${Date.now()}`);
      doc.moveDown(1);

      // Repository Metadata Box
      doc.rect(50, doc.y, 495, 75).fillAndStroke('#f8fafc', '#e2e8f0');
      const boxY = doc.y + 10;
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(`Repository: ${repo.name}`, 65, boxY);
      doc.fontSize(9).font('Helvetica').fillColor('#475569');
      doc.text(`Owner: ${repo.owner} | Source: ${repo.source.toUpperCase()} | Branch: ${repo.defaultBranch || 'main'}`, 65, boxY + 16);
      doc.text(`URL: ${repo.url || 'Uploaded archive'}`, 65, boxY + 28);
      doc.text(`Total Files Analyzed: ${repo.files ? repo.files.length : 0} | Total Lines of Code: ${summary.totalLines || 0}`, 65, boxY + 40);
      doc.text(`Estimated Health Score: ${quality.score}/100 (${quality.rating})`, 65, boxY + 52);

      doc.y = boxY + 80;
      doc.moveDown(1);

      // Executive Summary
      drawHeader('1. Executive Summary');
      doc.fontSize(10).font('Helvetica').fillColor('#1e293b');
      doc.text(`This report presents the automated code inspection, security audit, and architecture analysis for the repository "${repo.name}". The repository has been identified as a ${summary.appType || 'Software Project'} primarily built using ${summary.primaryLanguage || 'standard languages'}.`);
      doc.moveDown(0.5);

      if (summary.frameworks && summary.frameworks.length > 0) {
        doc.text(`Detected Frameworks & Technologies: ${summary.frameworks.join(', ')}`);
        doc.moveDown(0.5);
      }

      doc.text(`Total Findings Detected: ${analysis.totalFindings || 0} (${securityFindings.length} Security Issues, ${bugFindings.length} Code Quality / Bug Items).`);
      doc.moveDown(1.2);

      // Language Breakdown
      drawHeader('2. Language & Structure Overview');
      if (languages.length > 0) {
        languages.slice(0, 8).forEach(l => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155').text(`• ${l.language}: `, { continued: true });
          doc.font('Helvetica').fillColor('#64748b').text(`${l.linesOfCode.toLocaleString()} LOC (${l.percentage}%) across ${l.files} file(s)`);
        });
      } else {
        doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('No source code language breakdown available.');
      }
      doc.moveDown(1);

      // Security Findings
      drawHeader('3. Security Vulnerability Findings');
      if (securityFindings.length === 0) {
        doc.fontSize(9).font('Helvetica').fillColor('#16a34a').text('✔ No high-risk security vulnerabilities or hardcoded secrets detected.');
      } else {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#dc2626')
          .text(`Identified ${securityFindings.length} potential security concern(s). Real secrets have been masked.`);
        doc.moveDown(0.5);

        securityFindings.slice(0, 10).forEach(sec => {
          if (doc.y > 700) doc.addPage();
          
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#991b1b').text(`[${sec.severity}] ${sec.id} - ${sec.title}`);
          doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
          doc.text(`File: ${sec.filePath}:${sec.lineNumber} | Confidence: ${sec.confidence}`);
          doc.text(`Evidence: ${sec.evidence}`);
          doc.text(`Impact: ${sec.impact}`);
          doc.fillColor('#0284c7').text(`Remediation: ${sec.recommendedFix}`);
          doc.moveDown(0.6);
        });
      }
      doc.moveDown(1);

      // Bug & Quality Findings
      if (doc.y > 650) doc.addPage();
      drawHeader('4. Bug Reports & Code Quality');
      if (bugFindings.length === 0) {
        doc.fontSize(9).font('Helvetica').fillColor('#16a34a').text('✔ No static bug patterns or syntax anomalies flagged.');
      } else {
        bugFindings.slice(0, 10).forEach(bug => {
          if (doc.y > 700) doc.addPage();

          doc.fontSize(10).font('Helvetica-Bold').fillColor('#d97706').text(`[${bug.severity}] ${bug.id} - ${bug.title}`);
          doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
          doc.text(`File: ${bug.filePath}:${bug.lineNumber}`);
          doc.text(`Evidence: ${bug.evidence}`);
          doc.text(`Impact: ${bug.impact}`);
          doc.fillColor('#0284c7').text(`Fix: ${bug.recommendedFix}`);
          doc.moveDown(0.6);
        });
      }
      doc.moveDown(1);

      // Dependencies
      if (doc.y > 650) doc.addPage();
      drawHeader('5. Dependencies & Manifests');
      if (dependencies.length > 0) {
        doc.fontSize(9).font('Helvetica').fillColor('#334155').text(`Total Declared Dependencies: ${dependencies.length}`);
        doc.moveDown(0.4);
        dependencies.slice(0, 15).forEach(dep => {
          doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text(`• ${dep.name} (${dep.version}) - Manifest: ${dep.manifest}`);
        });
        if (dependencies.length > 15) {
          doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#94a3b8').text(`...and ${dependencies.length - 15} additional dependencies in manifest.`);
        }
      } else {
        doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('No standard package manifests detected (package.json, requirements.txt, Cargo.toml, go.mod).');
      }
      doc.moveDown(1);

      // Recommendations & Limitations
      if (doc.y > 650) doc.addPage();
      drawHeader('6. Strategic Recommendations & Scope Limitations');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b').text('Key Recommendations:');
      if (analysis.recommendations && analysis.recommendations.length > 0) {
        analysis.recommendations.forEach(rec => {
          doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text(`• ${rec}`);
        });
      } else {
        doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text('• Continue following code reviews, security scans, and test coverage maintenance.');
      }
      doc.moveDown(0.8);

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b').text('Analysis Limitations & Methodology Disclosure:');
      doc.fontSize(8).font('Helvetica').fillColor('#64748b');
      doc.text('1. This report was generated using static code pattern analysis, AST heuristics, and manifest inspection.');
      doc.text('2. Static analysis cannot replace dynamic runtime execution, penetration testing, or human code reviews.');
      doc.text('3. Code quality score is an estimate calculated using weighted deductions per finding severity.');
      doc.text('4. No remote code execution was performed. All analysis was conducted in read-only isolation.');

      // Footer
      doc.fontSize(8).fillColor('#94a3b8').text('GitHub Repository Agent | Confidential & Read-Only Audit', 50, 780, { align: 'center', width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generatePdfReport
};
