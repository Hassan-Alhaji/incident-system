const prisma = require('../prismaClient');

// Role Definitions
const ROLES = {
    // Medical
    MEDICAL_CREATORS: ['MEDICAL_MARSHAL', 'MEDICAL_VENDOR', 'MEDICAL_EVACUATION'],
    MEDICAL_PROCESSORS: ['MEDICAL_OP_TEAM', 'DEPUTY_MEDICAL_OFFICER', 'CHIEF_MEDICAL_OFFICER'],
    // Safety
    SAFETY_CREATORS: ['SAFETY_MARSHAL'],
    SAFETY_PROCESSORS: ['SAFETY_OP_TEAM', 'DEPUTY_SAFETY_OFFICER', 'SAFETY_OFFICER_CHIEF'],
    // Sport
    SPORT_CREATORS: ['SPORT_MARSHAL'],
    SPORT_PROCESSORS: ['CONTROL_OP_TEAM', 'DEPUTY_CONTROL_OP_OFFICER', 'CHIEF_OF_CONTROL'],

    // Exclusive
    SCRUTINEERS: ['SCRUTINEERS'],
    JUDGES: ['JUDGEMENT'],
    ADMIN: ['ADMIN']
};

const canCreate = (role) => {
    if (ROLES.MEDICAL_CREATORS.includes(role)) return 'MEDICAL';
    if (ROLES.SAFETY_CREATORS.includes(role)) return 'SAFETY';
    if (ROLES.SPORT_CREATORS.includes(role)) return 'SPORT';
    if (ROLES.ADMIN.includes(role)) return 'ANY';
    return null;
};

// @desc    Create a new ticket
// @route   POST /api/tickets
// @access  Private
const createTicket = async (req, res) => {
    try {
        const {
            priority, eventName, venue, incidentDate, location, description,
            drivers, witnesses,
            // Nested Data
            medicalReport,
            pitGridReport,
            postNumber,
            reporterName,
            reporterSignature,
            marshalMobile,
            // Explicit type override
            type: requestedType
        } = req.body;

        const userRole = req.user.role;
        // const allowedType = canCreate(userRole); // Deprecating strict single-type logic

        // Determine effective type
        let type = requestedType;

        // Validation Logic
        if (ROLES.MEDICAL_CREATORS.includes(userRole)) {
            // Medical can create MEDICAL, SPORT (PitGrid), SAFETY (Incident)
            if (!['MEDICAL', 'SPORT', 'SAFETY'].includes(type)) type = 'MEDICAL'; // Default
        } else if (ROLES.SPORT_CREATORS.includes(userRole)) {
            // Sport can create SPORT, SAFETY
            if (!['SPORT', 'SAFETY'].includes(type)) type = 'SPORT';
        } else if (ROLES.SAFETY_CREATORS.includes(userRole)) {
            if (!['SPORT', 'SAFETY'].includes(type)) type = 'SAFETY';
        }

        // Build nested writes
        let nestedData = {};
        if (type === 'MEDICAL' && medicalReport) {
            nestedData.medicalReport = { create: { ...medicalReport, authorId: req.user.id } };
        }
        if (type === 'SPORT' && pitGridReport) {
            nestedData.pitGridReport = {
                create: {
                    ...pitGridReport,
                    lapNumber: pitGridReport.lapNumber ? parseInt(pitGridReport.lapNumber) : null
                }
            };
        }


        // Generate Ticket NO with Collision Check
        const ticketCount = await prisma.ticket.count();
        let seqOffset = 1;
        let ticketNo = `INC-${new Date().getFullYear()}-${String(ticketCount + seqOffset).padStart(5, '0')}`;

        while (await prisma.ticket.findUnique({ where: { ticketNo } })) {
            seqOffset++;
            ticketNo = `INC-${new Date().getFullYear()}-${String(ticketCount + seqOffset).padStart(5, '0')}`;
        }

        const ticket = await prisma.ticket.create({
            data: {
                ticketNo,
                type,
                priority,
                eventName,
                venue,
                incidentDate: incidentDate ? new Date(incidentDate) : new Date(),
                location,
                description,
                drivers,
                witnesses,
                createdById: req.user.id,
                status: 'OPEN',
                postNumber,
                marshalId: req.user.marshalId,
                marshalMobile: marshalMobile || req.user.mobile,
                reporterName,
                reporterSignature,
                ...nestedData,
                activityLogs: {
                    create: {
                        actorId: req.user.id,
                        action: 'TICKET_CREATED',
                        details: `Ticket created (${type})`
                    }
                }
            },
        });

        res.status(201).json(ticket);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || 'Failed to create ticket' });
    }
};

