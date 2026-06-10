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

    // 5. HR Representative (under Human Resources department)
    const hrDept = await prisma.department.upsert({
        where: { name: 'Human Resources' },
        update: { nameAr: 'الموارد البشرية' },
        create: { name: 'Human Resources', nameAr: 'الموارد البشرية' },
    });
    console.log('Department created:', hrDept.name);

    const hrPassword = await hashPassword('hr123');
    const hrRep = await prisma.user.upsert({
        where: { email: 'hr@system.com' },
        update: {
            role: 'HR_REP',
            password: hrPassword,
            name: 'HR Representative',
            repDepartmentId: hrDept.id,
        },
        create: {
            email: 'hr@system.com',
            name: 'HR Representative',
            password: hrPassword,
            role: 'HR_REP',
            repDepartmentId: hrDept.id,
        },
    });
    console.log('HR Rep created:', hrRep.email);

    // 6. Create Departments
    const opsDept = await prisma.department.upsert({
        where: { name: 'Operations' },
        update: { nameAr: 'التشغيل' },
        create: { name: 'Operations', nameAr: 'التشغيل' },
    });
    console.log('Department created:', opsDept.name);

    const finDept = await prisma.department.upsert({
        where: { name: 'Finance' },
        update: { nameAr: 'المالية' },
        create: { name: 'Finance', nameAr: 'المالية' },
    });
    console.log('Department created:', finDept.name);

    const procDept = await prisma.department.upsert({
        where: { name: 'Procurement' },
        update: { nameAr: 'المشتريات' },
        create: { name: 'Procurement', nameAr: 'المشتريات' },
    });
    console.log('Department created:', procDept.name);

    const itDept = await prisma.department.upsert({
        where: { name: 'IT' },
        update: { nameAr: 'تقنية المعلومات' },
        create: { name: 'IT', nameAr: 'تقنية المعلومات' },
    });
    console.log('Department created:', itDept.name);

    // 7. Department Representatives
    const defaultPassword = await hashPassword('deprep123');

    // Operations Rep
    const opsRep = await prisma.user.upsert({
        where: { email: 'dep_rep@system.com' },
        update: {
            role: 'DEP_REP',
            password: defaultPassword,
            name: 'Operations Representative',
            repDepartmentId: opsDept.id,
        },
        create: {
            email: 'dep_rep@system.com',
            name: 'Operations Representative',
            password: defaultPassword,
            role: 'DEP_REP',
            repDepartmentId: opsDept.id,
        },
    });
    console.log('Operations Rep created:', opsRep.email);

    // Finance Rep
    const finRep = await prisma.user.upsert({
        where: { email: 'finance_rep@system.com' },
        update: {
            role: 'FINANCE_REP',
            password: defaultPassword,
            name: 'Finance Representative',
            repDepartmentId: finDept.id,
        },
        create: {
            email: 'finance_rep@system.com',
            name: 'Finance Representative',
            password: defaultPassword,
            role: 'FINANCE_REP',
            repDepartmentId: finDept.id,
        },
    });
    console.log('Finance Rep created:', finRep.email);

    // Procurement Rep
    const procRep = await prisma.user.upsert({
        where: { email: 'procurement_rep@system.com' },
        update: {
            role: 'DEP_REP',
            password: defaultPassword,
            name: 'Procurement Representative',
            repDepartmentId: procDept.id,
        },
        create: {
            email: 'procurement_rep@system.com',
            name: 'Procurement Representative',
            password: defaultPassword,
            role: 'DEP_REP',
            repDepartmentId: procDept.id,
        },
    });
    console.log('Procurement Rep created:', procRep.email);

    // IT Rep
    const itRep = await prisma.user.upsert({
        where: { email: 'it_rep@system.com' },
        update: {
            role: 'DEP_REP',
            password: defaultPassword,
            name: 'IT Representative',
            repDepartmentId: itDept.id,
        },
        create: {
            email: 'it_rep@system.com',
            name: 'IT Representative',
            password: defaultPassword,
            role: 'DEP_REP',
            repDepartmentId: itDept.id,
        },
    });
    console.log('IT Rep created:', itRep.email);

    console.log('\n✅ Seeding finished successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('  Admin:           al3ren0@gmail.com (OTP)');
    console.log('  Controller:      controller@system.com / controller123');
    console.log('  Reporter:        reporter@system.com / reporter123');
    console.log('  Safety Mgr:      safety_manager@system.com / safety123');
    console.log('  HR Rep:          hr@system.com / hr123');
    console.log('  Ops Rep:         dep_rep@system.com / deprep123');
    console.log('  Finance Rep:     finance_rep@system.com / deprep123');
    console.log('  Procurement Rep: procurement_rep@system.com / deprep123');
    console.log('  IT Rep:          it_rep@system.com / deprep123');
};

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
