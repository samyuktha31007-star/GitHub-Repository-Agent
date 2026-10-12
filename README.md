# GitHub Repository Agent ⚡

An autonomous, developer-focused AI code intelligence, security audit, and repository analysis platform built with Node.js, Express, and a modern vanilla web dashboard.

---

## 🌟 Overview

**GitHub Repository Agent** accepts public GitHub repositories, uploaded ZIP archives, and individual source code files to generate in-depth code intelligence, static vulnerability audits, bug detection, dependency graphs, architectural documentation, and audit-ready PDF reports.

---

## 🏗️ Architecture & Features

The application is structured into 12 core sections:

1. **Dashboard**: High-level code intelligence, line counts, language breakdown bars, security finding tallies, bug counts, and an estimated health rating.
2. **Add Repository**: Three ingestion workflows:
   - **GitHub URL**: Validates public repository URLs, extracts metadata, and downloads repository source trees via GitHub REST APIs.
   - **ZIP Upload**: Safe extraction engine with Zip Slip prevention, size bounds, and binary filtering.
   - **Individual Files**: Multi-file dropzone for ad-hoc inspection of scripts and configuration manifests.
3. **Repository Overview**: Git metadata, branch info, open issues, license, and repository health indicators (README, license, CI/CD, Docker, test suites).
4. **Project Structure Explorer**: Interactive file tree with folder expand/collapse, instant search/filter, and a syntax-highlighted code viewer with line numbers.
5. **Code Analysis**: Core entry points, architectural classification, scale metrics, and maintainability review.
6. **Bug Reports**: Pattern-based bug detection with severity classification (`Critical`, `High`, `Medium`, `Low`), evidence excerpts, line numbers, impacts, and one-click **Suggest Fix** dialogs.
7. **Security Analysis & Credential Audit**: Automated scanner for exposed secrets (AWS keys, GitHub PATs, Slack webhooks, hardcoded private keys) with automatic credential redaction, plus detection of code injection risks (`eval`, command injection, SQL injection).
8. **Dependencies**: Automated parser for `package.json`, `requirements.txt`, `Cargo.toml`, and `go.mod`.
9. **Documentation Generator**: Generate, preview, copy, and download Markdown documentation:
   - `README.md`
   - `API Documentation`
   - `Architecture & Design Documentation`
   - `Installation & Setup Guide`
10. **Repository Chatbot**: Conversational assistant grounded in the ingested repository's actual code, dependencies, and findings with prompt injection defense.
11. **PDF Reports**: Audit-ready downloadable PDF report compiled dynamically on the server via `pdfkit`.
12. **Settings & Configuration**: Configure AI providers (Gemini, OpenAI, Groq, Ollama, or Offline Heuristic Engine), enter API keys securely, configure optional GitHub tokens, and view live system diagnostics.

---

## 🔒 Security Safeguards

- **Strictly Read-Only**: The agent never writes to, commits, pushes, or alters the original repository. Code fixes are provided strictly as advisory suggestions.
- **Zip Slip Prevention**: Validates target extraction paths to prevent path traversal outside the safe sandbox.
- **Resource Exhaustion Defense**: Caps maximum archive size (25MB default) and total decompressed files (1,000 files / 100MB max).
- **Untrusted Code Execution Prevention**: Never executes uploaded source code or installs untrusted dependencies.
- **Secret Redaction**: Masks sensitive credentials and API keys in UI displays, logs, and PDF reports.
- **Prompt Injection Defense**: Sanitizes repository content before including it in AI prompts, enforcing strict system role boundaries.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher recommended, tested on Node.js v24)
- **npm** (v9.0.0 or higher)

