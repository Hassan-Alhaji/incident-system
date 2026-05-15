const { PrismaClient } = require('@prisma/client');

const password = 'Hana223203!';
const project = 'ezlecsjuqvcqvmfpigkl';

const regions = [
    'us-east-1',
    'eu-central-1',
    'ap-southeast-1',
    'us-west-1',
    'eu-west-1',
    'eu-west-2',
    'eu-north-1',
    'ap-northeast-1',
    'ap-southeast-2',
    'sa-east-1',
    'ca-central-1',
    'ap-south-1'
];

async function checkRegion(region) {
    const url = `postgres://postgres.${project}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`;
    const prisma = new PrismaClient({
        datasources: { db: { url } },
        log: []
    });

    try {
        console.log(`Checking ${region}...`);
        // Set a short timeout
        const result = await Promise.race([
            prisma.user.count(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        console.log(`✅ SUCCESS: Found ${result} users in region ${region}`);
        return region;
    } catch (e) {
        if (e.message.includes('Timeout')) {
            console.log(`❌ ${region}: Timeout`);
        } else if (e.code === 'P1001' || e.message.includes('Can\'t reach')) {
            console.log(`❌ ${region}: Unreachable`);
        } else if (e.message.includes('Tenant or user not found')) {
            console.log(`❌ ${region}: Tenant not found (Wrong Region)`);
        } else if (e.message.includes('password authentication failed')) {
            console.log(`❌ ${region}: Password Failed (Right Region, Wrong Password!)`);
            return region; // We found the region, just need password fix
        } else {
            console.log(`❌ ${region}: ${e.message.split('\n')[0]}`);
        }
    } finally {
        await prisma.$disconnect();
    }
    return null;
}

async function main() {
    console.log('Starting Region Detection with connection poolers...');
    // check sequentially to avoid spamming
    for (const region of regions) {
        const found = await checkRegion(region);
        if (found) {
            console.log('\n!!! FOUND REGION: ' + found + ' !!!');
            process.exit(0);
        }
    }
    console.log('Region detection finished. No match found.');
}

main();
