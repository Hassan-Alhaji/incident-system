const fs = require('fs');
const prisma = require('../prismaClient');
const { hashPassword } = require('../utils/authUtils');

const getUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                role: { notIn: ['OC_REPORTER', 'OC_SUPERVISOR', 'OC_SAFETY_INVESTIGATOR', 'OC_HSE_MANAGER'] }
            },
            select: {
                id: true, name: true, email: true, mobile: true, role: true, userGroup: true,
                isIntakeEnabled: true, createdAt: true, status: true,
                canViewMedical: true, canViewSafety: true, canViewSport: true, canViewAll: true,
                canViewAnalytics: true, canEscalate: true, canManageUsers: true,
                canCloseTickets: true, canPerformRCA: true
            }
        });
        res.json(users);
    } catch (error) {
        console.error('[User] getUsers Error:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

const createUser = async (req, res) => {
    try {
        const { name, email, password, role, userGroup, isIntakeEnabled } = req.body;
        console.log('[User] Creating user:', { name, email, role, userGroup, isIntakeEnabled });

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        // const hashedPassword = await hashPassword(password); // Removed for OTP
        const user = await prisma.user.create({
            data: {
                name,
                email,
                mobile: req.body.mobile || '',
                password: '', // No password for OTP users
                role: role || 'SPORT_MARSHAL',
                userGroup: userGroup || 'IN_CIRCUIT',
                isIntakeEnabled: isIntakeEnabled || false,
                canViewMedical: req.body.canViewMedical || false,
                canViewSafety: req.body.canViewSafety || false,
                canViewSport: req.body.canViewSport || false,
                canViewAll: req.body.canViewAll || false,
                canViewAnalytics: req.body.canViewAnalytics || false,
                canEscalate: req.body.canEscalate || false,
                canManageUsers: req.body.canManageUsers || false,
                canCloseTickets: req.body.canCloseTickets || false,
                canPerformRCA: req.body.canPerformRCA || false
            }
        });

        console.log('[User] User created:', user.id);
        res.status(201).json({ message: 'User created successfully', user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        console.error('[User] createUser Error:', error);
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        // Check for open tickets before deletion
        const openTickets = await prisma.ticket.count({
            where: {
                OR: [
                    { createdById: userId, status: { notIn: ['CLOSED', 'RESOLVED'] } },
                    { assignedToId: userId, status: { notIn: ['CLOSED', 'RESOLVED'] } }
                ]
            }
        });
        if (openTickets > 0) {
            return res.status(400).json({ message: 'Cannot delete: user has ' + openTickets + ' open ticket(s). Close or reassign them first.' });
        }
        // Soft delete: deactivate instead of permanently removing
        await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
        res.json({ message: 'User deactivated successfully' });
    } catch (error) {
        console.error('[User] deleteUser Error:', error);
        res.status(500).json({ message: 'Error deleting user' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { name, email, role, userGroup, isIntakeEnabled } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (req.body.mobile !== undefined) updateData.mobile = req.body.mobile;
        if (role) updateData.role = role;
        if (userGroup) updateData.userGroup = userGroup;
        if (typeof isIntakeEnabled === 'boolean') updateData.isIntakeEnabled = isIntakeEnabled;
        if (typeof req.body.canViewMedical === 'boolean') updateData.canViewMedical = req.body.canViewMedical;
        if (typeof req.body.canViewSafety === 'boolean') updateData.canViewSafety = req.body.canViewSafety;
        if (typeof req.body.canViewSport === 'boolean') updateData.canViewSport = req.body.canViewSport;
        if (typeof req.body.canViewAll === 'boolean') updateData.canViewAll = req.body.canViewAll;
        if (typeof req.body.canViewAnalytics === 'boolean') updateData.canViewAnalytics = req.body.canViewAnalytics;
        if (typeof req.body.canEscalate === 'boolean') updateData.canEscalate = req.body.canEscalate;
        if (typeof req.body.canManageUsers === 'boolean') updateData.canManageUsers = req.body.canManageUsers;
        if (typeof req.body.canCloseTickets === 'boolean') updateData.canCloseTickets = req.body.canCloseTickets;
        if (typeof req.body.canPerformRCA === 'boolean') updateData.canPerformRCA = req.body.canPerformRCA;

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

const downloadTemplate = async (req, res) => {
    try {
        const worksheet = xlsx.utils.json_to_sheet([
            {
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                mobile: '+966500000000',
                group: 'IN_CIRCUIT',
                medical_marshal: 'No'
            },
            {
                first_name: 'Jane',
                last_name: 'Smith',
                email: 'jane.smith@example.com',
                mobile: '+966500000001',
                group: 'OFF_CIRCUIT',
                medical_marshal: 'Yes'
            }
        ]);

        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Users');

        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="users_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Template Generate Error:', error);
        res.status(500).json({ message: 'Failed to generate template' });
    }
};

// ... (existing functions)
const importRegistry = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const importGroup = req.body.userGroup || 'IN_CIRCUIT';
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
            const email = row['email'];
            const firstName = row['first_name'];
            const lastName = row['last_name'];
            const mobile = row['mobile']?.toString();
            const group = row['group'] === 'OFF_CIRCUIT' ? 'OFF_CIRCUIT' : 'IN_CIRCUIT';
            const isMedical = row['medical_marshal'] === 'Yes';

            if (!email || !firstName || !lastName) {
                errors.push(`Row missing Email or Names: ${JSON.stringify(row)}`);
                continue;
            }

            // Ensure English Names
            const englishRegex = /^[A-Za-z\s]+$/;
            if (!englishRegex.test(firstName) || !englishRegex.test(lastName)) {
                errors.push(`Skipped ${email}: Names must be in English.`);
                continue;
            }

            try {
                let role = 'SPORT_MARSHAL';
                if (isMedical) role = 'MEDICAL_MARSHAL';

                const existingUser = await prisma.user.findFirst({
                    where: { email: email }
                });

                if (existingUser) {
                    errors.push(`Skipped ${email}: User already exists.`);
                    continue;
                } else {
                    await prisma.user.create({
                        data: {
                            name: `${firstName} ${lastName}`,
                            firstName: firstName,
                            lastName: lastName,
                            email: email,
                            mobile: mobile,
                            role: role,
                            userGroup: group,
                            isMedical: 
                            password: '', // OTP only
                            status: 'ACTIVE'
                        }
                    });
                    added++;
                }
            } catch (err) {
                errors.push(`Failed to process ${email}: ${err.message}`);
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

module.exports = { getUsers, createUser, deleteUser, updateUser, importRegistry, toggleUserStatus, updateProfile, downloadTemplate };
