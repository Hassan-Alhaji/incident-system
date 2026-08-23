const express = require('express');
const router = express.Router();
const { requestEmailOtp, verifyEmailOtp, registerUser, redirectToMicrosoft, handleMicrosoftCallback, redeemSsoExchangeCode } = require('../controllers/authController');

router.post('/otp/request', requestEmailOtp);
router.post('/otp/verify', verifyEmailOtp);
router.post('/register', registerUser);

// Microsoft SSO Routes
router.get('/microsoft', redirectToMicrosoft);
router.get('/microsoft/callback', handleMicrosoftCallback);

// SSO exchange: frontend calls this to retrieve token+user without URL exposure
router.get('/sso-exchange', redeemSsoExchangeCode);

module.exports = router;
