const express = require('express');
const router = express.Router();
const multer = require('multer');
const config = require('../config');
const { parseGitHubUrl, fetchRepoMetadata, fetchRepoFiles } = require('../services/githubService');
const { processZipBuffer, processUploadedFiles } = require('../services/archiveService');
const { createRepo, setActiveRepo } = require('../services/repoStore');
const { analyzeRepository } = require('../services/staticAnalyzer');

// Memory storage for uploads with strict limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSize
  }
});

/**
 * POST /api/ingest/github
 * Ingests a public GitHub repository via URL
 */
router.post('/github', async (req, res) => {
  try {
    const { url, branch, token } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'GitHub repository URL is required.' });
    }

    const { owner, repo } = parseGitHubUrl(url);

    // 1. Fetch metadata
    let metadata;
    try {
      metadata = await fetchRepoMetadata(owner, repo, token);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const targetBranch = branch || metadata.defaultBranch || 'main';

    // 2. Fetch repository source files
    let files;
    try {
      files = await fetchRepoFiles(owner, repo, targetBranch, token);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }

    // 3. Create repository record
    const repoRecord = createRepo({
      name: metadata.name,
      owner: metadata.owner,
      source: 'github_url',
      url: metadata.url,
      defaultBranch: targetBranch,
      description: metadata.description,
      stars: metadata.stars,
      forks: metadata.forks,
      openIssues: metadata.openIssues,
      license: metadata.license,
      files
    });

    // 4. Run automatic analysis
    const analysis = analyzeRepository(repoRecord);
    repoRecord.analysis = analysis;

    res.status(201).json({
      success: true,
      message: `Successfully ingested repository ${owner}/${repo}`,
      repo: {
        id: repoRecord.id,
        name: repoRecord.name,
        owner: repoRecord.owner,
        source: repoRecord.source,
        fileCount: files.length,
        summary: analysis.summary
      }
    });
  } catch (err) {
    res.status(500).json({ error: `Repository ingestion failed: ${err.message}` });
  }
});

/**
 * POST /api/ingest/zip
 * Ingests a repository from an uploaded ZIP archive
 */
router.post('/zip', upload.single('archive'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a valid ZIP archive file.' });
    }

    const originalName = req.file.originalname || 'uploaded-repo.zip';
    const repoName = originalName.replace(/\.zip$/i, '') || 'uploaded-project';

    let files;
    try {
      files = processZipBuffer(req.file.buffer, originalName);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const repoRecord = createRepo({
      name: repoName,
      owner: 'local-upload',
      source: 'zip_upload',
      description: `Uploaded from ${originalName}`,
      files
    });

    const analysis = analyzeRepository(repoRecord);
    repoRecord.analysis = analysis;

    res.status(201).json({
      success: true,
      message: `Successfully extracted and analyzed ${files.length} files from ${originalName}.`,
      repo: {
        id: repoRecord.id,
        name: repoRecord.name,
        owner: repoRecord.owner,
        source: repoRecord.source,
        fileCount: files.length,
        summary: analysis.summary
      }
    });
  } catch (err) {
    res.status(500).json({ error: `ZIP upload processing failed: ${err.message}` });
  }
});

/**
 * POST /api/ingest/files
 * Ingests multiple individual source files
 */
router.post('/files', upload.array('files', 100), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please select one or more files to upload.' });
    }

    let files;
    try {
      files = processUploadedFiles(req.files);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const repoName = `files-collection-${Date.now().toString(36)}`;
    const repoRecord = createRepo({
      name: repoName,
      owner: 'local-upload',
      source: 'file_upload',
      description: `Uploaded ${files.length} individual source files`,
      files
    });

    const analysis = analyzeRepository(repoRecord);
    repoRecord.analysis = analysis;

    res.status(201).json({
      success: true,
      message: `Successfully processed ${files.length} source code files.`,
      repo: {
        id: repoRecord.id,
        name: repoRecord.name,
        owner: repoRecord.owner,
        source: repoRecord.source,
        fileCount: files.length,
        summary: analysis.summary
      }
    });
  } catch (err) {
    res.status(500).json({ error: `File upload processing failed: ${err.message}` });
  }
});

module.exports = router;
