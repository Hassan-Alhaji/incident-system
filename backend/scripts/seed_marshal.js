const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = [
        // SPORT / CONTROL
        { marshalId: '1001', email: 'sport_marshal@test.com', name: 'Sport Marshal 1', role: 'SPORT_MARSHAL', isMedical: false },
        { marshalId: '1002', email: 'control_ops@test.com', name: 'Control Ops 1', role: 'CONTROL_OP_TEAM', isMedical: false },
        { marshalId: '1003', email: 'chief_control@test.com', name: 'Chief of Control', role: 'CHIEF_OF_CONTROL', isMedical: false },
        { marshalId: '1004', email: 'deputy_control@test.com', name: 'Deputy Control', role: 'DEPUTY_CONTROL_OP_OFFICER', isMedical: false },

        // MEDICAL
        { marshalId: '2001', email: 'med_marshal@test.com', name: 'Medical Marshal 1', role: 'MEDICAL_MARSHAL', isMedical: true },
        { marshalId: '2002', email: 'med_ops@test.com', name: 'Medical Ops 1', role: 'MEDICAL_OP_TEAM', isMedical: true }, // Ops might handle intake
        { marshalId: '2003', email: 'cmo@test.com', name: 'Chief Medical Officer', role: 'CHIEF_MEDICAL_OFFICER', isMedical: true },
        { marshalId: '2004', email: 'dmo@test.com', name: 'Deputy Medical Officer', role: 'DEPUTY_MEDICAL_OFFICER', isMedical: true },

        // SAFETY
        { marshalId: '3001', email: 'safety_marshal@test.com', name: 'Safety Marshal 1', role: 'SAFETY_MARSHAL', isMedical: false },
        { marshalId: '3002', email: 'safety_ops@test.com', name: 'Safety Ops 1', role: 'SAFETY_OP_TEAM', isMedical: false },
        { marshalId: '3003', email: 'chief_safety@test.com', name: 'Chief Safety', role: 'SAFETY_OFFICER_CHIEF', isMedical: false },
        { marshalId: '3004', email: 'deputy_safety@test.com', name: 'Deputy Safety', role: 'DEPUTY_SAFETY_OFFICER', isMedical: false },

        // TECH & JUDGE
        { marshalId: '4001', email: 'tech_marshal@test.com', name: 'Scrutineer 1', role: 'SCRUTINEERS', isMedical: false },
        { marshalId: '5001', email: 'judge_1@test.com', name: 'Judge 1', role: 'JUDGEMENT', isMedical: false },

        // ADMIN
        { marshalId: '9999', email: 'admin@test.com', name: 'System Admin', role: 'ADMIN', isMedical: false },
    ];

    console.log(`Seeding ${users.length} users...`);

    // Clean up existing test users to avoid Unique violations
    const testEmails = users.map(u => u.email);
    const testIds = users.map(u => u.marshalId);

    await prisma.user.deleteMany({
        where: {
            OR: [
                { email: { in: testEmails } },
                { marshalId: { in: testIds } },
                { email: 'marshal@test.com' } // Remove the previous single test user
            ]
        }
    });

    for (const u of users) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: {
                marshalId: u.marshalId,
                status: 'ACTIVE',
                role: u.role,
                name: u.name,
                isMedical: u.isMedical,
                password: 'OTP_ONLY'
            },
            create: {
                name: u.name,
                email: u.email,
                marshalId: u.marshalId,
                role: u.role,
                isMedical: u.isMedical,
                password: 'OTP_ONLY',
                status: 'ACTIVE',
                mobile: '0500000000'
            }
        });
        console.log(`  -> ${u.name} (${u.role})`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
