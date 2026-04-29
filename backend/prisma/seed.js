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
            canManageUsers: true,
            canCloseTickets: true,
            canPerformRCA: true,
            canEscalate: true,
        },
        create: {
            email: 'al3ren0@gmail.com',
            name: 'System Admin',
            role: 'ADMIN',
            password: '',
            canManageUsers: true,
            canCloseTickets: true,
            canPerformRCA: true,
            canEscalate: true,
        },
    });
    console.log('Admin created:', admin.email);

    // 2. HSE Controller
    const controllerPassword = await hashPassword('controller123');
    const controller = await prisma.user.upsert({
        where: { email: 'controller@system.com' },
        update: {
            role: 'HSE_CONTROLLER',
            password: controllerPassword,
            name: 'HSE Controller',
        },
        create: {
            email: 'controller@system.com',
            name: 'HSE Controller',
            password: controllerPassword,
            role: 'HSE_CONTROLLER',
        },
    });
    console.log('HSE Controller created:', controller.email);

    // 3. OC Reporter
    const reporterPassword = await hashPassword('reporter123');
    const reporter = await prisma.user.upsert({
        where: { email: 'reporter@system.com' },
        update: {
            role: 'OC_REPORTER',
            password: reporterPassword,
            name: 'OC Reporter',
        },
        create: {
            email: 'reporter@system.com',
            name: 'OC Reporter',
            password: reporterPassword,
            role: 'OC_REPORTER',
        },
    });
    console.log('OC Reporter created:', reporter.email);

    // 4. Safety Manager
    const safetyPassword = await hashPassword('safety123');
    const safetyManager = await prisma.user.upsert({
        where: { email: 'safety_manager@system.com' },
        update: {
            role: 'SAFETY_MANAGER',
            password: safetyPassword,
            name: 'Safety Manager',
            canCloseTickets: true,
            canEscalate: true,
        },
        create: {
            email: 'safety_manager@system.com',
            name: 'Safety Manager',
            password: safetyPassword,
            role: 'SAFETY_MANAGER',
            canCloseTickets: true,
            canEscalate: true,
        },
    });
    console.log('Safety Manager created:', safetyManager.email);

    // 5. HR Representative
    const hrPassword = await hashPassword('hr123');
    const hrRep = await prisma.user.upsert({
        where: { email: 'hr@system.com' },
        update: {
            role: 'HR_REP',
            password: hrPassword,
            name: 'HR Representative',
        },
        create: {
            email: 'hr@system.com',
            name: 'HR Representative',
            password: hrPassword,
            role: 'HR_REP',
        },
    });
    console.log('HR Rep created:', hrRep.email);

    // 6. Create a Department
    const dept = await prisma.department.upsert({
        where: { name: 'Operations' },
        update: { nameAr: 'العمليات' },
        create: { name: 'Operations', nameAr: 'العمليات' },
    });
    console.log('Department created:', dept.name);

    // 7. Department Representative
    const depRepPassword = await hashPassword('deprep123');
    const depRep = await prisma.user.upsert({
        where: { email: 'dep_rep@system.com' },
        update: {
            role: 'DEP_REP',
            password: depRepPassword,
            name: 'Department Rep',
            repDepartmentId: dept.id,
        },
        create: {
            email: 'dep_rep@system.com',
            name: 'Department Rep',
            password: depRepPassword,
            role: 'DEP_REP',
            repDepartmentId: dept.id,
        },
    });
    console.log('Dep Rep created:', depRep.email);

    console.log('\n✅ Seeding finished successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('  Admin:       al3ren0@gmail.com (OTP)');
    console.log('  Controller:  controller@system.com / controller123');
    console.log('  Reporter:    reporter@system.com / reporter123');
    console.log('  Safety Mgr:  safety_manager@system.com / safety123');
    console.log('  HR Rep:      hr@system.com / hr123');
    console.log('  Dep Rep:     dep_rep@system.com / deprep123');
};

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
