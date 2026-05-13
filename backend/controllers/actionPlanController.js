const prisma = require('../prismaClient');
const crypto = require('crypto');
const qrcode = require('qrcode');
const { createNotification, createNotificationsBulk } = require('./notificationController');
const logger = require('../lib/logger').child({ module: 'actionPlanController' });

// ===== CREATE ACTION PLAN =====
const createActionPlan = async (req, res) => {
    try {
        const { id: ticketId } = req.params;
        const { type, description, targetDate } = req.body;

        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        if (!['ASSIGNED','RETURNED_TO_DEPARTMENT',].includes(ticket.status)) {
            return res.status(400).json({ message: 'Ticket not in assignable state' });
        }

        if (!type || !['IMMEDIATE','SHORT_TERM','LONG_TERM'].includes(type)) {
            return res.status(400).json({ message: 'Valid type required' });
        }
        if (!description?.trim()) return res.status(400).json({ message: 'Description required' });

        const dataPayload = {
            ticketId,
            type,
            description: description.trim(),
            departmentId: ticket.departmentId,
            submittedBy: req.user.name,
            submittedAt: new Date(),
            status: 'SUBMITTED'
        };
        
        if (targetDate) {
            dataPayload.targetDate = new Date(targetDate);
        }

        const plan = await prisma.actionPlan.create({
            data: dataPayload,
            include: { attachments: true, department: { select: { name: true, nameAr: true } } }
        });

        await prisma.activityLog.create({
            data: { ticketId, actorId: req.user.id, action: 'STAGE_PLAN_CREATED', details: `${type} action plan submitted` }
        });

        res.status(201).json(plan);
    } catch (error) {
        logger.error({ err: error }, 'Create Action Plan Error:');
        res.status(500).json({ message: error.message });
    }
};

