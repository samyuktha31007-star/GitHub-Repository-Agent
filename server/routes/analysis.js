const express = require('express');
const router = express.Router();
const { getRepo, listRepos, setActiveRepo, deleteRepo } = require('../services/repoStore');
const { analyzeRepository } = require('../services/staticAnalyzer');
const { generateCodeFix, isAiConfigured } = require('../services/aiService');

/**
 * GET /api/repos
 * Lists all loaded repositories
 */
router.get('/', (req, res) => {
  res.json({ repos: listRepos() });
});

/**
 * GET /api/repos/:id
 * Fetches repository metadata, tree, metrics, and analysis findings
 */
router.get('/:id', (req, res) => {
  const repo = getRepo(req.params.id);
  if (!repo) {
    return res.status(404).json({ error: 'Repository not found or has been cleared.' });
  }

  // Return repo data excluding full content of all files to keep response fast
  const fileSummaries = repo.files.map(f => ({
    path: f.path,
    name: f.name,
    size: f.size,
    language: f.language,
    linesOfCode: f.linesOfCode,
    isEntryPoint: f.isEntryPoint
  }));

  res.json({
    repo: {
      id: repo.id,
      name: repo.name,
      owner: repo.owner,
      source: repo.source,
      url: repo.url,
      defaultBranch: repo.defaultBranch,
      description: repo.description,
      stars: repo.stars,
      forks: repo.forks,
      openIssues: repo.openIssues,
      license: repo.license,
      ingestedAt: repo.ingestedAt,
      fileCount: repo.files.length,
      fileTree: repo.fileTree,
      files: fileSummaries,
      analysis: repo.analysis
    }
  });
});

/**
 * POST /api/repos/:id/select
 * Sets the active repository
 */
router.post('/:id/select', (req, res) => {
  const success = setActiveRepo(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Repository not found.' });
  }
  res.json({ success: true, activeId: req.params.id });
});

/**
 * DELETE /api/repos/:id
 * Removes a repository from memory
 */
router.delete('/:id', (req, res) => {
  const success = deleteRepo(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Repository not found.' });
  }
  res.json({ success: true, message: 'Repository removed successfully.' });
});

/**
 * GET /api/repos/:id/file
 * Retrieves content and specific findings for a file
 */
router.get('/:id/file', (req, res) => {
  const repo = getRepo(req.params.id);
  if (!repo) {
    return res.status(404).json({ error: 'Repository not found.' });
  }

  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'Missing path query parameter.' });
  }

  const file = repo.files.find(f => f.path === filePath);
  if (!file) {
    return res.status(404).json({ error: `File "${filePath}" not found in repository.` });
  }

  // Filter findings for this file
  const bugs = repo.analysis?.bugFindings?.filter(b => b.filePath === filePath) || [];
  const security = repo.analysis?.securityFindings?.filter(s => s.filePath === filePath) || [];

  res.json({
    file: {
      path: file.path,
      name: file.name,
      size: file.size,
      language: file.language,
      linesOfCode: file.linesOfCode,
      isEntryPoint: file.isEntryPoint,
      content: file.content
    },
    findings: {
      bugs,
      security
    }
  });
});

/**
 * POST /api/repos/:id/suggest-fix
 * Returns proposed code fix for a specific bug or security finding
 */
router.post('/:id/suggest-fix', async (req, res) => {
  try {
    const repo = getRepo(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found.' });
    }

    const { findingId, filePath } = req.body;
    const allFindings = [
      ...(repo.analysis?.securityFindings || []),
      ...(repo.analysis?.bugFindings || [])
    ];

    const finding = allFindings.find(f => f.id === findingId || (f.filePath === filePath && f.title === req.body.title));
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found in repository analysis.' });
    }

    const fixSuggestion = await generateCodeFix(repo, finding);
    res.json({
      success: true,
      finding,
      fix: fixSuggestion,
      readOnlyNotice: 'This fix is an advisory proposal only. The original repository is strictly read-only and remains unchanged.'
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to generate code fix suggestion: ${err.message}` });
  }
});

/**
 * POST /api/repos/:id/reanalyze
 * Re-runs static analysis
 */
router.post('/:id/reanalyze', (req, res) => {
  const repo = getRepo(req.params.id);
  if (!repo) {
    return res.status(404).json({ error: 'Repository not found.' });
  }

  const analysis = analyzeRepository(repo);
  repo.analysis = analysis;
  res.json({ success: true, analysis });
});

module.exports = router;
