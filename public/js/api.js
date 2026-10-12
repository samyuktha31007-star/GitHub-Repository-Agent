/**
 * API Client for GitHub Repository Agent
 */
const API = {
  // Repository Ingestion
  async ingestGitHub(url, branch = '', token = '') {
    const res = await fetch('/api/ingest/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, branch, token })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to ingest GitHub repository');
    return data;
  },

  async ingestZip(file) {
    const formData = new FormData();
    formData.append('archive', file);

    const res = await fetch('/api/ingest/zip', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to process ZIP upload');
    return data;
  },

  async ingestFiles(filesList) {
    const formData = new FormData();
    for (let i = 0; i < filesList.length; i++) {
      formData.append('files', filesList[i]);
    }

    const res = await fetch('/api/ingest/files', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to process files upload');
    return data;
  },

  // Repositories Management
  async getRepos() {
    const res = await fetch('/api/repos');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch repositories list');
    return data.repos || [];
  },

  async getRepoDetails(id) {
    const res = await fetch(`/api/repos/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch repository details');
    return data.repo;
  },

  async selectRepo(id) {
    const res = await fetch(`/api/repos/${id}/select`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to select repository');
    return data;
  },

  async deleteRepo(id) {
    const res = await fetch(`/api/repos/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete repository');
    return data;
  },

  // File Viewer
  async getFileContent(repoId, filePath) {
    const res = await fetch(`/api/repos/${repoId}/file?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to retrieve file content');
    return data;
  },

  // Code Fix Suggestions
  async getFixSuggestion(repoId, findingId, filePath, title) {
    const res = await fetch(`/api/repos/${repoId}/suggest-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findingId, filePath, title })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to generate fix suggestion');
    return data;
  },

  // Chatbot
  async sendChatMessage(repoId, question) {
    const res = await fetch(`/api/repos/${repoId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send chat message');
    return data;
  },

  async getChatHistory(repoId) {
    const res = await fetch(`/api/repos/${repoId}/chat`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load chat history');
    return data.history || [];
  },

  async clearChat(repoId) {
    const res = await fetch(`/api/repos/${repoId}/chat`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to clear chat history');
    return data;
  },

  // Documentation Generation
  async generateDocs(repoId, docType) {
    const res = await fetch(`/api/repos/${repoId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to generate documentation');
    return data;
  },

  // Download PDF Report
  getPdfReportUrl(repoId) {
    return `/api/repos/${repoId}/pdf`;
  },

  // Settings & Diagnostics
  async getSettings() {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch settings');
    return data;
  },

  async updateSettings(settings) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update settings');
    return data;
  },

  async getHealth() {
    const res = await fetch('/api/settings/health');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch system health');
    return data;
  }
};
