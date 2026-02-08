const prisma = require('../prismaClient');
const { hashPassword } = require('../utils/authUtils');

const getUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, isIntakeEnabled: true, createdAt: true, status: true }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};

const createUser = async (req, res) => {
    try {
        const { name, email, password, role, isIntakeEnabled } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        // const hashedPassword = await hashPassword(password); // Removed for OTP
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: '', // No password for OTP users
                role: role || 'SPORT_MARSHAL',
                isIntakeEnabled: isIntakeEnabled || false
            }
        });

        res.status(201).json({ message: 'User created successfully', user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ message: 'Error creating user' });
    }
};

const deleteUser = async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { name, email, role, isIntakeEnabled } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (role) updateData.role = role;
        if (typeof isIntakeEnabled === 'boolean') updateData.isIntakeEnabled = isIntakeEnabled;

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData
        });

        res.json({ message: 'User updated', user: { id: user.id, name: user.name, role: user.role, isIntakeEnabled: user.isIntakeEnabled } });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, mobile } = req.body;
        const userId = req.user.id; // From authMiddleware

        // Validation: English Only and Required for these fields
        const englishRegex = /^[A-Za-z\s]+$/;
        // Mobile: Must start with 00 or + followed by digits
        const mobileRegex = /^(00|\+)\d+$/;

        if (firstName && !englishRegex.test(firstName)) {
            return res.status(400).json({ message: 'First Name must be English letters only' });
        }
        if (lastName && !englishRegex.test(lastName)) {
            return res.status(400).json({ message: 'Last Name must be English letters only' });
        }
        if (mobile && !mobileRegex.test(mobile)) {
            return res.status(400).json({ message: 'Mobile must start with country code (e.g. 00966...)' });
        }

        const updateData = {};
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (firstName && lastName) updateData.name = `${firstName} ${lastName}`;
        if (mobile) updateData.mobile = mobile;

        // Check isProfileCompleted
        // It becomes true if ALL required fields are present (either in this update or already in DB)
        // We'll fetch current user to check missing fields if not provided in update
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });

        const finalFirstName = firstName || currentUser.firstName;
        const finalLastName = lastName || currentUser.lastName;
        const finalMobile = mobile || currentUser.mobile;

        // Check if mobile is already used by ANOTHER user (to avoid P2002)
        if (mobile && mobile !== currentUser.mobile) {
            const existingMobile = await prisma.user.findFirst({
                where: {
                    mobile: mobile,
                    id: { not: userId }
                }
            });
            if (existingMobile) {
                return res.status(400).json({ message: 'Mobile number is already linked to another account.' });
            }
        }

        // If we passed validation (English name, valid mobile), we can mark profile as completed
        updateData.isProfileCompleted = true;

        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                name: user.name,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                mobile: user.mobile,
                marshalId: user.marshalId,
                role: user.role,
                isProfileCompleted: user.isProfileCompleted
            }
        });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Email or Mobile already in use' });
        }
        res.status(500).json({ message: 'Error updating profile' });
    }
};

const xlsx = require('xlsx');

// ... (existing functions)
const importRegistry = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const workbook = xlsx.readFile(req.file.path);
        // Clean up file after reading
        fs.unlinkSync(req.file.path);

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        let added = 0;
        let updated = 0;
        let errors = [];

        for (const row of data) {
            const marshalId = row['marshal_id']?.toString();
            const email = row['email'];
            const firstName = row['first_name'];
            const lastName = row['last_name'];
            const mobile = row['mobile']?.toString();
            const isMedical = row['medical_marshal'] === 'Yes';

            if (!marshalId || !email) {
                errors.push(`Row missing ID or Email: ${JSON.stringify(row)}`);
                continue;
            }

            try {
                // Determine Role
                let role = 'SPORT_MARSHAL';
                if (isMedical) role = 'MEDICAL_MARSHAL';

                // Upsert User
                const existingUser = await prisma.user.findFirst({
                    where: { OR: [{ marshalId: marshalId }, { email: email }] }
                });

                if (existingUser) {
                    await prisma.user.update({
                        where: { id: existingUser.id },
                        data: {
                            name: `${firstName} ${lastName}`,
                            marshalId: marshalId,
                            email: email,
                            mobile: mobile,
                            role: role,
                            isMedical: isMedical,
                        }
                    });
                    updated++;
                } else {
                    await prisma.user.create({
                        data: {
                            name: `${firstName} ${lastName}`,
                            email: email,
                            marshalId: marshalId,
                            mobile: mobile,
                            role: role,
                            isMedical: isMedical,
                            password: 'OTP_ONLY',
                            status: 'ACTIVE'
                        }
                    });
                    added++;
                }
            } catch (err) {
                errors.push(`Failed to process ${marshalId}: ${err.message}`);
            }
        }

        res.json({
            message: 'Import completed',
            summary: {
                totalRows: data.length,
                added,
                updated,
                errors
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error processing Excel file' });
    }
};

const toggleUserStatus = async (req, res) => {
    const { status } = req.body;
    try {
        await prisma.user.update({
            where: { id: req.params.id },
            data: { status }
        });
        res.json({ message: `User status updated to ${status}` });
    } catch (error) {
        res.status(500).json({ message: 'Error updating status' });
    }
};

module.exports = { getUsers, createUser, deleteUser, updateUser, importRegistry, toggleUserStatus, updateProfile };
