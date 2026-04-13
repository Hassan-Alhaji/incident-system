const express = require('express');
const router = express.Router();
console.log('[DEBUG] Auth Routes Module Loaded');
const { requestEmailOtp, verifyEmailOtp, registerUser } = require('../controllers/authController');

router.post('/otp/request', requestEmailOtp);
router.post('/otp/verify', verifyEmailOtp);
router.post('/register', registerUser);

module.exports = router;
