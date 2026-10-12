const jwt = require('jsonwebtoken');

// Potential security finding: hardcoded jwt secret in source code
const JWT_SECRET = "super_secret_jwt_key_1234567890";

function authenticateUser(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // Empty catch pattern
  }
}

module.exports = {
  authenticateUser,
  JWT_SECRET
};
