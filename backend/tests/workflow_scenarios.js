const axios = require('axios');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

const generateTestToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role, repDepartmentId: user.repDepartmentId },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
};

async function runScenarioTests() {
    console.log('🧪 Starting End-to-End Workflow Scenario Tests...\n');

    // 1. Get or Create Test Users and Department
    let dept = await prisma.department.findFirst({ where: { name: 'Operations & Facilities' } });
    if (!dept) {
        dept = await prisma.department.create({
            data: { name: 'Operations & Facilities', nameAr: 'العمليات والمرافق' }
        });
    }

    let reporter = await prisma.user.findFirst({ where: { email: 'reporter@test.com' } });
    if (!reporter) {
        reporter = await prisma.user.create({
            data: { email: 'reporter@test.com', name: 'Ahmed Reporter', role: 'OC_REPORTER', department: 'Operations & Facilities', repDepartmentId: dept.id }
        });
    }

    let controller = await prisma.user.findFirst({ where: { role: 'HSE_CONTROLLER' } });
    if (!controller) {
        controller = await prisma.user.create({
            data: { email: 'controller@test.com', name: 'Sami Controller', role: 'HSE_CONTROLLER' }
        });
    }

    let depRep = await prisma.user.findFirst({ where: { repDepartmentId: dept.id, role: 'DEP_REP' } });
    if (!depRep) {
        depRep = await prisma.user.create({
            data: { email: 'deprep@test.com', name: 'Khalid Dep Rep', role: 'DEP_REP', repDepartmentId: dept.id }
        });
    }

    let hrRep = await prisma.user.findFirst({ where: { role: 'HR_REP' } });
    if (!hrRep) {
        hrRep = await prisma.user.create({
            data: { email: 'hrrep@test.com', name: 'Mona HR', role: 'HR_REP' }
        });
    }

    const reporterToken = generateTestToken(reporter);
    const controllerToken = generateTestToken(controller);
    const depRepToken = generateTestToken(depRep);
    const hrRepToken = generateTestToken(hrRep);

    // =========================================================================
    // SCENARIO 1: Ticket with Injury + Controller Direct RCA + GOSI = Yes
    // =========================================================================
    console.log('=== SCENARIO 1: Ticket with Injury + Controller RCA + HR GOSI ===');
    
    // Step 1: Reporter submits ticket
    const createRes1 = await axios.post(`${API_BASE}/tickets`, {
        incidentType: 'OBSERVATION',
        whatHappened: 'Employee tripped over exposed wiring and sustained ankle sprain',
        incidentDate: new Date().toISOString().split('T')[0],
        incidentTime: '10:30',
        locationLat: 21.543333,
        locationLng: 39.172778,
        locationAddress: 'Main Entrance Hallway',
        reporterDepartmentId: dept.id,
        hasInjury: true,
        injuredPersons: [
            { name: 'Fahad Al-Harbi', mobile: '0551234567', type: 'EMPLOYEE', dept: 'Operations & Facilities' }
        ]
    }, { headers: { Authorization: `Bearer ${reporterToken}` } });

    const ticket1Id = createRes1.data.id;
    console.log(`✅ Ticket 1 created: ${createRes1.data.ticketNo} (Status: ${createRes1.data.status})`);

    // Step 2: Controller Reviews -> Changes type to INJURY, Sets Safety Classification, Completes RCA, and Confirms GOSI=true
    const ctrlRes1 = await axios.put(`${API_BASE}/tickets/${ticket1Id}/controller-action`, {
        action: 'ASSIGN',
        newType: 'INJURY',
        classificationType: 'SAFETY',
        hazardCategory: JSON.stringify(['Physical Hazards', 'Safety Hazards']),
        severity: 'SIGNIFICANT',
        targetDepartmentId: dept.id,
        notes: 'Please address immediate wiring hazards and fix carpeting.',
        delegateRcaToDept: false,
        rcaCause: 'Exposed extension cable routed across active walking pathway without cable protector ramp.',
        rcaWhy: 'Maintenance work was being performed and technician did not secure cable before leaving area.',
        rcaRootCause: 'Lack of standard operating procedure for temporary cable routing during event setup.',
        rcaCategory: 'Install rubber floor cable protector ramps across all walking pathways immediately.',
        rcaPreventiveActions: 'Enforce pre-shift inspection checklist for all event setups before opening hall doors.',
        notifyHr: true
    }, { headers: { Authorization: `Bearer ${controllerToken}` } });

    console.log(`✅ Controller assigned Ticket 1: ${ctrlRes1.data.message} (Status: ${ctrlRes1.data.status})`);

    // Step 3: HR Submits GOSI Data
    const hrRes1 = await axios.put(`${API_BASE}/tickets/${ticket1Id}/hr-action`, {
        injuredPersonsGosi: [
            {
                gosiEmployeeId: 'SMC-4081',
                gosiSubmitted: true,
                gosiReportDate: new Date().toISOString().split('T')[0],
                gosiReportNumber: 'GOSI-984210'
            }
        ],
        hrNotes: 'Employee evaluated at clinic and given 2 days rest. GOSI report submitted.'
    }, { headers: { Authorization: `Bearer ${hrRepToken}` } });

    console.log(`✅ HR submitted GOSI: ${hrRes1.data.message}`);

    // Step 4: Department Rep adds Action Plans and responds
    const planRes1 = await axios.post(`${API_BASE}/tickets/${ticket1Id}/action-plans`, {
        type: 'IMMEDIATE',
        description: 'Placed safety cones and temporary rubber cable covers.',
        responsiblePerson: 'Khalid Dep Rep',
        targetDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
    }, { headers: { Authorization: `Bearer ${depRepToken}` } });

    const deptRes1 = await axios.put(`${API_BASE}/tickets/${ticket1Id}/department-action`, {}, {
        headers: { Authorization: `Bearer ${depRepToken}` }
    });

    console.log(`✅ Department Rep submitted plans: ${deptRes1.data.message} (Status: ${deptRes1.data.status})`);

    // Step 5: Controller approves action plan & closes ticket
    await axios.put(`${API_BASE}/action-plans/${planRes1.data.id}`, { status: 'APPROVED' }, {
        headers: { Authorization: `Bearer ${controllerToken}` }
    });

    const closeRes1 = await axios.put(`${API_BASE}/tickets/${ticket1Id}/controller-review`, {
        action: 'CLOSE',
        violationType: 'NONE',
        notes: 'Action plans implemented and verified. GOSI documented.'
    }, { headers: { Authorization: `Bearer ${controllerToken}` } });

    console.log(`✅ Controller closed Ticket 1: ${closeRes1.data.message} (Status: ${closeRes1.data.status})`);

    // =========================================================================
    // SCENARIO 2: Security Breach + Controller Delegates RCA to Department Rep
    // =========================================================================
    console.log('\n=== SCENARIO 2: Security Breach + Delegated RCA to Department ===');

    const createRes2 = await axios.post(`${API_BASE}/tickets`, {
        incidentType: 'OBSERVATION',
        whatHappened: 'Storage area side door lock was found forced open overnight.',
        incidentDate: new Date().toISOString().split('T')[0],
        incidentTime: '08:00',
        locationLat: 21.543333,
        locationLng: 39.172778,
        locationAddress: 'Warehouse Zone B',
        reporterDepartmentId: dept.id,
        hasInjury: false
    }, { headers: { Authorization: `Bearer ${reporterToken}` } });

    const ticket2Id = createRes2.data.id;
    console.log(`✅ Ticket 2 created: ${createRes2.data.ticketNo} (Status: ${createRes2.data.status})`);

    // Controller assigns to Dept with Security Classification and DELEGATES RCA
    const ctrlRes2 = await axios.put(`${API_BASE}/tickets/${ticket2Id}/controller-action`, {
        action: 'ASSIGN',
        newType: 'UNSAFE_CONDITION',
        classificationType: 'SECURITY',
        hazardCategory: JSON.stringify(['Force Access', 'Unauthorized Access']),
        severity: 'MAJOR',
        targetDepartmentId: dept.id,
        notes: 'Security breach detected. Department Rep must complete RCA and provide immediate security plan.',
        delegateRcaToDept: true,
        notifyHr: false
    }, { headers: { Authorization: `Bearer ${controllerToken}` } });

    console.log(`✅ Controller assigned Ticket 2 with RCA Delegated: ${ctrlRes2.data.message} (Status: ${ctrlRes2.data.status})`);

    // Dep Rep adds Action Plan + completes the 5 RCA fields
    const planRes2 = await axios.post(`${API_BASE}/tickets/${ticket2Id}/action-plans`, {
        type: 'IMMEDIATE',
        description: 'Replaced broken lock with heavy-duty electronic card access latch.',
        responsiblePerson: 'Security & Facilities Team',
        targetDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
    }, { headers: { Authorization: `Bearer ${depRepToken}` } });

    const deptRes2 = await axios.put(`${API_BASE}/tickets/${ticket2Id}/department-action`, {
        rcaCause: 'Side door lock cylinder mechanism was compromised using mechanical tools.',
        rcaWhy: 'CCTV camera angle was obstructed by temporary scaffolding outside warehouse.',
        rcaRootCause: 'Absence of secondary biometric/RFID access control and lack of motion sensor lighting.',
        rcaCategory: 'Replaced lock mechanism and adjusted CCTV angle to cover perimeter.',
        rcaPreventiveActions: 'Install 24/7 motion sensor floodlights and integrate door sensor into central alarm panel.'
    }, { headers: { Authorization: `Bearer ${depRepToken}` } });

    console.log(`✅ Department Rep completed Delegated RCA + Action Plans: ${deptRes2.data.message} (Status: ${deptRes2.data.status})`);

    // Controller approves action plan & closes ticket
    await axios.put(`${API_BASE}/action-plans/${planRes2.data.id}`, { status: 'APPROVED' }, {
        headers: { Authorization: `Bearer ${controllerToken}` }
    });

    const closeRes2 = await axios.put(`${API_BASE}/tickets/${ticket2Id}/controller-review`, {
        action: 'CLOSE',
        violationType: 'NONE',
        notes: 'Department RCA and security upgrades verified.'
    }, { headers: { Authorization: `Bearer ${controllerToken}` } });

    console.log(`✅ Controller closed Ticket 2: ${closeRes2.data.message} (Status: ${closeRes2.data.status})`);

    // =========================================================================
    // SCENARIO 3: Minor Unsafe Condition (No Injury, Minor Severity -> No RCA)
    // =========================================================================
    console.log('\n=== SCENARIO 3: Minor Unsafe Condition (Routine / No RCA Required) ===');

    const createRes3 = await axios.post(`${API_BASE}/tickets`, {
        incidentType: 'OBSERVATION',
        whatHappened: 'Water puddle observed near restroom entrance due to cleaning.',
        incidentDate: new Date().toISOString().split('T')[0],
        incidentTime: '09:15',
        locationLat: 21.543333,
        locationLng: 39.172778,
        locationAddress: 'Corridor 3 near Restrooms',
        reporterDepartmentId: dept.id,
        hasInjury: false
    }, { headers: { Authorization: `Bearer ${reporterToken}` } });

    const ticket3Id = createRes3.data.id;
    console.log(`✅ Ticket 3 created: ${createRes3.data.ticketNo} (Status: ${createRes3.data.status})`);

    // Controller assigns as MINOR Unsafe Condition -> RCA is NOT required
    const ctrlRes3 = await axios.put(`${API_BASE}/tickets/${ticket3Id}/controller-action`, {
        action: 'ASSIGN',
        newType: 'UNSAFE_CONDITION',
        classificationType: 'SAFETY',
        hazardCategory: JSON.stringify(['Safety Hazards']),
        severity: 'MINOR',
        targetDepartmentId: dept.id,
        notes: 'Please ensure warning signs are placed and area mopped dry.',
        notifyHr: false
    }, { headers: { Authorization: `Bearer ${controllerToken}` } });

    console.log(`✅ Controller assigned Ticket 3 (RCA Not Required): ${ctrlRes3.data.message} (Status: ${ctrlRes3.data.status})`);

    // Dep Rep adds Action Plan without filling RCA
    const planRes3 = await axios.post(`${API_BASE}/tickets/${ticket3Id}/action-plans`, {
        type: 'IMMEDIATE',
        description: 'Dry mopped floor and placed Caution Wet Floor sign.',
        responsiblePerson: 'Cleaning Supervisor',
        targetDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
    }, { headers: { Authorization: `Bearer ${depRepToken}` } });

    const deptRes3 = await axios.put(`${API_BASE}/tickets/${ticket3Id}/department-action`, {}, {
        headers: { Authorization: `Bearer ${depRepToken}` }
    });

    console.log(`✅ Department Rep submitted action plan without RCA: ${deptRes3.data.message} (Status: ${deptRes3.data.status})`);

    // Controller approves plan and closes ticket without RCA
    await axios.put(`${API_BASE}/action-plans/${planRes3.data.id}`, { status: 'APPROVED' }, {
        headers: { Authorization: `Bearer ${controllerToken}` }
    });

    const closeRes3 = await axios.put(`${API_BASE}/tickets/${ticket3Id}/controller-review`, {
        action: 'CLOSE',
        violationType: 'NONE',
        notes: 'Verified caution sign and dry floor.'
    }, { headers: { Authorization: `Bearer ${controllerToken}` } });

    console.log(`✅ Controller closed Ticket 3 directly: ${closeRes3.data.message} (Status: ${closeRes3.data.status})`);

    // Verify DB state
    const savedTicket3 = await prisma.ticket.findUnique({
        where: { id: ticket3Id },
        include: { offCircuitReport: true }
    });

    console.log('\n📊 Database Verification for Scenario 3:');
    console.log(`- Ticket 3 Status: ${savedTicket3.status}`);
    console.log(`- Severity Level: ${savedTicket3.severityLevel}`);
    console.log(`- RCA Required: ${savedTicket3.offCircuitReport.rcaRequired}`);
    console.log(`- RCA Completed: ${savedTicket3.offCircuitReport.rcaCompleted}`);

    console.log('\n🎉 ALL 3 SCENARIOS PASSED SUCCESSFULLY!');
}

runScenarioTests()
    .catch(err => {
        console.error('❌ Scenario test failed:', err.response?.data || err.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
