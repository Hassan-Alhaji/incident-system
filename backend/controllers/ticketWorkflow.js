const prisma = require('../prismaClient');
const { createNotification } = require('./notificationController');

// ===== CONTROLLER ACTION =====
const controllerAction = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { offCircuitReport: true } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (!['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'].includes(role))
            return res.status(403).json({ message: 'Not authorized' });

        const { action, notes, severity, targetDepartmentId, newType, typeChangeReason, hazardCategory } = req.body;

        if (newType && newType !== ticket.type) {
            if (!typeChangeReason) return res.status(400).json({ message: 'Reason required when changing type' });
            await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: { originalType: ticket.type, typeChangeReason, incidentType: newType } });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { type: newType } });
            await prisma.activityLog.create({ data: { ticketId: ticket.id, actorId: req.user.id, action: 'TYPE_CHANGED', details: `Type changed from ${ticket.type} to ${newType}. Reason: ${typeChangeReason}` } });
        }

        // Return to reporter
        if (action === 'RETURN_REPORTER') {
            if (!notes) return res.status(400).json({ message: 'Notes required' });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'RETURNED_TO_REPORTER', activityLogs: { create: { actorId: req.user.id, action: 'RETURNED_TO_REPORTER', details: notes } } } });
            if (ticket.createdById) await createNotification(ticket.createdById, 'Ticket Returned', `Ticket ${ticket.ticketNo} returned for correction`, 'RETURNED', `/tickets/${ticket.id}`).catch(console.error);
            return res.json({ message: 'Returned to reporter', status: 'RETURNED_TO_REPORTER' });
        }

        // Assign to HR (when employee injured)
        if (action === 'ASSIGN_TO_HR') {
            if (!severity) return res.status(400).json({ message: 'Severity required' });
            const effectiveType = newType || ticket.type;
            const rcaRequired = effectiveType !== 'OBSERVATION';
            await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: { severity, hazardCategory: hazardCategory || null, controllerNotes: notes, controllerFilledBy: req.user.name, controllerFilledAt: new Date(), rcaRequired, hrAssignedAt: new Date() } });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'ASSIGNED_TO_HR', severityLevel: severity, activityLogs: { create: { actorId: req.user.id, action: 'ASSIGNED_TO_HR', details: `Assigned to HR for GOSI. Severity: ${severity}. ${notes || ''}` } } } });
            // Notify HR reps
            const hrReps = await prisma.user.findMany({ where: { role: 'HR_REP', status: 'ACTIVE' }, select: { id: true } });
            for (const hr of hrReps) await createNotification(hr.id, 'GOSI Required', `Ticket ${ticket.ticketNo}: Please complete GOSI data for injured employee`, 'ASSIGNED', `/tickets/${ticket.id}`).catch(console.error);
            // Notify controllers (watching)
            const controllers = await prisma.user.findMany({ where: { role: 'HSE_CONTROLLER', status: 'ACTIVE' }, select: { id: true } });
            for (const c of controllers) await createNotification(c.id, 'Ticket Pending HR', `Ticket ${ticket.ticketNo} is waiting for HR GOSI response`, 'INFO', `/tickets/${ticket.id}`).catch(console.error);
            return res.json({ message: 'Assigned to HR for GOSI', status: 'ASSIGNED_TO_HR' });
        }

        // Route to responsible dept (either directly or after HR completed)
        if (action === 'ASSIGN') {
            if (!severity) return res.status(400).json({ message: 'Severity required' });
            if (!targetDepartmentId) return res.status(400).json({ message: 'Department required' });
            if (!notes || !notes.trim()) return res.status(400).json({ message: 'Controller notes required before routing' });

            const effectiveType = newType || ticket.type;
            const rcaRequired = effectiveType !== 'OBSERVATION';
            await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: { severity, hazardCategory: hazardCategory || null, controllerNotes: notes, controllerFilledBy: req.user.name, controllerFilledAt: new Date(), rcaRequired, responsibleDeptId: targetDepartmentId } });
            const targetDept = await prisma.department.findUnique({ where: { id: targetDepartmentId } });
            const deptName = targetDept ? (targetDept.nameAr || targetDept.name) : 'Unknown';

            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'ASSIGNED', severityLevel: severity, departmentId: targetDepartmentId, activityLogs: { create: { actorId: req.user.id, action: 'TICKET_ASSIGNED', details: `Assigned to: ${deptName}. Severity: ${severity}. ${notes}` } } } });
            const depReps = await prisma.user.findMany({ where: { repDepartmentId: targetDepartmentId, role: 'DEP_REP', status: 'ACTIVE' }, select: { id: true } });
            for (const rep of depReps) await createNotification(rep.id, 'Ticket Assigned', `Ticket ${ticket.ticketNo} assigned to your department`, 'ASSIGNED', `/tickets/${ticket.id}`).catch(console.error);
            return res.json({ message: 'Ticket assigned to department', status: 'ASSIGNED' });
        }

        // Return HR to re-enter GOSI (from HR_COMPLETED)
        if (action === 'RETURN_HR') {
            if (!notes) return res.status(400).json({ message: 'Notes required' });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'ASSIGNED_TO_HR', activityLogs: { create: { actorId: req.user.id, action: 'RETURNED_TO_HR', details: notes } } } });
            const hrReps = await prisma.user.findMany({ where: { role: 'HR_REP', status: 'ACTIVE' }, select: { id: true } });
            for (const hr of hrReps) await createNotification(hr.id, 'GOSI Correction Required', `Ticket ${ticket.ticketNo}: Please review and correct GOSI data. Notes: ${notes}`, 'RETURNED', `/tickets/${ticket.id}`).catch(console.error);
            return res.json({ message: 'Returned to HR', status: 'ASSIGNED_TO_HR' });
        }

        res.status(400).json({ message: 'Invalid action. Use: RETURN_REPORTER, ASSIGN_TO_HR, ASSIGN, RETURN_HR' });
    } catch (error) {
        console.error('Controller Action Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ===== HR ACTION (submit GOSI data) =====
const hrAction = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { offCircuitReport: true } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (!['HR_REP', 'ADMIN'].includes(role)) return res.status(403).json({ message: 'Only HR representatives' });
        if (ticket.status !== 'ASSIGNED_TO_HR') return res.status(400).json({ message: 'Ticket not assigned to HR' });

        const { injuredPersonsGosi, contractorNotified, contractorNotifyDate, contractorNoReason } = req.body;

        let injuredPersons = ticket.offCircuitReport?.injuredPersons ? JSON.parse(ticket.offCircuitReport.injuredPersons) : [];
        const employeeInjured = injuredPersons.filter(p => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');

        // Validate per-person GOSI
        if (Array.isArray(injuredPersonsGosi) && injuredPersonsGosi.length > 0) {
            for (let i = 0; i < injuredPersonsGosi.length; i++) {
                const pg = injuredPersonsGosi[i];
                if (!pg.gosiEmployeeId) return res.status(400).json({ message: `Employee ID required for person #${i + 1}` });
                if (pg.gosiSubmitted === undefined || pg.gosiSubmitted === null) return res.status(400).json({ message: `GOSI status required for person #${i + 1}` });
                if (pg.gosiSubmitted && (!pg.gosiReportDate || !pg.gosiReportNumber)) return res.status(400).json({ message: `GOSI date and number required for person #${i + 1}` });
                if (!pg.gosiSubmitted && !pg.gosiNoReason) return res.status(400).json({ message: `Reason required for not submitting GOSI for person #${i + 1}` });
            }
            // Merge GOSI into injuredPersons
            let empIdx = 0;
            injuredPersons = injuredPersons.map(p => {
                if ((p.type === 'EMPLOYEE' || p.affiliate === 'Employee') && empIdx < injuredPersonsGosi.length) {
                    const g = injuredPersonsGosi[empIdx++];
                    return { ...p, gosiEmployeeId: g.gosiEmployeeId, gosiSubmitted: g.gosiSubmitted, gosiReportDate: g.gosiReportDate || null, gosiReportNumber: g.gosiReportNumber || null, gosiNoReason: g.gosiNoReason || null };
                }
                return p;
            });
        } else if (employeeInjured.length > 0) {
            return res.status(400).json({ message: 'GOSI data required for all injured employees' });
        }

        const reportUpdate = { injuredPersons: JSON.stringify(injuredPersons), hrFilledBy: req.user.name, hrFilledAt: new Date() };
        if (injuredPersonsGosi && injuredPersonsGosi[0]) {
            const first = injuredPersonsGosi[0];
            reportUpdate.gosiSubmitted = first.gosiSubmitted;
            reportUpdate.gosiEmployeeId = first.gosiEmployeeId;
            if (first.gosiSubmitted) { reportUpdate.gosiReportDate = first.gosiReportDate ? new Date(first.gosiReportDate) : null; reportUpdate.gosiReportNumber = first.gosiReportNumber || null; }
            else reportUpdate.gosiNoReason = first.gosiNoReason || null;
        }
        if (contractorNotified !== undefined) reportUpdate.contractorNotified = contractorNotified;
        if (contractorNotifyDate) reportUpdate.contractorNotifyDate = new Date(contractorNotifyDate);
        if (contractorNoReason) reportUpdate.contractorNoReason = contractorNoReason;

        // HR is the responsible department for employee-injury tickets — validate they
        // provided both required action plans before submitting to the controller for approval.
        const existingPlans = await prisma.actionPlan.findMany({ where: { ticketId: ticket.id }, select: { type: true } });
        const hasImmediate = existingPlans.some(p => p.type === 'IMMEDIATE');
        if (!hasImmediate) {
            return res.status(400).json({
                message: 'You must add at least an Immediate action plan before submitting.',
                code: 'MISSING_ACTION_PLANS'
            });
        }

        // Auto-assign HR department on the ticket so analytics/tracking attribute this to HR.
        const hrDept = await prisma.department.findFirst({
            where: { OR: [{ name: { contains: 'HR', mode: 'insensitive' } }, { nameAr: { contains: 'موارد' } }] },
            select: { id: true }
        });

        await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: reportUpdate });
        await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
                status: 'UNDER_REVIEW',
                ...(hrDept && !ticket.departmentId ? { departmentId: hrDept.id } : {}),
                activityLogs: { create: { actorId: req.user.id, action: 'HR_GOSI_SUBMITTED', details: 'HR completed GOSI data + action plans. Awaiting controller final review.' } }
            }
        });

        // Notify all controllers — HR is done, controller approves like any department response
        const controllers = await prisma.user.findMany({ where: { role: 'HSE_CONTROLLER', status: 'ACTIVE' }, select: { id: true } });
        for (const c of controllers) await createNotification(c.id, 'HR Response Submitted', `Ticket ${ticket.ticketNo}: HR completed GOSI data and action plans. Ready for your review.`, 'DEP_RESPONSE', `/tickets/${ticket.id}`).catch(console.error);

        res.json({ message: 'HR response submitted. Awaiting controller approval.', status: 'UNDER_REVIEW' });
    } catch (error) {
        console.error('HR Action Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ===== DEPARTMENT REP ACTION =====
const departmentAction = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { offCircuitReport: true } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (role !== 'DEP_REP' && role !== 'ADMIN') return res.status(403).json({ message: 'Only department reps' });
        if (!['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status)) return res.status(400).json({ message: 'Ticket not in assignable state' });

        if (role === 'DEP_REP') {
            const isSameDept = ticket.departmentId && ticket.departmentId === req.user.repDepartmentId;
            if (!isSameDept) return res.status(403).json({ message: 'Not your department ticket' });
        }

        await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: { depRepFilledBy: req.user.name, depRepFilledAt: new Date() } });
        await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'UNDER_REVIEW', activityLogs: { create: { actorId: req.user.id, action: 'DEP_REP_RESPONDED', details: 'Department submitted response & action plans' } } } });

        const controllers = await prisma.user.findMany({ where: { role: 'HSE_CONTROLLER', status: 'ACTIVE' }, select: { id: true } });
        for (const c of controllers) await createNotification(c.id, 'Department Response', `Ticket ${ticket.ticketNo}: Department responded`, 'DEP_RESPONSE', `/tickets/${ticket.id}`).catch(console.error);

        res.json({ message: 'Department response submitted', status: 'UNDER_REVIEW' });
    } catch (error) {
        console.error('Department Action Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ===== CONTROLLER FINAL REVIEW =====
const controllerFinalReview = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { offCircuitReport: true, actionPlans: true } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (!['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'].includes(role)) return res.status(403).json({ message: 'Not authorized' });
        if (!['UNDER_REVIEW', 'HR_COMPLETED'].includes(ticket.status)) return res.status(400).json({ message: 'Ticket not in reviewable state' });

        const { action, notes, reminderDate, reminderMessage } = req.body;

        if (action === 'RETURN_DEPARTMENT') {
            if (!notes) return res.status(400).json({ message: 'Notes required' });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'RETURNED_TO_DEPARTMENT', activityLogs: { create: { actorId: req.user.id, action: 'RETURNED_TO_DEPARTMENT', details: notes } } } });
            // Notify dept reps
            if (ticket.departmentId) {
                const depReps = await prisma.user.findMany({ where: { repDepartmentId: ticket.departmentId, role: 'DEP_REP', status: 'ACTIVE' }, select: { id: true } });
                for (const rep of depReps) await createNotification(rep.id, 'Ticket Returned', `Ticket ${ticket.ticketNo} returned for revision. Notes: ${notes}`, 'RETURNED', `/tickets/${ticket.id}`).catch(console.error);
            }
            return res.json({ message: 'Returned to department', status: 'RETURNED_TO_DEPARTMENT' });
        }

        if (action === 'SET_REMINDER') {
            if (!reminderDate || !reminderMessage) return res.status(400).json({ message: 'Reminder date and message required' });
            await prisma.reminder.create({ data: { ticketId: ticket.id, message: reminderMessage, reminderDate: new Date(reminderDate), createdById: req.user.id } });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'PENDING_REMINDER', activityLogs: { create: { actorId: req.user.id, action: 'REMINDER_SET', details: `Reminder: ${reminderMessage} (${reminderDate})` } } } });
            return res.json({ message: 'Reminder set', status: 'PENDING_REMINDER' });
        }

        if (action === 'ESCALATE') {
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'ESCALATED', escalatedToRole: 'SAFETY_MANAGER', offCircuitReport: { update: { rcaRequired: true } }, activityLogs: { create: { actorId: req.user.id, action: 'ESCALATED', details: notes || 'Escalated to Safety Manager' } } } });
            const managers = await prisma.user.findMany({ where: { role: { in: ['SAFETY_MANAGER', 'OC_HSE_MANAGER'] }, status: 'ACTIVE' }, select: { id: true } });
            for (const m of managers) await createNotification(m.id, 'Ticket Escalated', `Ticket ${ticket.ticketNo} escalated`, 'ESCALATED', `/tickets/${ticket.id}`).catch(console.error);
            return res.json({ message: 'Escalated', status: 'ESCALATED' });
        }

        if (action === 'PROCEED_RCA') {
            if (!ticket.offCircuitReport?.rcaRequired) return res.status(400).json({ message: 'RCA not required for this ticket' });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'UNDER_INVESTIGATION', activityLogs: { create: { actorId: req.user.id, action: 'RCA_STARTED', details: `Proceeding to RCA investigation. Notes: ${notes || 'None'}` } } } });
            return res.json({ message: 'Moved to RCA', status: 'UNDER_INVESTIGATION' });
        }

        if (action === 'CLOSE') {
            if (ticket.offCircuitReport?.rcaRequired && !ticket.offCircuitReport?.rcaCompleted) return res.status(400).json({ message: 'Cannot close: RCA required but not completed' });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED', closedBy: req.user.name, closedByRole: role, closedAt: new Date(), closureReason: notes, activityLogs: { create: { actorId: req.user.id, action: 'TICKET_CLOSED', details: notes || 'Ticket closed' } } } });
            if (ticket.createdById) await createNotification(ticket.createdById, 'Ticket Closed', `Ticket ${ticket.ticketNo} closed`, 'CLOSED', `/tickets/${ticket.id}`).catch(console.error);
            return res.json({ message: 'Ticket closed', status: 'CLOSED' });
        }

        res.status(400).json({ message: 'Invalid action' });
    } catch (error) {
        console.error('Controller Review Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ===== SUBMIT RCA =====
const submitRCA = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { offCircuitReport: true } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        const { role } = req.user;
        if (!['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'].includes(role) && !req.user.canPerformRCA) return res.status(403).json({ message: 'Not authorized for RCA' });
        if (!['UNDER_INVESTIGATION', 'ASSIGNED', 'UNDER_REVIEW'].includes(ticket.status)) return res.status(400).json({ message: 'Invalid state for RCA' });

        const { rcaCause, rcaWhy, rcaRootCause, rcaCategory, rcaPreventiveActions } = req.body;
        if (!rcaCause || !rcaWhy || !rcaRootCause || !rcaCategory || !rcaPreventiveActions) return res.status(400).json({ message: 'All 5 RCA fields are required' });

        await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: { rcaCause, rcaWhy, rcaRootCause, rcaCategory, rcaPreventiveActions, rcaCompleted: true, rcaFilledBy: req.user.name, rcaFilledAt: new Date() } });

        const updateData = { activityLogs: { create: { actorId: req.user.id, action: 'RCA_UPDATED', details: `RCA completed. Root cause: ${rcaRootCause.substring(0, 100)}...` } } };
        if (ticket.status === 'UNDER_INVESTIGATION') updateData.status = 'UNDER_REVIEW';
        await prisma.ticket.update({ where: { id: ticket.id }, data: updateData });

        // Notify controllers
        const controllers = await prisma.user.findMany({ where: { role: 'HSE_CONTROLLER', status: 'ACTIVE' }, select: { id: true } });
        for (const c of controllers) await createNotification(c.id, 'RCA Completed', `Ticket ${ticket.ticketNo}: RCA investigation completed. Please review and close.`, 'DEP_RESPONSE', `/tickets/${ticket.id}`).catch(console.error);

        res.json({ message: 'RCA saved', status: updateData.status || ticket.status });
    } catch (error) {
        console.error('RCA Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ===== SAFETY MANAGER ACTIONS =====
const safetyManagerAction = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { offCircuitReport: true } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        const { role } = req.user;
        if (!['SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'].includes(role)) return res.status(403).json({ message: 'Only Safety Manager' });
        if (ticket.status !== 'ESCALATED') return res.status(400).json({ message: 'Ticket not escalated' });

        const { action, notes, targetDepManagerId } = req.body;

        if (action === 'SEND_TO_DEP_MANAGER') {
            if (!targetDepManagerId) return res.status(400).json({ message: 'Department Manager ID required' });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { assignedToId: targetDepManagerId, activityLogs: { create: { actorId: req.user.id, action: 'SENT_TO_DEP_MANAGER', details: notes || 'Sent to Department Manager' } } } });
            await createNotification(targetDepManagerId, 'Review Required', `Ticket ${ticket.ticketNo} needs your review`, 'DEP_MANAGER', `/tickets/${ticket.id}`).catch(console.error);
            return res.json({ message: 'Sent to Department Manager' });
        }

        if (action === 'RETURN') {
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'RETURNED_TO_DEPARTMENT', escalatedToRole: null, activityLogs: { create: { actorId: req.user.id, action: 'RETURNED_FROM_ESCALATION', details: notes || 'Returned from escalation' } } } });
            return res.json({ message: 'Returned to department', status: 'RETURNED_TO_DEPARTMENT' });
        }

        if (action === 'CLOSE') {
            const rcaOverridden = ticket.offCircuitReport?.rcaRequired && !ticket.offCircuitReport?.rcaCompleted;
            await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: { finalDecision: 'CLOSE', finalNotes: notes, hseManagerFilledBy: req.user.name, hseManagerFilledAt: new Date() } });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED', closedBy: req.user.name, closedByRole: role, closedAt: new Date(), closureReason: notes, activityLogs: { create: { actorId: req.user.id, action: 'TICKET_CLOSED', details: rcaOverridden ? `Closed by Safety Manager (RCA waived). ${notes || ''}` : (notes || 'Closed') } } } });
            if (ticket.createdById) await createNotification(ticket.createdById, 'Ticket Closed', `Ticket ${ticket.ticketNo} closed by Safety Manager`, 'CLOSED', `/tickets/${ticket.id}`).catch(console.error);
            return res.json({ message: 'Ticket closed', status: 'CLOSED' });
        }

        res.status(400).json({ message: 'Invalid action' });
    } catch (error) {
        console.error('Safety Manager Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { controllerAction, hrAction, departmentAction, controllerFinalReview, submitRCA, safetyManagerAction };
