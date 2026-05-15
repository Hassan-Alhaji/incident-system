const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
    const regions = [
        'eu-west-1', 'eu-west-2', 'eu-north-1',
        'ap-northeast-1', 'ap-southeast-2',
        'sa-east-1', 'ca-central-1', 'ap-south-1',
        'us-west-1', // Added missing ones
        'us-east-1', // Re-check
        'eu-central-1' // Re-check
    ];

    const project = 'ezlecsjuqvcqvmfpigkl';
    const password = 'Hana223023'; // Try WITHOUT exclamation first

    // Also try WITH exclamation
    const passwords = [password, password + '!'];

    console.log(`Checking regions aggressively...`);

    for (const region of regions) {
        for (const pwd of passwords) {
            const url = `postgres://postgres.${project}:${pwd}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`;

            // Fast fail
            const prisma = new PrismaClient({
                datasources: { db: { url } },
                log: []
            });

            try {
                // very short timeout
                await Promise.race([
                    prisma.user.count(),
                    new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 3000))
                ]);
                console.log(`\n✅ SUCCESS! Connected to Region: ${region}`);
                console.log(`✅ Password: ${pwd}`);

                // Write .env
                const envContent = `PORT=3000\nDATABASE_URL="${url}"\nJWT_SECRET="supersecretkey_change_me_in_prod"\nEMAIL_USER=al3ren0@gmail.com\nEMAIL_PASS=bnpt gzmb xifj tdfa`;
                fs.writeFileSync('.env', envContent);
                console.log('✅ Updated .env file automatically!');
                process.exit(0);
            } catch (e) {
                // Silent fail to be fast
            } finally {
                // Fire and forget disconnect
                prisma.$disconnect().catch(() => { });
            }
        }
        process.stdout.write('.'); // progress
    }
    console.log('\n❌ Failed to connect with any combination.');
}

main();
