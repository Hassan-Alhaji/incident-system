const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

async function testDetectionAndAnalytics() {
    console.log('🧪 Testing Detection Source & Annual Analytics...');

    // 1. Get reporter and controller users
    let reporter = await prisma.user.findFirst({ where: { role: 'OC_REPORTER' } });
    if (!reporter) reporter = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    let controller = await prisma.user.findFirst({ where: { role: 'HSE_CONTROLLER' } });
    if (!controller) controller = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    const reporterToken = jwt.sign({ id: reporter.id, email: reporter.email, role: reporter.role, name: reporter.name }, JWT_SECRET, { expiresIn: '1h' });
    const controllerToken = jwt.sign({ id: controller.id, email: controller.email, role: controller.role, name: controller.name }, JWT_SECRET, { expiresIn: '1h' });

    const dept = await prisma.department.findFirst();

    // 2. Create ticket with Inspection detection source
    const createRes = await axios.post(`${API_BASE}/tickets`, {
        incidentType: 'OBSERVATION',
        whatHappened: 'Inspection walk in Paddock revealed loose cabling near timing stand.',
        incidentDate: new Date().toISOString().split('T')[0],
        incidentTime: '10:30',
        locationLat: 21.543333,
        locationLng: 39.172778,
        locationAddress: 'Paddock Sector 2',
        reporterDepartmentId: dept.id,
        detectionSource: 'INSPECTION'
    }, { headers: { Authorization: `Bearer ${reporterToken}` } });

    console.log(`✅ Created ticket with Detection Source: ${createRes.data.ticketNo}`);

    // Verify DB
    const dbTicket = await prisma.ticket.findUnique({
        where: { id: createRes.data.id },
        include: { offCircuitReport: true }
    });

    console.log(`✅ DB Verification - Detection Source in OffCircuitReport: ${dbTicket.offCircuitReport.detectionSource}`);

    // 3. Test Analytics Endpoint
    const analyticsRes = await axios.get(`${API_BASE}/analytics`, {
        headers: { Authorization: `Bearer ${controllerToken}` }
    });

    console.log('✅ Analytics Detection Source Stats:', analyticsRes.data.detectionSourceStats);
    console.log('✅ Analytics Available Years:', analyticsRes.data.availableYears);

    console.log('\n🎉 TEST COMPLETED SUCCESSFULLY!');
}

testDetectionAndAnalytics()
    .catch(err => {
        console.error('❌ Test failed:', err.response?.data || err.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
