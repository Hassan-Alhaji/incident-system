const prisma = require('../prismaClient');
const { generateToken, hashPassword, comparePassword } = require('../utils/authUtils');

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (user) {
            // DEVELOPER MODE: Password check bypassed
            // if (user && (await comparePassword(password, user.password))) {
            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user.id, user.role),
            });
        } else {
            res.status(401).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Register a new user (Admin only or for seeding)
// @route   POST /api/auth/register
// @access  Private/Admin
const registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        const userExists = await prisma.user.findUnique({ where: { email } });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || 'MARSHAL',
            },
        });

        res.status(201).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const sendOtp = async (req, res) => {
    const { marshalId, email } = req.body;

    try {
        // 1. Validate Input
        if (!marshalId || !email) {
            return res.status(400).json({ message: 'Marshal ID and Email are required' });
        }

        // 2. Find User
        const user = await prisma.user.findFirst({
            where: {
                marshalId: marshalId,
                email: email
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'Invalid Marshal ID or Email' });
        }

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({ message: 'Account is suspended or banned. Contact Operations.' });
        }

        // 3. Generate OTP (Dev: 3333)
        const otpCode = '3333';
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        // 4. Save to DB
        await prisma.user.update({
            where: { id: user.id },
            data: {
                otpCode,
                otpExpires
            }
        });

        // 5. Simulate Send (Log it)
        console.log(`[DEV MODE] OTP for ${email}: ${otpCode}`);

        res.json({ message: 'OTP sent successfully', devCode: otpCode });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyOtp = async (req, res) => {
    const { marshalId, otp } = req.body;

    try {
        const user = await prisma.user.findFirst({ where: { marshalId } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({ message: 'Account suspended' });
        }

        // Validate OTP (Dev: strict 3333 check per requirements, or DB check)
        // Requirement: "OTP validation accepts only: 3333"
        // But we stored it in DB too. Let's check both for safety or just 3333.
        // I will check input against 3333 AND expiry logic if needed, but for now 3333 is the master key.
        if (otp !== '3333') {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Clear OTP after use? optional but good practice.
        // For dev convenience, maybe keep it? requirements didn't specify one-time use strictness.
        // I'll clear it to be clean.
        await prisma.user.update({
            where: { id: user.id },
            data: { otpCode: null, otpExpires: null }
        });

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            marshalId: user.marshalId,
            token: generateToken(user.id, user.role),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { loginUser, registerUser, sendOtp, verifyOtp };
