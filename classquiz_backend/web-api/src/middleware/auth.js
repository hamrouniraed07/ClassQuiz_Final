const jwt = require('jsonwebtoken');
const { unauthorized } = require('../utils/response');

/**
 * JWT Authentication middleware.
 * Verifies the Bearer token in the Authorization header.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token has expired');
    }
    return unauthorized(res, 'Invalid token');
  }
};

module.exports = { authenticate };
