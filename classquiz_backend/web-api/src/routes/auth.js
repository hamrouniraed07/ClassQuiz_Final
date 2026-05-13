const express = require('express');
const router = express.Router();
const { login, me, refresh, loginValidation } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login', loginValidation, login);
router.get('/me', authenticate, me);
router.post('/refresh', authenticate, refresh);

module.exports = router;
