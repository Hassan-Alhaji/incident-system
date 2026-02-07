const express = require('express');
const router = express.Router();
const publicTicketController = require('../controllers/publicTicketController');
const upload = require('../middleware/uploadMiddleware'); // Need to ensure this exists or create it

// Routes handled: /api/public/submit/...

// Medical
router.post('/medical', upload.array('attachments', 5), publicTicketController.submitMedical);

// Control
router.post('/control', upload.array('attachments', 5), publicTicketController.submitControl);

// Safety
router.post('/safety', upload.array('attachments', 5), publicTicketController.submitSafety);

module.exports = router;
