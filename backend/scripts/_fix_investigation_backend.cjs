const fs = require('fs');
let c = fs.readFileSync('controllers/ocTicketController.js', 'utf8');

const regex = /const submitInvestigation = async \s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?const mgr = await prisma\.user\.findUnique/m;

const newLogic = `const submitInvestigation = async (req, res) => {
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

        const { underlyingCauses, rootCauses, analysisMethod, investigatorSignature, targetDepManagerId, returnReason, action } = req.body;

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
                            details: \`Returned to Department Rep: \${returnReason}\`
                        }
                    }
                }
            });
            return res.json({ message: 'Returned to Department Representative' });
        }

        // 2. Action: RCA based routes
        if (!analysisMethod || !rootCauses || !underlyingCauses) {
            return res.status(400).json({ message: 'Analysis Method, Root Causes, and Underlying Causes are strictly required.' });
        }

        if (ticket.offCircuitReport) {
            await prisma.offCircuitReport.update({
                where: { ticketId: ticket.id },
                data: {
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

        const mgr = await prisma.user.findUnique`;

c = c.replace(regex, newLogic);

fs.writeFileSync('controllers/ocTicketController.js', c);
console.log('Fixed ocTicketController investigator routes');
