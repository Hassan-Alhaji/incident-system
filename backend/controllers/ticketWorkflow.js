const prisma = require('../prismaClient');
const { createNotification, createNotificationsBulk } = require('./notificationController');
const logger = require('../lib/logger').child({ module: 'ticketWorkflow' });

const safeParseJSON = (data, fallback = []) => {
    if (!data) return fallback;
    try { return typeof data === 'string' ? JSON.parse(data) : data; }
    catch { return fallback; }
};

/**
 * Dispatch closure-violation notifications:
 *   • Department reps  → for WARNING or FINANCIAL  (info-only, full context)
 *   • Finance reps     → for FINANCIAL only        (info-only, SP + dept + amount)
 *
 * Both notifications are read-only and require no action from recipients.
 * Failure to notify must never block ticket closure — every call is wrapped in catch.
 */
const dispatchClosureViolationNotifications = async (ticket, { violationType, violationDescription, violationAmount }) => {
    const isFinViolation = violationType === 'FINANCIAL';
    const isWarning      = violationType === 'WARNING';
    if (!isFinViolation && !isWarning) return;

    const note   = (violationDescription || '').trim() || '(لا توجد ملاحظات — no note provided)';
    const ticketNo = ticket.ticketNo || ticket.id;

    // Responsible department: prefer ticket's own dept, fall back to service-provider's responsible dept
    const responsibleDeptId   = ticket.departmentId || ticket.serviceProvider?.responsibleDepartmentId || null;
    const responsibleDeptName = ticket.department?.name || ticket.serviceProvider?.department?.name || null;

    // 1) Department reps — warning OR financial
    if (responsibleDeptId) {
        try {
            const depReps = await prisma.user.findMany({
                where: { repDepartmentId: responsibleDeptId, role: { in: ['DEP_REP', 'DEP_MANAGER'] }, status: 'ACTIVE' },
                select: { id: true }
            });
            if (depReps.length) {
                const kind = isFinViolation ? 'Financial Violation' : 'Warning Violation';
                const amountLine = isFinViolation ? `\nAmount: ${violationAmount} SAR` : '';
                const msg =
`Ticket ${ticketNo} has been closed with a ${kind}.${amountLine}
Controller's note: ${note}
(For your information — no action required.)`;
                await createNotificationsBulk(
                    depReps.map(r => r.id),
                    `Ticket Closed — ${kind}`,
                    msg,
                    'INFO',
                    `/tickets/${ticket.id}`
                );
            }
        } catch (err) { logger.error({ err }, 'Dep-rep closure notify failed'); }
    } else {
        // No department found — log warning so it doesn't fail silently
        logger.warn({ ticketId: ticket.id, ticketNo }, 'Violation closure: no responsible department found — department notification skipped');
        // Notify the controllers so they're aware the notification wasn't sent
        try {
            const controllers = await prisma.user.findMany({ where: { role: { in: ['HSE_CONTROLLER', 'SAFETY_MANAGER'] }, status: 'ACTIVE' }, select: { id: true } });
            if (controllers.length) {
                await createNotificationsBulk(
                    controllers.map(c => c.id),
                    `⚠️ Violation Notice Not Delivered`,
                    `Ticket ${ticketNo} was closed with a violation, but no responsible department was found. The department was NOT notified. Please verify the ticket's department assignment.`,
                    'INFO',
                    `/tickets/${ticket.id}`
                );
            }
        } catch (err) { logger.error({ err }, 'Fallback controller notify failed'); }
    }

    // 2) Finance reps — financial only, with SP contact + responsible dept (NO ticket details)
    if (isFinViolation) {
        try {
            const financeReps = await prisma.user.findMany({
                where: { role: 'FINANCE_REP', status: 'ACTIVE' },
                select: { id: true }
            });
            if (financeReps.length) {
                const sp = ticket.serviceProvider;
                const spLines = sp
                    ? [
                        `Service Provider: ${sp.nameAr ? `${sp.name} / ${sp.nameAr}` : sp.name}`,
                        `Commercial Reg.: ${sp.commercialRegistrationNumber || 'N/A'}`,
                        `Representative: ${sp.representativeName || 'N/A'}`,
                        `Email: ${sp.representativeEmail || 'N/A'}`,
                        `Mobile: ${sp.representativeMobile || 'N/A'}`,
                      ].join('\n')
                    : 'Service Provider: (not linked)';
                const deptLine = `Responsible Department: ${responsibleDeptName || 'N/A'}`;
                const msg =
`Ticket No.: ${ticketNo}
Violation Amount: ${violationAmount} SAR
Controller's note: ${note}

— ${spLines}
— ${deptLine}

(For your information — no action required.)`;
                await createNotificationsBulk(
                    financeReps.map(r => r.id),
                    `Financial Violation — Ticket ${ticketNo}`,
                    msg,
                    'INFO',
                    null  // intentionally no ticket link — finance must not see ticket details
                );
            }
        } catch (err) { logger.error({ err }, 'Finance closure notify failed'); }
    }
};

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
            if (!['OBSERVATION','SECURITY','ACCIDENT','VIOLATION','NEAR_MISS','INJURY','HEALTH','PROPERTY_DAMAGE','SECURITY_BREACH','OTHER'].includes(newType)) {
                return res.status(400).json({ message: 'Invalid ticket type provided' });
            }
            if (!typeChangeReason) return res.status(400).json({ message: 'Reason required when changing type' });
            await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: { originalType: ticket.type, typeChangeReason, incidentType: newType } });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { type: newType } });
            await prisma.activityLog.create({ data: { ticketId: ticket.id, actorId: req.user.id, action: 'STAGE_TYPE_CHANGED', details: `Type changed from ${ticket.type} to ${newType}. Reason: ${typeChangeReason}` } });
        }

        // Return to reporter
        if (action === 'RETURN_REPORTER') {
            if (!notes) return res.status(400).json({ message: 'Notes required' });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'RETURNED_TO_REPORTER', activityLogs: { create: { actorId: req.user.id, action: 'STAGE_RETURNED_TO_REPORTER', details: notes } } } });
            if (ticket.createdById) await createNotification(ticket.createdById, 'Ticket Returned', `Ticket ${ticket.ticketNo} returned for correction`, 'RETURNED', `/tickets/${ticket.id}`).catch(err => logger.error({ err }, 'Background task failed'));
            return res.json({ message: 'Returned to reporter', status: 'RETURNED_TO_REPORTER' });
        }

        // Notify HR (when employee injured) - Does not block workflow
        if (action === 'NOTIFY_HR') {
            await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: { hrAssignedAt: new Date() } });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { activityLogs: { create: { actorId: req.user.id, action: 'STAGE_HR_NOTIFIED', details: `HR has been notified to provide GOSI data. ${notes || ''}` } } } });
            // Notify HR reps
            const hrReps = await prisma.user.findMany({ where: { role: 'HR_REP', status: 'ACTIVE' }, select: { id: true } });
            if (hrReps.length > 0) await createNotificationsBulk(hrReps.map(hr => hr.id), 'GOSI Data Required', `Ticket ${ticket.ticketNo}: Please complete GOSI data for injured employee(s).`, 'INFO', `/tickets/${ticket.id}`);
            return res.json({ message: 'HR Notified', status: ticket.status });
        }

        // Route to responsible dept (Controller must fill RCA first!)
        if (action === 'ASSIGN') {
            if (!severity) return res.status(400).json({ message: 'Severity required' });
            if (!targetDepartmentId) return res.status(400).json({ message: 'Department required' });
            if (!notes || !notes.trim()) return res.status(400).json({ message: 'Controller notes required before routing' });

            const effectiveType = newType || ticket.type;
            const rcaRequired = true; // User requested RCA to always be present for all types
            
            const { rcaCause, rcaWhy, rcaRootCause, rcaCategory, rcaPreventiveActions } = req.body;
            
            if (rcaRequired) {
                if (!rcaCause || !rcaWhy || !rcaRootCause || !rcaCategory || !rcaPreventiveActions) {
                    return res.status(400).json({ message: 'All 5 RCA fields are required before assigning to a department.' });
                }
            }

            // Update OffCircuitReport with Controller info and RCA
            await prisma.offCircuitReport.update({ 
                where: { ticketId: ticket.id }, 
                data: { 
                    severity, 
                    hazardCategory: hazardCategory || null, 
                    controllerNotes: notes, 
                    controllerFilledBy: req.user.name, 
                    controllerFilledAt: new Date(), 
                    rcaRequired, 
                    responsibleDeptId: targetDepartmentId,
                    ...(rcaRequired ? { 
                        rcaCause, rcaWhy, rcaRootCause, rcaCategory, rcaPreventiveActions, 
                        rcaCompleted: true, rcaFilledBy: req.user.name, rcaFilledAt: new Date() 
                    } : {})
                } 
            });

            const targetDept = await prisma.department.findUnique({ where: { id: targetDepartmentId } });
            const deptName = targetDept ? (targetDept.nameAr || targetDept.name) : 'Unknown';

            await prisma.ticket.update({ 
                where: { id: ticket.id }, 
                data: { 
                    status: 'ASSIGNED', 
                    severityLevel: severity, 
                    departmentId: targetDepartmentId, 
                    activityLogs: { 
                        create: { 
                            actorId: req.user.id, 
                            action: 'STAGE_ASSIGNED', 
                            details: `Controller completed RCA and assigned to: ${deptName}. Severity: ${severity}. ${notes}` 
                        } 
                    } 
                } 
            });

            const depReps = await prisma.user.findMany({ where: { repDepartmentId: targetDepartmentId, role: 'DEP_REP', status: 'ACTIVE' }, select: { id: true } });
            if (depReps.length > 0) await createNotificationsBulk(depReps.map(rep => rep.id), 'Ticket Assigned', `Ticket ${ticket.ticketNo} assigned to your department. RCA is ready for review.`, 'ASSIGNED', `/tickets/${ticket.id}`);
            
            // Check for employee injury to notify HR automatically
            let hasEmployeeInjury = false;
            const injured = safeParseJSON(ticket.offCircuitReport?.injuredPersons, []);
            hasEmployeeInjury = injured.some(p => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');

            if (hasEmployeeInjury) {
                await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: { hrAssignedAt: new Date() } });
                await prisma.ticket.update({ where: { id: ticket.id }, data: { activityLogs: { create: { actorId: req.user.id, action: 'STAGE_HR_NOTIFIED', details: `HR automatically notified to provide GOSI data.` } } } });
                const hrReps = await prisma.user.findMany({ where: { role: 'HR_REP', status: 'ACTIVE' }, select: { id: true } });
                if (hrReps.length > 0) await createNotificationsBulk(hrReps.map(hr => hr.id), 'GOSI Data Required', `Ticket ${ticket.ticketNo}: Please complete GOSI data for injured employee(s).`, 'INFO', `/tickets/${ticket.id}`);
            }

            return res.json({ message: 'RCA saved and ticket assigned to department', status: 'ASSIGNED' });
        }

        res.status(400).json({ message: 'Invalid action. Use: RETURN_REPORTER, NOTIFY_HR, ASSIGN' });
    } catch (error) {
        logger.error({ err: error }, 'Controller Action Error:');
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
        // if (ticket.status === 'CLOSED') return res.status(400).json({ message: 'Ticket is closed' }); // Removed to allow HR late updates

        const { injuredPersonsGosi, hrNotes } = req.body;

        let injuredPersons = safeParseJSON(ticket.offCircuitReport?.injuredPersons, []);
        const employeeInjured = injuredPersons.filter(p => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');

        // Validate per-person GOSI
        if (Array.isArray(injuredPersonsGosi) && injuredPersonsGosi.length > 0) {
            if (injuredPersonsGosi.length !== employeeInjured.length) {
                return res.status(400).json({ message: 'Must provide GOSI data for ALL injured employees' });
            }
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
        if (injuredPersonsGosi && injuredPersonsGosi.length > 0) {
            const anySubmitted = injuredPersonsGosi.some(g => g.gosiSubmitted);
            reportUpdate.gosiSubmitted = anySubmitted;
            
            const submittedGosi = injuredPersonsGosi.find(g => g.gosiSubmitted) || injuredPersonsGosi[0];
            reportUpdate.gosiEmployeeId = submittedGosi.gosiEmployeeId;
            if (submittedGosi.gosiSubmitted) { 
                reportUpdate.gosiReportDate = submittedGosi.gosiReportDate ? new Date(submittedGosi.gosiReportDate) : null; 
                reportUpdate.gosiReportNumber = submittedGosi.gosiReportNumber || null; 
            } else {
                reportUpdate.gosiNoReason = submittedGosi.gosiNoReason || null;
            }
        }
        if (hrNotes !== undefined) reportUpdate.hrNotes = hrNotes;

        await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: reportUpdate });
        await prisma.ticket.update({ where: { id: ticket.id }, data: { activityLogs: { create: { actorId: req.user.id, action: 'STAGE_HR_UPDATED', details: 'HR updated GOSI data/notes' } } } });

        res.json({ message: 'HR notes and GOSI data saved successfully', status: ticket.status });
    } catch (error) {
        logger.error({ err: error }, 'HR Action Error:');
        res.status(500).json({ message: error.message });
    }
};

