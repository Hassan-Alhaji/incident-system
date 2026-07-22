const prisma = require('../prismaClient');
const { generateToken } = require('../utils/authUtils');
const { sendOTP } = require('../utils/emailService');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger').child({ module: 'authController' });

// Check if maintenance mode is enabled
const isMaintenanceOn = () => {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maintenance.json'), 'utf-8'));
        return data.enabled === true;
    } catch { return false; }
};

// @desc    Request OTP for login
// @route   POST /api/auth/otp/request
// @access  Public
const requestEmailOtp = async (req, res) => {
    let step = 0;
    const { email } = req.body;

    try {
        step = 1; // Validate Input
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'Valid email is required' });
        }

        step = 2; // Find/Create User
        let user = await prisma.user.findUnique({ where: { email } });

        // Auto-create Admin if ADMIN_EMAIL matches and user doesn't exist yet
        if (!user && process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()) {
            user = await prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    name: 'Admin',
                    role: 'ADMIN',
                    isProfileCompleted: true,
                    status: 'ACTIVE',
                    canCloseTickets: true,
                    canPerformRCA: true,
                    canManageUsers: true,
                    canEscalate: true,
                }
            });
        }

        // Return error if user is not found
        if (!user) {
            return res.status(404).json({ code: 'EMAIL_NOT_FOUND', message: 'Email is not registered.' });
        }

        // Block non-admin login during maintenance
        if (isMaintenanceOn() && user.role !== 'ADMIN') {
            return res.status(503).json({ code: 'MAINTENANCE_MODE', message: 'The platform is currently under maintenance. Only administrators can access the system.' });
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

        step = 5; // Send Email (fire-and-forget — don't block response)
        sendOTP(email, otpCode).catch(e => logger.error({ err: e }, 'Email failed:'));

        // Return success immediately
        const response = {
            message: 'OTP generated',
            email
        };

        // Expose testCode ONLY in development — never in production
        if (process.env.NODE_ENV !== 'production') {
            response.testCode = otpCode;
        }

        res.json(response);

    } catch (error) {
        logger.error({ err: error, step }, `Auth error at step ${step}`);
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
            // A3: Brute-force protection — max 3 wrong attempts then invalidate OTP
            const attempts = (user.otpAttempts || 0) + 1;
            if (attempts >= 3) {
                // Invalidate the OTP — user must request a new one
                await prisma.user.update({
                    where: { id: user.id },
                    data: { otpCode: null, otpExpires: null, otpAttempts: 0 }
                });
                return res.status(400).json({
                    code: 'OTP_LOCKED',
                    message: 'Too many incorrect attempts. Please request a new code.'
                });
            }
            await prisma.user.update({ where: { id: user.id }, data: { otpAttempts: attempts } });
            return res.status(400).json({
                code: 'INVALID_OTP',
                message: `Invalid code. ${3 - attempts} attempt(s) remaining.`
            });
        }

        // Block non-admin verify during maintenance
        if (isMaintenanceOn() && user.role !== 'ADMIN') {
            return res.status(503).json({ message: 'The platform is under maintenance. Only administrators can login.' });
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
                otpAttempts: 0,  // Reset attempts on successful login
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
            canManageUsers: updatedUser.canManageUsers,
            token: generateToken(updatedUser.id, updatedUser.role),
        });

    } catch (error) {
        logger.error({ err: error }, 'Unhandled error');
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Self-register for OC portal
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { firstName, fatherName, lastName, email, mobile, department } = req.body;

    try {
        // Validation
        if (!firstName || !fatherName || !lastName || !email || !mobile || !department) {
            return res.status(400).json({ message: 'First name, father name, last name, department, email, and mobile number are required' });
        }

        // Strict RegEx to block symbols/scripts (only Arabic/English letters and spaces allowed)
        const nameRegex = /^[\p{L}\s]+$/u;
        if (!nameRegex.test(firstName) || !nameRegex.test(fatherName) || !nameRegex.test(lastName)) {
            return res.status(400).json({ message: 'Names can only contain letters and spaces. Symbols are not allowed.' });
        }

        // Strict Email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'Invalid email format.' });
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
                name: `${firstName} ${fatherName} ${lastName}`,
                firstName,
                fatherName,
                lastName,
                department,
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
        logger.error({ err: error }, '[Auth] Register Error:');
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Email or mobile already in use.' });
        }
        res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
};

module.exports = { requestEmailOtp, verifyEmailOtp, registerUser };
