const config = require('../config');
const { processZipBuffer } = require('./archiveService');

/**
 * Parses GitHub URL and extracts owner and repository name
 */
function parseGitHubUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Please provide a valid GitHub repository URL.');
  }

  let cleaned = rawUrl.trim();
  // Remove trailing slashes and .git
  cleaned = cleaned.replace(/\.git\/?$/, '').replace(/\/+$/, '');

  // Regex to extract owner and repo
  const match = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
  if (!match) {
    throw new Error('Invalid GitHub URL format. Expected: https://github.com/owner/repository');
  }

  const owner = match[1];
  const repo = match[2];

  if (!owner || !repo) {
    throw new Error('Could not parse repository owner or name from the provided URL.');
  }

  return { owner, repo };
}

/**
 * Gets GitHub request headers with optional authentication
 */
function getGitHubHeaders(customToken) {
  const token = customToken || config.githubToken;
  const headers = {
    'User-Agent': 'GitHub-Repository-Agent/1.0',
    'Accept': 'application/vnd.github.v3+json'
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  return headers;
}

/**
 * Fetches repository metadata from GitHub API
 */
async function fetchRepoMetadata(owner, repo, customToken) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const response = await fetch(url, {
    headers: getGitHubHeaders(customToken)
  });

  const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
  const rateLimitReset = response.headers.get('x-ratelimit-reset');

  if (response.status === 404) {
    throw new Error(`Repository "${owner}/${repo}" was not found or is private. Only public repositories are supported in this version.`);
  }

  if (response.status === 403 || response.status === 429) {
    let resetTime = '';
    if (rateLimitReset) {
      const resetDate = new Date(parseInt(rateLimitReset, 10) * 1000);
      resetTime = ` Resets at ${resetDate.toLocaleTimeString()}.`;
    }
    throw new Error(`GitHub API rate limit exceeded.${resetTime} Please add a GitHub Personal Access Token in Settings to enjoy 5,000 requests/hr.`);
  }

  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  return {
    name: data.name,
    fullName: data.full_name,
    owner: data.owner ? data.owner.login : owner,
    description: data.description || 'No description provided.',
    stars: data.stargazers_count || 0,
    forks: data.forks_count || 0,
    openIssues: data.open_issues_count || 0,
    license: data.license ? data.license.name : 'Not specified',
    defaultBranch: data.default_branch || 'main',
    url: data.html_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : null
  };
}

/**
 * Fetches repository source files via GitHub zipball endpoint
 */
async function fetchRepoFiles(owner, repo, branch = 'main', customToken) {
  const zipballUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;
  
  const headers = getGitHubHeaders(customToken);
  headers['Accept'] = 'application/vnd.github.v3.raw';

  const response = await fetch(zipballUrl, {
    headers,
    redirect: 'follow'
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error('GitHub rate limit reached while retrieving repository files. Please configure a GitHub Token in Settings.');
    }
    throw new Error(`Failed to download repository files (${response.status}): ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Extract files safely
  const files = processZipBuffer(buffer, `${owner}-${repo}.zip`);
  return files;
}

module.exports = {
  parseGitHubUrl,
  fetchRepoMetadata,
  fetchRepoFiles
};