// ===== DEPARTMENT REP ACTION =====
const departmentAction = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { offCircuitReport: true } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (!['DEP_REP', 'DEP_MANAGER', 'ADMIN'].includes(role)) return res.status(403).json({ message: 'Only department reps and managers' });
        if (!['ASSIGNED', 'RETURNED_TO_DEPARTMENT'].includes(ticket.status)) return res.status(400).json({ message: 'Ticket not in assignable state' });

        if (role === 'DEP_REP' || role === 'DEP_MANAGER') {
            const isSameDept = ticket.departmentId && ticket.departmentId === req.user.repDepartmentId;
            if (!isSameDept) return res.status(403).json({ message: 'Not your department ticket' });
        }

        const existingPlansCount = await prisma.actionPlan.count({ where: { ticketId: ticket.id } });
        if (existingPlansCount === 0) {
            return res.status(400).json({
                message: 'You must add at least one action plan before submitting.',
                code: 'MISSING_ACTION_PLANS'
            });
        }

        await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: { depRepFilledBy: req.user.name, depRepFilledAt: new Date() } });
        await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'UNDER_REVIEW', activityLogs: { create: { actorId: req.user.id, action: 'STAGE_DEPT_RESPONDED', details: 'Department submitted response & action plans' } } } });

        const controllers = await prisma.user.findMany({ where: { role: 'HSE_CONTROLLER', status: 'ACTIVE' }, select: { id: true } });
        if (controllers.length > 0) await createNotificationsBulk(controllers.map(c => c.id), 'Department Response', `Ticket ${ticket.ticketNo}: Department responded`, 'DEP_RESPONSE', `/tickets/${ticket.id}`);

        res.json({ message: 'Department response submitted', status: 'UNDER_REVIEW' });
    } catch (error) {
        logger.error({ err: error }, 'Department Action Error:');
        res.status(500).json({ message: error.message });
    }
};

