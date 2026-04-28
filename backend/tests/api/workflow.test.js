/**
 * Comprehensive Ticket Workflow Tests
 * Covers the full lifecycle: SUBMITTED → ASSIGNED → UNDER_REVIEW → CLOSED
 * and all branching paths (return, escalate, RCA, reminder).
 */

// Set env BEFORE any require so jwt.verify uses the same secret as our tokens
process.env.JWT_SECRET = 'test-workflow-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt = require('jsonwebtoken');

// ── Mocks (hoisted by Jest) ─────────────────────────────────────────────────

jest.mock('../../prismaClient', () => ({
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    ticket: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
    },
    offCircuitReport: {
        update: jest.fn(),
        create: jest.fn(),
    },
    activityLog: {
        create: jest.fn(),
    },
    notification: {
        create: jest.fn(),
    },
    reminder: {
        create: jest.fn(),
    },
}));

jest.mock('../../utils/emailService', () => ({
    sendOTP: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../controllers/notificationController', () => ({
    createNotification: jest.fn().mockResolvedValue(true),
    getNotifications: jest.fn((req, res) => res.json([])),
    markAsRead: jest.fn((req, res) => res.json({ message: 'ok' })),
    markAllAsRead: jest.fn((req, res) => res.json({ message: 'ok' })),
}));

// ── Load app AFTER mocks are set up ────────────────────────────────────────
const app = require('../../server');
const prisma = require('../../prismaClient');

// ── User Fixtures ───────────────────────────────────────────────────────────

const REPORTER = {
    id: 'u-reporter',
    name: 'Ahmed Reporter',
    email: 'reporter@test.com',
    role: 'OC_REPORTER',
    status: 'ACTIVE',
    isIntakeEnabled: false,
    mobile: null,
    userGroup: 'OFF_CIRCUIT',
    canCloseTickets: false,
    canPerformRCA: false,
    serviceProviderId: null,
    repDepartmentId: null,
};

const CONTROLLER = {
    id: 'u-controller',
    name: 'Sara Controller',
    email: 'controller@test.com',
    role: 'HSE_CONTROLLER',
    status: 'ACTIVE',
    isIntakeEnabled: false,
    mobile: null,
    userGroup: 'OFF_CIRCUIT',
    canCloseTickets: false,  // role grants close/RCA rights, not the flag
    canPerformRCA: false,    // role grants close/RCA rights, not the flag
    serviceProviderId: null,
    repDepartmentId: null,
};

const DEP_REP = {
    id: 'u-dep-rep',
    name: 'Omar Rep',
    email: 'rep@test.com',
    role: 'DEP_REP',
    status: 'ACTIVE',
    isIntakeEnabled: false,
    mobile: null,
    userGroup: 'OFF_CIRCUIT',
    canCloseTickets: false,
    canPerformRCA: false,
    serviceProviderId: null,
    repDepartmentId: 'dept-1',
};

const SAFETY_MGR = {
    id: 'u-safety',
    name: 'Khalid Safety',
    email: 'safety@test.com',
    role: 'SAFETY_MANAGER',
    status: 'ACTIVE',
    isIntakeEnabled: false,
    mobile: null,
    userGroup: 'OFF_CIRCUIT',
    canCloseTickets: true,
    canPerformRCA: true,
    serviceProviderId: null,
    repDepartmentId: null,
};

// Map user id → user object for auth middleware mock
const USER_MAP = {
    [REPORTER.id]:    REPORTER,
    [CONTROLLER.id]:  CONTROLLER,
    [DEP_REP.id]:     DEP_REP,
    [SAFETY_MGR.id]:  SAFETY_MGR,
};

// ── Token Helpers ───────────────────────────────────────────────────────────

const token = (user) => `Bearer ${jwt.sign({ id: user.id }, process.env.JWT_SECRET)}`;

// ── Ticket Fixture ──────────────────────────────────────────────────────────

