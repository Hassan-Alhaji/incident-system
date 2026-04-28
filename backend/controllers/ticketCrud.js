const prisma = require('../prismaClient');
const crypto = require('crypto');
const { createNotification } = require('./notificationController');

const ROLES = {
    REPORTER: ['OC_REPORTER'],
    CONTROLLER: ['HSE_CONTROLLER'],
    DEP_REP: ['DEP_REP'],
    DEP_MANAGER: ['DEP_MANAGER'],
    SAFETY_MANAGER: ['SAFETY_MANAGER', 'OC_HSE_MANAGER'],
    HR: ['HR_REP'],
    ALL: ['OC_REPORTER','HSE_CONTROLLER','DEP_REP','DEP_MANAGER','SAFETY_MANAGER','OC_HSE_MANAGER','HR_REP','SERVICE_PROVIDER_REP','ADMIN']
};

const ADMIN_ROLES = ['ADMIN', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'HSE_CONTROLLER'];

// ===== CREATE TICKET =====
const createTicket = async (req, res) => {
    try {
        const userRole = req.user.role;
        if (!ROLES.REPORTER.includes(userRole) && userRole !== 'ADMIN') {
            return res.status(403).json({ message: 'Only reporters can create tickets' });
        }
        const { incidentType, incidentDate, incidentTime, locationLat, locationLng, locationAddress, locationDescription, whatHappened, hasInjury, injuredPersons, witnesses, lateReportReason, serviceProviderId, zoneId } = req.body;

        if (!incidentType || !['OBSERVATION','ACCIDENT','SECURITY'].includes(incidentType)) {
            return res.status(400).json({ message: 'Valid incident type required (OBSERVATION, ACCIDENT, SECURITY)' });
        }
        if (!incidentDate || !incidentTime) return res.status(400).json({ message: 'Date and time required' });
        if (!whatHappened) return res.status(400).json({ message: 'Description required' });

        // Late report check
        const reportDateTime = new Date(`${incidentDate}T${incidentTime}`);
        const hoursDiff = (Date.now() - reportDateTime.getTime()) / (1000*60*60);
        const isLate = hoursDiff > 24;
        if (isLate && !lateReportReason) {
            return res.status(400).json({ message: 'Late report reason required (>24h)' });
        }

        // Generate ticket number
        const count = await prisma.ticket.count();
        let seq = 1;
        let ticketNo = `INC-${new Date().getFullYear()}-${String(count+seq).padStart(5,'0')}`;
        while (await prisma.ticket.findUnique({ where: { ticketNo } })) {
            seq++;
            ticketNo = `INC-${new Date().getFullYear()}-${String(count+seq).padStart(5,'0')}`;
        }

        const ticket = await prisma.ticket.create({
            data: {
                ticketNo,
                type: incidentType,
                status: 'SUBMITTED',
                priority: 'MEDIUM',
                userGroup: 'OFF_CIRCUIT',
                incidentDate: new Date(incidentDate),
                incidentTime,
                location: locationAddress || (locationLat ? `${locationLat},${locationLng}` : ''),
                description: whatHappened,
                reporterName: req.user.name,
                createdById: req.user.id,
                hasInjury: hasInjury || false,
                serviceProviderId: (serviceProviderId && serviceProviderId !== 'OTHER') ? serviceProviderId : null,
                zoneId: zoneId || null,
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
                        reporterFilledBy: req.user.name,
                        reporterFilledAt: new Date()
                    }
                },
                activityLogs: {
                    create: { actorId: req.user.id, action: 'TICKET_CREATED', details: `Ticket created (${incidentType})${isLate ? ' [LATE REPORT]' : ''}` }
                }
            },
            include: { offCircuitReport: true }
        });

        // Notify controllers
        try {
            const controllers = await prisma.user.findMany({ where: { role: 'HSE_CONTROLLER', status: 'ACTIVE' }, select: { id: true } });
            for (const c of controllers) {
                await createNotification(c.id, 'New Incident Report', `New ${incidentType} ticket ${ticket.ticketNo} by ${req.user.name}`, 'NEW_TICKET', `/tickets/${ticket.id}`);
            }
        } catch(e) { console.error('Notify error:', e); }

        res.status(201).json(ticket);
    } catch (error) {
        console.error('Create Ticket Error:', error);
        res.status(500).json({ message: error.message || 'Failed to create ticket' });
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
            where.OR = [{ status: 'ASSIGNED' }, { assignedToId: userId }, { departmentId: req.user.repDepartmentId }].filter(c => c.departmentId || c.status || c.assignedToId);
        } else if (ROLES.DEP_MANAGER.includes(role)) {
            where.OR = [{ status: 'ESCALATED' }, { assignedToId: userId }];
        } else if (ROLES.HR.includes(role)) {
            // HR sees tickets with injury that need GOSI
            where.OR = [{ assignedToId: userId }, { hasInjury: true }];
        } else if (role === 'SERVICE_PROVIDER_REP') {
            where.OR = [{ assignedToId: userId }, { serviceProviderId: req.user.serviceProviderId }].filter(Boolean);
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
                    _count: { select: { attachments: true, actionPlans: true, reminders: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip, take: limit
            }),
            prisma.ticket.count({ where })
        ]);

        const stats = {
            total,
            open: await prisma.ticket.count({ where: { ...where, status: { in: ['SUBMITTED','ASSIGNED','UNDER_REVIEW'] } } }),
            closed: await prisma.ticket.count({ where: { ...where, status: 'CLOSED' } }),
            escalated: await prisma.ticket.count({ where: { ...where, status: 'ESCALATED' } }),
            injuries: await prisma.ticket.count({ where: { ...where, hasInjury: true } })
        };

        res.json({ tickets, total, page, limit, pages: Math.ceil(total/limit), stats });
    } catch (error) {
        console.error('Get Tickets Error:', error);
        res.status(500).json({ message: 'Error fetching tickets' });
    }
};