// ===== CONTROLLER FINAL REVIEW =====
const controllerFinalReview = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { offCircuitReport: true, actionPlans: true, serviceProvider: { include: { department: true } }, department: true } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const { role } = req.user;
        if (!['HSE_CONTROLLER', 'SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'].includes(role)) return res.status(403).json({ message: 'Not authorized' });
        if (ticket.status !== 'UNDER_REVIEW') return res.status(400).json({ message: 'Ticket not in reviewable state' });

        const { action, notes, reminderDate, reminderMessage } = req.body;

        if (action === 'RETURN_DEPARTMENT') {
            if (!notes) return res.status(400).json({ message: 'Notes required' });
            
            const newStatus = 'RETURNED_TO_DEPARTMENT';
            await prisma.ticket.update({ 
                where: { id: ticket.id }, 
                data: { 
                    status: newStatus, 
                    offCircuitReport: { update: { controllerNotes: notes, controllerFilledBy: req.user.name, controllerFilledAt: new Date() } },
                    activityLogs: { create: { actorId: req.user.id, action: newStatus, details: notes } } 
                } 
            });
            
            if (ticket.departmentId) {
                const depReps = await prisma.user.findMany({ where: { repDepartmentId: ticket.departmentId, role: 'DEP_REP', status: 'ACTIVE' }, select: { id: true } });
                if (depReps.length > 0) await createNotificationsBulk(depReps.map(rep => rep.id), 'Ticket Returned', `Ticket ${ticket.ticketNo} returned for revision. Notes: ${notes}`, 'RETURNED', `/tickets/${ticket.id}`);
            }
            return res.json({ message: 'Returned to department', status: newStatus });
        }

        if (action === 'REMIND_HR') {
            const hrReps = await prisma.user.findMany({ where: { role: 'HR_REP', status: 'ACTIVE' }, select: { id: true } });
            if (hrReps.length > 0) {
                await createNotificationsBulk(hrReps.map(rep => rep.id), 'GOSI Missing', `Reminder: Please confirm the GOSI report for Ticket ${ticket.ticketNo}`, 'INFO', `/tickets/${ticket.id}`);
            }
            await prisma.activityLog.create({ data: { ticketId: ticket.id, actorId: req.user.id, action: 'REMINDER_SET', details: 'Reminded HR to fill GOSI data.' } });
            return res.json({ message: 'HR has been reminded successfully', status: ticket.status });
        }

        if (action === 'SET_REMINDER') {
            if (!reminderDate || !reminderMessage) return res.status(400).json({ message: 'Reminder date and message required' });
            const reminderDt = new Date(reminderDate);
            if (isNaN(reminderDt.getTime())) return res.status(400).json({ message: 'Invalid reminder date' });
            const today = new Date(); today.setHours(0, 0, 0, 0);
            if (reminderDt < today) return res.status(400).json({ message: 'Reminder date must be today or in the future' });
            await prisma.reminder.create({ data: { ticketId: ticket.id, message: reminderMessage, reminderDate: reminderDt, createdById: req.user.id } });
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'PENDING_REMINDER', activityLogs: { create: { actorId: req.user.id, action: 'REMINDER_SET', details: `Reminder: ${reminderMessage} (${reminderDate})` } } } });
            return res.json({ message: 'Reminder set', status: 'PENDING_REMINDER' });
        }

        if (action === 'ESCALATE') {
            await prisma.ticket.update({ 
                where: { id: ticket.id }, 
                data: { 
                    status: 'ESCALATED', 
                    escalatedToRole: 'SAFETY_MANAGER', 
                    offCircuitReport: { update: { rcaRequired: true, controllerNotes: notes || 'Escalated to Safety Manager', controllerFilledBy: req.user.name, controllerFilledAt: new Date() } }, 
                    activityLogs: { create: { actorId: req.user.id, action: 'ESCALATED', details: notes || 'Escalated to Safety Manager' } } 
                } 
            });
            const managers = await prisma.user.findMany({ where: { role: { in: ['SAFETY_MANAGER', 'OC_HSE_MANAGER'] }, status: 'ACTIVE' }, select: { id: true } });
            if (managers.length > 0) await createNotificationsBulk(managers.map(m => m.id), 'Ticket Escalated', `Ticket ${ticket.ticketNo} escalated`, 'ESCALATED', `/tickets/${ticket.id}`);
            return res.json({ message: 'Escalated', status: 'ESCALATED' });
        }

        

        if (action === 'CLOSE') {
            const { violationType, violationDescription, violationAmount } = req.body;
            
            const injured = safeParseJSON(ticket.offCircuitReport?.injuredPersons, []);
            const hasEmployeeInjury = injured.some(p => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');

            let finalViolationType = violationType;
            if (hasEmployeeInjury) {
                finalViolationType = 'NONE';
            }

            if (ticket.offCircuitReport?.rcaRequired && !ticket.offCircuitReport?.rcaCompleted) return res.status(400).json({ message: 'Cannot close: RCA required but not completed' });
            
            // If RCA was required, Action Plans must be present before closing
            if (ticket.offCircuitReport?.rcaRequired || ticket.type === 'SECURITY') {
                const existingPlans = await prisma.actionPlan.count({ where: { ticketId: ticket.id } });
                if (existingPlans === 0) {
                    return res.status(400).json({ message: 'Cannot close: Action plans are required for incidents that underwent RCA or Security incidents.' });
                }
            }

            if (!finalViolationType) {
                return res.status(400).json({ message: 'Violation type is required' });
            }

            if (finalViolationType !== 'NONE' && !violationDescription) {
                return res.status(400).json({ message: 'Violation description is required' });
            }

            if (finalViolationType === 'FINANCIAL' && !violationAmount) {
                return res.status(400).json({ message: 'Violation amount is required when there is a financial violation' });
            }

            const isFinViolation = finalViolationType === 'FINANCIAL';

            await prisma.ticket.update({ 
                where: { id: ticket.id }, 
                data: { 
                    status: 'CLOSED', 
                    closedBy: req.user.name, 
                    closedByRole: role, 
                    closedAt: new Date(), 
                    closureReason: violationDescription || notes || 'Closed', 
                    hasFinancialViolation: isFinViolation,
                    violationDescription: violationDescription || null,
                    violationAmount: isFinViolation ? violationAmount : null,
                    forwardedToFinance: isFinViolation,
                    activityLogs: { 
                        create: { 
                            actorId: req.user.id, 
                            action: 'STAGE_CLOSED', 
                            details: notes || violationDescription || 'Closed'
                        } 
                    } 
                } 
            });
            if (ticket.createdById) {
                const closeMsg = "Thank you for your report. The issue has been fully resolved. If you have any questions or additional requests, please contact the HSE Department.";
                await createNotification(ticket.createdById, 'Ticket Closed', closeMsg, 'CLOSED', `/tickets/${ticket.id}`).catch(err => logger.error({ err }, 'Background task failed'));
            }
            
            dispatchClosureViolationNotifications(ticket, {
                violationType: finalViolationType,
                violationDescription,
                violationAmount,
            }).catch(err => logger.error({ err }, 'Closure violation notify failed'));
            return res.json({ message: 'Ticket closed', status: 'CLOSED' });
        }

        res.status(400).json({ message: 'Invalid action' });
    } catch (error) {
        logger.error({ err: error }, 'Controller Review Error:');
        res.status(500).json({ message: error.message });
    }
};

