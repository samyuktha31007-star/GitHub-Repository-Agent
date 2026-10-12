const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Main health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// User routes
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  if (userId == null) {
    return res.status(400).json({ error: 'Missing user ID' });
  }
  res.json({ id: userId, username: 'testuser', role: 'customer' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;
