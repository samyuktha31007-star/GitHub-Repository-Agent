const express = require('express');
const router = express.Router();
const { getRepo } = require('../services/repoStore');
const { generatePdfReport } = require('../services/pdfService');

/**
 * GET /api/repos/:id/pdf
 * Generates and downloads a real PDF analysis report
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const repo = getRepo(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found.' });
    }

    const pdfBuffer = await generatePdfReport(repo);

    const safeFilename = `${repo.name.replace(/[^a-zA-Z0-9-_]/g, '_')}_analysis_report.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: `PDF report generation failed: ${err.message}` });
  }
});

module.exports = router;