// ===== SAFETY MANAGER ACTIONS =====
const safetyManagerAction = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { offCircuitReport: true, serviceProvider: { include: { department: true } }, department: true } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        const { role } = req.user;
        if (!['SAFETY_MANAGER', 'OC_HSE_MANAGER', 'ADMIN'].includes(role)) return res.status(403).json({ message: 'Only Safety Manager' });
        if (ticket.status !== 'ESCALATED') return res.status(400).json({ message: 'Ticket not escalated' });

        const { action, notes } = req.body;

        

        if (action === 'RETURN') {
            await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'UNDER_REVIEW', escalatedToRole: null, activityLogs: { create: { actorId: req.user.id, action: 'RETURNED_FROM_ESCALATION', details: notes || 'Returned to controller' } } } });
            return res.json({ message: 'Returned to controller', status: 'UNDER_REVIEW' });
        }

        if (action === 'ESCALATE_DEPT') {
            const { targetDepartmentId } = req.body;
            if (!targetDepartmentId) return res.status(400).json({ message: 'Department is required' });
            const targetDept = await prisma.department.findUnique({ where: { id: targetDepartmentId } });
            const deptName = targetDept ? (targetDept.nameAr || targetDept.name) : 'Unknown';
            await prisma.ticket.update({ 
                where: { id: ticket.id }, 
                data: { 
                    status: 'ASSIGNED', 
                    escalatedToRole: null, 
                    departmentId: targetDepartmentId, 
                    offCircuitReport: { update: { controllerNotes: notes || 'Escalated by Safety Manager', controllerFilledBy: req.user.name, controllerFilledAt: new Date(), responsibleDeptId: targetDepartmentId } },
                    activityLogs: { create: { actorId: req.user.id, action: 'ESCALATED_TO_DEPT', details: `Escalated to department: ${deptName}. Notes: ${notes || ''}` } } 
                } 
            });
            return res.json({ message: 'Escalated to department', status: 'ASSIGNED' });
        }

        if (action === 'REMIND_HR') {
            const hrReps = await prisma.user.findMany({ where: { role: 'HR_REP', status: 'ACTIVE' }, select: { id: true } });
            if (hrReps.length > 0) {
                await createNotificationsBulk(hrReps.map(rep => rep.id), 'GOSI Missing', `Reminder: Please confirm the GOSI report for Ticket ${ticket.ticketNo}`, 'INFO', `/tickets/${ticket.id}`);
            }
            await prisma.activityLog.create({ data: { ticketId: ticket.id, actorId: req.user.id, action: 'REMINDER_SET', details: 'Reminded HR to fill GOSI data.' } });
            return res.json({ message: 'HR has been reminded successfully', status: ticket.status });
        }

        if (action === 'CLOSE') {
            const { violationType, violationDescription, violationAmount } = req.body;
            const rcaOverridden = ticket.offCircuitReport?.rcaRequired && !ticket.offCircuitReport?.rcaCompleted;

            const injured = safeParseJSON(ticket.offCircuitReport?.injuredPersons, []);
            const hasEmployeeInjury = injured.some(p => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');

            let finalViolationType = violationType;
            if (hasEmployeeInjury) {
                finalViolationType = 'NONE';
            }

            if (!finalViolationType) {
                return res.status(400).json({ message: 'Violation type is required' });
            }
            if (finalViolationType !== 'NONE' && !violationDescription) {
                return res.status(400).json({ message: 'Violation description is required' });
            }
            if (finalViolationType === 'FINANCIAL' && !violationAmount) {
                return res.status(400).json({ message: 'Violation amount is required when there is a financial violation' });
            }

            const isFinViolation = finalViolationType === 'FINANCIAL';

            if (ticket.offCircuitReport) {
                await prisma.offCircuitReport.update({ where: { ticketId: ticket.id }, data: { finalDecision: 'CLOSE', finalNotes: violationDescription || notes, hseManagerFilledBy: req.user.name, hseManagerFilledAt: new Date() } });
            }
            await prisma.ticket.update({ 
                where: { id: ticket.id }, 
                data: { 
                    status: 'CLOSED', 
                    closedBy: req.user.name, 
                    closedByRole: role, 
                    closedAt: new Date(), 
                    closureReason: violationDescription || notes || 'Closed', 
                    hasFinancialViolation: isFinViolation,
                    violationDescription: violationDescription || null,
                    violationAmount: isFinViolation ? violationAmount : null,
                    forwardedToFinance: isFinViolation,
                    activityLogs: { 
                        create: { 
                            actorId: req.user.id, 
                            action: 'STAGE_CLOSED', 
                            details: (rcaOverridden ? `Closed by Safety Manager (RCA waived). ` : `Closed. `) + (violationDescription || notes || '')
                        } 
                    } 
                } 
            });
            if (ticket.createdById) {
                const closeMsg = "Thank you for your report. The issue has been fully resolved. If you have any questions or additional requests, please contact the HSE Department.";
                await createNotification(ticket.createdById, 'Ticket Closed', closeMsg, 'CLOSED', `/tickets/${ticket.id}`).catch(err => logger.error({ err }, 'Background task failed'));
            }

            dispatchClosureViolationNotifications(ticket, {
                violationType: finalViolationType,
                violationDescription,
                violationAmount,
            }).catch(err => logger.error({ err }, 'Closure violation notify failed'));
            return res.json({ message: 'Ticket closed', status: 'CLOSED' });
        }

        res.status(400).json({ message: 'Invalid action' });
    } catch (error) {
        logger.error({ err: error }, 'Safety Manager Error:');
        res.status(500).json({ message: error.message });
    }
};

module.exports = { controllerAction, hrAction, departmentAction, controllerFinalReview, safetyManagerAction };