// ===== GET TICKET BY ID =====
const getTicketById = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: {
                createdBy: { select: { id: true, name: true, role: true } },
                assignedTo: { select: { id: true, name: true, role: true } },
                offCircuitReport: true,
                zone: true,
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
        if (ROLES.REPORTER.includes(role) && ticket.createdById !== userId) {
            return res.status(403).json({ message: 'Not authorized to view this ticket' });
        }

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
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
        if (ticket.createdById !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Only reporter can reply' });
        if (!replyText?.trim()) return res.status(400).json({ message: 'Reply text required' });

        await prisma.activityLog.create({ data: { ticketId: id, actorId: req.user.id, action: 'REPORTER_REPLY', details: replyText.trim() } });
        await prisma.ticket.update({ where: { id }, data: { status: 'SUBMITTED' } });
        await prisma.activityLog.create({ data: { ticketId: id, actorId: req.user.id, action: 'STATUS_CHANGE', details: 'Reporter replied. Ticket resubmitted.' } });

        const updated = await prisma.ticket.findUnique({ where: { id }, include: { offCircuitReport: true, createdBy: { select: { id: true, name: true, role: true } }, activityLogs: { include: { actor: { select: { name: true, role: true } } }, orderBy: { createdAt: 'desc' } }, attachments: true } });
        res.json(updated);
    } catch (error) {
        console.error('Reporter reply error:', error);
        res.status(500).json({ message: 'Failed to submit reply' });
    }
};

// ===== UPLOAD ATTACHMENTS =====
const uploadAttachments = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const files = req.files;
        if (!files || files.length === 0) return res.status(400).json({ message: 'No files uploaded' });

        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { attachments: true } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        if (ticket.status === 'CLOSED') return res.status(400).json({ message: 'Cannot add attachments to closed ticket' });

        const startCount = ticket.attachments.length;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const attachmentId = crypto.randomUUID();
            const refId = `${ticket.ticketNo}-A${startCount + i + 1}`;
            await prisma.attachment.create({
                data: { id: attachmentId, ticketId, url: `/api/attachments/${attachmentId}/content`, type: file.mimetype.startsWith('image/') ? 'IMAGE' : 'DOCUMENT', name: file.originalname, size: file.size, mimeType: file.mimetype, refId, data: file.buffer }
            });
        }
        await prisma.activityLog.create({ data: { ticketId, actorId: req.user.id, action: 'ATTACHMENT_ADDED', details: `Uploaded ${files.length} file(s)` } });
        res.json({ message: `${files.length} file(s) uploaded` });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Upload failed' });
    }
};

module.exports = { createTicket, getTickets, getTicketById, reporterReply, uploadAttachments, ROLES, ADMIN_ROLES };
