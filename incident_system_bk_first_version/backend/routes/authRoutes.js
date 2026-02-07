const express = require('express');
const router = express.Router();
console.log('[DEBUG] Auth Routes Module Loaded');
const { requestEmailOtp, verifyEmailOtp } = require('../controllers/authController');

router.post('/otp/request', requestEmailOtp);
router.post('/otp/verify', verifyEmailOtp);

module.exports = router;
