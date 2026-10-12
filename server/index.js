const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const ingestRoutes = require('./routes/ingest');
const analysisRoutes = require('./routes/analysis');
const chatRoutes = require('./routes/chat');
const docsRoutes = require('./routes/docs');
const reportsRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');

const app = express();

// Security and utility middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static frontend assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/ingest', ingestRoutes);
app.use('/api/repos', analysisRoutes);
app.use('/api/repos', chatRoutes);
app.use('/api/repos', docsRoutes);
app.use('/api/repos', reportsRoutes);
app.use('/api/settings', settingsRoutes);

// Fallback to index.html for SPA routing
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
  next();
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message || err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected internal server error occurred.'
  });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(`🚀 GitHub Repository Agent running on port ${config.port}`);
    console.log(`👉 Open http://localhost:${config.port} in your browser`);
    console.log(`====================================================`);
  });
}

module.exports = app;
