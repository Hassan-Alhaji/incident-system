const prisma = require('../prismaClient');
const { generateToken } = require('../utils/authUtils');
const { sendOTP } = require('../utils/emailService');

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
        if (!user && email === 'al3ren0@gmail.com') {
            user = await prisma.user.create({
                data: {
                    email,
                    name: 'Admin',
                    role: 'ADMIN',
                    password: '', // No password needed
                }
            });
        }

        // Auto-create New User as SPORT_MARSHAL
        if (!user) {
            const nameFromEmail = email.split('@')[0];
            user = await prisma.user.create({
                data: {
                    email,
                    name: nameFromEmail, // Default name from email
                    role: 'SPORT_MARSHAL', // Standard role
                    password: '',
                    status: 'ACTIVE'
                }
            });
            // Proceed to generate OTP for this new user
        }

        if (user.status === 'SUSPENDED') {
            return res.status(403).json({ message: 'Account suspended' });
        }

        step = 3; // Generate OTP
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

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

        // ALWAYS return success + OTP for testing (so you can login!)
        res.json({
            message: sent ? 'OTP sent to email' : 'Email failed (Using Test Mode)',
            email,
            testCode: otpCode // <--- YOUR CODE IS HERE
        });

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

        // Clear OTP
        await prisma.user.update({
            where: { id: user.id },
            data: { otpCode: null, otpExpires: null }
        });

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Keep existing Marshal logic if needed, or deprecate. 
// For now, I'll export the new ones.

module.exports = { requestEmailOtp, verifyEmailOtp };
