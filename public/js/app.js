/**
 * Main Application Coordinator & State Manager
 */
const App = {
  currentView: 'dashboard',
  activeRepoId: null,
  activeRepo: null,
  activeFile: null,
  activeDocType: 'readme',
  selectedZipFile: null,
  selectedMultiFiles: [],

  async init() {
    UI.initTheme();
    this.bindEvents();
    await this.loadRepositoriesList();
    await this.loadSettings();
    await this.refreshDiagnostics();

    // Check URL hash for view routing
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`view-${hash}`)) {
      this.navigateTo(hash);
    }
  },

  bindEvents() {
    // Navigation items
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const view = item.getAttribute('data-view');
        if (view) this.navigateTo(view);
      });
    });

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.addEventListener('click', () => UI.toggleTheme());

    // Mobile menu toggle
    const mobileBtn = document.getElementById('mobile-toggle');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
      });
    }

    // Header buttons
    document.getElementById('header-add-repo-btn')?.addEventListener('click', () => this.navigateTo('add-repo'));
    document.getElementById('header-download-pdf-btn')?.addEventListener('click', () => this.downloadCurrentPdf());
    document.getElementById('btn-download-pdf-view')?.addEventListener('click', () => this.downloadCurrentPdf());

    // Repo Selector dropdown
    const repoSelect = document.getElementById('repo-select-dropdown');
    if (repoSelect) {
      repoSelect.addEventListener('change', async (e) => {
        const selectedId = e.target.value;
        if (selectedId) {
          await this.selectRepository(selectedId);
        }
      });
    }

    // Add Repo Tabs
    document.querySelectorAll('#view-add-repo .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#view-add-repo .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#view-add-repo .tab-pane').forEach(p => p.style.display = 'none');
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        const pane = document.getElementById(tabId);
        if (pane) pane.style.display = 'block';
      });
    });

    // Ingest Forms
    this.bindIngestEvents();

    // Tree Search Filter
    document.getElementById('tree-search-input')?.addEventListener('input', (e) => {
      this.filterTreeNodes(e.target.value);
    });

    // File Viewer Copy / Download
    document.getElementById('viewer-copy-btn')?.addEventListener('click', () => {
      if (this.activeFile) {
        UI.copyText(this.activeFile.content, `Copied ${this.activeFile.name} content`);
      }
    });

    document.getElementById('viewer-download-btn')?.addEventListener('click', () => {
      if (this.activeFile) {
        UI.downloadFile(this.activeFile.name, this.activeFile.content);
      }
    });

    // Bug Filter Buttons
    document.querySelectorAll('.bug-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bug-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterBugs(btn.getAttribute('data-filter'));
      });
    });

    // Dependencies Search
    document.getElementById('deps-search-input')?.addEventListener('input', (e) => {
      this.filterDependencies(e.target.value);
    });

    // Doc Generator Tabs
    document.querySelectorAll('.doc-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.doc-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeDocType = btn.getAttribute('data-doctype');
        this.generateCurrentDoc();
      });
    });

    document.getElementById('doc-regenerate-btn')?.addEventListener('click', () => this.generateCurrentDoc());
    document.getElementById('doc-copy-btn')?.addEventListener('click', () => {
      const container = document.getElementById('doc-preview-container');
      if (container) UI.copyText(container.innerText, 'Copied documentation');
    });
    document.getElementById('doc-download-btn')?.addEventListener('click', () => {
      const container = document.getElementById('doc-preview-container');
      if (container) UI.downloadFile(`${this.activeDocType}-documentation.md`, container.innerText, 'text/markdown');
    });

    // Chatbot Form
    const chatForm = document.getElementById('chat-input-form');
    if (chatForm) {
      chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input-text');
        if (input && input.value.trim()) {
          const q = input.value.trim();
          input.value = '';
          await this.sendChatQuestion(q);
        }
      });
    }

    // Settings AI Form
    document.getElementById('form-settings-ai')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveSettings();
    });
  },

  bindIngestEvents() {
    // 1. GitHub URL Form
    document.getElementById('form-github-url')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('input-github-url').value.trim();
      const branch = document.getElementById('input-github-branch').value.trim();
      const token = document.getElementById('input-github-token').value.trim();
      const btn = document.getElementById('btn-submit-github');

      try {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Fetching & Ingesting...';
        UI.showToast('Contacting GitHub API and retrieving files...', 'info');

        const res = await API.ingestGitHub(url, branch, token);
        UI.showToast(res.message, 'success');
        await this.loadRepositoriesList();
        await this.selectRepository(res.repo.id);
        this.navigateTo('dashboard');
      } catch (err) {
        UI.showToast(err.message, 'error', 6000);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🚀</span> Ingest & Analyze';
      }
    });

    // 2. ZIP Dropzone
    const zipDropzone = document.getElementById('zip-dropzone');
    const zipInput = document.getElementById('input-zip-file');
    const zipBtn = document.getElementById('btn-submit-zip');

    if (zipDropzone && zipInput) {
      zipDropzone.addEventListener('dragover', (e) => { e.preventDefault(); zipDropzone.classList.add('dragover'); });
      zipDropzone.addEventListener('dragleave', () => zipDropzone.classList.remove('dragover'));
      zipDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        zipDropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          this.handleZipSelection(e.dataTransfer.files[0]);
        }
      });

      zipInput.addEventListener('change', () => {
        if (zipInput.files.length > 0) {
          this.handleZipSelection(zipInput.files[0]);
        }
      });

      zipBtn?.addEventListener('click', async () => {
        if (!this.selectedZipFile) return;
        try {
          zipBtn.disabled = true;
          zipBtn.innerHTML = '<span>⏳</span> Extracting & Analyzing...';
          UI.showToast('Extracting ZIP archive safely...', 'info');

          const res = await API.ingestZip(this.selectedZipFile);
          UI.showToast(res.message, 'success');
          await this.loadRepositoriesList();
          await this.selectRepository(res.repo.id);
          this.navigateTo('dashboard');
        } catch (err) {
          UI.showToast(err.message, 'error', 6000);
        } finally {
          zipBtn.disabled = false;
          zipBtn.innerHTML = '<span>🚀</span> Upload & Analyze ZIP';
        }
      });
    }

    // 3. Multi Files Dropzone
    const filesDropzone = document.getElementById('files-dropzone');
    const filesInput = document.getElementById('input-multi-files');
    const filesBtn = document.getElementById('btn-submit-files');

    if (filesDropzone && filesInput) {
      filesDropzone.addEventListener('dragover', (e) => { e.preventDefault(); filesDropzone.classList.add('dragover'); });
      filesDropzone.addEventListener('dragleave', () => filesDropzone.classList.remove('dragover'));
      filesDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        filesDropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          this.handleFilesSelection(e.dataTransfer.files);
        }
      });

      filesInput.addEventListener('change', () => {
        if (filesInput.files.length > 0) {
          this.handleFilesSelection(filesInput.files);
        }
      });

      filesBtn?.addEventListener('click', async () => {
        if (!this.selectedMultiFiles || this.selectedMultiFiles.length === 0) return;
        try {
          filesBtn.disabled = true;
          filesBtn.innerHTML = '<span>⏳</span> Processing Files...';
          UI.showToast(`Processing ${this.selectedMultiFiles.length} files...`, 'info');

          const res = await API.ingestFiles(this.selectedMultiFiles);
          UI.showToast(res.message, 'success');
          await this.loadRepositoriesList();
          await this.selectRepository(res.repo.id);
          this.navigateTo('dashboard');
        } catch (err) {
          UI.showToast(err.message, 'error', 6000);
        } finally {
          filesBtn.disabled = false;
          filesBtn.innerHTML = '<span>🚀</span> Upload & Analyze Files';
        }
      });
    }
  },

  handleZipSelection(file) {
    if (!file.name.endsWith('.zip')) {
      UI.showToast('Please select a valid .zip file', 'error');
      return;
    }
    this.selectedZipFile = file;
    document.getElementById('zip-selected-filename').textContent = `Selected: ${file.name} (${UI.formatBytes(file.size)})`;
    const btn = document.getElementById('btn-submit-zip');
    if (btn) btn.disabled = false;
  },

  handleFilesSelection(files) {
    this.selectedMultiFiles = files;
    document.getElementById('files-selected-count').textContent = `Selected ${files.length} file(s) ready for analysis`;
    const btn = document.getElementById('btn-submit-files');
    if (btn) btn.disabled = false;
  },

  navigateTo(viewName) {
    this.currentView = viewName;
    window.location.hash = viewName;

    // Update active nav link
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewName);
    });

    // Update views
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `view-${viewName}`);
    });

    // Close mobile drawer if open
    document.getElementById('sidebar')?.classList.remove('open');

    // Trigger view-specific refreshes
    if (viewName === 'doc-gen' && this.activeRepo) {
      this.generateCurrentDoc();
    } else if (viewName === 'chatbot' && this.activeRepo) {
      this.loadChatHistory();
    }
  },

  async loadRepositoriesList() {
    try {
      const repos = await API.getRepos();
      const select = document.getElementById('repo-select-dropdown');
      if (!select) return;

      select.innerHTML = '';
      if (repos.length === 0) {
        select.innerHTML = '<option value="" disabled selected>No repositories loaded</option>';
        this.activeRepoId = null;
        this.activeRepo = null;
        this.renderEmptyStates();
        return;
      }

      repos.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = `${r.name} (${r.owner}) - ${r.fileCount} files`;
        if (r.isActive) opt.selected = true;
        select.appendChild(opt);
      });

      const active = repos.find(r => r.isActive) || repos[0];
      if (active) {
        await this.selectRepository(active.id);
      }
    } catch (err) {
      console.error('Failed to load repositories', err);
    }
  },

  async selectRepository(id) {
    try {
      this.activeRepoId = id;
      const select = document.getElementById('repo-select-dropdown');
      if (select) select.value = id;

      const repo = await API.getRepoDetails(id);
      this.activeRepo = repo;

      this.updateBadges();
      this.renderDashboard();
      this.renderOverview();
      this.renderProjectStructure();
      this.renderCodeAnalysis();
      this.renderBugReports();
      this.renderSecurityAnalysis();
      this.renderDependencies();
    } catch (err) {
      UI.showToast(`Error loading repository: ${err.message}`, 'error');
    }
  },

  renderEmptyStates() {
    document.getElementById('dashboard-empty').style.display = 'flex';
    document.getElementById('dashboard-content').style.display = 'none';

    document.getElementById('overview-empty').style.display = 'flex';
    document.getElementById('overview-content').style.display = 'none';

    document.getElementById('structure-empty').style.display = 'flex';
    document.getElementById('structure-content').style.display = 'none';
  },

  updateBadges() {
    const bugs = this.activeRepo?.analysis?.bugFindings?.length || 0;
    const sec = this.activeRepo?.analysis?.securityFindings?.length || 0;

    const bugsBadge = document.getElementById('nav-bugs-badge');
    const secBadge = document.getElementById('nav-security-badge');

    if (bugsBadge) bugsBadge.textContent = bugs;
    if (secBadge) secBadge.textContent = sec;
  },

  // 1. Dashboard View
  renderDashboard() {
    if (!this.activeRepo) {
      this.renderEmptyStates();
      return;
    }

    document.getElementById('dashboard-empty').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'block';

    const r = this.activeRepo;
    const s = r.analysis?.summary || {};
    const q = r.analysis?.qualityScore || { score: 85, rating: 'Good' };

    document.getElementById('dash-files-count').textContent = UI.formatNumber(r.files.length);
    document.getElementById('dash-loc-count').textContent = UI.formatNumber(s.totalLines || 0);
    document.getElementById('dash-sec-count').textContent = r.analysis?.securityFindings?.length || 0;
    document.getElementById('dash-bugs-count').textContent = r.analysis?.bugFindings?.length || 0;
    document.getElementById('dash-health-score').textContent = `${q.score}/100`;

    document.getElementById('dash-app-type').textContent = s.appType || 'Software Project';
    document.getElementById('dash-primary-lang').textContent = s.primaryLanguage || 'Unknown';
    document.getElementById('dash-frameworks').textContent = s.frameworks?.join(', ') || 'Standard / Core Library';
    document.getElementById('dash-source').textContent = r.source.toUpperCase();
    document.getElementById('dash-branch').textContent = r.defaultBranch || 'main';

    // Languages breakdown bars
    const langsContainer = document.getElementById('dash-languages-list');
    langsContainer.innerHTML = '';
    (r.analysis?.languages || []).slice(0, 6).forEach(l => {
      const item = document.createElement('div');
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.2rem;">
          <span><strong>${l.language}</strong> (${l.files} files)</span>
          <span>${l.linesOfCode.toLocaleString()} LOC (${l.percentage}%)</span>
        </div>
        <div style="height: 6px; background-color: var(--bg-tertiary); border-radius: 9999px; overflow: hidden;">
          <div style="height: 100%; width: ${l.percentage}%; background: linear-gradient(90deg, var(--accent-cyan), var(--accent-indigo));"></div>
        </div>
      `;
      langsContainer.appendChild(item);
    });

    // Strategic Recommendations
    const recsContainer = document.getElementById('dash-recommendations-list');
    recsContainer.innerHTML = '';
    const recs = r.analysis?.recommendations || [];
    if (recs.length === 0) {
      recsContainer.innerHTML = '<li>✔ No immediate strategic alerts flagged. Maintain automated code reviews and unit test coverage.</li>';
    } else {
      recs.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;
        recsContainer.appendChild(li);
      });
    }
  },

  // 2. Overview View
  renderOverview() {
    if (!this.activeRepo) return;
    document.getElementById('overview-empty').style.display = 'none';
    document.getElementById('overview-content').style.display = 'block';

    const r = this.activeRepo;
    document.getElementById('ov-name').textContent = r.name;
    document.getElementById('ov-owner').textContent = r.owner;
    document.getElementById('ov-source').textContent = r.source.toUpperCase();
    document.getElementById('ov-branch').textContent = r.defaultBranch || 'main';
    document.getElementById('ov-license').textContent = r.license || 'Not specified';
    document.getElementById('ov-ingested').textContent = UI.formatDate(r.ingestedAt);

    const urlElem = document.getElementById('ov-url');
    if (r.url) {
      urlElem.href = r.url;
      urlElem.textContent = r.url;
    } else {
      urlElem.removeAttribute('href');
      urlElem.textContent = 'Local Archive (No remote URL)';
    }

    document.getElementById('ov-description').textContent = r.description || 'No description provided.';

    // Health Indicators
    const h = r.analysis?.health || {};
    const healthContainer = document.getElementById('ov-health-indicators');
    healthContainer.innerHTML = `
      <div>${h.hasReadme ? '✅' : '❌'} <strong>README Documentation:</strong> ${h.hasReadme ? 'Present' : 'Missing'}</div>
      <div>${h.hasLicense ? '✅' : '❌'} <strong>Open Source License:</strong> ${h.hasLicense ? 'Detected' : 'Missing'}</div>
      <div>${h.hasTests ? '✅' : '⚠️'} <strong>Automated Test Suites:</strong> ${h.hasTests ? 'Detected' : 'None found'}</div>
      <div>${h.hasCI ? '✅' : 'ℹ️'} <strong>CI/CD Pipelines:</strong> ${h.hasCI ? 'Configured' : 'Not detected'}</div>
      <div>${h.hasDocker ? '✅' : 'ℹ️'} <strong>Containerization (Docker):</strong> ${h.hasDocker ? 'Present' : 'None'}</div>
    `;
  },

  // 3. Project Structure Explorer
  renderProjectStructure() {
    if (!this.activeRepo) return;
    document.getElementById('structure-empty').style.display = 'none';
    document.getElementById('structure-content').style.display = 'grid';

    const container = document.getElementById('tree-nodes-container');
    container.innerHTML = '';

    const tree = this.activeRepo.fileTree || [];
    this.renderTreeNodeList(tree, container, 0);

    // Default select first entrypoint or first file
    const firstFile = this.activeRepo.files?.find(f => f.isEntryPoint) || this.activeRepo.files?.[0];
    if (firstFile) {
      this.loadFilePreview(firstFile.path);
    }
  },

  renderTreeNodeList(nodes, parentElem, depth = 0) {
    nodes.forEach(node => {
      const div = document.createElement('div');
      div.className = 'tree-node';
      div.style.paddingLeft = `${depth * 14 + 6}px`;

      const isDir = node.type === 'directory';
      const icon = isDir ? '📁' : '📄';

      div.innerHTML = `<span>${icon}</span><span class="node-name">${node.name}</span>`;

      if (isDir) {
        div.addEventListener('click', () => {
          const childrenContainer = div.nextElementSibling;
          if (childrenContainer) {
            const isHidden = childrenContainer.style.display === 'none';
            childrenContainer.style.display = isHidden ? 'block' : 'none';
            div.querySelector('span').textContent = isHidden ? '📂' : '📁';
          }
        });
        parentElem.appendChild(div);

        const childrenContainer = document.createElement('div');
        this.renderTreeNodeList(node.children || [], childrenContainer, depth + 1);
        parentElem.appendChild(childrenContainer);
      } else {
        div.addEventListener('click', () => {
          document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('active'));
          div.classList.add('active');
          this.loadFilePreview(node.path);
        });
        parentElem.appendChild(div);
      }
    });
  },

  filterTreeNodes(query) {
    const q = query.toLowerCase().trim();
    document.querySelectorAll('.tree-node').forEach(node => {
      const name = node.querySelector('.node-name')?.textContent.toLowerCase() || '';
      if (!q || name.includes(q)) {
        node.style.display = 'flex';
      } else {
        node.style.display = 'none';
      }
    });
  },

  async loadFilePreview(filePath) {
    if (!this.activeRepoId) return;
    try {
      const data = await API.getFileContent(this.activeRepoId, filePath);
      this.activeFile = data.file;

      document.getElementById('viewer-selected-filename').textContent = `${data.file.path} (${data.file.language}, ${data.file.linesOfCode} lines, ${UI.formatBytes(data.file.size)})`;

      const codeElem = document.getElementById('viewer-code-content');
      // Add line numbers
      const lines = data.file.content.split(/\r\n|\r|\n/);
      const numbered = lines.map((line, idx) => `${String(idx + 1).padStart(4, ' ')} | ${line}`).join('\n');
      codeElem.textContent = numbered;
    } catch (err) {
      UI.showToast(`Failed to load file: ${err.message}`, 'error');
    }
  },

  // 4. Code Analysis View
  renderCodeAnalysis() {
    if (!this.activeRepo) return;
    const r = this.activeRepo;
    const s = r.analysis?.summary || {};

    // Entry points
    const epContainer = document.getElementById('ca-entrypoints-list');
    epContainer.innerHTML = '';
    const entries = r.analysis?.entryPoints || [];
    if (entries.length === 0) {
      epContainer.innerHTML = '<span class="text-muted">No standard entry points found (such as index.js, app.py, main.go).</span>';
    } else {
      entries.forEach(ep => {
        const item = document.createElement('div');
        item.style.cursor = 'pointer';
        item.innerHTML = `🚀 <strong style="color: var(--accent-cyan);">${ep}</strong> - <span style="font-size: 0.8rem; color: var(--text-muted);">Click to inspect</span>`;
        item.addEventListener('click', () => {
          this.navigateTo('structure');
          this.loadFilePreview(ep);
        });
        epContainer.appendChild(item);
      });
    }

    // Architecture details
    document.getElementById('ca-arch-details').innerHTML = `
      <div><strong>Identified Paradigm:</strong> ${s.appType}</div>
      <div><strong>Framework Integration:</strong> ${s.frameworks?.join(', ') || 'Custom'}</div>
      <div><strong>Primary Language:</strong> ${s.primaryLanguage}</div>
    `;

    // Scale details
    document.getElementById('ca-scale-details').innerHTML = `
      <div><strong>Total Files:</strong> ${r.files.length}</div>
      <div><strong>Total Lines of Code:</strong> ${s.totalLines?.toLocaleString() || 0}</div>
      <div><strong>Total Declared Packages:</strong> ${r.analysis?.dependencies?.length || 0}</div>
    `;
  },

  // 5. Bug Reports View
  renderBugReports() {
    if (!this.activeRepo) return;
    this.filterBugs('all');
  },

  filterBugs(filter) {
    const list = document.getElementById('bug-reports-list');
    list.innerHTML = '';

    let bugs = this.activeRepo?.analysis?.bugFindings || [];
    if (filter !== 'all') {
      bugs = bugs.filter(b => b.severity.toLowerCase() === filter.toLowerCase());
    }

    if (bugs.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1rem;">
          <div class="empty-icon">✔</div>
          <h4 class="empty-title">No Bug Findings for Selected Filter</h4>
          <p class="empty-subtitle">Zero static bug patterns matching "${filter}" severity were identified.</p>
        </div>
      `;
      return;
    }

    bugs.forEach(bug => {
      const card = document.createElement('div');
      card.className = `finding-card severity-${bug.severity.toLowerCase()}`;
      card.innerHTML = `
        <div class="finding-header">
          <div>
            <div class="finding-meta">
              <span class="nav-badge ${bug.severity === 'Critical' ? 'badge-red' : bug.severity === 'High' ? 'badge-amber' : 'badge-blue'}">${bug.severity.toUpperCase()}</span>
              <span>${bug.id}</span>
              <span>•</span>
              <span>📁 ${bug.filePath}:${bug.lineNumber}</span>
              <span>•</span>
              <span>Confidence: ${bug.confidence}</span>
            </div>
            <h4 class="finding-title" style="margin-top: 0.35rem;">${bug.title}</h4>
          </div>
          <button class="btn btn-secondary btn-fix" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;">
            <span>💡</span> Suggest Fix
          </button>
        </div>
        <div style="font-size: 0.88rem; color: var(--text-secondary);">${bug.description}</div>
        <div class="evidence-box">${UI.escapeHtml(bug.evidence)}</div>
        <div style="font-size: 0.84rem;"><strong>Impact:</strong> ${bug.impact}</div>
        <div class="remediation-box"><strong>Recommended Fix:</strong> ${bug.recommendedFix}</div>
      `;

      card.querySelector('.btn-fix').addEventListener('click', () => {
        this.openCodeFixModal(bug);
      });

      list.appendChild(card);
    });
  },

  // 6. Security Analysis View
  renderSecurityAnalysis() {
    if (!this.activeRepo) return;
    const list = document.getElementById('security-reports-list');
    list.innerHTML = '';

    const findings = this.activeRepo.analysis?.securityFindings || [];
    if (findings.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="padding: 3rem 1rem;">
          <div class="empty-icon" style="color: var(--accent-emerald);">🛡️</div>
          <h4 class="empty-title">No Security Risks Flagged</h4>
          <p class="empty-subtitle">No exposed secrets or high-risk static vulnerabilities detected in the analyzed files.</p>
        </div>
      `;
      return;
    }

    findings.forEach(sec => {
      const card = document.createElement('div');
      card.className = `finding-card severity-${sec.severity.toLowerCase()}`;
      card.innerHTML = `
        <div class="finding-header">
          <div>
            <div class="finding-meta">
              <span class="nav-badge badge-red">${sec.severity.toUpperCase()}</span>
              <span>${sec.id}</span>
              <span>•</span>
              <span>📁 ${sec.filePath}:${sec.lineNumber}</span>
              <span>•</span>
              <span>Category: ${sec.type}</span>
            </div>
            <h4 class="finding-title" style="margin-top: 0.35rem;">${sec.title}</h4>
          </div>
          <button class="btn btn-secondary btn-fix" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;">
            <span>💡</span> Suggest Fix
          </button>
        </div>
        <div style="font-size: 0.88rem; color: var(--text-secondary);">${sec.description}</div>
        <div class="evidence-box">${UI.escapeHtml(sec.evidence)}</div>
        <div style="font-size: 0.84rem;"><strong>Potential Impact:</strong> ${sec.impact}</div>
        <div class="remediation-box" style="border-color: rgba(244, 63, 94, 0.3); color: var(--accent-rose); background: rgba(244, 63, 94, 0.08);">
          <strong>Remediation:</strong> ${sec.recommendedFix}
        </div>
      `;

      card.querySelector('.btn-fix').addEventListener('click', () => {
        this.openCodeFixModal(sec);
      });

      list.appendChild(card);
    });
  },

  // 7. Dependencies View
  renderDependencies() {
    if (!this.activeRepo) return;
    const manifestsContainer = document.getElementById('deps-manifests-list');
    manifestsContainer.innerHTML = '';

    const manifests = this.activeRepo.analysis?.manifests || [];
    if (manifests.length === 0) {
      manifestsContainer.innerHTML = '<span class="text-muted">No package manifests detected (package.json, requirements.txt, Cargo.toml, go.mod).</span>';
    } else {
      manifests.forEach(m => {
        const badge = document.createElement('span');
        badge.className = 'nav-badge badge-blue';
        badge.textContent = `📄 ${m.file} (${m.type})`;
        manifestsContainer.appendChild(badge);
      });
    }

    this.filterDependencies('');
  },

  filterDependencies(query) {
    const q = query.toLowerCase().trim();
    const tbody = document.getElementById('deps-table-body');
    tbody.innerHTML = '';

    let deps = this.activeRepo?.analysis?.dependencies || [];
    if (q) {
      deps = deps.filter(d => d.name.toLowerCase().includes(q) || d.ecosystem.toLowerCase().includes(q));
    }

    if (deps.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No dependencies found.</td></tr>`;
      return;
    }

    deps.forEach(dep => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${dep.name}</strong></td>
        <td><code>${dep.version}</code></td>
        <td>${dep.type}</td>
        <td><span class="nav-badge badge-blue">${dep.ecosystem}</span></td>
        <td style="color: var(--text-muted); font-size: 0.8rem;">${dep.manifest}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  // 8. Documentation Generator View
  async generateCurrentDoc() {
    if (!this.activeRepoId) {
      UI.showToast('Please load a repository first', 'info');
      return;
    }

    const preview = document.getElementById('doc-preview-container');
    const title = document.getElementById('doc-active-title');
    title.textContent = `${this.activeDocType.toUpperCase()} Documentation`;
    preview.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">⏳ Generating documentation from repository context...</div>';

    try {
      const res = await API.generateDocs(this.activeRepoId, this.activeDocType);
      title.textContent = res.filename;
      preview.innerHTML = UI.renderMarkdown(res.markdown);
      if (res.note) {
        UI.showToast(res.note, 'info');
      }
    } catch (err) {
      preview.innerHTML = `<div style="color: var(--accent-rose);">Failed to generate documentation: ${err.message}</div>`;
    }
  },

  // 9. Repository Chatbot
  async loadChatHistory() {
    if (!this.activeRepoId) return;
    try {
      const history = await API.getChatHistory(this.activeRepoId);
      const container = document.getElementById('chat-messages-container');
      container.innerHTML = '';

      if (history.length === 0) {
        container.innerHTML = `
          <div class="chat-bubble assistant">
            👋 Hello! I am the <strong>Repository Agent</strong>. I have ingested <strong>${this.activeRepo?.name}</strong>. Ask me anything about its architecture, entry points, detected bugs, security concerns, or function logic!
          </div>
        `;
        return;
      }

      history.forEach(m => {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${m.role}`;
        bubble.innerHTML = UI.renderMarkdown(m.content);
        container.appendChild(bubble);
      });

      container.scrollTop = container.scrollHeight;
    } catch (err) {
      console.error(err);
    }
  },

  async sendChatQuestion(question) {
    if (!this.activeRepoId) {
      UI.showToast('Load a repository first to ask questions', 'info');
      return;
    }

    const container = document.getElementById('chat-messages-container');
    const sendBtn = document.getElementById('chat-send-btn');

    // Add user bubble
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user';
    userBubble.textContent = question;
    container.appendChild(userBubble);

    // Add loading bubble
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'chat-bubble assistant';
    loadingBubble.innerHTML = '<em>Thinking and inspecting repository files...</em>';
    container.appendChild(loadingBubble);
    container.scrollTop = container.scrollHeight;

    sendBtn.disabled = true;

    try {
      const res = await API.sendChatMessage(this.activeRepoId, question);
      loadingBubble.innerHTML = UI.renderMarkdown(res.reply.content);
      if (res.note) {
        const noteSpan = document.createElement('div');
        noteSpan.style.fontSize = '0.75rem';
        noteSpan.style.color = 'var(--text-muted)';
        noteSpan.style.marginTop = '0.5rem';
        noteSpan.textContent = `ℹ️ ${res.note}`;
        loadingBubble.appendChild(noteSpan);
      }
    } catch (err) {
      loadingBubble.innerHTML = `<span style="color: var(--accent-rose);">Error: ${err.message}</span>`;
    } finally {
      sendBtn.disabled = false;
      container.scrollTop = container.scrollHeight;
    }
  },

  askSuggestedQuestion(q) {
    const input = document.getElementById('chat-input-text');
    if (input) {
      input.value = q;
      document.getElementById('chat-input-form')?.dispatchEvent(new Event('submit'));
    }
  },

  async clearChat() {
    if (!this.activeRepoId) return;
    try {
      await API.clearChat(this.activeRepoId);
      this.loadChatHistory();
      UI.showToast('Chat history cleared', 'info');
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  // 10. Code Fix Suggestion Modal
  async openCodeFixModal(finding) {
    if (!this.activeRepoId) return;
    UI.openModal('modal-code-fix');

    document.getElementById('modal-fix-title').textContent = `Fix Suggestion: ${finding.title}`;
    document.getElementById('modal-original-code').textContent = finding.evidence || 'Loading...';
    document.getElementById('modal-proposed-code').textContent = 'Generating proposal...';
    document.getElementById('modal-explanation').textContent = 'Analyzing syntax and security best practices...';
    document.getElementById('modal-side-effects').textContent = 'Checking impacts...';
    document.getElementById('modal-suggested-tests').textContent = 'Synthesizing test cases...';

    try {
      const res = await API.getFixSuggestion(this.activeRepoId, finding.id, finding.filePath, finding.title);
      const fix = res.fix;

      document.getElementById('modal-original-code').textContent = fix.originalCode || finding.evidence;
      document.getElementById('modal-proposed-code').textContent = fix.proposedCode;
      document.getElementById('modal-explanation').textContent = fix.explanation;
      document.getElementById('modal-side-effects').textContent = fix.potentialSideEffects || 'None identified';
      document.getElementById('modal-suggested-tests').textContent = fix.suggestedTests || 'Run project regression tests.';

      // Copy & download buttons
      document.getElementById('modal-copy-fix-btn').onclick = () => {
        UI.copyText(fix.proposedCode, 'Proposed code copied to clipboard');
      };
      document.getElementById('modal-download-fix-btn').onclick = () => {
        const ext = finding.filePath.split('.').pop() || 'txt';
        UI.downloadFile(`fix_${finding.id}.${ext}`, fix.proposedCode);
      };
    } catch (err) {
      document.getElementById('modal-explanation').textContent = `Could not generate AI fix: ${err.message}`;
    }
  },

  // 11. PDF Reports
  downloadCurrentPdf() {
    if (!this.activeRepoId) {
      UI.showToast('Please load a repository first to download a PDF report.', 'info');
      return;
    }
    UI.showToast('Generating and streaming PDF audit report...', 'info');
    const url = API.getPdfReportUrl(this.activeRepoId);
    window.location.href = url;
  },

  // 12. Settings & Diagnostics
  async loadSettings() {
    try {
      const s = await API.getSettings();
      document.getElementById('settings-ai-provider').value = s.aiProvider;
      document.getElementById('settings-ai-model').value = s.aiModel;
      document.getElementById('settings-ai-baseurl').value = s.aiBaseUrl || '';

      const keyStatus = document.getElementById('settings-ai-key-status');
      if (s.isAiConfigured) {
        keyStatus.textContent = `Configured (${s.aiKeyMasked})`;
        keyStatus.style.color = 'var(--accent-emerald)';
      } else {
        keyStatus.textContent = 'Key is not set. Operating in Offline Heuristic mode.';
        keyStatus.style.color = 'var(--accent-amber)';
      }

      const ghStatus = document.getElementById('settings-github-token-status');
      if (s.hasGitHubToken) {
        ghStatus.textContent = `Configured (${s.githubTokenMasked})`;
        ghStatus.style.color = 'var(--accent-emerald)';
      } else {
        ghStatus.textContent = 'Optional. Leave blank for unauthenticated 60 req/hr.';
        ghStatus.style.color = 'var(--text-muted)';
      }
    } catch (err) {
      console.error(err);
    }
  },

  async saveSettings() {
    try {
      const aiProvider = document.getElementById('settings-ai-provider').value;
      const aiApiKey = document.getElementById('settings-ai-key').value;
      const aiModel = document.getElementById('settings-ai-model').value;
      const aiBaseUrl = document.getElementById('settings-ai-baseurl').value;
      const githubToken = document.getElementById('settings-github-token').value;

      const res = await API.updateSettings({ aiProvider, aiApiKey, aiModel, aiBaseUrl, githubToken });
      UI.showToast(res.message, 'success');
      await this.loadSettings();
      await this.refreshDiagnostics();
    } catch (err) {
      UI.showToast(`Failed to update settings: ${err.message}`, 'error');
    }
  },

  async refreshDiagnostics() {
    try {
      const d = await API.getHealth();
      document.getElementById('diag-status').textContent = d.status;
      document.getElementById('diag-node').textContent = d.nodeVersion;
      document.getElementById('diag-uptime').textContent = `${d.uptimeSeconds}s`;
      document.getElementById('diag-memory').textContent = `${d.memoryUsageMb} MB`;
      document.getElementById('diag-repos').textContent = d.loadedRepositoriesCount;
    } catch (err) {
      console.error(err);
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
