const prisma = require('../prismaClient');
const { generateToken } = require('../utils/authUtils');
const { sendOTP } = require('../utils/emailService');

// @desc    Request OTP for login
// @route   POST /api/auth/otp/request
// @access  Public
const requestEmailOtp = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

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

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.status === 'SUSPENDED') {
            return res.status(403).json({ message: 'Account suspended' });
        }

        // Generate 4-digit OTP
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await prisma.user.update({
            where: { id: user.id },
            data: { otpCode, otpExpires }
        });

        const sent = await sendOTP(email, otpCode);
        if (sent) {
            res.json({ message: 'OTP sent to email', email });
        } else {
            // Fallback for dev if email fails (or just error out)
            console.log(`[AUTH] OTP for ${email}: ${otpCode}`);
            res.json({ message: 'OTP sent (Logged for Dev)', email }); // In prod might want to return 500
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
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
