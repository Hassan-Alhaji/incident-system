const prisma = require('../prismaClient');
const crypto = require('crypto');
const { createNotification, createNotificationsBulk } = require('./notificationController');
const logger = require('../lib/logger').child({ module: 'ticketCrud' });
const { verifyMagicBytes } = require('../middleware/uploadMiddleware');

// B3: In production, never leak internal error messages to the client
const isProd = process.env.NODE_ENV === 'production';
const safeError = (err, fallback = 'An unexpected error occurred. Please try again.') => isProd ? fallback : (err.message || fallback);

const ROLES = {
    REPORTER: ['OC_REPORTER'],
    CONTROLLER: ['HSE_CONTROLLER'],
    DEP_REP: ['DEP_REP'],
    DEP_MANAGER: ['DEP_MANAGER'],
    SAFETY_MANAGER: ['SAFETY_MANAGER', 'OC_HSE_MANAGER'],
    HR: ['HR_REP'],
    FINANCE: ['FINANCE_REP'],
    ALL: ['OC_REPORTER','HSE_CONTROLLER','DEP_REP','DEP_MANAGER','SAFETY_MANAGER','OC_HSE_MANAGER','HR_REP','SERVICE_PROVIDER_REP','FINANCE_REP','ADMIN']
};

const ADMIN_ROLES = ['ADMIN', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'HSE_CONTROLLER'];

// ===== SECURITY: Whitelist-based response sanitizer =====
// Any field NOT listed here is automatically hidden from reporters.
// This ensures new schema fields are secure-by-default.
const REPORTER_ALLOWED_TICKET = new Set([
    'id', 'ticketNo', 'status', 'type', 'priority',
    'description', 'location', 'hasInjury',
    'incidentDate', 'incidentTime',
    'createdAt', 'updatedAt', 'createdById',
    'createdBy', 'zone', 'event', 'attachments',
    'offCircuitReport', '_count'
]);
const REPORTER_ALLOWED_OC = new Set([
    'id', 'ticketId',
    'incidentType', 'incidentDate', 'incidentTime',
    'locationLat', 'locationLng', 'locationAddress', 'locationDescription',
    'whatHappened', 'hasInjury',
    'isLateReport', 'lateReportReason',
    'injuredPersons', 'witnesses',
    'reporterFilledBy', 'reporterFilledAt',
    'createdAt', 'updatedAt'
]);
const REPORTER_ALLOWED_PERSON = new Set([
    'name', 'type', 'affiliate', 'mobile', 'company', 'dept'
]);

function sanitizeForReporter(ticket) {
    if (!ticket) return ticket;
    const safe = {};
    for (const key of REPORTER_ALLOWED_TICKET) {
        if (ticket[key] !== undefined) safe[key] = ticket[key];
    }
    // Filter attachments: reporter sees only their own uploads.
    if (ticket.attachments && ticket.createdById) {
        safe.attachments = ticket.attachments.filter(att =>
            att.uploadedById === ticket.createdById
        ).map(({ data, ...meta }) => meta); // strip binary data
    }
    // Rebuild _count so reporter only sees counts they're entitled to.
    // List endpoints use prisma _count which sums ALL rows; we cannot accurately
    // count their attachments without a separate query, so we drop the inaccurate
    // total to avoid confusion with the filtered detail view.
    // actionPlans/reminders existence is itself confidential — never expose.
    if (ticket._count) {
        safe._count = {}; // intentionally empty: dashboard chips fall back to 0
    }
    if (ticket.offCircuitReport) {
        const oc = {};
        for (const key of REPORTER_ALLOWED_OC) {
            if (ticket.offCircuitReport[key] !== undefined) oc[key] = ticket.offCircuitReport[key];
        }
        // Strip GOSI/HR data from injuredPersons — keep only reporter-submitted fields
        if (oc.injuredPersons) {
            try {
                const persons = typeof oc.injuredPersons === 'string' ? JSON.parse(oc.injuredPersons) : oc.injuredPersons;
                oc.injuredPersons = JSON.stringify(
                    persons.map(p => {
                        const clean = {};
                        for (const k of REPORTER_ALLOWED_PERSON) { if (p[k] !== undefined) clean[k] = p[k]; }
                        return clean;
                    })
                );
            } catch { /* keep as-is if parse fails */ }
        }
        safe.offCircuitReport = oc;
    }
    return safe;
}

