/**
 * Full E2E Scenario Tests — Live Server
 * ═══════════════════════════════════════════════════════════════════
 * Tests 5 complete ticket lifecycle scenarios against the running API:
 *
 *   Scenario 1: OBSERVATION — No Injury, No Fine  (NONE violation)
 *   Scenario 2: NEAR_MISS  — Employee Injury, No Fine  (WARNING violation)
 *   Scenario 3: OBSERVATION — Contractor Injury, No Fine  (NONE violation)
 *   Scenario 4: OBSERVATION — No Injury, Financial Fine  (FINANCIAL violation)
 *   Scenario 5: NEAR_MISS  — Employee Injury, Financial Fine  (FINANCIAL violation)
 *
 * Each scenario walks through the ENTIRE workflow:
 *   Reporter creates → Controller assigns → Dept rep adds action plan →
 *   Dept rep submits → Controller approves plan → Controller closes
 *
 * Usage:
 *   node tests/e2e_full_scenarios.js
 */

const axios = require('axios');

const BASE = 'http://localhost:3000/api';
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36m→\x1b[0m';
const HEAD = '\x1b[33m';
const RESET = '\x1b[0m';
const DIM  = '\x1b[2m';

let passed = 0;
let failed = 0;
const scenarioResults = [];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Helpers ──────────────────────────────────────────────────────────────────

function assert(condition, label, detail = '') {
    if (condition) {
        console.log(`  ${PASS} ${label}`);
        passed++;
    } else {
        console.log(`  ${FAIL} ${label}${detail ? ' — ' + detail : ''}`);
        failed++;
    }
}

async function step(label, fn) {
    try {
        return await fn();
    } catch (err) {
        const msg = err.response?.data?.message || err.message;
        const status = err.response?.status;
        console.log(`  ${FAIL} ${label} — HTTP ${status}: ${msg}`);
        failed++;
        return null;
    }
}

function api(token) {
    return axios.create({
        baseURL: BASE,
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
}

async function login(email) {
    const otpRes = await axios.post(`${BASE}/auth/otp/request`, { email });
    const code = otpRes.data.testCode;
    const verRes = await axios.post(`${BASE}/auth/otp/verify`, { email, otp: code });
    return verRes.data.token;
}

// ── Setup Phase ───────────────────────────────────────────────────────────────

async function setup() {
    console.log(`\n${HEAD}╔══════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${HEAD}║     SETUP: Creating test users, department & provider   ║${RESET}`);
    console.log(`${HEAD}╚══════════════════════════════════════════════════════════╝${RESET}`);

    // 1. Admin login
    const adminToken = await login('al3ren0@gmail.com');
    assert(!!adminToken, 'Admin login successful');
    const adm = api(adminToken);

    // 2. Create users
    const users = {};
    const roleMap = [
        { key: 'reporter',   name: 'E2E Reporter',     email: 'e2e.reporter@test.local',    role: 'OC_REPORTER'    },
        { key: 'controller', name: 'E2E Controller',    email: 'e2e.controller@test.local',  role: 'HSE_CONTROLLER' },
        { key: 'deprep',     name: 'E2E Dept Rep',      email: 'e2e.deprep@test.local',      role: 'DEP_REP'        },
        { key: 'safety',     name: 'E2E Safety Mgr',    email: 'e2e.safety@test.local',      role: 'SAFETY_MANAGER' },
        { key: 'hr',         name: 'E2E HR Rep',        email: 'e2e.hr@test.local',          role: 'HR_REP'         },
    ];

    for (const u of roleMap) {
        const r = await adm.post('/users', { name: u.name, email: u.email, role: u.role, mobile: '+966500000000' });
        if (r.status === 201) {
            users[u.key] = { id: r.data.user.id, email: u.email };
            assert(true, `Created ${u.role}: ${u.name}`);
        } else if (r.status === 400 && r.data.message === 'Email exists') {
            const all = await adm.get('/users');
            const found = all.data.find(x => x.email === u.email);
            if (found) {
                users[u.key] = { id: found.id, email: u.email };
                assert(true, `Reusing existing ${u.role}: ${u.name}`);
            }
        } else {
            assert(false, `Create ${u.role}`, r.data.message);
        }
    }

    // 3. Create department
    let deptId;
    const deptRes = await adm.post('/departments', {
        nameEn: 'E2E Test Department',
        nameAr: 'قسم اختبار شامل',
        representatives: [{ name: 'E2E Dept Rep', email: 'e2e.deprep@test.local', mobile: '' }],
    });
    if (deptRes.status === 201) {
        deptId = deptRes.data.id;
        assert(true, `Department created: ${deptRes.data.name}`);
    } else {
        const depts = await adm.get('/departments');
        const found = depts.data.find(d => d.name === 'E2E Test Department');
        if (found) {
            deptId = found.id;
            await adm.put(`/departments/${deptId}`, {
                nameEn: 'E2E Test Department',
                representatives: [{ name: 'E2E Dept Rep', email: 'e2e.deprep@test.local', mobile: '' }],
            });
            assert(true, `Reusing existing department (id: ${deptId})`);
        } else {
            assert(false, 'Create department', deptRes.data.message);
        }
    }

    // 4. Create a service provider for financial fine scenarios
    let spId;
    const spRes = await adm.post('/service-providers', {
        name: 'E2E Test Provider',
        nameAr: 'مزود اختبار',
        commercialRegistrationNumber: '7009999001',
        responsibleDepartmentId: deptId,
        representativeName: 'SP Contact',
        representativeEmail: 'sp.contact@test.local',
        representativeMobile: '+966501111111',
        representatives: [{ name: 'SP Contact', email: 'sp.contact@test.local', mobile: '+966501111111' }],
    });
    if (spRes.status === 201) {
        spId = spRes.data.id;
        assert(true, `Service Provider created: ${spRes.data.name}`);
    } else {
        const sps = await adm.get('/service-providers');
        const found = sps.data.find(s => s.commercialRegistrationNumber === '7009999001');
        if (found) {
            spId = found.id;
            assert(true, `Reusing existing service provider (CR: 7009999001)`);
        } else {
            assert(false, 'Create service provider', spRes.data.message);
        }
    }

    // 5. Login as each role
    // Auth rate limiter = 10 requests per minute. Admin login consumed 2.
    // 5 user logins = 10 more auth requests → must wait for window reset first.
    console.log(`\n  ${INFO} Waiting 61s for auth rate limiter to reset (admin login used 2 of 10 slots)...`);
    await sleep(61000);
    console.log(`  ${INFO} Logging in as each role...`);
    const tokens = {};
    for (const u of roleMap) {
        const t = await login(u.email);
        tokens[u.key] = t;
        assert(!!t, `Login as ${u.role}`);
    }

    console.log(`\n  ${INFO} Setup complete. Dept: ${deptId}, SP: ${spId}`);
    return { adminToken, tokens, users, deptId, spId };
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMON WORKFLOW HELPER — walks a ticket through the entire lifecycle
// ══════════════════════════════════════════════════════════════════════════════

async function runFullLifecycle(ctx, config) {
    const { tokens, deptId, spId } = ctx;
    const reporter   = api(tokens.reporter);
    const controller = api(tokens.controller);
    const deprep     = api(tokens.deprep);

    let ticketId, ticketNo;
    const startTime = Date.now();

    // ── Step 1: Reporter creates ticket ──────────────────────────────────
    console.log(`\n  ${INFO} Step 1 — Reporter creates ticket`);
    await step('Create ticket', async () => {
        const payload = {
            incidentType:    'OBSERVATION',
            incidentDate:    new Date().toISOString().split('T')[0],
            incidentTime:    '09:00',
            whatHappened:    config.description,
            locationAddress: config.location,
            hasInjury:       config.hasInjury,
        };
        if (config.injuredPersons) payload.injuredPersons = config.injuredPersons;
        if (config.witnesses)      payload.witnesses = config.witnesses;
        if (config.serviceProviderId) payload.serviceProviderId = config.serviceProviderId;

        const r = await reporter.post('/tickets', payload);
        assert(r.status === 201, `POST /tickets → 201`, r.data?.message);
        assert(r.data.status === 'SUBMITTED', `Status = SUBMITTED`);
        assert(r.data.hasInjury === config.hasInjury, `hasInjury = ${config.hasInjury}`);
        ticketId = r.data.id;
        ticketNo = r.data.ticketNo;
        console.log(`      ${DIM}Ticket: ${ticketNo}${RESET}`);
    });
    if (!ticketId) return null;

    // ── Step 2: Controller assigns to department ─────────────────────────
    console.log(`\n  ${INFO} Step 2 — Controller assigns to department`);

    // If the ticket type needs to change (e.g. to NEAR_MISS for RCA), do it here
    const assignPayload = {
        action:             'ASSIGN',
        severity:           config.severity || 'MINOR',
        targetDepartmentId: deptId,
        notes:              config.controllerNotes || 'Assigned for investigation',
    };
    if (config.newType) assignPayload.newType = config.newType;
    if (config.serviceProviderId) assignPayload.serviceProviderId = config.serviceProviderId;

    // For NEAR_MISS type, RCA is required — include RCA fields
    const effectiveType = config.newType || 'OBSERVATION';
    if (effectiveType !== 'OBSERVATION') {
        assignPayload.rcaCause = 'Root cause identified during investigation';
        assignPayload.rcaWhy = '1. Lack of training → 2. No supervision → 3. Missing procedures → 4. No enforcement → 5. Culture gap';
        assignPayload.rcaRootCause = 'Insufficient safety procedures and supervision';
        assignPayload.rcaCategory = 'MANAGEMENT_SYSTEM_FAILURE';
        assignPayload.rcaPreventiveActions = 'Implement safety training program and supervision checklist';
    }

    await step('Controller ASSIGN', async () => {
        const r = await controller.put(`/tickets/${ticketId}/controller-action`, assignPayload);
        assert(r.status === 200, `PUT /controller-action → 200`, r.data?.message);
        assert(r.data.status === 'ASSIGNED', `Status = ASSIGNED`);
    });

    // ── Step 3: Verify ticket state ──────────────────────────────────────
    console.log(`\n  ${INFO} Step 3 — Verify ticket state after assignment`);
    await step('Verify ticket state', async () => {
        const r = await controller.get(`/tickets/${ticketId}`);
        assert(r.data.status === 'ASSIGNED', 'Status = ASSIGNED in DB');
        assert(r.data.departmentId === deptId, 'departmentId is correct');
        assert(!!r.data.departmentAssignedAt, 'departmentAssignedAt set');
        if (config.hasInjury) {
            assert(r.data.hasInjury === true, 'hasInjury = true in DB');
        }
    });

    // ── Step 4: Department rep creates action plan ───────────────────────
    console.log(`\n  ${INFO} Step 4 — Department rep creates action plan`);
    let actionPlanId;
    await step('Create IMMEDIATE action plan', async () => {
        const r = await deprep.post(`/tickets/${ticketId}/action-plans`, {
            type:        'IMMEDIATE',
            description: config.actionPlanDesc || 'Corrective action taken immediately to resolve the issue',
            targetDate:  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
        assert(r.status === 201, `POST /action-plans → 201`, r.data?.message);
        assert(r.data.status === 'SUBMITTED', `Action plan status = SUBMITTED`);
        actionPlanId = r.data.id;
    });

    // ── Step 5: Department rep submits response ──────────────────────────
    console.log(`\n  ${INFO} Step 5 — Department rep submits response`);
    await step('Department action → UNDER_REVIEW', async () => {
        const r = await deprep.put(`/tickets/${ticketId}/department-action`, {});
        assert(r.status === 200, `PUT /department-action → 200`, r.data?.message);
        assert(r.data.status === 'UNDER_REVIEW', `Status = UNDER_REVIEW`);
    });

    // ── Step 6: Controller approves the action plan ──────────────────────
    console.log(`\n  ${INFO} Step 6 — Controller approves the action plan`);
    await step('Approve action plan', async () => {
        const r = await controller.put(`/action-plans/${actionPlanId}`, {
            status:      'APPROVED',
            reviewNotes: 'Action plan approved. Implementation verified.',
        });
        assert(r.status === 200, `PUT /action-plans/:id → 200`, r.data?.message);
        assert(r.data.status === 'APPROVED', `Action plan status = APPROVED`);
    });

    // ── Step 7: Controller closes the ticket ─────────────────────────────
    console.log(`\n  ${INFO} Step 7 — Controller closes the ticket`);
    const closePayload = {
        action: 'CLOSE',
        notes:  config.closeNotes || 'Investigation complete. Issue resolved.',
        violationType: config.violationType || 'NONE',
    };
    if (config.violationType === 'FINANCIAL') {
        closePayload.violationDescription = config.violationDescription || 'Safety violation by contractor';
        closePayload.violationAmount = config.violationAmount || '5000';
        if (config.serviceProviderId) closePayload.serviceProviderId = config.serviceProviderId;
    }
    if (config.violationType === 'WARNING') {
        closePayload.violationDescription = config.violationDescription || 'Warning issued for safety non-compliance';
    }

    await step('Controller CLOSE', async () => {
        const r = await controller.put(`/tickets/${ticketId}/controller-review`, closePayload);
        assert(r.status === 200, `PUT /controller-review CLOSE → 200`, r.data?.message);
        assert(r.data.status === 'CLOSED', `Status = CLOSED`);
    });

    // ── Step 8: Final verification ───────────────────────────────────────
    console.log(`\n  ${INFO} Step 8 — Final verification`);
    await step('Verify final ticket state', async () => {
        const r = await controller.get(`/tickets/${ticketId}`);
        assert(r.data.status === 'CLOSED', 'Final status = CLOSED');
        assert(!!r.data.closedAt, 'closedAt timestamp set');
        assert(r.data.closedBy === 'E2E Controller', 'closedBy = E2E Controller');

        // Verify injury state
        if (config.hasInjury) {
            assert(r.data.hasInjury === true, 'hasInjury preserved = true');
            const injured = r.data.offCircuitReport?.injuredPersons;
            if (injured) {
                const parsed = typeof injured === 'string' ? JSON.parse(injured) : injured;
                assert(parsed.length > 0, `injuredPersons count: ${parsed.length}`);
                const personType = parsed[0].type || parsed[0].affiliate;
                assert(!!personType, `Injured person type: ${personType}`);
            }
        } else {
            assert(r.data.hasInjury === false, 'hasInjury = false (no injury)');
        }

        // Verify violation/fine state
        if (config.violationType === 'FINANCIAL') {
            assert(r.data.hasFinancialViolation === true, 'hasFinancialViolation = true');
            assert(r.data.forwardedToFinance === true, 'forwardedToFinance = true');
            assert(!!r.data.violationAmount, `violationAmount = ${r.data.violationAmount}`);
            assert(!!r.data.violationDescription, 'violationDescription is set');
        } else if (config.violationType === 'WARNING') {
            assert(r.data.hasFinancialViolation === false, 'hasFinancialViolation = false (WARNING)');
            assert(!!r.data.violationDescription, 'violationDescription is set (WARNING)');
        } else {
            assert(r.data.hasFinancialViolation === false || r.data.hasFinancialViolation === null, 'No financial violation (NONE)');
        }

        // Verify activity logs trail
        const logs = r.data.activityLogs.map(l => l.action);
        assert(logs.includes('STAGE_CREATED'), 'Log: STAGE_CREATED');
        assert(logs.includes('STAGE_ASSIGNED'), 'Log: STAGE_ASSIGNED');
        assert(logs.includes('STAGE_PLAN_CREATED'), 'Log: STAGE_PLAN_CREATED');
        assert(logs.includes('STAGE_DEPT_RESPONDED'), 'Log: STAGE_DEPT_RESPONDED');
        assert(logs.includes('STAGE_PLAN_UPDATED'), 'Log: STAGE_PLAN_UPDATED');
        assert(logs.includes('STAGE_CLOSED'), 'Log: STAGE_CLOSED');
        console.log(`      ${DIM}Trail: ${logs.reverse().join(' → ')}${RESET}`);
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    return { ticketId, ticketNo, elapsed };
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════

async function scenario1(ctx) {
    console.log(`\n${HEAD}╔══════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${HEAD}║  SCENARIO 1: No Injury — No Fine (OBSERVATION/NONE)     ║${RESET}`);
    console.log(`${HEAD}╚══════════════════════════════════════════════════════════╝${RESET}`);

    const result = await runFullLifecycle(ctx, {
        description:    'Loose cable near the main entrance creating a tripping hazard. No one was hurt.',
        location:       'Gate A — Ground Floor',
        hasInjury:      false,
        severity:       'MINOR',
        violationType:  'NONE',
        controllerNotes:'Housekeeping issue. No immediate danger. No injury.',
        closeNotes:     'Cable secured. Issue resolved. No violations.',
        actionPlanDesc: 'Cable secured with cable ties and routed through conduit. Area cleared.',
    });

    if (result) {
        console.log(`\n  ${PASS} SCENARIO 1 COMPLETE — ${result.ticketNo} CLOSED (${result.elapsed}s)`);
        scenarioResults.push({ name: 'No Injury / No Fine', ticket: result.ticketNo, status: 'PASSED', time: result.elapsed });
    } else {
        scenarioResults.push({ name: 'No Injury / No Fine', ticket: 'N/A', status: 'FAILED', time: '-' });
    }
}

async function scenario2(ctx) {
    console.log(`\n${HEAD}╔══════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${HEAD}║  SCENARIO 2: Employee Injury — No Fine (WARNING)        ║${RESET}`);
    console.log(`${HEAD}╚══════════════════════════════════════════════════════════╝${RESET}`);

    const result = await runFullLifecycle(ctx, {
        description:    'Worker slipped on wet floor in the workshop area. Sustained minor wrist sprain.',
        location:       'Workshop Block B — Level 1',
        hasInjury:      true,
        injuredPersons: [
            { name: 'Ahmed Mohammed', type: 'EMPLOYEE', dept: 'Maintenance', mobile: '0501234567' }
        ],
        witnesses: [
            { name: 'Saeed Ali', mobile: '0507654321' }
        ],
        newType:        'NEAR_MISS',
        severity:       'MODERATE',
        violationType:  'WARNING',
        violationDescription: 'Warning issued: Wet floor not marked with caution signs. Supervisor must ensure proper signage.',
        controllerNotes:'Employee injury — wet floor incident. Investigation required.',
        closeNotes:     'Investigation complete. Warning issued to maintenance supervisor.',
        actionPlanDesc: 'Wet floor signs deployed. Supervisor briefed on marking wet areas immediately.',
    });

    if (result) {
        console.log(`\n  ${PASS} SCENARIO 2 COMPLETE — ${result.ticketNo} CLOSED (${result.elapsed}s)`);
        scenarioResults.push({ name: 'Employee Injury / Warning', ticket: result.ticketNo, status: 'PASSED', time: result.elapsed });
    } else {
        scenarioResults.push({ name: 'Employee Injury / Warning', ticket: 'N/A', status: 'FAILED', time: '-' });
    }
}

async function scenario3(ctx) {
    console.log(`\n${HEAD}╔══════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${HEAD}║  SCENARIO 3: Contractor Injury — No Fine (NONE)         ║${RESET}`);
    console.log(`${HEAD}╚══════════════════════════════════════════════════════════╝${RESET}`);

    const result = await runFullLifecycle(ctx, {
        description:    'Contractor worker cut his hand while handling metal sheets without proper gloves.',
        location:       'Storage Yard — Section C',
        hasInjury:      true,
        injuredPersons: [
            { name: 'Khaled Ibrahim', type: 'CONTRACTOR', company: 'SafeGuard Services', mobile: '0559876543' }
        ],
        serviceProviderId: ctx.spId,
        severity:       'MINOR',
        violationType:  'NONE',
        controllerNotes:'Contractor hand injury. Minor cut. First aid applied on site.',
        closeNotes:     'First aid administered. Contractor company notified. No further action needed.',
        actionPlanDesc: 'PPE enforcement: All contractors must wear cut-resistant gloves when handling metal.',
    });

    if (result) {
        console.log(`\n  ${PASS} SCENARIO 3 COMPLETE — ${result.ticketNo} CLOSED (${result.elapsed}s)`);
        scenarioResults.push({ name: 'Contractor Injury / No Fine', ticket: result.ticketNo, status: 'PASSED', time: result.elapsed });
    } else {
        scenarioResults.push({ name: 'Contractor Injury / No Fine', ticket: 'N/A', status: 'FAILED', time: '-' });
    }
}

async function scenario4(ctx) {
    console.log(`\n${HEAD}╔══════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${HEAD}║  SCENARIO 4: No Injury — Financial Fine (FINANCIAL)     ║${RESET}`);
    console.log(`${HEAD}╚══════════════════════════════════════════════════════════╝${RESET}`);

    const result = await runFullLifecycle(ctx, {
        description:    'Contractor vehicles parked in restricted area without authorization. Blocking emergency access route.',
        location:       'Emergency Route — East Side',
        hasInjury:      false,
        serviceProviderId: ctx.spId,
        severity:       'MODERATE',
        violationType:  'FINANCIAL',
        violationDescription: 'Unauthorized parking in restricted emergency access zone. Violation of site safety regulations Section 4.2.',
        violationAmount: '10000',
        controllerNotes:'Contractor blocked emergency access route. Financial penalty applicable per contract clause.',
        closeNotes:     'Emergency route cleared. Financial violation recorded. Fine forwarded to finance.',
        actionPlanDesc: 'All contractor vehicles to be parked in designated areas only. Barrier installed at restricted zone entrance.',
    });

    if (result) {
        console.log(`\n  ${PASS} SCENARIO 4 COMPLETE — ${result.ticketNo} CLOSED (${result.elapsed}s)`);
        scenarioResults.push({ name: 'No Injury / Financial Fine', ticket: result.ticketNo, status: 'PASSED', time: result.elapsed });
    } else {
        scenarioResults.push({ name: 'No Injury / Financial Fine', ticket: 'N/A', status: 'FAILED', time: '-' });
    }
}

async function scenario5(ctx) {
    console.log(`\n${HEAD}╔══════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${HEAD}║  SCENARIO 5: Employee Injury + Financial Fine           ║${RESET}`);
    console.log(`${HEAD}╚══════════════════════════════════════════════════════════╝${RESET}`);

    const result = await runFullLifecycle(ctx, {
        description:    'Worker fell from scaffolding (2m height) due to missing guardrails installed by contractor. Sustained back injury.',
        location:       'Building 3 — Level 2 Scaffolding',
        hasInjury:      true,
        injuredPersons: [
            { name: 'Omar Hassan', type: 'EMPLOYEE', dept: 'Civil Works', mobile: '0508765432' }
        ],
        witnesses: [
            { name: 'Fahad Nasser', mobile: '0503456789' },
            { name: 'Saleh Ahmed', mobile: '0501234567' },
        ],
        serviceProviderId: ctx.spId,
        newType:        'NEAR_MISS',
        severity:       'MAJOR',
        violationType:  'FINANCIAL',
        violationDescription: 'Scaffolding erected without guardrails by contractor, causing employee fall injury. Violation of scaffolding safety standards ISO 12811.',
        violationAmount: '25000',
        controllerNotes:'Serious incident — scaffolding missing guardrails. Employee fall with back injury. Contractor responsible.',
        closeNotes:     'Full investigation completed. Contractor fined 25,000 SAR. Scaffolding re-inspected and corrected.',
        actionPlanDesc: 'All scaffolding to be inspected before use. Contractor suspended from scaffolding work pending re-certification.',
    });

    if (result) {
        console.log(`\n  ${PASS} SCENARIO 5 COMPLETE — ${result.ticketNo} CLOSED (${result.elapsed}s)`);
        scenarioResults.push({ name: 'Employee Injury / Financial Fine', ticket: result.ticketNo, status: 'PASSED', time: result.elapsed });
    } else {
        scenarioResults.push({ name: 'Employee Injury / Financial Fine', ticket: 'N/A', status: 'FAILED', time: '-' });
    }
}

// ── Verify Dashboard Stats ──────────────────────────────────────────────────

async function verifyDashboardStats(ctx) {
    console.log(`\n${HEAD}╔══════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${HEAD}║  VERIFY: Dashboard Stats & Ticket List                  ║${RESET}`);
    console.log(`${HEAD}╚══════════════════════════════════════════════════════════╝${RESET}`);

    const controller = api(ctx.tokens.controller);

    await step('Verify ticket list returns stats', async () => {
        const r = await controller.get('/tickets');
        assert(r.status === 200, 'GET /tickets → 200');
        assert(typeof r.data.stats === 'object', 'Response includes stats object');
        assert(typeof r.data.stats.total === 'number', `Total tickets: ${r.data.stats.total}`);
        assert(typeof r.data.stats.closed === 'number', `Closed tickets: ${r.data.stats.closed}`);
        assert(typeof r.data.stats.injuries === 'number', `Injury tickets: ${r.data.stats.injuries}`);
        console.log(`      ${DIM}Stats: total=${r.data.stats.total}, open=${r.data.stats.open}, closed=${r.data.stats.closed}, injuries=${r.data.stats.injuries}${RESET}`);
    });

    await step('Verify analytics endpoint', async () => {
        const r = await controller.get('/analytics');
        assert(r.status === 200, 'GET /analytics → 200');
        console.log(`      ${DIM}Analytics response received successfully${RESET}`);
    });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n${HEAD}╔══════════════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${HEAD}║   HSE PLATFORM — FULL E2E SCENARIO TEST (5 Scenarios)          ║${RESET}`);
    console.log(`${HEAD}╚══════════════════════════════════════════════════════════════════╝${RESET}`);
    console.log(`  Server: ${BASE}`);
    console.log(`  Date:   ${new Date().toISOString()}`);

    try {
        const ctx = await setup();
        await scenario1(ctx);
        await scenario2(ctx);
        await scenario3(ctx);
        await scenario4(ctx);
        await scenario5(ctx);
        await verifyDashboardStats(ctx);
    } catch (err) {
        console.error(`\n\x1b[31m FATAL ERROR: ${err.message}\x1b[0m`);
        console.error(err.stack);
    }

    // ── Summary Table ────────────────────────────────────────────────────
    const total = passed + failed;
    const color = failed === 0 ? '\x1b[32m' : '\x1b[31m';

    console.log(`\n${HEAD}══════════════════════════════════════════════════════════════════${RESET}`);
    console.log(`${HEAD}  SCENARIO RESULTS${RESET}`);
    console.log(`${HEAD}══════════════════════════════════════════════════════════════════${RESET}`);
    console.log(`  ${'#'.padEnd(3)} ${'Scenario'.padEnd(40)} ${'Ticket'.padEnd(18)} ${'Time'.padEnd(6)} Status`);
    console.log(`  ${'─'.repeat(3)} ${'─'.repeat(40)} ${'─'.repeat(18)} ${'─'.repeat(6)} ${'─'.repeat(8)}`);
    scenarioResults.forEach((s, i) => {
        const statusIcon = s.status === 'PASSED' ? PASS : FAIL;
        console.log(`  ${String(i + 1).padEnd(3)} ${s.name.padEnd(40)} ${s.ticket.padEnd(18)} ${(s.time + 's').padEnd(6)} ${statusIcon} ${s.status}`);
    });

    console.log(`\n${HEAD}══════════════════════════════════════════════════════════════════${RESET}`);
    console.log(`${color}  TOTAL: ${passed}/${total} assertions passed, ${failed} failed${RESET}`);
    console.log(`${HEAD}══════════════════════════════════════════════════════════════════${RESET}\n`);

    process.exit(failed > 0 ? 1 : 0);
}

main();