### Installation
```bash
# Clone or navigate to the repository directory
git clone https://github.com/your-username/github-repo-agent.git
cd "git hub repo agent"

# Install dependencies
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure parameters (optional):
```ini
PORT=3000
AI_PROVIDER=gemini # or 'openai', 'heuristic'
AI_API_KEY=your_gemini_or_openai_key
GITHUB_TOKEN=optional_github_token_for_5000_req_per_hr
```
*Note: If no AI key is provided, the agent runs in **Offline Heuristic Mode**, utilizing local static analysis rules and metadata extraction without external dependencies.*

### Running the Application
```bash
npm start
```
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🧪 Running Automated Tests

Run the complete test suite (unit tests, security tests, and end-to-end API tests):
```bash
npm test
```

Test coverage includes:
- GitHub URL parser and error handling
- Path traversal & Zip Slip attack prevention
- Secret redaction and masking
- Static security and bug pattern scanners
- Dependency manifest parsing
- Server-side PDF report compilation
- End-to-end ingestion, chat, and documentation routes

---

## 📁 Project Structure

```
├── server/
│   ├── index.js              # Express app setup and middleware
│   ├── config.js             # Configuration and environment variables
│   ├── routes/
│   │   ├── ingest.js         # Ingestion endpoints (URL, ZIP, files)
│   │   ├── analysis.js       # Analysis, file viewer, and code fix routes
│   │   ├── chat.js           # Grounded chatbot routes
│   │   ├── docs.js           # Markdown documentation generator
│   │   ├── reports.js        # PDF report generator stream
│   │   └── settings.js       # Settings and diagnostic routes
│   ├── services/
│   │   ├── githubService.js  # GitHub REST API and zipball fetcher
│   │   ├── archiveService.js # Safe ZIP extractor and file processor
│   │   ├── repoStore.js      # In-memory and file tree repository manager
│   │   ├── staticAnalyzer.js # Heuristic static analyzer and vulnerability scanner
│   │   ├── aiService.js      # AI provider integration with heuristic fallback
│   │   └── pdfService.js     # PDF report compiler with PDFKit
│   └── utils/
│       ├── securityUtils.js  # Path validation, secret masking, sanitization
│       └── languageDetect.js # Language mapping and entrypoint detection
├── public/
│   ├── index.html            # Main SPA dashboard
│   ├── css/
│   │   ├── main.css          # Design system, themes, and layout
│   │   └── components.css    # Cards, tree, chatbot, and modals
│   └── js/
│       ├── app.js            # Coordinator, navigation, and view rendering
│       ├── api.js            # Frontend API client
│       └── ui.js             # UI helpers, markdown renderer, and modals
├── tests/
│   ├── run_all_tests.js      # Master test runner
│   ├── test_ingest.js        # Ingestion and Zip Slip security tests
│   ├── test_static_analysis.js # Static analysis scanner tests
│   ├── test_pdf_report.js    # PDF generation test
│   ├── test_e2e_api.js       # End-to-end API integration tests
│   └── sample_repos/         # Sample test projects and test archives
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 📋 Implemented Features & Known Limitations

### Implemented Features
- [x] Ingestion from public GitHub repository URLs (REST API & zipball)
- [x] Ingestion from uploaded ZIP archives with Zip Slip protection
- [x] Ingestion from multi-file selections
- [x] Dark & light theme developer dashboard with responsive layout
- [x] Navigable project file tree with filtering and read-only code viewer
- [x] Language distribution metrics and lines-of-code calculation
- [x] Static security scanner for exposed tokens, private keys, eval, command injection, and SQL injection
- [x] Static bug scanner for empty catches, loose equality, infinite loops, and unhandled JSON parsing
- [x] Manifest parsers for npm (`package.json`), Python (`requirements.txt`), Rust (`Cargo.toml`), and Go (`go.mod`)
- [x] Four documentation generators: README, API docs, Architecture, and Setup Guide
- [x] Repository-aware chatbot with grounded code citations
- [x] Read-only code fix suggestions dialog with copy and download
- [x] Server-side downloadable PDF reports
- [x] Settings management for AI providers and GitHub tokens
- [x] 100% passing automated test suite

### Known Limitations
- **Public Repositories Only**: This version intentionally supports public GitHub repositories. Private repository access with OAuth login is not enabled in this version.
- **GitHub Unauthenticated Rate Limits**: Unauthenticated GitHub API calls are limited to 60 requests per hour by GitHub. Providing a GitHub Personal Access Token in Settings raises this limit to 5,000 requests per hour.
- **Static vs. Dynamic Analysis**: Findings are generated through static pattern analysis and AST heuristics; dynamic runtime penetration testing is recommended for full production verification.
