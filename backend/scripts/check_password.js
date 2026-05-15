const { PrismaClient } = require('@prisma/client');

async function main() {
    // Top 3 most likely regions
    const regions = ['eu-central-1', 'us-east-1', 'ap-southeast-1'];
    const project = 'ezlecsjuqvcqvmfpigkl';
    const password = 'Hana223023';

    console.log(`Checking regions with password: ${password}`);

    for (const region of regions) {
        // Construct the URL
        const url = `postgres://postgres.${project}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`;

        const prisma = new PrismaClient({
            datasources: { db: { url } },
            log: []
        });

        console.log(`Trying ${region}...`);
        try {
            await Promise.race([
                prisma.user.count(),
                new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 4000))
            ]);
            console.log(`\n✅ SUCCESS! Connected to Region: ${region}`);
            console.log(`URL: ${url}`);

            // Create .env file if successful
            const fs = require('fs');
            const envContent = `PORT=3000\nDATABASE_URL="${url}"\nJWT_SECRET="supersecretkey_change_me_in_prod"\nEMAIL_USER=al3ren0@gmail.com\nEMAIL_PASS=bnpt gzmb xifj tdfa`;
            fs.writeFileSync('.env', envContent);
            console.log('✅ Updated .env file automatically!');
            process.exit(0);
        } catch (e) {
            let msg = e.message || String(e);
            if (msg.includes('password authentication failed')) {
                console.log(`❌ ${region}: Wrong Password (but Region might be correct!)`);
            } else if (msg.includes('Tenant or user not found')) {
                console.log(`❌ ${region}: Wrong Region`);
            } else {
                console.log(`❌ ${region}: ${msg.split('\n')[0].substring(0, 50)}...`);
            }
        } finally {
            await prisma.$disconnect();
        }
    }
    console.log('\n❌ Failed to connect with this password.');
}

main();
