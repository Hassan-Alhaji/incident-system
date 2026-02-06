const express = require('express');
const router = express.Router();
const { requestEmailOtp, verifyEmailOtp } = require('../controllers/authController');

router.post('/otp/request', requestEmailOtp);
router.post('/otp/verify', verifyEmailOtp);

module.exports = router;
