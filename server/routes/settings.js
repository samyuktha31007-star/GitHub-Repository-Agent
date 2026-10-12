const express = require('express');
const router = express.Router();
const config = require('../config');
const { listRepos } = require('../services/repoStore');

/**
 * GET /api/settings
 * Retrieves active system configuration with sensitive keys masked
 */
router.get('/', (req, res) => {
  const hasAiKey = !!(config.aiApiKey && config.aiApiKey.trim().length > 0);
  const hasGitHubToken = !!(config.githubToken && config.githubToken.trim().length > 0);

  res.json({
    aiProvider: config.aiProvider,
    aiModel: config.aiModel,
    aiBaseUrl: config.aiBaseUrl || '',
    isAiConfigured: hasAiKey,
    hasGitHubToken,
    githubTokenMasked: hasGitHubToken ? '••••••••••••' + config.githubToken.slice(-4) : '',
    aiKeyMasked: hasAiKey ? '••••••••••••' + config.aiApiKey.slice(-4) : '',
    limits: {
      maxFileSizeMb: config.maxFileSize / (1024 * 1024),
      maxZipFiles: config.maxZipFiles,
      maxUncompressedSizeMb: config.maxUncompressedSize / (1024 * 1024)
    }
  });
});

/**
 * POST /api/settings
 * Updates runtime configuration in memory
 */
router.post('/', (req, res) => {
  const { aiProvider, aiApiKey, aiModel, aiBaseUrl, githubToken } = req.body;

  if (aiProvider !== undefined) config.aiProvider = aiProvider;
  if (aiModel !== undefined) config.aiModel = aiModel;
  if (aiBaseUrl !== undefined) config.aiBaseUrl = aiBaseUrl;

  // Only update secret keys if non-empty string provided
  if (typeof aiApiKey === 'string' && aiApiKey.trim().length > 0) {
    config.aiApiKey = aiApiKey.trim();
  }
  if (typeof githubToken === 'string') {
    config.githubToken = githubToken.trim();
  }

  res.json({
    success: true,
    message: 'Settings updated successfully.',
    isAiConfigured: !!(config.aiApiKey && config.aiApiKey.trim().length > 0),
    hasGitHubToken: !!(config.githubToken && config.githubToken.trim().length > 0)
  });
});

/**
 * GET /api/health
 * System health and diagnostic check
 */
router.get('/health', (req, res) => {
  const repos = listRepos();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    loadedRepositoriesCount: repos.length,
    activeAiProvider: config.aiProvider,
    isAiConfigured: !!(config.aiApiKey && config.aiApiKey.trim().length > 0)
  });
});

module.exports = router;
