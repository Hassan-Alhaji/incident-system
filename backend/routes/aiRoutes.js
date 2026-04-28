const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { enhanceText, analyticsChat } = require('../controllers/aiController');

// All AI routes should be protected
router.post('/enhance-text', protect, enhanceText);
router.post('/analytics-chat', protect, analyticsChat);

module.exports = router;
