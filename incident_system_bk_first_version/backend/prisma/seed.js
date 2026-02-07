const prisma = require('../prismaClient');
const { hashPassword } = require('../utils/authUtils');
require('dotenv').config({ path: '../.env' }); // Load env variables

const main = async () => {
    console.log('Seeding database...');

    // 1. System Admin
    const admin = await prisma.user.upsert({
        where: { email: 'al3ren0@gmail.com' },
        update: {
            role: 'ADMIN',
            name: 'System Admin',
            password: '', // OTP Mode
        },
        create: {
            email: 'al3ren0@gmail.com',
            name: 'System Admin',
            role: 'ADMIN',
            password: '',
        },
    });
    console.log('Admin updated:', admin.email);

    // 2. Medical Operations
    const medicalPassword = await hashPassword('medical123');
    const medicalOps = await prisma.user.upsert({
        where: { email: 'medical_ops@system.com' },
        update: {
            role: 'MEDICAL_OP_TEAM',
            password: medicalPassword,
            name: 'Medical Operations'
        },
        create: {
            email: 'medical_ops@system.com',
            name: 'Medical Operations',
            password: medicalPassword,
            role: 'MEDICAL_OP_TEAM',
        },
    });
    console.log('Medical Ops updated:', medicalOps.email);

    // 3. Safety Operations
    const safetyPassword = await hashPassword('safety123');
    const safetyOps = await prisma.user.upsert({
        where: { email: 'safety_ops@system.com' },
        update: {
            role: 'SAFETY_OP_TEAM',
            password: safetyPassword,
            name: 'Safety Operations'
        },
        create: {
            email: 'safety_ops@system.com',
            name: 'Safety Operations',
            password: safetyPassword,
            role: 'SAFETY_OP_TEAM',
        },
    });
    console.log('Safety Ops updated:', safetyOps.email);

    // 4. Control Operations
    const controlPassword = await hashPassword('control123');
    const controlOps = await prisma.user.upsert({
        where: { email: 'control_ops@system.com' },
        update: {
            role: 'CONTROL_OP_TEAM',
            password: controlPassword,
            name: 'Control Operations'
        },
        create: {
            email: 'control_ops@system.com',
            name: 'Control Operations',
            password: controlPassword,
            role: 'CONTROL_OP_TEAM',
        },
    });
    console.log('Control Ops updated:', controlOps.email);

    console.log('Seeding finished successfully.');
};

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