// Finance sees ONLY violation details + vendor identity + responsible department — nothing else
const FINANCE_ALLOWED_TICKET = new Set([
    'id', 'ticketNo', 'status', 'type',
    'hasFinancialViolation', 'violationAmount', 'violationDescription',
    'forwardedToFinance', 'closedBy', 'closedAt', 'createdAt'
]);

function sanitizeForFinance(ticket) {
    if (!ticket) return ticket;
    const safe = {};
    for (const key of FINANCE_ALLOWED_TICKET) {
        if (ticket[key] !== undefined) safe[key] = ticket[key];
    }
    // Service Provider (violator) full details
    if (ticket.serviceProvider) {
        safe.serviceProvider = {
            name: ticket.serviceProvider.name,
            nameAr: ticket.serviceProvider.nameAr,
            commercialRegistrationNumber: ticket.serviceProvider.commercialRegistrationNumber,
            representativeName: ticket.serviceProvider.representativeName || null,
            representativeMobile: ticket.serviceProvider.representativeMobile || null,
            representativeEmail: ticket.serviceProvider.representativeEmail || null,
        };
        // Responsible department for the service provider
        if (ticket.serviceProvider.department) {
            safe.serviceProvider.department = {
                name: ticket.serviceProvider.department.name,
                nameAr: ticket.serviceProvider.department.nameAr,
            };
        }
    }
    // Ticket's assigned department (responsible department)
    if (ticket.department) {
        safe.department = {
            name: ticket.department.name,
            nameAr: ticket.department.nameAr,
        };
    }
    return safe;
}

