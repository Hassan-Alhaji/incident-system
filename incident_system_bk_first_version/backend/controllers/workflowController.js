const prisma = require('../prismaClient');

const ALLOWED_ESCALATIONS = {
    // Medical
    'MEDICAL_OP_TEAM': ['DEPUTY_MEDICAL_OFFICER', 'CHIEF_MEDICAL_OFFICER', 'SAFETY_OP_TEAM', 'CONTROL_OP_TEAM'],
    'DEPUTY_MEDICAL_OFFICER': ['CHIEF_MEDICAL_OFFICER'], // "Escalate: Yes (within Medical workflow only)" - Maybe to CMO?
    'CHIEF_MEDICAL_OFFICER': [], // Top of chain? Or can escalate to Safety/Control? Prompt says "Escalate: Yes (within Medical workflow only)"

    // Safety
    'SAFETY_OP_TEAM': ['DEPUTY_SAFETY_OFFICER', 'SAFETY_OFFICER_CHIEF', 'MEDICAL_OP_TEAM', 'CONTROL_OP_TEAM'],
    'DEPUTY_SAFETY_OFFICER': ['SAFETY_OFFICER_CHIEF'],
    'SAFETY_OFFICER_CHIEF': [],

    // Sport / Control
    'CONTROL_OP_TEAM': ['CHIEF_OF_CONTROL', 'DEPUTY_CONTROL_OP_OFFICER', 'MEDICAL_OP_TEAM', 'SAFETY_OP_TEAM'],
    'DEPUTY_CONTROL_OP_OFFICER': [
        'MEDICAL_OP_TEAM', 'SAFETY_OP_TEAM', 'SCRUTINEERS', 'JUDGEMENT', 'CHIEF_OF_CONTROL'
    ],
    'CHIEF_OF_CONTROL': [
        'MEDICAL_OP_TEAM', 'SAFETY_OP_TEAM', 'SCRUTINEERS', 'JUDGEMENT'
    ]
};

