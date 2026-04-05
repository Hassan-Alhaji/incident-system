const { PrismaClient } = require('@prisma/client');

// Use the connection string WITH pgbouncer=true
const connectionString = "postgres://postgres.ezlecsjuqvcqvmfpigkl:Hana223023!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: connectionString
        }
    }
});

async function main() {
    console.log('Testing connection to:', connectionString);
    try {
        const count = await prisma.user.count();
        console.log('Connection Successful! User count:', count);
    } catch (error) {
        console.error('Connection Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
