const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getValidations,
  getValidation,
  submitReview,
  skipValidation,
  getValidationStats,
} = require('../controllers/validationController');

router.use(authenticate);

router.get('/stats', getValidationStats);

router.route('/')
  .get(getValidations);

router.route('/:id')
  .get(getValidation);

router.post('/:id/review', submitReview);
router.post('/:id/skip', skipValidation);

module.exports = router;
