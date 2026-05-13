const {
  loginAdmin,
  getCurrentAdmin,
  refreshAdminToken,
  loginValidation,
} = require('./adminController');

module.exports = {
  login: loginAdmin,
  me: getCurrentAdmin,
  refresh: refreshAdminToken,
  loginValidation,
};
