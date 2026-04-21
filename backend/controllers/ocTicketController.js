const prisma = require('../prismaClient');
const crypto = require('crypto');
const { createNotification } = require('./notificationController');

// Off-Circuit Role Groups
const OC_ROLES = {
    REPORTER: ['OC_REPORTER'],
    SUPERVISOR: ['OC_SUPERVISOR'], // HSE_CONTROLLER removed to prevent auth trap
    DEP_REP: ['DEP_REP'],
    DEP_MANAGER: ['DEP_MANAGER'],
    INVESTIGATOR: ['OC_SAFETY_INVESTIGATOR'],
    HSE_MANAGER: ['OC_HSE_MANAGER'],
    HSE_CONTROLLER: ['HSE_CONTROLLER'],
    ALL: ['OC_REPORTER', 'OC_SUPERVISOR', 'DEP_REP', 'DEP_MANAGER', 'OC_SAFETY_INVESTIGATOR', 'OC_HSE_MANAGER', 'HSE_CONTROLLER', 'ADMIN', 'SERVICE_PROVIDER_REP']
};

// ---------- CREATE TICKET (Reporter only) ----------
const createOCTicket = async (req, res) => {
    try {
        const userRole = req.user.role;
        if (!OC_ROLES.REPORTER.includes(userRole) && userRole !== 'ADMIN') {
            return res.status(403).json({ message: 'Only OC Reporters can create off-circuit tickets' });
        }

        const {
            incidentType, incidentDate, incidentTime,
            locationLat, locationLng, locationAddress,
            whatHappened, hasInjury, severity,
            injuredPersons, witnesses, description, serviceProviderId
        } = req.body;

        // Validation
        if (!incidentDate || !incidentTime) {
            return res.status(400).json({ message: 'Incident date and time are required' });
        }
        if (!severity) {
            return res.status(400).json({ message: 'Severity is required' });
        }
        if (!locationLat || !locationLng) {
            return res.status(400).json({ message: 'Location (map pin) is required' });
        }

        // Generate Ticket Number
        const ticketCount = await prisma.ticket.count();
        let seqOffset = 1;
        let ticketNo = `OC-${new Date().getFullYear()}-${String(ticketCount + seqOffset).padStart(5, '0')}`;
        while (await prisma.ticket.findUnique({ where: { ticketNo } })) {
            seqOffset++;
            ticketNo = `OC-${new Date().getFullYear()}-${String(ticketCount + seqOffset).padStart(5, '0')}`;
        }

        // Map severity to priority enum
        const priorityMap = { MINOR: 'MINOR', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' };

        // Map incidentType to TicketType enum
        const typeMap = {
            VIOLATION: 'VIOLATION', HEALTH: 'HEALTH', NEAR_MISS: 'NEAR_MISS',
            PROPERTY_DAMAGE: 'PROPERTY_DAMAGE', INJURY: 'INJURY', FIRE: 'FIRE',
            SECURITY_BREACH: 'SECURITY_BREACH', ACCIDENT: 'ACCIDENT', OTHER: 'SAFETY'
        };

        const calculateDueDate = (sev) => {
            const now = new Date();
            if (sev === 'RED' || sev === 'CRITICAL') return new Date(now.getTime() + 24 * 60 * 60 * 1000);
            if (sev === 'YELMINOR' || sev === 'HIGH') return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        };

        const ticket = await prisma.ticket.create({
            data: {
                ticketNo,
                type: typeMap[incidentType] || 'SAFETY',
                status: 'HSE_REVIEW', // Dynamic Routing Phase 1 Default
                priority: priorityMap[severity] || 'MEDIUM',
                severityLevel: severity,
                dueDate: calculateDueDate(severity),
                userGroup: 'OFF_CIRCUIT',
                zoneId: req.body.zoneId || null,
                incidentDate: new Date(incidentDate),
                incidentTime,
                location: locationAddress || `${locationLat},${locationLng}`,
                description: whatHappened || description || '',
                reporterName: req.user.name,
                createdById: req.user.id,
                hasInjury: hasInjury || false,
                serviceProviderId: (serviceProviderId && serviceProviderId !== 'OTHER') ? serviceProviderId : null,
                offCircuitReport: {
                    create: {
                        incidentType,
                        incidentDate: new Date(incidentDate),
                        incidentTime,
                        locationLat: parseFloat(locationLat),
                        locationLng: parseFloat(locationLng),
                        locationAddress,
                        whatHappened: whatHappened || description || '',
                        hasInjury: hasInjury || false,
                        severity,
                        injuredPersons: injuredPersons ? JSON.stringify(injuredPersons) : null,
                        witnesses: witnesses ? JSON.stringify(witnesses) : null,
                        reporterFilledBy: req.user.name,
                        reporterFilledAt: new Date()
                    }
                },
                activityLogs: {
                    create: {
                        actorId: req.user.id,
                        action: 'TICKET_CREATED',
                        details: `Off-circuit ticket created (${incidentType})`
                    }
                }
            },
            include: { offCircuitReport: true }
        });

        // Notify all supervisors
        try {
            const supervisors = await prisma.user.findMany({
                where: { role: 'OC_SUPERVISOR', status: 'ACTIVE' },
                select: { id: true }
            });
            for (const sup of supervisors) {
                await createNotification(
                    sup.id,
                    'New Off-Circuit Incident',
                    `New incident ticket ${ticket.ticketNo} submitted by ${req.user.name}`,
                    'OC_NEW_TICKET',
                    `/oc/tickets/${ticket.id}`
                );
            }
        } catch (e) {
            console.error('Failed to notify supervisors:', e);
        }

        res.status(201).json(ticket);
    } catch (error) {
        console.error('Create OC Ticket Error:', error);
        res.status(500).json({ message: error.message || 'Failed to create ticket' });
    }
};

// ---------- GET ALL TICKETS (Role-filtered) ----------
const getOCTickets = async (req, res) => {
    try {
        const { role, id: userId } = req.user;

        let where = { userGroup: 'OFF_CIRCUIT' };

        if (OC_ROLES.REPORTER.includes(role)) {
            // Reporters see only their own tickets
            where.createdById = userId;
        } else if (OC_ROLES.SUPERVISOR.includes(role)) {
            where.OR = [
                { status: { in: ['OPEN', 'SUPERVISOR_REVIEW'] } },
                { assignedToId: userId }
            ];
        } else if (OC_ROLES.DEP_REP.includes(role)) {
            where.OR = [
                { status: 'PENDING_DEP_REP' },
                { assignedToId: userId }
            ];
        } else if (OC_ROLES.DEP_MANAGER.includes(role)) {
            where.OR = [
                { status: 'ESCALATED_TO_DEP_MANAGER' },
                { assignedToId: userId }
            ];
        } else if (OC_ROLES.INVESTIGATOR.includes(role)) {
            // Investigators see tickets in UNDER_INVESTIGATION or assigned to them
            where.OR = [
                { status: 'UNDER_INVESTIGATION' },
                { assignedToId: userId }
            ];
        } else if (OC_ROLES.HSE_MANAGER.includes(role)) {
            // HSE Managers see tickets in FINAL_REVIEW + all closed
            where.OR = [
                { status: 'FINAL_REVIEW' },
                { status: 'CLOSED' },
                { status: 'CLOSED_REJECTED' },
                { assignedToId: userId }
            ];
        } else if (role === 'ADMIN' || role === 'HSE_CONTROLLER') {
            // Admin and HSE Controller see all
            // keep where as is (just userGroup filter)
        } else if (role === 'SERVICE_PROVIDER_REP') {
            where.OR = [
                { assignedToId: userId },
                { serviceProviderId: req.user.serviceProviderId }
            ].filter(Boolean);
        } else {
            return res.status(403).json({ message: 'Not authorized for off-circuit tickets' });
        }

        const tickets = await prisma.ticket.findMany({
            where,
            include: {
                createdBy: { select: { name: true, role: true } },
                assignedTo: { select: { name: true, role: true } },
                offCircuitReport: true,
                _count: { select: { attachments: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(tickets);
    } catch (error) {
        console.error('Get OC Tickets Error:', error);
        res.status(500).json({ message: 'Error fetching tickets' });
    }
};

// ---------- GET TICKET BY ID ----------
const getOCTicketById = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: {
                createdBy: { select: { id: true, name: true, role: true } },
                assignedTo: { select: { id: true, name: true, role: true } },
                offCircuitReport: true,
                zone: true,
                serviceProvider: {
                    include: {
                        department: true,
                        representatives: { select: { id: true, name: true, email: true, mobile: true, role: true } }
                    }
                },
                attachments: true,
                activityLogs: {
                    include: { actor: { select: { name: true, role: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        if (ticket.userGroup !== 'OFF_CIRCUIT') {
            return res.status(403).json({ message: 'Not an off-circuit ticket' });
        }

        // Access check
        const { role, id: userId } = req.user;
        if (role !== 'ADMIN' && !OC_ROLES.ALL.includes(role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (OC_ROLES.REPORTER.includes(role) && ticket.createdById !== userId) {
            return res.status(403).json({ message: 'Not authorized to view this ticket' });
        }

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ---------- UPDATE REPORTER SECTION (only if RETURNED_FOR_EDIT) ----------
const updateReporterSection = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: { offCircuitReport: true }
        });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (!OC_ROLES.REPORTER.includes(role) && role !== 'ADMIN') {
            return res.status(403).json({ message: 'Only reporters can update this section' });
        }
        if (ticket.createdById !== req.user.id && role !== 'ADMIN') {
            return res.status(403).json({ message: 'Not your ticket' });
        }
        if (ticket.status !== 'RETURNED_FOR_EDIT' && ticket.status !== 'DRAFT') {
            return res.status(400).json({ message: 'Ticket is not in editable state' });
        }

        const {
            incidentType, incidentDate, incidentTime,
            locationLat, locationLng, locationAddress,
            whatHappened, hasInjury, severity,
            injuredPersons, witnesses
        } = req.body;

        const updateData = {};
        if (incidentType !== undefined) updateData.incidentType = incidentType;
        if (incidentDate !== undefined) updateData.incidentDate = new Date(incidentDate);
        if (incidentTime !== undefined) updateData.incidentTime = incidentTime;
        if (locationLat !== undefined) updateData.locationLat = parseFloat(locationLat);
        if (locationLng !== undefined) updateData.locationLng = parseFloat(locationLng);
        if (locationAddress !== undefined) updateData.locationAddress = locationAddress;
        if (whatHappened !== undefined) updateData.whatHappened = whatHappened;
        if (hasInjury !== undefined) updateData.hasInjury = hasInjury;
        if (severity !== undefined) updateData.severity = severity;
        if (injuredPersons !== undefined) updateData.injuredPersons = JSON.stringify(injuredPersons);
        if (witnesses !== undefined) updateData.witnesses = JSON.stringify(witnesses);
        updateData.reporterFilledBy = req.user.name;
        updateData.reporterFilledAt = new Date();

        await prisma.offCircuitReport.update({
            where: { ticketId: ticket.id },
            data: updateData
        });

        // Update ticket main fields too
        const ticketUpdate = {
            status: 'OPEN',
            hasInjury: hasInjury || ticket.hasInjury,
            activityLogs: {
                create: {
                    actorId: req.user.id,
                    action: 'REPORTER_SECTION_UPDATED',
                    details: 'Reporter updated and resubmitted the ticket'
                }
            }
        };
        if (whatHappened) ticketUpdate.description = whatHappened;
        if (incidentDate) ticketUpdate.incidentDate = new Date(incidentDate);
        if (incidentTime) ticketUpdate.incidentTime = incidentTime;

        const updated = await prisma.ticket.update({
            where: { id: ticket.id },
            data: ticketUpdate,
            include: { offCircuitReport: true }
        });

        res.json(updated);
    } catch (error) {
        console.error('Update Reporter Section Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ---------- SUPERVISOR ACTION (approve/return) ----------
const supervisorAction = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: { offCircuitReport: true }
        });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (!OC_ROLES.SUPERVISOR.includes(role) && role !== 'ADMIN') {
            return res.status(403).json({ message: 'Only supervisors can perform this action' });
        }
        if (!['OPEN', 'SUPERVISOR_REVIEW'].includes(ticket.status)) {
            return res.status(400).json({ message: 'Ticket is not in reviewable state' });
        }

        const { action, gosiReportDate, gosiReportNumber, immediateActions, supervisorNotes, supervisorSignature } = req.body;

        if (action === 'RETURN') {
            // Return to reporter
            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    status: 'RETURNED_FOR_EDIT',
                    activityLogs: {
                        create: {
                            actorId: req.user.id,
                            action: 'TICKET_RETURNED_TO_REPORTER',
                            details: `Returned for edit. Notes: ${supervisorNotes || 'N/A'}`
                        }
                    }
                }
            });

            if (ticket.offCircuitReport) {
                await prisma.offCircuitReport.update({
                    where: { ticketId: ticket.id },
                    data: { supervisorNotes, supervisorFilledBy: req.user.name, supervisorFilledAt: new Date() }
                });
            }

            // Notify reporter
            if (ticket.createdById) {
                await createNotification(
                    ticket.createdById,
                    'Ticket Returned for Edit',
                    `Ticket ${ticket.ticketNo} has been returned. Please review and resubmit.`,
                    'OC_RETURNED',
                    `/oc/tickets/${ticket.id}`
                ).catch(console.error);
            }

            return res.json({ message: 'Ticket returned to reporter', status: 'RETURNED_FOR_EDIT' });
        }

        if (action === 'APPROVE') {
            // Update off-circuit report with supervisor data
            if (ticket.offCircuitReport) {
                await prisma.offCircuitReport.update({
                    where: { ticketId: ticket.id },
                    data: {
                        gosiReportDate: gosiReportDate ? new Date(gosiReportDate) : null,
                        gosiReportNumber,
                        immediateActions,
                        supervisorNotes,
                        supervisorSignature,
                        supervisorFilledBy: req.user.name,
                        supervisorFilledAt: new Date()
                    }
                });
            }

            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    status: 'UNDER_INVESTIGATION',
                    activityLogs: {
                        create: {
                            actorId: req.user.id,
                            action: 'SUPERVISOR_APPROVED',
                            details: 'Supervisor approved and sent to investigation'
                        }
                    }
                }
            });

            // Notify investigators
            const investigators = await prisma.user.findMany({
                where: { role: 'OC_SAFETY_INVESTIGATOR', status: 'ACTIVE' },
                select: { id: true }
            });
            for (const inv of investigators) {
                await createNotification(
                    inv.id,
                    'New Investigation Required',
                    `Ticket ${ticket.ticketNo} is ready for investigation.`,
                    'OC_INVESTIGATION',
                    `/oc/tickets/${ticket.id}`
                ).catch(console.error);
            }

            return res.json({ message: 'Ticket approved and sent to investigation', status: 'UNDER_INVESTIGATION' });
        }

        res.status(400).json({ message: 'Invalid action. Use APPROVE or RETURN' });
    } catch (error) {
        console.error('Supervisor Action Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ---------- HSE CONTROLLER ROUTING ACTION ----------
const hseControllerAction = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: { offCircuitReport: true, serviceProvider: true }
        });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (!['HSE_CONTROLLER', 'OC_HSE_MANAGER', 'ADMIN'].includes(role)) {
            return res.status(403).json({ message: 'Only HSE Controllers can route tickets' });
        }

        const { 
            action, notes, targetId, serviceProviderId, priority, severityLevel,
            isLTI, isMaterialDamage, isRegulatoryReportable, isNearMiss,
            riskLikelihood, riskConsequence, riskScore, riskLevel,
            targetDepartmentId
        } = req.body;

        const baseUpdateData = {};
        if (priority) baseUpdateData.priority = priority;
        if (severityLevel) baseUpdateData.severityLevel = severityLevel;
        
        const controllerAssessmentData = {
            isLTI: isLTI || false,
            isMaterialDamage: isMaterialDamage || false,
            isRegulatoryReportable: isRegulatoryReportable || false,
            isNearMiss: isNearMiss || false,
            riskLikelihood: riskLikelihood || null,
            riskConsequence: riskConsequence || null,
            riskScore: riskScore || null,
            riskLevel: riskLevel || null,
            controllerFilledBy: req.user.name,
            controllerFilledAt: new Date()
        };

        if (action === 'RETURN_REPORTER') {
            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    ...baseUpdateData,
                    offCircuitReport: { update: controllerAssessmentData },
                    status: 'RETURNED_TO_REPORTER',
                    activityLogs: { create: { actorId: req.user.id, action: 'RETURNED_TO_REPORTER', details: `Need more details: ${notes}` } }
                }
            });
            return res.json({ message: 'Returned to reporter' });
        }

        if (action === 'ROUTE_HR') {
            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    ...baseUpdateData,
                    offCircuitReport: { update: controllerAssessmentData },
                    status: 'PENDING_HR',
                    activityLogs: { create: { actorId: req.user.id, action: 'ROUTED_TO_HR', details: `GOSI & Policy Actions required: ${notes}` } }
                }
            });
            return res.json({ message: 'Routed to HR' });
        }

        if (action === 'ROUTE_DEP_REP') {
            if (targetDepartmentId === 'HSE_MANAGER') {
                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: {
                        ...baseUpdateData,
                        offCircuitReport: { update: controllerAssessmentData },
                        status: 'FINAL_REVIEW',
                        escalatedToRole: 'OC_HSE_MANAGER',
                        activityLogs: { create: { actorId: req.user.id, action: 'ROUTED_TO_HSE_MANAGER', details: `Passed to HSE Manager: ${notes}` } }
                    }
                });
                return res.json({ message: 'Routed to HSE Manager successfully' });
            }

            // Normal Department Routing
            const extraData = {};
            if (targetDepartmentId && targetDepartmentId !== 'HSE_MANAGER') {
                extraData.departmentId = targetDepartmentId;
            } else if (serviceProviderId) {
                extraData.serviceProviderId = serviceProviderId;
            }

            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    ...baseUpdateData,
                    ...extraData,
                    offCircuitReport: { update: controllerAssessmentData },
                    status: 'PENDING_DEP_REP',
                    escalatedToRole: 'DEP_REP',
                    activityLogs: { create: { actorId: req.user.id, action: 'ROUTED_TO_DEP_REP', details: `Corrective Action Plan required: ${notes}` } }
                }
            });
            return res.json({ message: 'Routed to Department Rep' });
        }

        if (action === 'ROUTE_TO_USER') {
            if (!targetId) return res.status(400).json({ message: 'Target user ID is required.' });
            
            const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
            if (!targetUser) return res.status(404).json({ message: 'Target user not found.' });

            // In our custom workflow, routing from HSE Controller always goes to the Department Rep phase first.
            let newStatus = 'PENDING_DEP_REP';

            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    ...baseUpdateData,
                    offCircuitReport: { update: controllerAssessmentData },
                    status: newStatus,
                    assignedToId: targetId,
                    escalatedToRole: targetUser.role,
                    activityLogs: { create: { actorId: req.user.id, action: 'ROUTED_TICKET', details: `Routed to ${targetUser.name} (${targetUser.role}): ${notes}` } }
                }
            });
            try {
                await createNotification(targetId, 'Ticket Routed', `Ticket ${ticket.ticketNo} routed to you.`, 'TICKET_ROUTED', `/oc/tickets/${ticket.id}`);
            } catch (e) { console.error('Notif error', e); }

            return res.json({ message: `Routed successfully to ${targetUser.name}` });
        }

        if (action === 'ROUTE_HSE_MANAGER') {
            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    ...baseUpdateData,
                    offCircuitReport: { update: controllerAssessmentData },
                    status: 'FINAL_REVIEW',
                    escalatedToRole: 'OC_HSE_MANAGER',
                    activityLogs: { create: { actorId: req.user.id, action: 'ROUTED_TO_HSE_MANAGER', details: `Passed to HSE Manager for final review/closure: ${notes}` } }
                }
            });
            return res.json({ message: 'Ticket routed to HSE Manager successfully' });
        }

        res.status(400).json({ message: 'Invalid routing action' });
    } catch (error) {
        console.error('HSE Action Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ---------- DEPARTMENT REP SECTION ----------
const departmentRepAction = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: { offCircuitReport: true }
        });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (role !== 'DEP_REP' && role !== 'ADMIN') {
            return res.status(403).json({ message: 'Only Department Representatives can perform this action' });
        }
        if (ticket.status !== 'PENDING_DEP_REP') {
            return res.status(400).json({ message: 'Ticket is not awaiting department response' });
        }

        const { immediateCauses, preventiveActions } = req.body;

        if (ticket.offCircuitReport) {
            await prisma.offCircuitReport.update({
                where: { ticketId: ticket.id },
                data: {
                    immediateCauses,
                    preventiveActions,
                    depRepFilledBy: req.user.name,
                    depRepFilledAt: new Date()
                }
            });
        }

        await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
                status: 'DEP_REP_RESPONDED',
                escalatedToRole: 'HSE_CONTROLLER',
                activityLogs: {
                    create: {
                        actorId: req.user.id,
                        action: 'DEP_REP_SUBMITTED',
                        details: 'Department Representative submitted corrective actions. Returned to HSE Controller for review.'
                    }
                }
            }
        });

        // Notify HSE Controllers
        const controllers = await prisma.user.findMany({
            where: { role: 'HSE_CONTROLLER', status: 'ACTIVE' },
            select: { id: true }
        });
        for (const ctrl of controllers) {
            await createNotification(
                ctrl.id,
                'Dep Rep Response Received',
                `Ticket ${ticket.ticketNo}: Department Representative has submitted corrective actions for your review.`,
                'DEP_REP_RESPONSE',
                `/oc/tickets/${ticket.id}`
            ).catch(console.error);
        }

        res.json({ message: 'Response submitted successfully. Sent back to HSE Controller for review.', status: 'DEP_REP_RESPONDED' });
    } catch (error) {
        console.error('Dep Rep Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ---------- INVESTIGATOR SECTION ----------
const submitInvestigation = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: { offCircuitReport: true }
        });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (!OC_ROLES.INVESTIGATOR.includes(role) && !OC_ROLES.HSE_CONTROLLER.includes(role) && role !== 'ADMIN' && !req.user.canPerformRCA) {
            return res.status(403).json({ message: 'Only investigators or HSE Controllers can perform this action' });
        }
        if (ticket.status !== 'UNDER_INVESTIGATION' && ticket.status !== 'DEP_REP_RESPONDED') {
            return res.status(400).json({ message: 'Ticket is not in investigation stage' });
        }

        const { immediateCauses, preventiveActions, underlyingCauses, rootCauses, analysisMethod, investigatorSignature, targetDepManagerId, returnReason, action } = req.body;

        // 1. Action: RETURN_TO_DEPARTMENT
        if (action === 'RETURN_TO_DEPARTMENT') {
            if (!returnReason) return res.status(400).json({ message: 'Return reason is strictly required.' });
            
            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    status: 'PENDING_DEP_REP',
                    escalatedToRole: 'DEP_REP',
                    activityLogs: {
                        create: {
                            actorId: req.user.id,
                            action: 'RETURNED_TO_DEP_REP',
                            details: `Returned to Department Rep: ${returnReason}`
                        }
                    }
                }
            });
            return res.json({ message: 'Returned to Department Representative' });
        }

        // 2. Action: RCA based routes
        const missingFields = [];
        if (!immediateCauses?.trim()) missingFields.push('Immediate Causes');
        if (!preventiveActions?.trim()) missingFields.push('Preventive Actions');
        if (!analysisMethod?.trim()) missingFields.push('Analysis Method');
        if (!rootCauses?.trim()) missingFields.push('Root Causes');
        if (!underlyingCauses?.trim()) missingFields.push('Underlying Causes');

        if (missingFields.length > 0) { 
            return res.status(400).json({ message: `Missing required Analysis fields: ${missingFields.join(', ')}` }); 
        }

        if (ticket.offCircuitReport) {
            await prisma.offCircuitReport.update({
                where: { ticketId: ticket.id },
                data: {
                    immediateCauses,
                    preventiveActions,
                    underlyingCauses,
                    rootCauses,
                    analysisMethod,
                    investigatorSignature,
                    investigatorFilledBy: req.user.name,
                    investigatorFilledAt: new Date()
                }
            });
        }

        if (action === 'CLOSE_TICKET') {
            if (!req.user.canCloseTickets && role !== 'ADMIN') {
                return res.status(403).json({ message: 'You do not have permission to close tickets' });
            }
            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    status: 'CLOSED',
                    escalatedToRole: 'CLOSED',
                    activityLogs: {
                        create: { actorId: req.user.id, action: 'CLOSED_AFTER_RCA', details: 'Ticket strictly closed after formal RCA' }
                    }
                }
            });
            return res.json({ message: 'Ticket has been completely closed.' });
        }

        if (action === 'ROUTE_HSE_MANAGER') {
            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    status: 'FINAL_REVIEW',
                    escalatedToRole: 'OC_HSE_MANAGER',
                    activityLogs: {
                        create: { actorId: req.user.id, action: 'RCA_COMPLETED', details: 'Formal RCA completed and routed to HSE Manager' }
                    }
                }
            });
            return res.json({ message: 'Ticket routed to HSE Manager.' });
        }

        // Default or ROUTE_DEP_MANAGER
        if (!targetDepManagerId) {
            return res.status(400).json({ message: 'Target Department Manager is required for this route.' });
        }

        await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
                status: 'ESCALATED_TO_DEP_MANAGER',
                assignedToId: targetDepManagerId,
                escalatedToRole: 'DEP_MANAGER',
                activityLogs: {
                    create: { actorId: req.user.id, action: 'RCA_COMPLETED', details: 'Formal RCA completed and sent to Department Manager' }
                }
            }
        });

        const mgr = await prisma.user.findUnique({ where: { id: targetDepManagerId } });
        if (mgr) {
            await createNotification(
                mgr.id,
                'CAPA Approval Required',
                `Ticket ${ticket.ticketNo} RCA complete. Please review and approve preventive actions.`,
                'DEP_MANAGER_APPROVAL',
                `/oc/tickets/${ticket.id}`
            ).catch(console.error);
        }

        res.json({ message: 'Investigation submitted, ticket sent to Department Manager for final approval', status: 'ESCALATED_TO_DEP_MANAGER' });
    } catch (error) {
        console.error('Submit Investigation Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ---------- DEPARTMENT MANAGER SECTION ----------
const departmentManagerApprove = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: { offCircuitReport: true }
        });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (role !== 'DEP_MANAGER' && role !== 'ADMIN') {
            return res.status(403).json({ message: 'Only Department Managers can perform this action' });
        }
        if (ticket.status !== 'ESCALATED_TO_DEP_MANAGER') {
            return res.status(400).json({ message: 'Ticket is not awaiting department manager approval' });
        }

        await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
                status: 'FINAL_REVIEW',
                escalatedToRole: 'OC_HSE_MANAGER',
                activityLogs: {
                    create: {
                        actorId: req.user.id,
                        action: 'CAPA_APPROVED',
                        details: 'Department Manager approved the preventive actions.'
                    }
                }
            }
        });

        // Notify HSE Managers
        const hseManagers = await prisma.user.findMany({
            where: { role: 'OC_HSE_MANAGER', status: 'ACTIVE' },
            select: { id: true }
        });
        for (const mgr of hseManagers) {
            await createNotification(
                mgr.id,
                'Final Review Required',
                `Ticket ${ticket.ticketNo} RCA & CAPA approved and awaiting final closure.`,
                'OC_FINAL_REVIEW',
                `/oc/tickets/${ticket.id}`
            ).catch(console.error);
        }

        res.json({ message: 'CAPA approved, ticket sent to HSE Manager', status: 'FINAL_REVIEW' });
    } catch (error) {
        console.error('Department Manager Approve Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ---------- HSE MANAGER FINAL DECISION ----------
const finalDecision = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: { offCircuitReport: true }
        });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (!OC_ROLES.HSE_MANAGER.includes(role) && role !== 'ADMIN' && !req.user.canCloseTickets) {
            return res.status(403).json({ message: 'Only HSE Managers can perform this action' });
        }
        if (ticket.status !== 'FINAL_REVIEW') {
            return res.status(400).json({ message: 'Ticket is not in final review stage' });
        }

        const { decision, finalNotes, hseManagerSignature } = req.body;

        if (!['CLOSE', 'REJECT'].includes(decision)) {
            return res.status(400).json({ message: 'Decision must be CLOSE or REJECT' });
        }

        const newStatus = decision === 'CLOSE' ? 'CLOSED' : 'CLOSED_REJECTED';

        if (ticket.offCircuitReport) {
            await prisma.offCircuitReport.update({
                where: { ticketId: ticket.id },
                data: {
                    finalDecision: decision,
                    finalNotes,
                    hseManagerSignature,
                    hseManagerFilledBy: req.user.name,
                    hseManagerFilledAt: new Date()
                }
            });
        }

        await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
                status: newStatus,
                closedBy: req.user.name,
                closedByRole: req.user.role,
                closedAt: new Date(),
                closureReason: finalNotes,
                activityLogs: {
                    create: {
                        actorId: req.user.id,
                        action: decision === 'CLOSE' ? 'TICKET_CLOSED' : 'TICKET_REJECTED',
                        details: `HSE Manager ${decision.toLowerCase()}d the ticket. Notes: ${finalNotes || 'N/A'}`
                    }
                }
            }
        });

        // Notify reporter
        if (ticket.createdById) {
            await createNotification(
                ticket.createdById,
                decision === 'CLOSE' ? 'Ticket Closed' : 'Ticket Rejected',
                `Ticket ${ticket.ticketNo} has been ${decision.toLowerCase()}d by HSE Manager.`,
                'OC_DECISION',
                `/oc/tickets/${ticket.id}`
            ).catch(console.error);
        }

        res.json({ message: `Ticket ${decision.toLowerCase()}d`, status: newStatus });
    } catch (error) {
        console.error('Final Decision Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ---------- UPLOAD ATTACHMENTS ----------
const uploadOCAttachments = async (req, res) => {
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
        if (['CLOSED', 'CLOSED_REJECTED'].includes(ticket.status)) {
            return res.status(400).json({ message: 'Cannot add attachments to a closed ticket' });
        }

        const startCount = ticket.attachments.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const attachmentId = crypto.randomUUID();
            const refId = `${ticket.ticketNo}-A${startCount + i + 1}`;
            const downloadUrl = `/api/attachments/${attachmentId}/content`;

            await prisma.attachment.create({
                data: {
                    id: attachmentId,
                    ticketId,
                    url: downloadUrl,
                    type: file.mimetype.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
                    name: file.originalname,
                    size: file.size,
                    mimeType: file.mimetype,
                    refId,
                    data: file.buffer
                }
            });
        }

        await prisma.activityLog.create({
            data: {
                ticketId,
                actorId: req.user.id,
                action: 'ATTACHMENT_ADDED',
                details: `Uploaded ${files.length} attachment(s)`
            }
        });

        res.status(200).json({ message: `${files.length} attachment(s) uploaded successfully` });
    } catch (error) {
        console.error('Upload OC Attachments Error:', error);
        res.status(500).json({ message: 'Failed to upload attachments' });
    }
};

