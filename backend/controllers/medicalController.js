const prisma = require('../prismaClient');

// @desc    Submit a medical report for a ticket
// @route   POST /api/tickets/:id/medical-report
// @access  Private (Medical/Admin)
const submitMedicalReport = async (req, res) => {
    const ticketId = req.params.id;
    const { summary, recommendation, licenseAction, driverName } = req.body;

    try {
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        // Upsert Medical Report (Update if exists, Create if new)
        const report = await prisma.medicalReport.upsert({
            where: { ticketId },
            update: {
                summary,
                recommendation,
                licenseAction,
                // If updating, we might want to track the 'Assessor', but for now let's leave author as original or update?
                // If we don't update authorId, it stays as the Marshal.
                // If we do, it becomes the Doctor.
                // Given the fields are distinct (Marshal data vs Doctor Assessment), maybe we keep the original author? 
                // However, the PDF report says "Report by [Author]". 
                // Let's NOT update authorId to preserve the original creator (Marshal). 
                // Ideally we'd have `assessorId`. But schema is fixed for now?
                // Let's just update the content fields.
            },
            create: {
                ticketId,
                authorId: req.user.id,
                summary,
                recommendation,
                licenseAction
            }
        });

        // Update Ticket Status based on license action or general workflow
        const newStatus = licenseAction === 'SUSPEND' ? 'ESCALATED' : 'AWAITING_DECISION';

        await prisma.ticket.update({
            where: { id: ticketId },
            data: { status: newStatus }
        });

        // Log Activity
        await prisma.activityLog.create({
            data: {
                ticketId,
                actorId: req.user.id,
                action: 'MEDICAL_REPORT_SUBMITTED',
                details: `Medical report submitted. License Action: ${licenseAction}. Recommendation: ${recommendation}`
            }
        });

        res.status(201).json(report);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to submit medical report' });
    }
};

// @desc    Get medical report for a ticket
// @route   GET /api/tickets/:id/medical-report
// @access  Private (Medical/Admin)
const getMedicalReport = async (req, res) => {
    try {
        const report = await prisma.medicalReport.findUnique({
            where: { ticketId: req.params.id },
            include: { author: { select: { name: true, role: true } } }
        });

        if (!report) {
            return res.status(404).json({ message: 'No medical report found' });
        }

        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { submitMedicalReport, getMedicalReport };
