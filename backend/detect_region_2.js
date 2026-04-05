const { PrismaClient } = require('@prisma/client');

async function main() {
    // List of regions to try
    const regions = [
        'eu-west-1', 'eu-west-2', 'eu-north-1',
        'ap-northeast-1', 'ap-southeast-2',
        'sa-east-1', 'ca-central-1', 'ap-south-1',
        'eu-central-2', 'us-east-2', 'us-west-2' // Extended regions
    ];

    const project = 'ezlecsjuqvcqvmfpigkl';
    const password = 'Hana223203!';

    for (const region of regions) {
        console.log(`Checking ${region}...`);
        const url = `postgres://postgres.${project}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`;

        // Dynamically create a client for each region
        const prisma = new PrismaClient({
            datasources: { db: { url } },
            log: [] // suppress internal prisma logs
        });

        try {
            await Promise.race([
                prisma.user.count(),
                new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 4000))
            ]);
            console.log(`\n✅ SUCCESS! Connected to Region: ${region}`);
            console.log(`URL: ${url}`);
            process.exit(0);
        } catch (e) {
            let msg = e.message || String(e);
            if (msg.includes('Tenant or user not found')) {
                // Expected for wrong region
            } else if (msg.includes('password authentication failed')) {
                console.log(`⚠️ Password failed for ${region} (but region is likely correct!)`);
            } else {
                // console.log(`   ${region} error: ${msg.split('\n')[0].substring(0, 50)}...`);
            }
        } finally {
            await prisma.$disconnect();
        }
    }
    console.log('\n❌ Failed to detect region automatically.');
}

main();
