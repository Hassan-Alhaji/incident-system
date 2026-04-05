const express = require('express');
const router = express.Router();
const { getAttachmentContent } = require('../controllers/attachmentController');

// Public route to fetch attachment content by ID
// Security: Relies on UUID unguessability.
router.get('/:id/content', getAttachmentContent);

module.exports = router;
