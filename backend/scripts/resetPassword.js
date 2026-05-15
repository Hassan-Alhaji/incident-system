const prisma = require('./prismaClient');
const { hashPassword } = require('./utils/authUtils');

async function resetAdminPassword() {
    console.log('Resetting admin password...');
    try {
        const newPassword = 'admin@123';
        const hashedPassword = await hashPassword(newPassword);

        const updatedUser = await prisma.user.update({
            where: { email: 'admin@system.com' },
            data: { password: hashedPassword },
        });

        console.log(`✅ Password updated for user: ${updatedUser.email}`);
        console.log(`🔑 New Password: ${newPassword}`);
    } catch (error) {
        console.error('❌ Error updating password:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetAdminPassword();
