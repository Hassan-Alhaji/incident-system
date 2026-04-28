const prisma = require('../prismaClient');
const { generateToken } = require('../utils/authUtils');
const { sendOTP } = require('../utils/emailService');
const crypto = require('crypto');

// @desc    Request OTP for login
// @route   POST /api/auth/otp/request
// @access  Public
const requestEmailOtp = async (req, res) => {
    let step = 0;
    const { email } = req.body;

    try {
        step = 1; // Validate Input
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        step = 2; // Find/Create User
        let user = await prisma.user.findUnique({ where: { email } });

        // Auto-create Admin if missing
        // Auto-create Admin only if ADMIN_EMAIL is configured in .env
        if (!user && process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL) {
            user = await prisma.user.create({
                data: {
                    email,
                    name: 'Admin',
                    role: 'ADMIN',
                    password: '',
                }
            });
        }

        // Return error if user is not found
        if (!user) {
            return res.status(404).json({ code: 'EMAIL_NOT_FOUND', message: 'Email is not registered.' });
        }

        if (user.status === 'SUSPENDED') {
            return res.status(403).json({ code: 'ACCOUNT_SUSPENDED', message: 'Your account is deactivated. Please contact the administrator.' });
        }
        if (user.status === 'PENDING') {
            return res.status(403).json({ code: 'ACCOUNT_PENDING', message: 'Your account is pending activation. Please wait for administrator approval.' });
        }

        step = 3; // Generate OTP
        const otpCode = crypto.randomInt(100000, 999999).toString();
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min

        step = 4; // Update Database (Critical Step)
        await prisma.user.update({
            where: { id: user.id },
            data: { otpCode, otpExpires }
        });

        step = 5; // Send Email
        let sent = false;
        try {
            sent = await sendOTP(email, otpCode);
        } catch (e) {
            console.error('Email failed:', e);
        }

        // Return success - only expose OTP in non-production for debugging
        const response = {
            message: sent ? 'OTP sent to email' : 'Email delivery pending',
            email
        };

        // Only expose testCode in development OR when SHOW_OTP_ON_SCREEN=true (for testing)
        if (process.env.NODE_ENV !== 'production' || process.env.SHOW_OTP_ON_SCREEN === 'true') {
            response.testCode = otpCode;
        }

        res.json(response);

    } catch (error) {
        console.error(`Error at step ${step}:`, error);
        res.status(500).json({
            message: `Login Failed at Step ${step}: ${error.message || 'Unknown error'}`,
            step
        });
    }
};

// @desc    Verify OTP and Login
// @route   POST /api/auth/otp/verify
// @access  Public
const verifyEmailOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.otpCode !== otp) {
            return res.status(400).json({ message: 'Invalid code' });
        }


        if (new Date() > user.otpExpires) {
            return res.status(400).json({ message: 'Code expired' });
        }

        // Auto-Complete Profile if Data Exists (Migration helper)
        // Check removed: Always mark profile as completed to bypass modal
        let isProfileCompleted = true;

        // Clear OTP and Update Profile Status
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                otpCode: null,
                otpExpires: null,
                isProfileCompleted: isProfileCompleted
            }
        });

        res.json({
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            mobile: updatedUser.mobile,
            isProfileCompleted: updatedUser.isProfileCompleted,
            role: updatedUser.role,
            canCloseTickets: updatedUser.canCloseTickets,
            canPerformRCA: updatedUser.canPerformRCA,
            token: generateToken(updatedUser.id, updatedUser.role),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Self-register for OC portal
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { firstName, lastName, email, mobile } = req.body;

    try {
        // Validation
        if (!firstName || !lastName || !email || !mobile) {
            return res.status(400).json({ message: 'First name, last name, email, and mobile number are required' });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists. Please login instead.' });
        }

        // Check duplicate mobile
        if (mobile) {
            const existingMobile = await prisma.user.findFirst({ where: { mobile } });
            if (existingMobile) {
                return res.status(400).json({ message: 'This mobile number is already registered.' });
            }
        }

        // Create user as OC_REPORTER with PENDING status
        // Admin must approve before they can login
        const user = await prisma.user.create({
            data: {
                name: `${firstName} ${lastName}`,
                firstName,
                lastName,
                email,
                mobile: mobile || null,
                password: '',
                role: 'OC_REPORTER',
                userGroup: 'OFF_CIRCUIT',
                status: 'PENDING',
                isProfileCompleted: true
            }
        });

        // Note: No OTP generated here — account is PENDING and user cannot login
        // until an admin activates their account. This avoids confusing the user.

        res.status(201).json({
            message: 'Account created successfully. An administrator will review and activate your account.',
            email
        });

    } catch (error) {
        console.error('[Auth] Register Error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Email or mobile already in use.' });
        }
        res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
};

module.exports = { requestEmailOtp, verifyEmailOtp, registerUser };
