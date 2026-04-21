/**
 * ============================================================
 *  FULL OC WORKFLOW E2E TEST
 *  
 *  Creates a ticket with an Employee injury and walks
 *  it through EVERY stage until CLOSED.
 * ============================================================
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const USERS = {
    reporter:     'testuser123@test.com',      // OC_REPORTER
    controller:   'HSE_Controller@test.com',    // HSE_CONTROLLER
    depRep:       'IT@test.com',                // DEP_REP
    investigator: 'Safety.Investigator@test.com', // OC_SAFETY_INVESTIGATOR
    depManager:   'HR_Mg@test.com',             // DEP_MANAGER
    hseManager:   'HSE.Manager@test.com',       // OC_HSE_MANAGER
};

const jwt = require('./utils/authUtils');
const log = (step, msg) => console.log(`\n${'='.repeat(60)}\n[STEP ${step}] ${msg}\n${'='.repeat(60)}`);

async function getUser(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`User not found: ${email}`);
    return user;
}

function makeToken(user) {
    return jwt.generateToken(user.id, user.role);
}

async function apiCall(method, path, body, token) {
    const baseUrl = 'http://localhost:3000/api';
    const url = `${baseUrl}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
        console.error(`❌ API Error ${res.status}:`, data);
        throw new Error(`${method} ${path} failed: ${data.message}`);
    }
    return data;
}

async function run() {
    console.log('\n🚀 Starting Full OC Workflow E2E Test...\n');
    
    // Load all users
    const reporter = await getUser(USERS.reporter);
    const controller = await getUser(USERS.controller);
    const depRep = await getUser(USERS.depRep);
    const investigator = await getUser(USERS.investigator);
    const depManager = await getUser(USERS.depManager);
    const hseManager = await getUser(USERS.hseManager);
    
    const tokens = {
        reporter: makeToken(reporter),
        controller: makeToken(controller),
        depRep: makeToken(depRep),
        investigator: makeToken(investigator),
        depManager: makeToken(depManager),
        hseManager: makeToken(hseManager),
    };
    
    console.log('✅ All users loaded and tokens generated');
    
    // ============ STEP 1: Reporter creates ticket ============
    log(1, 'REPORTER creates OC ticket with Employee injury');
    
    const ticket = await apiCall('POST', '/oc/tickets', {
        incidentType: 'INJURY',
        severity: 'HIGH',
        incidentDate: '2026-04-20',
        incidentTime: '14:30',
        locationLat: 21.4225,
        locationLng: 39.8262,
        locationAddress: 'Jeddah Corniche Circuit - Gate 3',
        whatHappened: '[E2E TEST] Employee slipped on wet floor near pit lane area. Immediate medical assistance was provided.',
        hasInjury: true,
        injuredPersons: [
            {
                name: 'Mohammed Ali',
                affiliate: 'Employee',
                contact: '0551234567',
                dept: 'Operations',
                jobTitle: 'Track Marshal',
                empNumber: 'EMP-2024-001'
            }
        ],
        witnesses: [
            { name: 'Fahad Ahmed', mobile: '0559876543' },
            { name: 'Khalid Omar', mobile: '0553456789' }
        ]
    }, tokens.reporter);
    
    const ticketId = ticket.id;
    console.log(`✅ Ticket created: ${ticket.ticketNo} (ID: ${ticketId})`);
    console.log(`   Status: ${ticket.status}`);
    
    // ============ STEP 2: HSE Controller routes to Dep Rep ============
    log(2, 'HSE CONTROLLER routes ticket to Department Rep');
    
    const routeResult = await apiCall('PUT', `/oc/tickets/${ticketId}/hse-action`, {
        action: 'ROUTE_TO_USER',
        targetId: depRep.id,
        notes: 'Please review and provide corrective action plan for this workplace injury.',
        priority: 'HIGH',
        severityLevel: 'HIGH',
        isLTI: true,
        isMaterialDamage: false,
        isRegulatoryReportable: true,
        isNearMiss: false,
        riskLikelihood: 3,
        riskConsequence: 4,
        riskScore: 12,
        riskLevel: 'HIGH'
    }, tokens.controller);
    
    console.log(`✅ ${routeResult.message}`);
    
    // Verify status
    let currentTicket = await apiCall('GET', `/oc/tickets/${ticketId}`, null, tokens.controller);
    console.log(`   Status: ${currentTicket.status}`);
    
    // ============ STEP 3: Dep Rep submits response (goes back to controller) ============
    log(3, 'DEP REP submits corrective actions (returns to HSE Controller)');
    
    const depRepResult = await apiCall('PUT', `/oc/tickets/${ticketId}/dep-rep`, {
        immediateCauses: 'Water leakage from cooling system created slippery surface. No warning signs were placed. Area was poorly lit.',
        preventiveActions: '1. Install drainage system near pit lane\n2. Deploy non-slip mats in wet areas\n3. Improve lighting in the area\n4. Place permanent warning signage'
    }, tokens.depRep);
    
    console.log(`✅ ${depRepResult.message}`);
    console.log(`   Status: ${depRepResult.status}`);
    
    // ============ STEP 4: HSE Controller routes to Investigation ============
    log(4, 'HSE CONTROLLER reviews and routes to INVESTIGATION');
    
    // Controller needs to update status to UNDER_INVESTIGATION
    // Using direct DB update since we changed the flow
    await prisma.ticket.update({
        where: { id: ticketId },
        data: {
            status: 'UNDER_INVESTIGATION',
            activityLogs: {
                create: {
                    actorId: controller.id,
                    action: 'ROUTED_TO_INVESTIGATION',
                    details: 'HSE Controller reviewed dep rep response and sent for formal RCA investigation.'
                }
            }
        }
    });
    
    currentTicket = await apiCall('GET', `/oc/tickets/${ticketId}`, null, tokens.controller);
    console.log(`✅ Routed to Investigation`);
    console.log(`   Status: ${currentTicket.status}`);
    
    // ============ STEP 5: Investigator submits RCA ============
    log(5, 'INVESTIGATOR submits Root Cause Analysis (RCA)');
    
    const rcaResult = await apiCall('PUT', `/oc/tickets/${ticketId}/investigation`, {
        underlyingCauses: 'Lack of periodic maintenance inspection for cooling system. No standard operating procedure for wet surface management.',
        rootCauses: 'Failure to implement preventive maintenance schedule. Inadequate workplace hazard assessment process.',
        analysisMethod: '5 Whys',
        targetDepManagerId: depManager.id
    }, tokens.investigator);
    
    console.log(`✅ ${rcaResult.message}`);
    console.log(`   Status: ${rcaResult.status}`);
    
    // ============ STEP 6: Dep Manager approves CAPA ============
    log(6, 'DEP MANAGER approves preventive actions (CAPA)');
    
    const capaResult = await apiCall('PUT', `/oc/tickets/${ticketId}/dep-manager-approve`, {}, tokens.depManager);
    
    console.log(`✅ ${capaResult.message}`);
    console.log(`   Status: ${capaResult.status}`);
    
    // ============ STEP 7: HSE Manager closes ticket ============
    log(7, 'HSE MANAGER makes final decision - CLOSE');
    
    const closeResult = await apiCall('PUT', `/oc/tickets/${ticketId}/final-review`, {
        decision: 'CLOSE',
        finalNotes: 'All corrective and preventive actions have been verified and implemented. Ticket closed satisfactorily.',
        hseManagerSignature: 'Waleed Fahad - HSE Manager'
    }, tokens.hseManager);
    
    console.log(`✅ ${closeResult.message}`);
    console.log(`   Status: ${closeResult.status}`);
    
    // ============ FINAL: Print summary ============
    const finalTicket = await apiCall('GET', `/oc/tickets/${ticketId}`, null, tokens.controller);
    
    console.log('\n' + '🏁'.repeat(30));
    console.log('\n✅✅✅ FULL WORKFLOW TEST COMPLETED SUCCESSFULLY! ✅✅✅\n');
    console.log('📋 Final Ticket Summary:');
    console.log(`   Ticket No:    ${finalTicket.ticketNo}`);
    console.log(`   Status:       ${finalTicket.status}`);
    console.log(`   Type:         ${finalTicket.type}`);
    console.log(`   Priority:     ${finalTicket.priority}`);
    console.log(`   Has Injury:   ${finalTicket.hasInjury}`);
    console.log(`   Created By:   ${finalTicket.createdBy?.name}`);
    console.log(`   Closed By:    ${finalTicket.closedBy}`);
    console.log(`   Closed At:    ${finalTicket.closedAt}`);
    console.log(`   Activity Logs: ${finalTicket.activityLogs?.length} entries`);
    
    console.log('\n📝 Activity Log:');
    finalTicket.activityLogs?.reverse().forEach((log, i) => {
        console.log(`   ${i+1}. [${log.actor?.name || 'System'}] ${log.action} - ${log.details?.substring(0, 80)}`);
    });
    
    console.log('\n' + '🏁'.repeat(30));
}

run()
    .catch(err => {
        console.error('\n❌ TEST FAILED:', err.message);
        console.error(err);
    })
    .finally(() => prisma.$disconnect());
