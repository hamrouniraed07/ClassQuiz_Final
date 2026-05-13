const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { unauthorized } = require('../utils/response');

/**
 * JWT Authentication middleware.
 * Verifies the Bearer token in the Authorization header and resolves the Admin document.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const adminId = decoded.sub || decoded.id;
    const admin = adminId ? await Admin.findById(adminId).select('+password') : null;

    if (!admin) {
      return unauthorized(res, 'Invalid token');
    }

    req.admin = admin;
    req.user = {
      id: admin._id.toString(),
      email: admin.email,
      username: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token has expired');
    }
    return unauthorized(res, 'Invalid token');
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return unauthorized(res, 'Admin access required');
  }

  return next();
};

module.exports = { authenticate, requireAdmin };
