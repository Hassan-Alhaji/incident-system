const express = require('express');
const router = express.Router();
const { getAttachmentContent } = require('../controllers/attachmentController');

const { protect } = require('../middleware/authMiddleware');

// Protected route to fetch attachment content by ID
router.get('/:id/content', protect, getAttachmentContent);

module.exports = router;
