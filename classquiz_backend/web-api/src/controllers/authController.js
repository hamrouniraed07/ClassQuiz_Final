const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { success, unauthorized, badRequest } = require('../utils/response');

/**
 * POST /api/auth/login
 * Single admin authentication
 */
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return badRequest(res, 'Username and password are required');
  }

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (username !== adminUsername) {
    return unauthorized(res, 'Invalid credentials');
  }

  // Compare with bcrypt if hash stored, or plain text in dev
  const isValid =
    adminPassword.startsWith('$2')
      ? await bcrypt.compare(password, adminPassword)
      : password === adminPassword;

  if (!isValid) {
    return unauthorized(res, 'Invalid credentials');
  }

  const token = jwt.sign(
    { username: adminUsername, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return success(res, {
    token,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    user: { username: adminUsername, role: 'admin' },
  }, 'Login successful');
};

/**
 * GET /api/auth/me
 * Return current admin info from token
 */
const me = async (req, res) => {
  return success(res, { user: req.user }, 'Authenticated');
};

/**
 * POST /api/auth/refresh
 * Issue a new token given a valid one
 */
const refresh = async (req, res) => {
  const token = jwt.sign(
    { username: req.user.username, role: req.user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  return success(res, { token, expiresIn: process.env.JWT_EXPIRES_IN || '7d' }, 'Token refreshed');
};

module.exports = { login, me, refresh };
