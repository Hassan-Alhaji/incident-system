const prisma = require('../prismaClient');
const crypto = require('crypto');
const qrcode = require('qrcode');

// ===== CREATE ACTION PLAN =====
const createActionPlan = async (req, res) => {
    try {
        const { id: ticketId } = req.params;
        const { type, description, targetDate } = req.body;

        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        if (!['ASSIGNED','RETURNED_TO_DEPARTMENT','ASSIGNED_TO_HR'].includes(ticket.status)) {
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
            data: { ticketId, actorId: req.user.id, action: 'ACTION_PLAN_CREATED', details: `${type} action plan submitted` }
        });

        res.status(201).json(plan);
    } catch (error) {
        console.error('Create Action Plan Error:', error);
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
        const { description, status, reviewNotes } = req.body;
        const plan = await prisma.actionPlan.findUnique({ where: { id: req.params.id } });
        if (!plan) return res.status(404).json({ message: 'Action plan not found' });

        const updateData = {};
        if (description) updateData.description = description;
        if (status) {
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
            data: { ticketId: plan.ticketId, actorId: req.user.id, action: 'ACTION_PLAN_UPDATED', details: `${plan.type} plan ${status || 'updated'}` }
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
        console.error('Upload AP Attachment Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ===== GET ACTION PLAN ATTACHMENT CONTENT =====
const getActionPlanAttachmentContent = async (req, res) => {
    try {
        // Try by direct ID first (new uploads), then fallback by URL for old mismatched records
        let att = await prisma.actionPlanAttachment.findUnique({ where: { id: req.params.id } });
        if (!att) {
            att = await prisma.actionPlanAttachment.findFirst({
                where: { url: { contains: req.params.id } }
            });
        }
        if (!att || !att.data) return res.status(404).json({ message: 'Not found' });
        res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${att.name}"`);
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
        const reminder = await prisma.reminder.update({
            where: { id: req.params.id },
            data: { isCompleted: true, completedAt: new Date(), completedNote }
        });

        // Move ticket back to UNDER_REVIEW
        await prisma.ticket.update({
            where: { id: reminder.ticketId },
            data: { status: 'UNDER_REVIEW', activityLogs: { create: { actorId: req.user.id, action: 'REMINDER_COMPLETED', details: completedNote || 'Reminder completed' } } }
        });

        res.json({ message: 'Reminder completed, ticket back to review', reminder });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ===== QR CODE FOR TICKET REPORT =====
const getTicketQRCode = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            select: { ticketNo: true, status: true, type: true, createdAt: true, severityLevel: true }
        });
        if (!ticket) return res.status(404).json({ message: 'Not found' });

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
        const att = await prisma.actionPlanAttachment.findUnique({ where: { id: req.params.id } });
        if (!att) return res.status(404).json({ message: 'Attachment not found' });
        await prisma.actionPlanAttachment.delete({ where: { id: req.params.id } });
        res.json({ message: 'Attachment deleted' });
    } catch (error) {
        console.error('Delete AP Attachment Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { createActionPlan, getActionPlans, updateActionPlan, uploadActionPlanAttachment, getActionPlanAttachmentContent, deleteActionPlanAttachment, createReminder, getReminders, completeReminder, getTicketQRCode };