// ==========================================
// ===   OC USER MANAGEMENT (HSE/Admin)   ===
// ==========================================

const OC_ADMIN_ROLES = ['OC_HSE_MANAGER', 'ADMIN', 'HSE_CONTROLLER'];
const OC_USER_ROLES = ['OC_REPORTER', 'HSE_CONTROLLER', 'OC_HSE_MANAGER', 'HR_REP', 'PROCUREMENT_REP', 'DEP_REP', 'DEP_MANAGER', 'SAFETY_MANAGER', 'SERVICE_PROVIDER_REP'];

const getOCUsers = async (req, res) => {
    try {
        if (!OC_ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        const users = await prisma.user.findMany({
            where: { role: { in: OC_USER_ROLES } },
            select: {
                id: true, name: true, email: true, role: true, userGroup: true,
                status: true, createdAt: true, mobile: true,
                canViewAnalytics: true,  canManageUsers: true,
                canCloseTickets: true, canPerformRCA: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        console.error('Get OC Users Error:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

const createOCUser = async (req, res) => {
    try {
        if (!OC_ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        const { name, email, role, mobile, canManageUsers, canCloseTickets, canPerformRCA } = req.body;
        if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });
        if (!OC_USER_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid OC role' });

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ message: 'User with this email already exists' });

        const user = await prisma.user.create({
            data: {
                name, email, password: '', role,
                userGroup: 'OFF_CIRCUIT',
                mobile: mobile || null,
                status: 'ACTIVE',
                canManageUsers: canManageUsers || false,
                canCloseTickets: canCloseTickets || false,
                canPerformRCA: canPerformRCA || false
            }
        });
        res.status(201).json({ message: 'User created', user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        console.error('Create OC User Error:', error);
        res.status(500).json({ message: error.message || 'Error creating user' });
    }
};

const updateOCUser = async (req, res) => {
    try {
        if (!OC_ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        const { name, email, role, mobile, canManageUsers, canCloseTickets, canPerformRCA } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (role && OC_USER_ROLES.includes(role)) updateData.role = role;
        if (mobile !== undefined) updateData.mobile = mobile;
        if (typeof canManageUsers === 'boolean') updateData.canManageUsers = canManageUsers;
        if (typeof canCloseTickets === 'boolean') updateData.canCloseTickets = canCloseTickets;
        if (typeof canPerformRCA === 'boolean') updateData.canPerformRCA = canPerformRCA;
        updateData.userGroup = 'OFF_CIRCUIT';

        const user = await prisma.user.update({ where: { id: req.params.id }, data: updateData });
        res.json({ message: 'User updated', user: { id: user.id, name: user.name, role: user.role } });
    } catch (error) {
        console.error('Update OC User Error:', error);
        res.status(500).json({ message: 'Error updating user' });
    }
};

const deleteOCUser = async (req, res) => {
    try {
        if (!OC_ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        const openTickets = await prisma.ticket.count({
            where: {
                OR: [
                    { createdById: req.params.id, status: { notIn: ['CLOSED', 'RESOLVED', 'CLOSED_REJECTED'] } },
                    { assignedToId: req.params.id, status: { notIn: ['CLOSED', 'RESOLVED', 'CLOSED_REJECTED'] } }
                ]
            }
        });
        if (openTickets > 0) {
            return res.status(400).json({ message: `Cannot delete: user has ${openTickets} open ticket(s)` });
        }
        await prisma.user.update({ where: { id: req.params.id }, data: { status: 'SUSPENDED' } });
        res.json({ message: 'User deactivated' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user' });
    }
};

const toggleOCUserStatus = async (req, res) => {
    try {
        if (!OC_ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        const { status } = req.body;
        await prisma.user.update({ where: { id: req.params.id }, data: { status } });
        res.json({ message: `User status updated to ${status}` });
    } catch (error) {
        res.status(500).json({ message: 'Error updating status' });
    }
};

// ==========================================
// ===       OC ANALYTICS                 ===
// ==========================================

const getOCAnalytics = async (req, res) => {
    try {
        const { role } = req.user;
        if (!OC_ROLES.ALL.includes(role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const where = { userGroup: 'OFF_CIRCUIT' };

        const totalTickets = await prisma.ticket.count({ where });
        const totalInjuries = await prisma.ticket.count({ where: { ...where, hasInjury: true } });

        const ticketsByStatus = await prisma.ticket.groupBy({
            by: ['status'], _count: { id: true },
            where
        });

        const ticketsByType = await prisma.ticket.groupBy({
            by: ['type'], _count: { id: true },
            where
        });

        const ticketsByPriority = await prisma.ticket.groupBy({
            by: ['priority'], _count: { id: true },
            where
        });

        // Monthly trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyTickets = await prisma.ticket.findMany({
            where: { ...where, createdAt: { gte: sixMonthsAgo } },
            select: { createdAt: true, hasInjury: true }
        });

        const monthlyTrend = {};
        monthlyTickets.forEach(t => {
            const key = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyTrend[key]) monthlyTrend[key] = { total: 0, injuries: 0 };
            monthlyTrend[key].total++;
            if (t.hasInjury) monthlyTrend[key].injuries++;
        });

        // Top locations
        const reportsWithLocation = await prisma.offCircuitReport.findMany({
            where: { locationAddress: { not: null, not: '' } },
            select: { locationAddress: true }
        });
        const locMap = {};
        reportsWithLocation.forEach(r => {
            locMap[r.locationAddress] = (locMap[r.locationAddress] || 0) + 1;
        });
        const topLocations = Object.keys(locMap)
            .map(k => ({ name: k.substring(0, 25), count: locMap[k] }))
            .sort((a,b) => b.count - a.count)
            .slice(0, 5);

        // Top reporters
        const topReportersData = await prisma.ticket.groupBy({
            by: ['createdById'], _count: { id: true },
            where, orderBy: { _count: { id: 'desc' } }, take: 5
        });
        const reporterIds = topReportersData.map(t => t.createdById).filter(Boolean);
        const reporters = await prisma.user.findMany({
            where: { id: { in: reporterIds } },
            select: { id: true, name: true, role: true }
        });
        const topReporters = topReportersData.map(t => {
            const u = reporters.find(r => r.id === t.createdById);
            return { name: u?.name || 'Unknown', role: u?.role || '', count: t._count.id };
        });

        // Average closure time
        const closedTickets = await prisma.ticket.findMany({
            where: { ...where, status: { in: ['CLOSED', 'CLOSED_REJECTED'] }, closedAt: { not: null } },
            select: { createdAt: true, closedAt: true }
        });
        let avgClosureMs = 0;
        if (closedTickets.length > 0) {
            const totalMs = closedTickets.reduce((sum, t) => sum + (t.closedAt.getTime() - t.createdAt.getTime()), 0);
            avgClosureMs = totalMs / closedTickets.length;
        }

        let avgClosureText = '0h';
        if (avgClosureMs > 0) {
            const totalMins = Math.floor(avgClosureMs / 60000);
            const hours = Math.floor(totalMins / 60);
            const mins = totalMins % 60;
            if (hours > 0) {
                avgClosureText = `${hours}h ${mins}m`;
            } else {
                avgClosureText = `${mins}m`;
            }
        }

        res.json({
            totalTickets,
            totalInjuries,
            statusDistribution: ticketsByStatus.reduce((acc, c) => ({ ...acc, [c.status]: c._count.id }), {}),
            typeDistribution: ticketsByType.reduce((acc, c) => ({ ...acc, [c.type]: c._count.id }), {}),
            priorityDistribution: ticketsByPriority.reduce((acc, c) => ({ ...acc, [c.priority]: c._count.id }), {}),
            monthlyTrend,
            topLocations,
            topReporters,
            avgClosureHours: Math.round(avgClosureMs / (1000 * 60 * 60)),
            avgClosureText,
            closedCount: closedTickets.length
        });
    } catch (error) {
        console.error('OC Analytics Error:', error);
        res.status(500).json({ message: 'Failed to fetch analytics' });
    }
};

// ==========================================
// ===   OC EXCEL IMPORT / EXPORT         ===
// ==========================================

const xlsx = require('xlsx');
const fs = require('fs');

const downloadOCUserTemplate = async (req, res) => {
    try {
        const worksheet = xlsx.utils.json_to_sheet([
            { name: 'Ahmed Ali', email: 'ahmed@company.com', mobile: '+966500000000', role: 'OC_REPORTER' },
            { name: 'Sara Hassan', email: 'sara@company.com', mobile: '+966500000001', role: 'OC_SUPERVISOR' },
        ]);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'OC Users');
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="oc_users_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ message: 'Failed to generate template' });
    }
};

const importOCUsers = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    if (!OC_ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });

    try {
        const workbook = xlsx.readFile(req.file.path);
        fs.unlinkSync(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        let added = 0, skipped = 0;
        const errors = [];
        const validRoles = ['OC_REPORTER', 'OC_SUPERVISOR', 'OC_SAFETY_INVESTIGATOR', 'OC_HSE_MANAGER'];

        for (const row of data) {
            const email = row['email']?.toString().trim();
            const name = row['name']?.toString().trim();
            const mobile = row['mobile']?.toString().trim();
            const role = row['role']?.toString().trim();

            if (!email || !name) { errors.push(`Missing name/email: ${JSON.stringify(row)}`); continue; }
            if (!validRoles.includes(role)) { errors.push(`Invalid role for ${email}: ${role}`); continue; }

            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) { skipped++; errors.push(`Exists: ${email}`); continue; }

            await prisma.user.create({
                data: { name, email, password: '', role, userGroup: 'OFF_CIRCUIT', mobile: mobile || null, status: 'ACTIVE' }
            });
            added++;
        }

        res.json({ message: 'Import completed', summary: { totalRows: data.length, added, skipped, errors } });
    } catch (error) {
        console.error('OC Import Error:', error);
        res.status(500).json({ message: 'Error processing file' });
    }
};

const exportOCTickets = async (req, res) => {
    try {
        if (!OC_ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { startDate, endDate } = req.query;
        let whereClause = { userGroup: 'OFF_CIRCUIT' };
        
        if (startDate && endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.createdAt = {
                gte: new Date(startDate),
                lte: end
            };
        }

        const tickets = await prisma.ticket.findMany({
            where: whereClause,
            include: {
                createdBy: { select: { name: true, role: true } },
                offCircuitReport: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const rows = tickets.map(t => {
            const oc = t.offCircuitReport;
            const createdMs = new Date(t.createdAt).getTime();
            const closedMs = t.closedAt ? new Date(t.closedAt).getTime() : null;
            const durationHours = closedMs ? Math.round((closedMs - createdMs) / (1000 * 60 * 60)) : null;
            const durationDays = closedMs ? (durationHours / 24).toFixed(1) : null;

            return {
                'Ticket No': t.ticketNo,
                'Status': t.status,
                'Type': oc?.incidentType || t.type,
                'Severity': oc?.severity || t.priority,
                'Has Injury': t.hasInjury ? 'Yes' : 'No',
                'Reporter': t.createdBy?.name || '',
                'Description': oc?.whatHappened || t.description || '',
                'Incident Date': oc?.incidentDate ? new Date(oc.incidentDate).toLocaleDateString() : '',
                'Incident Time': oc?.incidentTime || '',
                'Location': oc?.locationAddress || '',
                'Lat': oc?.locationLat || '',
                'Lng': oc?.locationLng || '',
                'Injured Persons': oc?.injuredPersons ? JSON.parse(oc.injuredPersons).length : 0,
                'Witnesses': oc?.witnesses ? JSON.parse(oc.witnesses).length : 0,
                'Supervisor': oc?.supervisorFilledBy || '',
                'Supervisor Date': oc?.supervisorFilledAt ? new Date(oc.supervisorFilledAt).toLocaleDateString() : '',
                'GOSI Report No': oc?.gosiReportNumber || '',
                'Immediate Actions': oc?.immediateActions || '',
                'Investigator': oc?.investigatorFilledBy || '',
                'Investigator Date': oc?.investigatorFilledAt ? new Date(oc.investigatorFilledAt).toLocaleDateString() : '',
                'Analysis Method': oc?.analysisMethod || '',
                'Immediate Causes': oc?.immediateCauses || '',
                'Root Causes': oc?.rootCauses || '',
                'Preventive Actions': oc?.preventiveActions || '',
                'HSE Manager': oc?.hseManagerFilledBy || '',
                'Final Decision': oc?.finalDecision || '',
                'Closed By': t.closedBy || '',
                'Created At': new Date(t.createdAt).toLocaleString(),
                'Closed At': t.closedAt ? new Date(t.closedAt).toLocaleString() : '',
                'Duration (Hours)': durationHours !== null ? durationHours : 'Open',
                'Duration (Days)': durationDays !== null ? durationDays : 'Open',
            };
        });

        const worksheet = xlsx.utils.json_to_sheet(rows);

        // Auto-size columns
        const colWidths = Object.keys(rows[0] || {}).map(key => ({
            wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length).slice(0, 20)) + 2
        }));
        worksheet['!cols'] = colWidths;

        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'OC Tickets');
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="oc_tickets_report_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('OC Export Error:', error);
        res.status(500).json({ message: 'Failed to export tickets' });
    }
};

module.exports = {
    createOCTicket,
    getOCTickets,
    getOCTicketById,
    updateReporterSection,
    departmentRepAction,
    departmentManagerApprove,
    hseControllerAction,
    submitInvestigation,
    finalDecision,
    uploadOCAttachments,
    getOCUsers,
    createOCUser,
    updateOCUser,
    deleteOCUser,
    toggleOCUserStatus,
    getOCAnalytics,
    downloadOCUserTemplate,
    importOCUsers,
    exportOCTickets
};
