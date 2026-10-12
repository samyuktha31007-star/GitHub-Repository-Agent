const fs = require('fs');
const path = require('path');
const config = require('../config');

// In-memory repository cache with support for multiple active repositories
const repositories = new Map();
let activeRepoId = null;

// Ensure temp directory exists
if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
}

function buildFileTree(files) {
  const root = { name: 'root', path: '', type: 'directory', children: [] };

  for (const file of files) {
    const parts = file.path.replace(/\\/g, '/').split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      let existing = current.children.find(c => c.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          size: isFile ? file.size : 0,
          language: isFile ? file.language : null,
          children: isFile ? undefined : []
        };
        current.children.push(existing);
      }
      if (!isFile) {
        current = existing;
      }
    }
  }

  // Sort directories first, then files alphabetically
  function sortTree(node) {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortTree);
    }
  }

  sortTree(root);
  return root.children;
}

function createRepo(repoData) {
  const id = 'repo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  const files = repoData.files || [];
  const fileTree = buildFileTree(files);

  const newRepo = {
    id,
    name: repoData.name || 'unnamed-repo',
    owner: repoData.owner || 'local-user',
    source: repoData.source || 'upload',
    url: repoData.url || null,
    defaultBranch: repoData.defaultBranch || 'main',
    description: repoData.description || '',
    stars: repoData.stars || 0,
    forks: repoData.forks || 0,
    openIssues: repoData.openIssues || 0,
    license: repoData.license || 'Not specified',
    ingestedAt: new Date().toISOString(),
    files,
    fileTree,
    analysis: null,
    chatHistory: []
  };

  repositories.set(id, newRepo);
  activeRepoId = id;
  return newRepo;
}

function getRepo(id) {
  if (!id) return activeRepoId ? repositories.get(activeRepoId) : null;
  return repositories.get(id) || null;
}

function listRepos() {
  return Array.from(repositories.values()).map(r => ({
    id: r.id,
    name: r.name,
    owner: r.owner,
    source: r.source,
    url: r.url,
    fileCount: r.files ? r.files.length : 0,
    ingestedAt: r.ingestedAt,
    isActive: r.id === activeRepoId,
    hasAnalysis: !!r.analysis
  }));
}

function setActiveRepo(id) {
  if (repositories.has(id)) {
    activeRepoId = id;
    return true;
  }
  return false;
}

function updateAnalysis(id, analysisData) {
  const repo = getRepo(id);
  if (repo) {
    repo.analysis = analysisData;
    return true;
  }
  return false;
}

function addChatMessage(id, role, content, metadata = {}) {
  const repo = getRepo(id);
  if (repo) {
    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      role, // 'user' or 'assistant' or 'system'
      content,
      timestamp: new Date().toISOString(),
      metadata
    };
    repo.chatHistory.push(msg);
    return msg;
  }
  return null;
}

function getChatHistory(id) {
  const repo = getRepo(id);
  return repo ? repo.chatHistory : [];
}

function clearChat(id) {
  const repo = getRepo(id);
  if (repo) {
    repo.chatHistory = [];
    return true;
  }
  return false;
}

function deleteRepo(id) {
  const res = repositories.delete(id);
  if (activeRepoId === id) {
    const keys = Array.from(repositories.keys());
    activeRepoId = keys.length > 0 ? keys[0] : null;
  }
  return res;
}

module.exports = {
  createRepo,
  getRepo,
  listRepos,
  setActiveRepo,
  updateAnalysis,
  addChatMessage,
  getChatHistory,
  clearChat,
  deleteRepo,
  buildFileTree
};