// ===== CREATE TICKET =====
const createTicket = async (req, res) => {
    try {
        const userRole = req.user.role;
        if (!ROLES.REPORTER.includes(userRole) && userRole !== 'ADMIN') {
            return res.status(403).json({ message: 'Only reporters can create tickets' });
        }
        const { incidentType, incidentDate, incidentTime, locationLat, locationLng, locationAddress, locationDescription, whatHappened, hasInjury, injuredPersons, witnesses, lateReportReason, serviceProviderId, zoneId, eventId, departmentId, reporterDepartmentId, detectionSource } = req.body;

        if (!incidentType || !['OBSERVATION'].includes(incidentType)) {
            return res.status(400).json({ message: 'Valid incident type required (OBSERVATION)' });
        }
        if (!incidentDate || !incidentTime) return res.status(400).json({ message: 'Date and time required' });
        if (!whatHappened) return res.status(400).json({ message: 'Description required' });

        // H4: Late report check
        // Append Saudi Arabia timezone offset (+03:00) so the server correctly
        // interprets local time sent by the browser without a timezone suffix.
        const timeStr = incidentTime.length === 5 ? `${incidentTime}:00` : incidentTime; // ensure HH:MM:SS
        const reportDateTime = new Date(`${incidentDate}T${timeStr}+03:00`);
        if (isNaN(reportDateTime.getTime())) {
            return res.status(400).json({ message: 'Invalid incident date or time' });
        }
        // C1: Reject future-dated incidents from the server side (5 min tolerance for clock skew)
        if (reportDateTime.getTime() > Date.now() + 5 * 60 * 1000) {
            return res.status(400).json({ message: 'Incident date cannot be in the future.' });
        }
        const hoursDiff = (Date.now() - reportDateTime.getTime()) / (1000*60*60);
        const isLate = hoursDiff > 24;
        if (isLate && !lateReportReason) {
            return res.status(400).json({ message: 'Late report reason required (>24h)' });
        }

        // H5: Pre-validate FKs to return clean 400 instead of Prisma P2003 → 500
        const fkChecks = [];
        if (departmentId) fkChecks.push(prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } }).then(r => ({ name: 'department', found: !!r })));
        if (zoneId) fkChecks.push(prisma.zone.findUnique({ where: { id: zoneId }, select: { id: true } }).then(r => ({ name: 'zone', found: !!r })));
        if (eventId) fkChecks.push(prisma.event.findUnique({ where: { id: eventId }, select: { id: true } }).then(r => ({ name: 'event', found: !!r })));
        if (serviceProviderId && serviceProviderId !== 'OTHER') fkChecks.push(prisma.serviceProvider.findUnique({ where: { id: serviceProviderId }, select: { id: true } }).then(r => ({ name: 'serviceProvider', found: !!r })));
        if (fkChecks.length) {
            const results = await Promise.all(fkChecks);
            const missing = results.find(r => !r.found);
            if (missing) return res.status(400).json({ message: `Invalid ${missing.name} reference` });
        }

        // Generate ticket number using database sequence to prevent race conditions
        const currentYear = new Date().getFullYear();
        // A5: Validate year is a safe 4-digit integer before using in raw SQL
        if (!Number.isInteger(currentYear) || currentYear < 2020 || currentYear > 2099) {
            return res.status(500).json({ message: 'Server date error. Please contact support.' });
        }
        let ticket = null;
        let retries = 0;
        let seqNum;

        try {
            await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "ticket_seq_${currentYear}" START WITH 1`);
            
            // Sync sequence with existing records (seed, migrations, etc.) to prevent duplicate key collisions
            const maxTicket = await prisma.ticket.findFirst({
                where: { ticketNo: { startsWith: `INC-${currentYear}-` } },
                orderBy: { ticketNo: 'desc' },
                select: { ticketNo: true }
            });
            if (maxTicket) {
                const maxNum = parseInt(maxTicket.ticketNo.split('-')[2], 10);
                if (!isNaN(maxNum)) {
                    // Check if current value is less than maxNum, adjust if needed
                    const [{ currval }] = await prisma.$queryRawUnsafe(`
                        SELECT COALESCE((
                            SELECT last_value FROM "ticket_seq_${currentYear}"
                        ), 1) as currval
                    `);
                    if (Number(currval) < maxNum) {
                        await prisma.$executeRawUnsafe(`SELECT setval('"ticket_seq_${currentYear}"', ${maxNum})`);
                    }
                }
            }

            const [{ nextval }] = await prisma.$queryRawUnsafe(`SELECT nextval('"ticket_seq_${currentYear}"') as nextval`);
            seqNum = Number(nextval);
        } catch (seqError) {
            logger.warn({ err: seqError }, 'Failed to use database sequence, falling back to count method');
            // Fallback count logic
            const count = await prisma.ticket.count({
                where: { ticketNo: { startsWith: `INC-${currentYear}-` } }
            });
            seqNum = count + 1;
        }

        while (!ticket && retries < 10) {
            const ticketNo = `INC-${currentYear}-${String(seqNum + retries).padStart(5, '0')}`;
            let priority = 'MEDIUM';
            
            try {
                ticket = await prisma.ticket.create({
                    data: {
                        ticketNo,
                        createdById: req.user.id,
                        departmentId: departmentId || null,
                        zoneId: zoneId || null,
                        type: incidentType,
                        status: 'SUBMITTED',
                        priority,
                        userGroup: 'OFF_CIRCUIT',
                        incidentDate: new Date(incidentDate),
                        incidentTime,
                        location: locationAddress || (locationLat ? `${locationLat},${locationLng}` : ''),
                        description: whatHappened,
                        reporterName: req.user.name,
                        hasInjury: hasInjury || false,
                        serviceProviderId: (serviceProviderId && serviceProviderId !== 'OTHER') ? serviceProviderId : null,
                        eventId: eventId || null,
                        offCircuitReport: {
                            create: {
                                incidentType,
                                incidentDate: new Date(incidentDate),
                                incidentTime,
                                locationLat: locationLat ? parseFloat(locationLat) : null,
                                locationLng: locationLng ? parseFloat(locationLng) : null,
                                locationAddress,
                                locationDescription,
                                whatHappened,
                                hasInjury: hasInjury || false,
                                isLateReport: isLate,
                                lateReportReason: isLate ? lateReportReason : null,
                                injuredPersons: injuredPersons ? JSON.stringify(injuredPersons) : null,
                                witnesses: witnesses ? JSON.stringify(witnesses) : null,
                                detectionSource: detectionSource || 'INTERNAL_OBSERVATION',
                                reporterFilledBy: req.user.name,
                                reporterFilledAt: new Date(),
                                reporterDepartmentId: reporterDepartmentId || null
                            }
                        },
                        activityLogs: {
                            create: { actorId: req.user.id, action: 'STAGE_CREATED', details: `Ticket created (${incidentType})${isLate ? ' [LATE REPORT]' : ''}` }
                        }
                    },
                    include: { offCircuitReport: true }
                });
            } catch (error) {
                if (error.code === 'P2002') {
                    // Collision detected on ticketNo unique constraint, increment retry and try again
                    retries++;
                    continue;
                }
                throw error; // Rethrow if it's a different error
            }
        }

        if (!ticket) {
            return res.status(500).json({ message: 'Failed to generate unique ticket number due to high concurrency. Please try again.' });
        }

        // Notify controllers
        try {
            const controllers = await prisma.user.findMany({ where: { role: 'HSE_CONTROLLER', status: 'ACTIVE' }, select: { id: true } });
            if (controllers.length > 0) {
                await createNotificationsBulk(controllers.map(c => c.id), 'New Incident Report', `New ${incidentType} ticket ${ticket.ticketNo} by ${req.user.name}`, 'NEW_TICKET', `/tickets/${ticket.id}`);
            }

            // Immediately notify HR if an employee is injured (bypassing controller wait)
            if (hasInjury && injuredPersons) {
                const injuredArr = typeof injuredPersons === 'string' ? JSON.parse(injuredPersons) : injuredPersons;
                const hasEmployee = injuredArr.some(p => p.type === 'EMPLOYEE');
                if (hasEmployee) {
                    await prisma.offCircuitReport.update({
                        where: { ticketId: ticket.id },
                        data: { hrAssignedAt: new Date() }
                    });
                    const hrReps = await prisma.user.findMany({ where: { role: 'HR_REP', status: 'ACTIVE' }, select: { id: true } });
                    if (hrReps.length > 0) {
                        await createNotificationsBulk(hrReps.map(hr => hr.id), 'GOSI Data Required', `New Ticket ${ticket.ticketNo}: Please complete GOSI data for injured employee(s).`, 'INFO', `/tickets/${ticket.id}`);
                    }
                }
            }
        } catch(e) { logger.error({ err: e }, 'Notify error:'); }

        res.status(201).json(ticket);
    } catch (error) {
        logger.error({ err: error }, 'Create Ticket Error:');
        res.status(500).json({ message: safeError(error, 'Failed to create ticket') });
    }
};

// ===== GET ALL TICKETS =====
const getTickets = async (req, res) => {
    try {
        const { role, id: userId } = req.user;
        let where = { userGroup: 'OFF_CIRCUIT' };

        if (ROLES.REPORTER.includes(role)) {
            where.createdById = userId;
        } else if (ROLES.DEP_REP.includes(role)) {
            where.OR = [
                { assignedToId: userId }, 
                { departmentId: req.user.repDepartmentId }
            ].filter(Boolean);
        } else if (ROLES.DEP_MANAGER.includes(role)) {
            where.OR = [
                { assignedToId: userId }, 
                { status: 'ESCALATED', departmentId: req.user.repDepartmentId }
            ].filter(Boolean);
        } else if (ROLES.HR.includes(role)) {
            // HR sees tickets with injury that need GOSI
            where.OR = [{ assignedToId: userId }, { hasInjury: true }];
        } else if (role === 'SERVICE_PROVIDER_REP') {
            // D3: SP reps see only tickets for service providers under their department
            // and only active (non-closed) tickets
            const spFilter = [{ assignedToId: userId }];
            if (req.user.serviceProviderId) spFilter.push({ serviceProviderId: req.user.serviceProviderId });
            if (req.user.repDepartmentId) {
                // Also see tickets for ANY SP linked to their department
                const deptSPs = await prisma.serviceProvider.findMany({
                    where: { departmentId: req.user.repDepartmentId },
                    select: { id: true }
                });
                deptSPs.forEach(sp => spFilter.push({ serviceProviderId: sp.id }));
            }
            where.OR = spFilter;
            // Only show non-closed tickets to SP reps
            where.status = { not: 'CLOSED' };
        } else if (ROLES.FINANCE.includes(role)) {
            where.forwardedToFinance = true;
        } else if (!['ADMIN','HSE_CONTROLLER','SAFETY_MANAGER','OC_HSE_MANAGER'].includes(role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const [tickets, total] = await Promise.all([
            prisma.ticket.findMany({
                where,
                include: {
                    createdBy: { select: { name: true, role: true } },
                    assignedTo: { select: { name: true, role: true } },
                    offCircuitReport: true,
                    department: { select: { name: true, nameAr: true } },
                    event: true,
                    _count: { select: { attachments: true, actionPlans: true, reminders: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip, take: limit
            }),
            // Use count() against the same `where` filter so that `total` accurately
            // reflects the user's scoped dataset — not a groupBy aggregate which can
            // silently include rows outside the current user's permission scope.
            prisma.ticket.count({ where })
        ]);

        // Summary stats derived from a separate groupBy so the counts remain correct
        // even when the ticket list is paginated.
        const groups = await prisma.ticket.groupBy({
            by: ['status', 'hasInjury'],
            where,
            _count: { id: true }
        });

        let open = 0, closed = 0, escalated = 0, injuries = 0;
        groups.forEach(g => {
            const count = g._count.id;
            if (['SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW'].includes(g.status)) open += count;
            if (g.status === 'CLOSED') closed += count;
            if (g.status === 'ESCALATED') escalated += count;
            if (g.hasInjury) injuries += count;
        });

        const stats = { total, open, closed, escalated, injuries };

        // Mask confidential PII for non-authorized roles
        const isConfidentialViewer = ['ADMIN', 'HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER'].includes(role);
        const sanitizedTickets = tickets.map(t => {
            // Security: role-based whitelist filtering
            if (ROLES.REPORTER.includes(role)) return sanitizeForReporter(t);
            if (ROLES.FINANCE.includes(role)) return sanitizeForFinance(t);
            if (!isConfidentialViewer && t.createdById !== userId) {
                if (t.createdBy) t.createdBy = { id: t.createdBy.id, role: t.createdBy.role, name: 'Confidential', email: 'Confidential', mobile: 'Confidential', department: null };
                t.reporterName = 'Confidential';
                if (t.offCircuitReport) t.offCircuitReport.reporterFilledBy = 'Confidential';
            }
            return t;
        });

        res.json({ tickets: sanitizedTickets, total, page, limit, pages: Math.ceil(total / limit), stats });
    } catch (error) {
        logger.error({ err: error }, 'Get Tickets Error:');
        res.status(500).json({ message: 'Error fetching tickets' });
    }
};

// ===== GET TICKET BY ID =====
const getTicketById = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: {
                createdBy: { select: { id: true, name: true, role: true, email: true, mobile: true, department: true } },
                assignedTo: { select: { id: true, name: true, role: true } },
                offCircuitReport: true,
                zone: true,
                event: true,
                department: { select: { id: true, name: true, nameAr: true } },
                serviceProvider: {
                    include: {
                        department: true,
                        representatives: { select: { id: true, name: true, email: true, mobile: true, role: true } }
                    }
                },
                attachments: true,
                actionPlans: { include: { attachments: true, department: { select: { name: true, nameAr: true } } }, orderBy: { createdAt: 'asc' } },
                reminders: { orderBy: { reminderDate: 'desc' } },
                activityLogs: {
                    include: { actor: { select: { name: true, role: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role, id: userId } = req.user;
        if (role !== 'ADMIN' && !ROLES.ALL.includes(role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Role-based visibility logic
        const isControllerOrAdmin = ['ADMIN', 'HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER'].includes(role);
        
        if (!isControllerOrAdmin) {
            let canView = false;
            if (ROLES.REPORTER.includes(role)) {
                canView = (ticket.createdById === userId);
            } else if (ROLES.DEP_REP.includes(role)) {
                canView = (ticket.assignedToId === userId) || (ticket.departmentId === req.user.repDepartmentId);
            } else if (ROLES.DEP_MANAGER.includes(role)) {
                canView = (ticket.assignedToId === userId) || (ticket.status === 'ESCALATED' && ticket.departmentId === req.user.repDepartmentId);
            } else if (ROLES.HR.includes(role)) {
                canView = (ticket.assignedToId === userId) || (ticket.hasInjury === true);
            } else if (role === 'SERVICE_PROVIDER_REP') {
                // D3: SP rep can only view active tickets for their SP or their department's SPs
                if (ticket.status === 'CLOSED') {
                    canView = false;
                } else if (ticket.assignedToId === userId || ticket.serviceProviderId === req.user.serviceProviderId) {
                    canView = true;
                } else if (req.user.repDepartmentId) {
                    const sp = ticket.serviceProviderId ? await prisma.serviceProvider.findUnique({
                        where: { id: ticket.serviceProviderId }, select: { departmentId: true }
                    }) : null;
                    canView = sp?.departmentId === req.user.repDepartmentId;
                }
            } else if (ROLES.FINANCE.includes(role)) {
                canView = (ticket.forwardedToFinance === true);
            }

            if (!canView) {
                return res.status(403).json({ message: 'Not authorized to view this ticket' });
            }
        }

        const isConfidentialViewer = ['ADMIN', 'HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER'].includes(role) || ticket.createdById === userId;
        if (!isConfidentialViewer) {
            if (ticket.createdBy) {
                ticket.createdBy = { 
                    id: ticket.createdBy.id, 
                    role: ticket.createdBy.role, 
                    name: 'Confidential', 
                    email: 'Confidential', 
                    mobile: 'Confidential', 
                    department: null 
                };
            }
            ticket.reporterName = 'Confidential';
            if (ticket.offCircuitReport) ticket.offCircuitReport.reporterFilledBy = 'Confidential';
            if (ticket.activityLogs) {
                ticket.activityLogs.forEach(log => {
                    if (log.actor && log.createdById === ticket.createdById) {
                        log.actor.name = 'Confidential';
                    }
                });
            }

        }

        // Security: role-based whitelist filtering
        if (ROLES.REPORTER.includes(role)) {
            return res.json(sanitizeForReporter(ticket));
        }
        if (ROLES.FINANCE.includes(role)) {
            return res.json(sanitizeForFinance(ticket));
        }

        res.json(ticket);
    } catch (error) {
        logger.error({ err: error }, 'Get Ticket By ID Error:');
        res.status(500).json({ message: safeError(error, 'Error fetching ticket') });
    }
};

// ===== REPORTER REPLY (when RETURNED_TO_REPORTER) =====
const reporterReply = async (req, res) => {
    try {
        const { id } = req.params;
        const { replyText } = req.body;
        const ticket = await prisma.ticket.findUnique({ where: { id } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        if (ticket.status !== 'RETURNED_TO_REPORTER') return res.status(400).json({ message: 'Ticket not in returned state' });
        if (ticket.createdById !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Only the ticket reporter can reply' });
        if (!replyText?.trim()) return res.status(400).json({ message: 'Reply text required' });

        await prisma.activityLog.create({ data: { ticketId: id, actorId: req.user.id, action: 'STAGE_REPORTER_REPLY', details: replyText.trim() } });
        await prisma.ticket.update({ where: { id }, data: { status: 'SUBMITTED' } });
        await prisma.activityLog.create({ data: { ticketId: id, actorId: req.user.id, action: 'STATUS_CHANGE', details: 'Reporter replied. Ticket resubmitted.' } });

        // Notify controllers that the ticket was resubmitted
        const controllers = await prisma.user.findMany({ where: { role: { in: ['HSE_CONTROLLER', 'SAFETY_MANAGER'] }, status: 'ACTIVE' }, select: { id: true } });
        if (controllers.length > 0) {
            await createNotificationsBulk(controllers.map(c => c.id), 'Ticket Resubmitted', `Reporter has replied and resubmitted Ticket ${ticket.ticketNo}.`, 'INFO', `/tickets/${ticket.id}`);
        }


        const updated = await prisma.ticket.findUnique({ where: { id }, include: { offCircuitReport: true, createdBy: { select: { id: true, name: true, role: true, email: true, mobile: true, department: true } }, activityLogs: { include: { actor: { select: { name: true, role: true } } }, orderBy: { createdAt: 'desc' } }, attachments: true } });
        
        // Security: reporters get whitelist-filtered response
        if (ROLES.REPORTER.includes(req.user.role)) {
            return res.json(sanitizeForReporter(updated));
        }

        const isConfidentialViewer = ['ADMIN', 'HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER'].includes(req.user.role) || updated.createdById === req.user.id;
        if (!isConfidentialViewer && updated) {
            if (updated.createdBy) updated.createdBy = { id: updated.createdBy.id, role: updated.createdBy.role, name: 'Confidential', email: 'Confidential', mobile: 'Confidential', department: null };
            updated.reporterName = 'Confidential';
            if (updated.offCircuitReport) updated.offCircuitReport.reporterFilledBy = 'Confidential';
        }

        res.json(updated);
    } catch (error) {
        logger.error({ err: error }, 'Reporter reply error:');
        res.status(500).json({ message: 'Failed to submit reply' });
    }
};

// ===== UPLOAD ATTACHMENTS =====
const uploadAttachments = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const files = req.files;
        if (!files || files.length === 0) return res.status(400).json({ message: 'No files uploaded' });

        // B1: Verify magic bytes for each uploaded file (prevent MIME spoofing)
        for (const file of files) {
            if (!verifyMagicBytes(file.buffer, file.mimetype)) {
                return res.status(400).json({
                    message: `عذراً، الملف "${file.originalname}" لا يطابق النوع المُعلن عنه. يُرجى التأكد من إرسال ملف سليم.\nThe file "${file.originalname}" content does not match its declared type. Please upload a valid file.`
                });
            }
        }

        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { attachments: true } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        if (ticket.status === 'CLOSED') return res.status(400).json({ message: 'Cannot add attachments to closed ticket' });

        // B5: Enforce maximum 15 attachments per ticket
        const MAX_ATTACHMENTS = 15;
        const currentCount = ticket.attachments.length;
        if (currentCount >= MAX_ATTACHMENTS) {
            return res.status(400).json({
                message: `لقد وصلت إلى الحد الأقصى للمرفقات (${MAX_ATTACHMENTS} ملف لكل تذكرة).\nAttachment limit reached: maximum ${MAX_ATTACHMENTS} files allowed per ticket.`
            });
        }
        if (currentCount + files.length > MAX_ATTACHMENTS) {
            return res.status(400).json({
                message: `إرفاق ${files.length} ملف سيتجاوز الحد المسموح (${MAX_ATTACHMENTS} ملف). المتاح حالياً: ${MAX_ATTACHMENTS - currentCount} ملف.\nUploading ${files.length} file(s) would exceed the limit of ${MAX_ATTACHMENTS}. Remaining slots: ${MAX_ATTACHMENTS - currentCount}.`
            });
        }

        const startCount = currentCount;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const attachmentId = crypto.randomUUID();
            const refId = `${ticket.ticketNo}-A${startCount + i + 1}`;
            await prisma.attachment.create({
                data: { id: attachmentId, ticketId, uploadedById: req.user.id, url: `/api/attachments/${attachmentId}/content`, type: file.mimetype.startsWith('image/') ? 'IMAGE' : 'DOCUMENT', name: file.originalname, size: file.size, mimeType: file.mimetype, refId, data: file.buffer }
            });
        }
        await prisma.activityLog.create({ data: { ticketId, actorId: req.user.id, action: 'ATTACHMENT_ADDED', details: `Uploaded ${files.length} file(s)` } });
        res.json({ message: `${files.length} file(s) uploaded successfully` });
    } catch (error) {
        logger.error({ err: error }, 'Upload error:');
        res.status(500).json({ message: 'Upload failed. Please try again.' });
    }
};

module.exports = { createTicket, getTickets, getTicketById, reporterReply, uploadAttachments, ROLES, ADMIN_ROLES };
