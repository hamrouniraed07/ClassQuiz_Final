const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const { success, created, badRequest, unauthorized, conflict } = require('../utils/response');

const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

const loginValidation = [
  body('email')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage('A valid email is required'),
  body('username')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage('Username must be an email address'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required'),
];

const registerValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email is required')
    .normalizeEmail(),
  body('password')
    .trim()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
];

function validationFailed(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, 'Validation failed', errors.array());
  }
  return null;
}

function signToken(admin) {
  return jwt.sign(
    {
      sub: admin._id.toString(),
      email: admin.email,
      role: admin.role,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

function buildAdminResponse(admin) {
  return {
    id: admin._id,
    email: admin.email,
    username: admin.email,
    role: admin.role,
    createdAt: admin.createdAt,
  };
}

const registerAdmin = async (req, res) => {
  const failed = validationFailed(req, res);
  if (failed) return failed;

  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password;

  const adminCount = await Admin.countDocuments();
  if (adminCount > 0 && !req.admin) {
    return unauthorized(res, 'Admin authentication required to register additional admins');
  }

  const existingAdmin = await Admin.findOne({ email });
  if (existingAdmin) {
    return conflict(res, 'An admin with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const admin = await Admin.create({ email, password: hashedPassword });
  const token = signToken(admin);

  return created(
    res,
    {
      token,
      expiresIn: jwtExpiresIn,
      user: buildAdminResponse(admin),
    },
    'Admin registered successfully'
  );
};

const loginAdmin = async (req, res) => {
  const failed = validationFailed(req, res);
  if (failed) return failed;

  const identifier = (req.body.email || req.body.username || '').trim().toLowerCase();
  const password = req.body.password;

  if (!identifier || !password) {
    return badRequest(res, 'Email and password are required');
  }

  const admin = await Admin.findOne({ email: identifier }).select('+password');
  if (!admin) {
    return unauthorized(res, 'Invalid credentials');
  }

  const isValidPassword = await bcrypt.compare(password, admin.password);
  if (!isValidPassword) {
    return unauthorized(res, 'Invalid credentials');
  }

  const token = signToken(admin);

  return success(
    res,
    {
      token,
      expiresIn: jwtExpiresIn,
      user: buildAdminResponse(admin),
    },
    'Login successful'
  );
};

const getCurrentAdmin = async (req, res) => {
  if (!req.admin) {
    return unauthorized(res, 'Unauthorized');
  }

  return success(
    res,
    {
      user: buildAdminResponse(req.admin),
    },
    'Authenticated'
  );
};

const refreshAdminToken = async (req, res) => {
  if (!req.admin) {
    return unauthorized(res, 'Unauthorized');
  }

  const token = signToken(req.admin);
  return success(res, { token, expiresIn: jwtExpiresIn }, 'Token refreshed');
};

const getAdminDashboard = async (req, res) => {
  const [totalAdmins, recentAdmins] = await Promise.all([
    Admin.countDocuments(),
    Admin.find().sort({ createdAt: -1 }).limit(5).select('email role createdAt'),
  ]);

  return success(
    res,
    {
      admin: buildAdminResponse(req.admin),
      stats: {
        totalAdmins,
      },
      recentAdmins,
    },
    'Admin dashboard loaded'
  );
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getCurrentAdmin,
  refreshAdminToken,
  getAdminDashboard,
  loginValidation,
  registerValidation,
};
