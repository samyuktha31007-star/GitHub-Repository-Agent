const express = require('express');
const router = express.Router();
const { getRepo } = require('../services/repoStore');
const { generateDocumentation } = require('../services/aiService');

/**
 * POST /api/repos/:id/docs/generate
 * Generates documentation (readme, api, project, setup)
 */
router.post('/:id/generate', async (req, res) => {
  try {
    const repo = getRepo(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found.' });
    }

    const { docType } = req.body;
    const validTypes = ['readme', 'api', 'project', 'setup'];
    const selectedType = validTypes.includes(docType) ? docType : 'readme';

    const result = await generateDocumentation(repo, selectedType);

    res.json({
      success: true,
      repoId: repo.id,
      docType: selectedType,
      filename: selectedType === 'readme' ? 'README.md' : `${selectedType}-documentation.md`,
      markdown: result.markdown,
      source: result.source,
      note: result.note || null
    });
  } catch (err) {
    res.status(500).json({ error: `Documentation generation failed: ${err.message}` });
  }
});

module.exports = router;