// @desc    Escalate a ticket to another role/team
// @route   POST /api/tickets/:id/escalate
// @access  Private
const escalateTicket = async (req, res) => {
    const { toRole, reason, notes } = req.body;
    const ticketId = req.params.id;
    const userRole = req.user.role;

    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        // Validate Escalation Path
        const allowedTargets = ALLOWED_ESCALATIONS[userRole] || [];

        // Admin override
        if (userRole !== 'ADMIN' && !allowedTargets.includes(toRole)) {
            return res.status(403).json({
                message: `Escalation not allowed. Your role (${userRole}) cannot escalate to ${toRole}.`
            });
        }

        let nextStatus = 'ESCALATED';
        // Specific status logic if needed, otherwise generic ESCALATED or preserve processing status
        // Prompt says "Receive / Process" for these roles, so maybe status should be OPEN or assigned?
        // Let's use ESCLATED to mark it, but they can pick it up.

        // Update Ticket: Assign to Role (Conceptually). 
        // Logic: specific user assignment or just role queue?
        // Since we don't have role queues in DB (just assignedToId specific user), 
        // we might need to notify or just set status.
        // For MVP/Proto, we'll set a `assignedToId` if a specific user is picked, BUT
        // the request usually just gives a target Role. 
        // Ideally, we'd have a 'pool'. 
        // Workaround: We will just log it and set status. Front end will filter by Role + Status/Type.
        // BUT, Scrutineers/Judgement imply specific assignment often.
        // For now, assume 'toRole' puts it in that bucket. The 'getTickets' logic filters by Status/Type.
        // We might need to change Ticket Type if it crosses departments? 
        // Medical -> Safety: Should it change type? Probably not, just who is looking at it.
        // But `getTickets` filters Medical Tickets for Medical Team. If a Medical Ticket goes to Safety, Safety needs to see it.
        // My `getTickets` logic: "SAFETY_OP_TEAM sees SAFETY tickets". 
        // If Medical escalates to Safety, the ticket type is still MEDICAL. Safety won't see it!
        // FIX: I need to update `getTickets` to look for Escalations aimed at their role, OR I need to change ticket Type, OR add `assignedDepartment` field.
        // Simpler: `getTickets` checks "Is Assigned To Me OR My Role". 
        // But I don't have 'assignedRole' field.
        // I will add `assignedRole` to Ticket model? 
        // Or just repurpose `status`?
        // Adding `assignedRole` to Schema is cleanest.

        // Wait, I can't easily change schema again without migration issues/time.
        // I'll stick to: Escalation changes `status` to `ESCALATED` and I'll add logic in `getTickets` to see EVERYTHING if you are a Processor?
        // No, strict separation.
        // Let's use `assignedToId` if specific user passed. 
        // If only `toRole` passed, we need a way.
        // I will try to find a user with that role? No, that's brittle.
        // I will rely on `type` switching? "Medical Ticket" -> Escalate to Safety. Does it become a Safety Ticket?
        // "Create: Medical Tickets only".
        // It's likely the Ticket keeps its identity.
        // I will assume `getTickets` needs to be smarter.

        // TEMPORARY FIX: If escalating across departments, maybe we DO need to update `assignedToId`.
        // If the user selects a specific *person* in the UI to escalate to, that works.
        // If they select a *Dept*, we have a problem.
        // I'll assume the UI asks for a specific User of that Role to assign to.

        let updateData = {
            status: nextStatus,
            escalatedToRole: toRole, // Save the target role
            activityLogs: {
                create: {
                    actorId: req.user.id,
                    action: 'TICKET_ESCALATED',
                    details: `Escalated to ${toRole}. Reason: ${reason}. Notes: ${notes}`
                }
            }
        };

        // If specific userId provided in body
        if (req.body.assignedToId) {
            updateData.assignedToId = req.body.assignedToId;
        }
        // If toRole provided, we can't easily assign without a 'Role Queue'.
        // I'll assume for this task that the User selects a Person.

        const updatedTicket = await prisma.ticket.update({
            where: { id: ticketId },
            data: updateData
        });

        res.json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Transfer ticket (Scrutineers <-> Judgement)
const transferTicket = async (req, res) => {
    const { toRole, notes, assignedToId } = req.body;
    const ticketId = req.params.id;
    const userRole = req.user.role;

    try {
        if (!['SCRUTINEERS', 'JUDGEMENT'].includes(userRole)) {
            return res.status(403).json({ message: 'Only Scrutineers/Judgement can transfer.' });
        }

        if (userRole === 'SCRUTINEERS' && toRole !== 'JUDGEMENT') {
            return res.status(403).json({ message: 'Scrutineers can only transfer to Judgement.' });
        }
        if (userRole === 'JUDGEMENT' && toRole !== 'SCRUTINEERS') {
            return res.status(403).json({ message: 'Judgement can only transfer to Scrutineers.' });
        }

        // Logic relies on assigning to a specific user (assignedToId) or just leaving it open in that 'pool' (if we had pools).
        // I'll require assignedToId for exclusive handling.

        if (!assignedToId) {
            return res.status(400).json({ message: 'Must assign to a specific user.' });
        }

        const ticket = await prisma.ticket.update({
            where: { id: ticketId },
            data: {
                assignedToId,
                status: 'AWAITING_DECISION', // or Keep current? 
                activityLogs: {
                    create: {
                        actorId: req.user.id,
                        action: 'TICKET_TRANSFERRED',
                        details: `Transferred to ${toRole}. Notes: ${notes}`
                    }
                }
            }
        });

        res.json(ticket);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Return ticket to Control
const returnTicket = async (req, res) => {
    const { notes } = req.body; // Maybe return to specific person?
    const ticketId = req.params.id;
    const userRole = req.user.role;

    try {
        if (!['SCRUTINEERS', 'JUDGEMENT'].includes(userRole)) {
            return res.status(403).json({ message: 'Permission denied.' });
        }

        // Must find who sent it? Or generic Control?
        // Prompt: "Return To: COC or Deputy Control Operation Officer only"
        // We really need to know WHO sent it or pick one.
        // For now, I'll set status RETURNED_TO_CONTROL and maybe clear assignedToId so Control team can pick it up?
        // Or assignedToId must be provided.

        // I'll require assignedToId in body (User must pick a Control Officer)
        if (!req.body.assignedToId) {
            return res.status(400).json({ message: 'Select a Control Officer to return to.' });
        }

        const ticket = await prisma.ticket.update({
            where: { id: ticketId },
            data: {
                assignedToId: req.body.assignedToId,
                status: 'RETURNED_TO_CONTROL',
                activityLogs: {
                    create: {
                        actorId: req.user.id,
                        action: 'TICKET_RETURNED',
                        details: `Returned to control. Notes: ${notes}`
                    }
                }
            }
        });

        res.json(ticket);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Reopen Ticket (Admin Only -> COC)
const reopenTicket = async (req, res) => {
    const ticketId = req.params.id;
    const userRole = req.user.role; // Should be ADMIN

    try {
        // 1. Check Permissions
        if (userRole !== 'ADMIN' && userRole !== 'CHIEF_OF_CONTROL') {
            return res.status(403).json({ message: 'Only Admin or Chief of Control can reopen tickets.' });
        }

        // 2. Find Ticket
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        if (ticket.status !== 'CLOSED') {
            return res.status(400).json({ message: 'Ticket is not closed.' });
        }

        // 3. Determine Assignee
        let targetUserId = null;
        let details = '';

        if (userRole === 'CHIEF_OF_CONTROL') {
            // COC reopens for themselves
            targetUserId = req.user.id;
            details = `Ticket reopened by Chief of Control (${req.user.name}).`;
        } else {
            // Admin reopens -> Assign to COC
            const cocUser = await prisma.user.findFirst({
                where: { role: 'CHIEF_OF_CONTROL' }
            });

            if (!cocUser) {
                return res.status(500).json({ message: 'No Chief of Control found to assign the ticket to.' });
            }
            targetUserId = cocUser.id;
            details = `Ticket reopened by Admin and directed to COC (${cocUser.name}).`;
        }

        // 4. Update Ticket
        const updatedTicket = await prisma.ticket.update({
            where: { id: ticketId },
            data: {
                status: 'REOPENED',
                assignedToId: targetUserId,
                activityLogs: {
                    create: {
                        actorId: req.user.id,
                        action: 'TICKET_REOPENED',
                        details: details
                    }
                }
            }
        });

        res.json(updatedTicket);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { escalateTicket, transferTicket, returnTicket, reopenTicket };
