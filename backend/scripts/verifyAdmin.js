const prisma = require('./prismaClient');

async function checkAdmin() {
    console.log('Checking for admin user...');
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'admin@system.com' }
        });

        if (!user) {
            console.error('❌ Admin user NOT found!');
        } else {
            console.log('✅ Admin user found:');
            console.log(`   ID: ${user.id}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);

            if (user.role !== 'ADMIN') {
                console.error(`❌ Incorrect Role! Expected 'ADMIN', got '${user.role}'`);
            } else {
                console.log('✅ Role is correct.');
            }
        }
    } catch (error) {
        console.error('Error checking admin:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAdmin();