// @desc    Get all tickets (Filtered by Role/Permissions)
// @route   GET /api/tickets
// @access  Private
const getTickets = async (req, res) => {
    try {
        const { role, id: userId, canViewMedical, canViewSafety, canViewSport, canViewAll } = req.user;

        // 1. Super Admin / View All
        if (role === 'ADMIN' || role === 'CHIEF_OF_CONTROL' || canViewAll) {
            const tickets = await prisma.ticket.findMany({
                include: {
                    createdBy: { select: { name: true, role: true } },
                    assignedTo: { select: { name: true } },
                    controlReport: true,
                    medicalReport: true,
                    safetyReport: true
                },
                orderBy: { createdAt: 'desc' }
            });
            return res.json(tickets);
        }

        // 2. Base Visibility (Own, Assigned, Escalated to Me/MyRole)
        const orConditions = [
            { createdById: userId },
            { assignedToId: userId },
            { escalatedToRole: role }
        ];

        // 3. Department Views (Submitted only)
        if (canViewMedical) orConditions.push({ type: 'MEDICAL', status: { not: 'DRAFT' } });
        if (canViewSafety) orConditions.push({ type: 'SAFETY', status: { not: 'DRAFT' } });
        if (canViewSport) orConditions.push({ type: 'SPORT', status: { not: 'DRAFT' } });

        // 4. Legacy Support for "Intake" (Mapping old roles to view permissions dynamically if needed, 
        // but for now relying on strict flags as requested. Admin must configure users.)

        const tickets = await prisma.ticket.findMany({
            where: {
                OR: orConditions
            },
            include: {
                createdBy: { select: { name: true, role: true } },
                assignedTo: { select: { name: true } },
                controlReport: true,
                medicalReport: true,
                safetyReport: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tickets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching tickets' });
    }
};

// @desc    Get ticket by ID
// @route   GET /api/tickets/:id
const getTicketById = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: {
                createdBy: { select: { id: true, name: true, role: true } },
                assignedTo: { select: { id: true, name: true } },
                medicalReport: { include: { author: { select: { name: true } } } },
                controlReport: true,
                safetyReport: true,
                investigationReport: { include: { author: { select: { name: true } } } },
                attachments: true,
                activityLogs: {
                    include: { actor: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            },
        });

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role, id: userId, canViewMedical, canViewSafety, canViewSport, canViewAll } = req.user;

        // 1. Super User
        if (role === 'ADMIN' || role === 'CHIEF_OF_CONTROL' || canViewAll) return res.json(ticket);

        // 2. Base Visibility
        if (ticket.createdById === userId) return res.json(ticket);
        if (ticket.assignedToId === userId) return res.json(ticket);
        if (ticket.escalatedToRole === role) return res.json(ticket);

        // 3. Draft Restriction (Only Creator/Admin can see drafts, usually)
        if (ticket.status === 'DRAFT') {
            // If not creator/admin (handled above), deny
            return res.status(403).json({ message: 'Draft tickets are private.' });
        }

        // 4. Department Visibility (Submitted)
        if (canViewMedical && ticket.type === 'MEDICAL') return res.json(ticket);
        if (canViewSafety && ticket.type === 'SAFETY') return res.json(ticket);
        if (canViewSport && ticket.type === 'SPORT') return res.json(ticket);

        // If none of the above
        return res.status(403).json({ message: 'Not authorized to view this ticket' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Submit Ticket (Draft -> Open)
// @route   POST /api/tickets/:id/submit
const submitTicket = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        if (ticket.createdById !== req.user.id) {
            return res.status(403).json({ message: 'Only creator can submit' });
        }

        if (ticket.status !== 'DRAFT') {
            return res.status(400).json({ message: 'Ticket is already submitted' });
        }

        const updated = await prisma.ticket.update({
            where: { id: req.params.id },
            data: {
                status: 'OPEN',
                activityLogs: {
                    create: {
                        actorId: req.user.id,
                        action: 'TICKET_SUBMITTED',
                        details: 'Ticket submitted for processing'
                    }
                }
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Ticket Content
// @route   PUT /api/tickets/:id
const updateTicket = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        const isCreator = ticket.createdById === req.user.id;

        let canEdit = false;

        // Rule: Marshals/Creators can edit DRAFT only
        if (isCreator && ticket.status === 'DRAFT') {
            canEdit = true;
        }

        // Rule: Processors can edit "After submission"
        if (ticket.status !== 'DRAFT') {
            if (ROLES.MEDICAL_PROCESSORS.includes(role) && ticket.type === 'MEDICAL') canEdit = true;
            if (ROLES.SAFETY_PROCESSORS.includes(role) && ticket.type === 'SAFETY') canEdit = true;
            if (ROLES.SPORT_PROCESSORS.includes(role) && ticket.type === 'SPORT') canEdit = true;
            if (ROLES.SCRUTINEERS.includes(role) && ticket.assignedToId === req.user.id) canEdit = true;
            if (ROLES.JUDGES.includes(role) && ticket.assignedToId === req.user.id) canEdit = true;
        }

        if (role === 'ADMIN') canEdit = true;

        if (!canEdit) {
            return res.status(403).json({ message: 'Cannot edit this ticket in current status.' });
        }

        // Update Allowed Fields
        const updated = await prisma.ticket.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
                activityLogs: {
                    create: {
                        actorId: req.user.id,
                        action: 'TICKET_UPDATED',
                        details: 'Details updated'
                    }
                }
            }
        });

        res.json(updated);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Close Ticket
// @route   POST /api/tickets/:id/close
const closeTicket = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        const ALLOWED_CLOSERS = [
            'DEPUTY_MEDICAL_OFFICER', 'CHIEF_MEDICAL_OFFICER',
            'DEPUTY_SAFETY_OFFICER', 'SAFETY_OFFICER_CHIEF',
            'DEPUTY_CONTROL_OP_OFFICER', 'CHIEF_OF_CONTROL',
            'SCRUTINEERS', 'JUDGEMENT', 'ADMIN'
        ];

        if (!ALLOWED_CLOSERS.includes(role)) {
            return res.status(403).json({ message: 'Not authorized to close tickets' });
        }

        const updated = await prisma.ticket.update({
            where: { id: req.params.id },
            data: {
                status: 'CLOSED',
                closedBy: req.user.name,
                closedByRole: req.user.role,
                closedAt: new Date(),
                activityLogs: {
                    create: {
                        actorId: req.user.id,
                        action: 'TICKET_CLOSED',
                        details: 'Ticket closed'
                    }
                }
            }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Upload attachments
const uploadAttachments = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: { attachments: true }
        });

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        if (ticket.status === 'CLOSED') {
            return res.status(400).json({ message: 'Cannot add attachments to a closed ticket.' });
        }

        const startCount = ticket.attachments.length;

        const attachmentsData = files.map((file, index) => ({
            ticketId,
            url: `/uploads/${file.filename}`,
            type: file.mimetype.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
            name: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            refId: `${ticket.ticketNo}-A${startCount + index + 1}` // e.g. INC-2026-0011-A1
        }));

        await prisma.attachment.createMany({
            data: attachmentsData
        });

        await prisma.activityLog.create({
            data: {
                ticketId,
                actorId: req.user.id,
                action: 'ATTACHMENT_ADDED',
                details: `Uploaded ${files.length} attachments`
            }
        });

        res.status(200).json({ message: 'Attachments uploaded successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to upload attachments' });
    }
};

const addComment = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { text } = req.body;

        // Allow comment if files are being uploaded (handled in separate call usually, but frontend calls comments endpoint)
        // Wait, frontend calls comments endpoint ONLY with text. Files go to /attachments.
        if (!text || !text.trim()) {
            return res.status(400).json({ message: 'Comment text is required' });
        }

        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        if (ticket.status === 'CLOSED') {
            return res.status(400).json({ message: 'Cannot comment on a closed ticket.' });
        }

        const log = await prisma.activityLog.create({
            data: {
                ticketId,
                actorId: req.user.id,
                action: 'COMMENT_ADDED',
                details: text
            },
            include: { actor: { select: { name: true } } }
        });

        res.status(201).json(log);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to add comment' });
    }
};

module.exports = {
    createTicket,
    getTickets,
    getTicketById,
    uploadAttachments,
    addComment,
    submitTicket,
    updateTicket,
    closeTicket
};