// ===== GET ACTION PLANS =====
const getActionPlans = async (req, res) => {
    try {
        const plans = await prisma.actionPlan.findMany({
            where: { ticketId: req.params.id },
            include: { attachments: true, department: { select: { name: true, nameAr: true } } },
            orderBy: { createdAt: 'asc' }
        });
        res.json(plans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ===== UPDATE ACTION PLAN =====
const updateActionPlan = async (req, res) => {
    try {
        const { description, status, reviewNotes, targetDate } = req.body;
        const plan = await prisma.actionPlan.findUnique({ where: { id: req.params.id } });
        if (!plan) return res.status(404).json({ message: 'Action plan not found' });

        const isControllerRole = ['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'].includes(req.user.role);
        const isDeptRep = req.user.role === 'DEP_REP' && req.user.repDepartmentId === plan.departmentId;

        if (!isControllerRole && !isDeptRep) {
            return res.status(403).json({ message: 'Not authorized to modify this action plan' });
        }

        const updateData = {};
        if (description) updateData.description = description;
        if (targetDate) updateData.targetDate = new Date(targetDate);
        if (status) {
            if ((status === 'APPROVED' || status === 'REJECTED') && !isControllerRole) {
                return res.status(403).json({ message: 'Not authorized to review action plans' });
            }
            updateData.status = status;
            if (status === 'APPROVED' || status === 'REJECTED') {
                updateData.reviewedBy = req.user.name;
                updateData.reviewedAt = new Date();
                updateData.reviewNotes = reviewNotes || null;
            }
        }

        const updated = await prisma.actionPlan.update({
            where: { id: req.params.id },
            data: updateData,
            include: { attachments: true }
        });

        await prisma.activityLog.create({
            data: { ticketId: plan.ticketId, actorId: req.user.id, action: 'STAGE_PLAN_UPDATED', details: `${plan.type} plan ${status || 'updated'}` }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ===== UPLOAD ACTION PLAN ATTACHMENTS =====
const uploadActionPlanAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        const files = req.files;
        if (!files || files.length === 0) return res.status(400).json({ message: 'No files' });

        const plan = await prisma.actionPlan.findUnique({ where: { id } });
        if (!plan) return res.status(404).json({ message: 'Action plan not found' });

        const created = [];
        for (const file of files) {
            const attId = crypto.randomUUID(); // single ID used for both DB record and URL
            const att = await prisma.actionPlanAttachment.create({
                data: {
                    id: attId,
                    actionPlanId: id,
                    url: `/api/action-plan-attachments/${attId}/content`,
                    name: file.originalname,
                    type: file.mimetype.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
                    size: file.size,
                    mimeType: file.mimetype,
                    data: file.buffer
                }
            });
            created.push(att);
        }

        await prisma.activityLog.create({
            data: { ticketId: plan.ticketId, actorId: req.user.id, action: 'ACTION_PLAN_EVIDENCE', details: `${files.length} evidence file(s) uploaded for ${plan.type} plan` }
        });

        res.json({ message: `${files.length} file(s) uploaded`, attachments: created });
    } catch (error) {
        logger.error({ err: error }, 'Upload AP Attachment Error:');
        res.status(500).json({ message: error.message });
    }
};

// ===== GET ACTION PLAN ATTACHMENT CONTENT =====
const getActionPlanAttachmentContent = async (req, res) => {
    try {
        // Try by direct ID first (new uploads), then fallback by URL for old mismatched records
        let att = await prisma.actionPlanAttachment.findUnique({ 
            where: { id: req.params.id },
            include: { actionPlan: { include: { ticket: true } } }
        });
        if (!att) {
            att = await prisma.actionPlanAttachment.findFirst({
                where: { url: { contains: req.params.id } },
                include: { actionPlan: { include: { ticket: true } } }
            });
        }
        if (!att || !att.data) return res.status(404).json({ message: 'Not found' });

        // IDOR Protection: Verify user is authorized to view this attachment
        const role = req.user.role;
        const userId = req.user.id;
        const ticket = att.actionPlan?.ticket;
        const plan = att.actionPlan;
        
        if (ticket) {
            const isControllerOrAdmin = ['ADMIN', 'HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER'].includes(role);
            if (!isControllerOrAdmin) {
                let canView = false;
                const userDeptId = req.user.repDepartmentId;

                if (['OC_REPORTER', 'REPORTER'].includes(role)) {
                    canView = (ticket.createdById === userId);
                } else if (role === 'DEP_REP') {
                    canView = (ticket.assignedToId === userId) || (ticket.departmentId === userDeptId) || (plan.departmentId === userDeptId);
                } else if (role === 'DEP_MANAGER') {
                    canView = (ticket.assignedToId === userId) || (ticket.status === 'ESCALATED' && ticket.departmentId === userDeptId);
                } else if (role === 'HR_REP') {
                    canView = (ticket.assignedToId === userId) || (ticket.hasInjury === true);
                } else if (role === 'SERVICE_PROVIDER_REP') {
                    canView = (ticket.assignedToId === userId) || (ticket.serviceProviderId === req.user.serviceProviderId);
                }

                if (!canView) {
                    return res.status(403).json({ message: 'Not authorized to view this attachment' });
                }
            }
        }
        const safeInlineMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        const isSafeInline = safeInlineMimeTypes.includes(att.mimeType);
        const disposition = isSafeInline ? 'inline' : 'attachment';

        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'none'; sandbox;");
        res.setHeader('Content-Type', isSafeInline ? att.mimeType : 'application/octet-stream');
        res.setHeader('Content-Disposition', `${disposition}; filename="${att.name || 'attachment'}"`);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(att.data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ===== REMINDERS =====
const createReminder = async (req, res) => {
    try {
        const { message, reminderDate } = req.body;
        if (!message || !reminderDate) return res.status(400).json({ message: 'Message and date required' });

        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const reminder = await prisma.reminder.create({
            data: { ticketId: req.params.id, message, reminderDate: new Date(reminderDate), createdById: req.user.id }
        });

        res.status(201).json(reminder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getReminders = async (req, res) => {
    try {
        const reminders = await prisma.reminder.findMany({
            where: { ticketId: req.params.id },
            include: { createdBy: { select: { name: true } } },
            orderBy: { reminderDate: 'desc' }
        });
        res.json(reminders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const completeReminder = async (req, res) => {
    try {
        const { completedNote } = req.body;
        const reminder = await prisma.reminder.findUnique({
            where: { id: req.params.id },
            include: { ticket: true }
        });

        if (!reminder) return res.status(404).json({ message: 'Reminder not found' });

        const isControllerRole = ['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'].includes(req.user.role);
        const isDeptRep = req.user.role === 'DEP_REP' && req.user.repDepartmentId === reminder.ticket.departmentId;

        if (!isControllerRole && !isDeptRep) {
            return res.status(403).json({ message: 'Not authorized to complete this reminder' });
        }

        const updatedReminder = await prisma.reminder.update({
            where: { id: req.params.id },
            data: { isCompleted: true, completedAt: new Date(), completedNote }
        });

        // Move ticket back to UNDER_REVIEW
        await prisma.ticket.update({
            where: { id: reminder.ticketId },
            data: { status: 'UNDER_REVIEW', activityLogs: { create: { actorId: req.user.id, action: 'REMINDER_COMPLETED', details: completedNote || 'Reminder completed' } } }
        });

        // Notify the controller who created the reminder, or all controllers if unknown
        if (reminder.createdById) {
            await createNotification(reminder.createdById, 'Reminder Completed', `The department has completed the reminder for Ticket ${reminder.ticket.ticketNo}. It is now ready for your review.`, 'INFO', `/tickets/${reminder.ticketId}`);
        } else {
            const controllers = await prisma.user.findMany({ where: { role: { in: ['HSE_CONTROLLER', 'SAFETY_MANAGER'] }, status: 'ACTIVE' }, select: { id: true } });
            if (controllers.length > 0) {
                await createNotificationsBulk(controllers.map(c => c.id), 'Reminder Completed', `The department has completed a reminder for Ticket ${reminder.ticket.ticketNo}. It is now ready for your review.`, 'INFO', `/tickets/${reminder.ticketId}`);
            }
        }

        res.json({ message: 'Reminder completed, ticket back to review', reminder: updatedReminder });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ===== QR CODE FOR TICKET REPORT =====
const getTicketQRCode = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            select: { ticketNo: true, status: true, type: true, createdAt: true, severityLevel: true, createdById: true, assignedToId: true, departmentId: true, serviceProviderId: true, hasInjury: true }
        });
        if (!ticket) return res.status(404).json({ message: 'Not found' });

        const { role, id: userId } = req.user;
        const isControllerOrAdmin = ['ADMIN', 'HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER'].includes(role);
        
        if (!isControllerOrAdmin) {
            let canView = false;
            const userDeptId = req.user.repDepartmentId;

            if (['OC_REPORTER', 'REPORTER'].includes(role)) {
                canView = (ticket.createdById === userId);
            } else if (role === 'DEP_REP') {
                canView = (ticket.assignedToId === userId) || (ticket.departmentId === userDeptId);
            } else if (role === 'DEP_MANAGER') {
                canView = (ticket.assignedToId === userId) || (ticket.status === 'ESCALATED' && ticket.departmentId === userDeptId);
            } else if (role === 'HR_REP') {
                canView = (ticket.assignedToId === userId) || (ticket.hasInjury === true);
            } else if (role === 'SERVICE_PROVIDER_REP') {
                canView = (ticket.assignedToId === userId) || (ticket.serviceProviderId === req.user.serviceProviderId);
            }

            if (!canView) {
                return res.status(403).json({ message: 'Not authorized to view this ticket' });
            }
        }

        const text = [
            'SMC HSE Platform',
            `Ticket: ${ticket.ticketNo}`,
            `Type: ${ticket.type}`,
            `Status: ${ticket.status}`,
            ticket.severityLevel ? `Severity: ${ticket.severityLevel}` : '',
            `Date: ${new Date(ticket.createdAt).toLocaleDateString('en-GB')}`,
            'Authorized by SMC HSE Department',
        ].filter(Boolean).join('\n');

        const png = await qrcode.toBuffer(text, { width: 220, margin: 2, color: { dark: '#1e3a5f', light: '#ffffff' } });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(png);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ===== DELETE ACTION PLAN ATTACHMENT =====
const deleteActionPlanAttachment = async (req, res) => {
    try {
        const att = await prisma.actionPlanAttachment.findUnique({ 
            where: { id: req.params.id },
            include: { actionPlan: true }
        });
        if (!att) return res.status(404).json({ message: 'Attachment not found' });

        const plan = att.actionPlan;
        const isControllerRole = ['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'].includes(req.user.role);
        const isDeptRep = req.user.role === 'DEP_REP' && req.user.repDepartmentId === plan.departmentId;

        if (!isControllerRole && !isDeptRep) {
            return res.status(403).json({ message: 'Not authorized to delete this attachment' });
        }

        await prisma.actionPlanAttachment.delete({ where: { id: req.params.id } });
        res.json({ message: 'Attachment deleted' });
    } catch (error) {
        logger.error({ err: error }, 'Delete AP Attachment Error:');
        res.status(500).json({ message: error.message });
    }
};

module.exports = { createActionPlan, getActionPlans, updateActionPlan, uploadActionPlanAttachment, getActionPlanAttachmentContent, deleteActionPlanAttachment, createReminder, getReminders, completeReminder, getTicketQRCode };
