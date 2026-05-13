const express = require('express');
const router = express.Router();
const {
  registerAdmin,
  loginAdmin,
  getAdminDashboard,
  loginValidation,
  registerValidation,
} = require('../controllers/adminController');
const {
  authenticateAdmin,
  requireAdmin,
  allowInitialAdminRegistration,
} = require('../middleware/adminAuth');

router.post('/register', registerValidation, allowInitialAdminRegistration, registerAdmin);
router.post('/login', loginValidation, loginAdmin);
router.get('/dashboard', authenticateAdmin, requireAdmin, getAdminDashboard);

module.exports = router;
