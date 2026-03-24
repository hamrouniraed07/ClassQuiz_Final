const express = require('express');
const router = express.Router();
const { login, me, refresh } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', authenticate, me);
router.post('/refresh', authenticate, refresh);

module.exports = router;
