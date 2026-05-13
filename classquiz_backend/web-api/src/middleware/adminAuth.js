const { authenticate, requireAdmin } = require('./auth');
const Admin = require('../models/Admin');

const allowInitialAdminRegistration = async (req, res, next) => {
  const adminCount = await Admin.countDocuments();

  if (adminCount === 0) {
    return next();
  }

  return authenticate(req, res, () => requireAdmin(req, res, next));
};

module.exports = {
  authenticateAdmin: authenticate,
  requireAdmin,
  allowInitialAdminRegistration,
};