const baseTicket = (overrides = {}) => ({
    id: 'ticket-1',
    ticketNo: 'INC-2026-00001',
    type: 'OBSERVATION',
    status: 'SUBMITTED',
    hasInjury: false,
    createdById: REPORTER.id,
    assignedToId: null,
    departmentId: null,
    offCircuitReport: {
        id: 'ocr-1',
        ticketId: 'ticket-1',
        severity: null,
        rcaRequired: false,
        rcaCompleted: false,
        injuredPersons: null,
    },
    activityLogs: [],
    ...overrides,
});

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();

    // Auth middleware: resolve user from decoded JWT id
    prisma.user.findUnique.mockImplementation(({ where }) =>
        Promise.resolve(USER_MAP[where.id] || null)
    );

    // Default silent returns for writes
    prisma.ticket.update.mockResolvedValue({});
    prisma.offCircuitReport.update.mockResolvedValue({});
    prisma.activityLog.create.mockResolvedValue({});
    prisma.reminder.create.mockResolvedValue({});
    prisma.user.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. CREATE TICKET  (POST /api/tickets)
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/tickets — Create Ticket', () => {
    const validBody = {
        incidentType: 'OBSERVATION',
        incidentDate: '2026-04-26',
        incidentTime: '08:00',
        whatHappened: 'Slippery floor near entrance',
        locationAddress: 'Gate A',
        hasInjury: false,
    };

    it('creates a ticket and returns 201 for a reporter', async () => {
        prisma.ticket.count.mockResolvedValue(5);
        prisma.ticket.findUnique
            .mockResolvedValueOnce(USER_MAP[REPORTER.id]) // auth middleware
            .mockResolvedValueOnce(null);                  // ticketNo uniqueness check
        prisma.ticket.create.mockResolvedValue({ ...baseTicket(), ticketNo: 'INC-2026-00006' });

        const res = await request(app)
            .post('/api/tickets')
            .set('Authorization', token(REPORTER))
            .send(validBody);

        expect(res.status).toBe(201);
        expect(prisma.ticket.create).toHaveBeenCalledTimes(1);
    });

    it('returns 403 when a controller tries to create a ticket', async () => {
        const res = await request(app)
            .post('/api/tickets')
            .set('Authorization', token(CONTROLLER))
            .send(validBody);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/Only reporters/);
    });

    it('returns 401 when no token is provided', async () => {
        const res = await request(app).post('/api/tickets').send(validBody);
        expect(res.status).toBe(401);
    });

    it('returns 400 when incidentType is missing', async () => {
        const { incidentType, ...body } = validBody;
        const res = await request(app)
            .post('/api/tickets')
            .set('Authorization', token(REPORTER))
            .send(body);
        expect(res.status).toBe(400);
    });

    it('returns 400 when incidentType is invalid', async () => {
        const res = await request(app)
            .post('/api/tickets')
            .set('Authorization', token(REPORTER))
            .send({ ...validBody, incidentType: 'FIRE' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when description (whatHappened) is missing', async () => {
        const { whatHappened, ...body } = validBody;
        const res = await request(app)
            .post('/api/tickets')
            .set('Authorization', token(REPORTER))
            .send(body);
        expect(res.status).toBe(400);
    });

    it('returns 400 when late report is submitted without a reason', async () => {
        const lateBody = {
            ...validBody,
            incidentDate: '2026-01-01',
            incidentTime: '08:00',
            // No lateReportReason
        };
        const res = await request(app)
            .post('/api/tickets')
            .set('Authorization', token(REPORTER))
            .send(lateBody);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Late report reason/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. CONTROLLER ACTION  (PUT /api/tickets/:id/controller-action)
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/tickets/:id/controller-action — Controller Action', () => {
    beforeEach(() => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(baseTicket());
            return Promise.resolve(USER_MAP[where.id] || null);
        });
    });

    // ── RETURN_REPORTER ──────────────────────────────────────────────────
    describe('action: RETURN_REPORTER', () => {
        it('returns 200 and updates status to RETURNED_TO_REPORTER', async () => {
            const res = await request(app)
                .put('/api/tickets/ticket-1/controller-action')
                .set('Authorization', token(CONTROLLER))
                .send({ action: 'RETURN_REPORTER', notes: 'Missing details' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('RETURNED_TO_REPORTER');
            expect(prisma.ticket.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'ticket-1' } })
            );
        });

        it('returns 400 when notes are missing', async () => {
            const res = await request(app)
                .put('/api/tickets/ticket-1/controller-action')
                .set('Authorization', token(CONTROLLER))
                .send({ action: 'RETURN_REPORTER' });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Notes required/i);
        });
    });

    // ── ASSIGN ───────────────────────────────────────────────────────────
    describe('action: ASSIGN', () => {
        it('assigns ticket with MAJOR severity and sets rcaRequired=true', async () => {
            const res = await request(app)
                .put('/api/tickets/ticket-1/controller-action')
                .set('Authorization', token(CONTROLLER))
                .send({ action: 'ASSIGN', severity: 'MAJOR', targetDepartmentId: 'dept-1', notes: 'Critical incident' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ASSIGNED');

            // Verify offCircuitReport updated with rcaRequired=true
            expect(prisma.offCircuitReport.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ rcaRequired: true }),
                })
            );
        });

        it('assigns ticket with MINOR severity and sets rcaRequired=false', async () => {
            const res = await request(app)
                .put('/api/tickets/ticket-1/controller-action')
                .set('Authorization', token(CONTROLLER))
                .send({ action: 'ASSIGN', severity: 'MINOR', targetDepartmentId: 'dept-1' });

            expect(res.status).toBe(200);
            expect(prisma.offCircuitReport.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ rcaRequired: false }),
                })
            );
        });

        it('returns 400 when severity is missing', async () => {
            const res = await request(app)
                .put('/api/tickets/ticket-1/controller-action')
                .set('Authorization', token(CONTROLLER))
                .send({ action: 'ASSIGN', targetDepartmentId: 'dept-1' });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Severity required/i);
        });

        it('returns 400 when targetDepartmentId is missing', async () => {
            const res = await request(app)
                .put('/api/tickets/ticket-1/controller-action')
                .set('Authorization', token(CONTROLLER))
                .send({ action: 'ASSIGN', severity: 'MAJOR' });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Department required/i);
        });

        it('sets rcaRequired=true for ACCIDENT tickets even with MINOR severity', async () => {
            prisma.ticket.findUnique.mockImplementation(({ where }) => {
                if (where.id === 'ticket-1') return Promise.resolve(baseTicket({ type: 'ACCIDENT' }));
                return Promise.resolve(USER_MAP[where.id] || null);
            });

            const res = await request(app)
                .put('/api/tickets/ticket-1/controller-action')
                .set('Authorization', token(CONTROLLER))
                .send({ action: 'ASSIGN', severity: 'MINOR', targetDepartmentId: 'dept-1' });

            expect(res.status).toBe(200);
            expect(prisma.offCircuitReport.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ rcaRequired: true }),
                })
            );
        });
    });

    // ── Auth & 404 ───────────────────────────────────────────────────────
    it('returns 403 when a reporter tries to perform controller action', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-action')
            .set('Authorization', token(REPORTER))
            .send({ action: 'ASSIGN', severity: 'MINOR', targetDepartmentId: 'dept-1' });
        expect(res.status).toBe(403);
    });

    it('returns 404 when ticket does not exist', async () => {
        prisma.ticket.findUnique.mockImplementation(({ where }) =>
            where.id === 'ticket-1'
                ? Promise.resolve(null)
                : Promise.resolve(USER_MAP[where.id] || null)
        );
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-action')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'ASSIGN', severity: 'MINOR', targetDepartmentId: 'dept-1' });
        expect(res.status).toBe(404);
    });

    it('returns 400 for an unknown action', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-action')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'YEET' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Invalid action/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. REPORTER REPLY  (PUT /api/tickets/:id/reporter-reply)
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/tickets/:id/reporter-reply — Reporter Reply', () => {
    const returnedTicket = baseTicket({ status: 'RETURNED_TO_REPORTER' });

    beforeEach(() => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(returnedTicket);
            return Promise.resolve(USER_MAP[where.id] || null);
        });
        prisma.ticket.update.mockResolvedValue({ ...returnedTicket, status: 'SUBMITTED' });
    });

    it('resubmits the ticket and returns the updated ticket', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/reporter-reply')
            .set('Authorization', token(REPORTER))
            .send({ replyText: 'Added more details about the incident.' });

        expect(res.status).toBe(200);
        expect(prisma.activityLog.create).toHaveBeenCalled();
        expect(prisma.ticket.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { status: 'SUBMITTED' } })
        );
    });

    it('returns 400 when ticket is not in RETURNED_TO_REPORTER state', async () => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(baseTicket({ status: 'SUBMITTED' }));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/reporter-reply')
            .set('Authorization', token(REPORTER))
            .send({ replyText: 'Some reply' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/not in returned state/i);
    });

    it('returns 403 when a different reporter tries to reply', async () => {
        // Create a second reporter with a different id
        const otherReporter = { ...REPORTER, id: 'u-other-reporter' };
        prisma.user.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'u-other-reporter') return Promise.resolve(otherReporter);
            if (where.id === 'ticket-1') return Promise.resolve(returnedTicket);
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const otherToken = `Bearer ${jwt.sign({ id: 'u-other-reporter' }, process.env.JWT_SECRET)}`;
        const res = await request(app)
            .put('/api/tickets/ticket-1/reporter-reply')
            .set('Authorization', otherToken)
            .send({ replyText: 'Trying to interfere' });

        expect(res.status).toBe(403);
    });

    it('returns 400 when replyText is empty', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/reporter-reply')
            .set('Authorization', token(REPORTER))
            .send({ replyText: '   ' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Reply text required/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. DEPARTMENT ACTION  (PUT /api/tickets/:id/department-action)
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/tickets/:id/department-action — Department Action', () => {
    const assignedTicket = baseTicket({
        status: 'ASSIGNED',
        departmentId: 'dept-1',
        assignedToId: DEP_REP.id,
    });

    beforeEach(() => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(assignedTicket);
            return Promise.resolve(USER_MAP[where.id] || null);
        });
    });

    it('submits department response for a no-injury ticket → UNDER_REVIEW', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/department-action')
            .set('Authorization', token(DEP_REP))
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UNDER_REVIEW');
        expect(prisma.ticket.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: 'UNDER_REVIEW' }) })
        );
    });

    it('submits department response for employee injury with GOSI submitted', async () => {
        const injuryTicket = baseTicket({
            status: 'ASSIGNED',
            departmentId: 'dept-1',
            hasInjury: true,
            offCircuitReport: {
                ...baseTicket().offCircuitReport,
                hasInjury: true,
                injuredPersons: JSON.stringify([{ name: 'Ali', type: 'EMPLOYEE', dept: 'Ops' }]),
            },
        });

        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(injuryTicket);
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/department-action')
            .set('Authorization', token(DEP_REP))
            .send({ gosiSubmitted: true, gosiReportDate: '2026-04-20', gosiReportNumber: 'GOSI-001' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UNDER_REVIEW');
    });

    it('returns 400 for employee injury when GOSI status is not provided', async () => {
        const injuryTicket = baseTicket({
            status: 'ASSIGNED',
            departmentId: 'dept-1',
            hasInjury: true,
            offCircuitReport: {
                ...baseTicket().offCircuitReport,
                hasInjury: true,
                injuredPersons: JSON.stringify([{ type: 'EMPLOYEE' }]),
            },
        });

        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(injuryTicket);
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/department-action')
            .set('Authorization', token(DEP_REP))
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/GOSI submission status required/i);
    });

    it('returns 400 when ticket status is not ASSIGNED or RETURNED_TO_DEPARTMENT', async () => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(baseTicket({ status: 'SUBMITTED' }));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/department-action')
            .set('Authorization', token(DEP_REP))
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/not in assignable state/i);
    });

    it('returns 403 (IDOR) when DEP_REP is from a different department', async () => {
        const otherDeptTicket = baseTicket({
            status: 'ASSIGNED',
            departmentId: 'dept-99',    // different department
            assignedToId: null,
        });

        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(otherDeptTicket);
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/department-action')
            .set('Authorization', token(DEP_REP))  // DEP_REP is in dept-1
            .send({});

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/Not your department/i);
    });

    it('returns 403 when a reporter tries to submit department action', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/department-action')
            .set('Authorization', token(REPORTER))
            .send({});
        expect(res.status).toBe(403);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. CONTROLLER FINAL REVIEW  (PUT /api/tickets/:id/controller-review)
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/tickets/:id/controller-review — Controller Final Review', () => {
    const underReviewTicket = baseTicket({
        status: 'UNDER_REVIEW',
        offCircuitReport: {
            ...baseTicket().offCircuitReport,
            rcaRequired: false,
            rcaCompleted: false,
        },
        actionPlans: [],
    });

    beforeEach(() => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(underReviewTicket);
            return Promise.resolve(USER_MAP[where.id] || null);
        });
    });

    it('RETURN_DEPARTMENT: returns ticket to department with notes', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'RETURN_DEPARTMENT', notes: 'Action plan incomplete' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('RETURNED_TO_DEPARTMENT');
    });

    it('RETURN_DEPARTMENT: returns 400 when notes are missing', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'RETURN_DEPARTMENT' });
        expect(res.status).toBe(400);
    });

    it('SET_REMINDER: sets a reminder and moves to PENDING_REMINDER', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'SET_REMINDER', reminderDate: '2026-05-01', reminderMessage: 'Follow up with dept' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('PENDING_REMINDER');
        expect(prisma.reminder.create).toHaveBeenCalledTimes(1);
    });

    it('SET_REMINDER: returns 400 when reminderDate or message is missing', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'SET_REMINDER', reminderMessage: 'Follow up' }); // no date
        expect(res.status).toBe(400);
    });

    it('ESCALATE: escalates ticket to Safety Manager', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'ESCALATE', notes: 'Needs senior oversight' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ESCALATED');
        expect(prisma.ticket.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'ESCALATED', escalatedToRole: 'SAFETY_MANAGER' }),
            })
        );
    });

    it('PROCEED_RCA: moves to UNDER_INVESTIGATION when RCA is required', async () => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(baseTicket({
                status: 'UNDER_REVIEW',
                offCircuitReport: { ...baseTicket().offCircuitReport, rcaRequired: true },
                actionPlans: [],
            }));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'PROCEED_RCA' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UNDER_INVESTIGATION');
    });

    it('PROCEED_RCA: returns 400 when RCA is not required', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'PROCEED_RCA' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/RCA not required/i);
    });

    it('CLOSE: closes ticket when no RCA is required', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'CLOSE', notes: 'All clear' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('CLOSED');
    });

    it('CLOSE: returns 400 when RCA is required but not completed', async () => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(baseTicket({
                status: 'UNDER_REVIEW',
                offCircuitReport: { ...baseTicket().offCircuitReport, rcaRequired: true, rcaCompleted: false },
                actionPlans: [],
            }));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'CLOSE' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/RCA required but not completed/i);
    });

    it('returns 400 when ticket is not UNDER_REVIEW', async () => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(baseTicket({ status: 'ASSIGNED' }));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'CLOSE' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/not under review/i);
    });

    it('returns 403 for a DEP_REP', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(DEP_REP))
            .send({ action: 'CLOSE' });
        expect(res.status).toBe(403);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. SUBMIT RCA  (PUT /api/tickets/:id/rca)
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/tickets/:id/rca — Submit RCA', () => {
    const investigationTicket = baseTicket({
        status: 'UNDER_INVESTIGATION',
        offCircuitReport: { ...baseTicket().offCircuitReport, rcaRequired: true, rcaCompleted: false },
    });

    const validRCA = {
        rcaCause: 'Wet floor due to cleaning without warning signs',
        rcaWhy: 'No protocol for wet floor signs; cleaning staff untrained',
        rcaPreventable: true,
        rcaRootCause: 'Lack of safety awareness training',
        rcaCategory: 'HUMAN_FACTOR',
    };

    beforeEach(() => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(investigationTicket);
            return Promise.resolve(USER_MAP[where.id] || null);
        });
    });

    it('submits RCA and moves ticket to UNDER_REVIEW', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/rca')
            .set('Authorization', token(CONTROLLER))
            .send(validRCA);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UNDER_REVIEW');
        expect(prisma.offCircuitReport.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ rcaCompleted: true }),
            })
        );
    });

    it('returns 400 when required RCA fields are missing', async () => {
        const { rcaRootCause, ...partial } = validRCA;
        const res = await request(app)
            .put('/api/tickets/ticket-1/rca')
            .set('Authorization', token(CONTROLLER))
            .send(partial);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/All RCA fields required/i);
    });

    it('returns 400 when ticket is not UNDER_INVESTIGATION', async () => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(baseTicket({ status: 'UNDER_REVIEW' }));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/rca')
            .set('Authorization', token(CONTROLLER))
            .send(validRCA);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/not under investigation/i);
    });

    it('returns 403 when a DEP_REP without canPerformRCA tries to submit RCA', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/rca')
            .set('Authorization', token(DEP_REP))
            .send(validRCA);
        expect(res.status).toBe(403);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. SAFETY MANAGER ACTION  (PUT /api/tickets/:id/safety-manager)
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/tickets/:id/safety-manager — Safety Manager Action', () => {
    const escalatedTicket = baseTicket({
        status: 'ESCALATED',
        offCircuitReport: { ...baseTicket().offCircuitReport, rcaRequired: false, rcaCompleted: false },
    });

    beforeEach(() => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(escalatedTicket);
            return Promise.resolve(USER_MAP[where.id] || null);
        });
    });

    it('CLOSE: closes the escalated ticket', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/safety-manager')
            .set('Authorization', token(SAFETY_MGR))
            .send({ action: 'CLOSE', notes: 'Issue resolved at management level' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('CLOSED');
        expect(prisma.offCircuitReport.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ finalDecision: 'CLOSE' }),
            })
        );
    });

    it('CLOSE: Safety Manager can close even when RCA required but not completed (override authority)', async () => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(baseTicket({
                status: 'ESCALATED',
                offCircuitReport: { ...baseTicket().offCircuitReport, rcaRequired: true, rcaCompleted: false },
            }));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/safety-manager')
            .set('Authorization', token(SAFETY_MGR))
            .send({ action: 'CLOSE', notes: 'Closing with RCA waiver — safety manager override' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('CLOSED');
    });

    it('RETURN: returns ticket to department from escalation', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/safety-manager')
            .set('Authorization', token(SAFETY_MGR))
            .send({ action: 'RETURN', notes: 'Department needs to revisit action plan' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('RETURNED_TO_DEPARTMENT');
    });

    it('SEND_TO_DEP_MANAGER: assigns ticket to a department manager', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/safety-manager')
            .set('Authorization', token(SAFETY_MGR))
            .send({ action: 'SEND_TO_DEP_MANAGER', targetDepManagerId: 'u-dep-manager', notes: 'Review required' });

        expect(res.status).toBe(200);
        expect(prisma.ticket.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ assignedToId: 'u-dep-manager' }),
            })
        );
    });

    it('SEND_TO_DEP_MANAGER: returns 400 when targetDepManagerId is missing', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/safety-manager')
            .set('Authorization', token(SAFETY_MGR))
            .send({ action: 'SEND_TO_DEP_MANAGER' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Department Manager ID required/i);
    });

    it('TRANSFER: transfers ticket to another user', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/safety-manager')
            .set('Authorization', token(SAFETY_MGR))
            .send({ action: 'TRANSFER', transferToId: 'u-other', notes: 'Reassigned' });

        expect(res.status).toBe(200);
        expect(prisma.ticket.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ assignedToId: 'u-other' }),
            })
        );
    });

    it('TRANSFER: returns 400 when transferToId is missing', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/safety-manager')
            .set('Authorization', token(SAFETY_MGR))
            .send({ action: 'TRANSFER' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Transfer target required/i);
    });

    it('returns 400 when ticket status is not ESCALATED', async () => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(baseTicket({ status: 'UNDER_REVIEW' }));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/safety-manager')
            .set('Authorization', token(SAFETY_MGR))
            .send({ action: 'CLOSE' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/not escalated/i);
    });

    it('returns 403 when a controller tries to use safety manager endpoint', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/safety-manager')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'CLOSE' });
        expect(res.status).toBe(403);
    });

    it('returns 400 for an unknown action', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/safety-manager')
            .set('Authorization', token(SAFETY_MGR))
            .send({ action: 'UNKNOWN' });
        expect(res.status).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. FULL END-TO-END WORKFLOW  (happy path)
// ═══════════════════════════════════════════════════════════════════════════

describe('Full Workflow — Happy Path (OBSERVATION → MINOR → CLOSED)', () => {
    let currentTicketStatus = 'SUBMITTED';

    const getTicket = (overrides = {}) => baseTicket({
        status: currentTicketStatus,
        offCircuitReport: { ...baseTicket().offCircuitReport, ...overrides.offCircuitReport },
        actionPlans: [],
        ...overrides,
    });

    beforeEach(() => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(getTicket());
            return Promise.resolve(USER_MAP[where.id] || null);
        });
        prisma.ticket.update.mockResolvedValue({});
    });

    it('Step 1 — Reporter creates ticket (SUBMITTED)', async () => {
        prisma.ticket.count.mockResolvedValue(0);
        prisma.ticket.findUnique
            .mockResolvedValueOnce(USER_MAP[REPORTER.id]) // auth
            .mockResolvedValueOnce(null);                  // ticketNo uniqueness
        prisma.ticket.create.mockResolvedValue(baseTicket());

        const res = await request(app)
            .post('/api/tickets')
            .set('Authorization', token(REPORTER))
            .send({
                incidentType: 'OBSERVATION',
                incidentDate: '2026-04-26',
                incidentTime: '09:00',
                whatHappened: 'Loose cable near workstation',
                locationAddress: 'Office Block B',
            });

        expect(res.status).toBe(201);
        currentTicketStatus = 'SUBMITTED';
    });

    it('Step 2 — Controller assigns ticket with MINOR severity (ASSIGNED)', async () => {
        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-action')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'ASSIGN', severity: 'MINOR', targetDepartmentId: 'dept-1' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ASSIGNED');
        currentTicketStatus = 'ASSIGNED';
    });

    it('Step 3 — Department rep submits response (UNDER_REVIEW)', async () => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(getTicket({ status: 'ASSIGNED', departmentId: 'dept-1' }));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/department-action')
            .set('Authorization', token(DEP_REP))
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UNDER_REVIEW');
        currentTicketStatus = 'UNDER_REVIEW';
    });

    it('Step 4 — Controller closes ticket (CLOSED)', async () => {
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(getTicket({
                status: 'UNDER_REVIEW',
                offCircuitReport: { ...baseTicket().offCircuitReport, rcaRequired: false },
                actionPlans: [],
            }));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        const res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'CLOSE', notes: 'All clear. Hazard removed.' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('CLOSED');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. RCA PATH  (MAJOR incident requires RCA before closing)
// ═══════════════════════════════════════════════════════════════════════════

describe('Full Workflow — RCA Path (ACCIDENT → MAJOR → RCA → CLOSED)', () => {
    it('completes full RCA cycle: ASSIGNED → UNDER_INVESTIGATION → UNDER_REVIEW → CLOSED', async () => {
        const rcaTicket = (status, extraOverrides = {}, rcaRequired = true, rcaCompleted = false) => baseTicket({
            status,
            type: 'ACCIDENT',
            offCircuitReport: { ...baseTicket().offCircuitReport, rcaRequired, rcaCompleted },
            actionPlans: [],
            ...extraOverrides,
        });

        // 1. Controller assigns → ASSIGNED
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(rcaTicket('SUBMITTED'));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        let res = await request(app)
            .put('/api/tickets/ticket-1/controller-action')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'ASSIGN', severity: 'MAJOR', targetDepartmentId: 'dept-1' });
        expect(res.status).toBe(200);

        // 2. Dept responds → UNDER_REVIEW (departmentId must match DEP_REP's repDepartmentId)
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(rcaTicket('ASSIGNED', { departmentId: 'dept-1' }));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        res = await request(app)
            .put('/api/tickets/ticket-1/department-action')
            .set('Authorization', token(DEP_REP))
            .send({});
        expect(res.status).toBe(200);

        // 3. Controller proceeds to RCA → UNDER_INVESTIGATION
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(rcaTicket('UNDER_REVIEW'));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'PROCEED_RCA' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UNDER_INVESTIGATION');

        // 4. RCA submitted → back to UNDER_REVIEW
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(rcaTicket('UNDER_INVESTIGATION'));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        res = await request(app)
            .put('/api/tickets/ticket-1/rca')
            .set('Authorization', token(CONTROLLER))
            .send({
                rcaCause: 'Equipment failure',
                rcaWhy: 'Maintenance was skipped',
                rcaRootCause: 'No maintenance schedule',
                rcaCategory: 'PROCESS_FAILURE',
            });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UNDER_REVIEW');

        // 5. Controller closes after RCA completed → CLOSED
        prisma.ticket.findUnique.mockImplementation(({ where }) => {
            if (where.id === 'ticket-1') return Promise.resolve(rcaTicket('UNDER_REVIEW', {}, true, true));
            return Promise.resolve(USER_MAP[where.id] || null);
        });

        res = await request(app)
            .put('/api/tickets/ticket-1/controller-review')
            .set('Authorization', token(CONTROLLER))
            .send({ action: 'CLOSE', notes: 'RCA complete. Corrective actions verified.' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('CLOSED');
    });
});
