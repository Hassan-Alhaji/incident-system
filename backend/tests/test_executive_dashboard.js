const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

async function testExecutiveDashboard() {
    console.log('🧪 Testing Executive Dashboard & Department Scoping...');

    // 1. Get a department and a department manager
    const dept = await prisma.department.findFirst();
    if (!dept) throw new Error('No department found');

    let depManager = await prisma.user.findFirst({ where: { role: 'DEP_MANAGER' } });
    if (!depManager) {
        depManager = await prisma.user.upsert({
            where: { email: 'dept_manager_test@system.com' },
            update: { role: 'DEP_MANAGER', repDepartmentId: dept.id },
            create: {
                email: 'dept_manager_test@system.com',
                name: 'Dept Operations Manager',
                role: 'DEP_MANAGER',
                repDepartmentId: dept.id,
                department: dept.name,
                userGroup: 'OFF_CIRCUIT',
                status: 'ACTIVE'
            }
        });
    } else if (!depManager.repDepartmentId) {
        depManager = await prisma.user.update({
            where: { id: depManager.id },
            data: { repDepartmentId: dept.id }
        });
    }

    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    console.log(`Department: ${dept.name} (${dept.id})`);
    console.log(`Manager User: ${depManager.email} (${depManager.role})`);
    console.log(`Admin User: ${admin?.email || 'N/A'}`);

    // 1. Create a user without permission in DB and test 403 Forbidden
    let unpermittedUser = await prisma.user.upsert({
        where: { email: 'reporter_no_analytics@test.com' },
        update: { role: 'OC_REPORTER', canViewAnalytics: false },
        create: {
            email: 'reporter_no_analytics@test.com',
            name: 'Reporter Without Analytics',
            role: 'OC_REPORTER',
            canViewAnalytics: false,
            userGroup: 'OFF_CIRCUIT',
            status: 'ACTIVE'
        }
    });

    const unpermittedToken = jwt.sign({
        id: unpermittedUser.id,
        email: unpermittedUser.email,
        role: unpermittedUser.role,
        name: unpermittedUser.name,
        canViewAnalytics: false
    }, JWT_SECRET, { expiresIn: '1h' });

    let unpermittedBlocked = false;
    try {
        await axios.get(`${API_BASE}/analytics`, {
            headers: { Authorization: `Bearer ${unpermittedToken}` }
        });
    } catch (e) {
        if (e.response?.status === 403) {
            unpermittedBlocked = true;
            console.log('✅ Unpermitted user correctly blocked with 403 Forbidden:', e.response.data.message);
        }
    }
    if (!unpermittedBlocked) throw new Error('Unpermitted user was not blocked!');

    // 2. Test manager with explicit permission canViewAnalytics: true
    await prisma.user.update({
        where: { id: depManager.id },
        data: { canViewAnalytics: true }
    });

    const mgrToken = jwt.sign({
        id: depManager.id,
        email: depManager.email,
        role: depManager.role,
        name: depManager.name,
        canViewAnalytics: true,
        repDepartmentId: dept.id,
        department: dept.name
    }, JWT_SECRET, { expiresIn: '1h' });

    const adminToken = jwt.sign({
        id: admin?.id || 'admin-1',
        email: admin?.email || 'admin@test.com',
        role: 'ADMIN',
        name: admin?.name || 'Admin User',
        canViewAnalytics: true
    }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Fetch analytics as Department Manager
    const mgrRes = await axios.get(`${API_BASE}/analytics`, {
        headers: { Authorization: `Bearer ${mgrToken}` }
    });

    console.log('✅ Department Manager Analytics Response:');
    console.log('  - isDepRestricted:', mgrRes.data.isDepRestricted);
    console.log('  - userDepartment:', mgrRes.data.userDepartment?.name);
    console.log('  - executiveKpis:', mgrRes.data.executiveKpis);
    console.log('  - unitsBreakdown:', mgrRes.data.unitsBreakdown?.map(u => `${u.labelAr}: ${u.total} (Open: ${u.open}, Major: ${u.major})`));
    console.log('  - trainingHours:', mgrRes.data.trainingHours);
    console.log('  - detailsList items count:', mgrRes.data.detailsList?.length);

    if (!mgrRes.data.isDepRestricted) {
        throw new Error('Manager was not scoped to department!');
    }

    // 3. Fetch analytics as Admin (Unrestricted)
    const adminRes = await axios.get(`${API_BASE}/analytics`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('\n✅ Admin Analytics Response:');
    console.log('  - isDepRestricted:', adminRes.data.isDepRestricted);
    console.log('  - selectedDepartmentId:', adminRes.data.selectedDepartmentId);
    console.log('  - totalTickets:', adminRes.data.totalTickets);
    console.log('  - departmentsList count:', adminRes.data.departmentsList?.length);

    if (adminRes.data.isDepRestricted) {
        throw new Error('Admin should not be restricted!');
    }

    // 4. Test Quarter and Month filtering
    const q1Res = await axios.get(`${API_BASE}/analytics?year=2026&quarter=1`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('\n✅ Quarter 1 Analytics Filter:', q1Res.data.executiveKpis);

    console.log('\n🎉 ALL EXECUTIVE DASHBOARD TESTS PASSED 100%!');
}

testExecutiveDashboard()
    .catch(err => {
        console.error('❌ Test failed:', err.response?.data || err.stack || err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
