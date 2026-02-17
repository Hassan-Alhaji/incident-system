const prisma = require('../prismaClient');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const xlsx = require('xlsx');

// Helper to safely convert to string
const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') {
        if (isNaN(val) || !isFinite(val)) return '';
        return String(val);
    }
    if (typeof val === 'string') return val;
    if (typeof val === 'boolean') return String(val);
    return '';
};

// @desc    Export ticket report to PDF
// @route   POST /api/tickets/:id/export-pdf
// @access  Private
const exportPdf = async (req, res) => {
    const ticketId = req.params.id;

    try {
        console.log('[PDF Export] Starting for ticket:', ticketId);

        // Fetch comprehensive data
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                createdBy: { select: { name: true, email: true, mobile: true } },
                medicalReport: true,
                controlReport: true,
                safetyReport: true,
                pitGridReport: true,
                attachments: true,
                activityLogs: {
                    include: { actor: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 20
                }
            }
        });

        if (!ticket) {
            console.log('[PDF Export] Ticket not found');
            return res.status(404).json({ message: 'Ticket not found' });
        }

        console.log('[PDF Export] Ticket loaded, creating document');

        const verifyToken = Math.random().toString(36).substring(2, 10).toUpperCase();
        const chunks = [];
        const doc = new PDFDocument({
            size: 'A4',
            margin: 40,
            bufferPages: true,
            autoFirstPage: true
        });

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', async () => {
            console.log('[PDF Export] Document finalized, sending response');
            const pdfBuffer = Buffer.concat(chunks);
            const fileName = `report-${safeString(ticket.ticketNo)}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            res.send(pdfBuffer);

            try {
                await prisma.ticketExport.create({
                    data: {
                        ticketId,
                        verifyToken,
                        pdfUrl: 'BUFFERED',
                        snapshotJson: JSON.stringify({ id: ticket.id, ticketNo: ticket.ticketNo })
                    }
                });
            } catch (e) {
                console.error('Export log error:', e);
            }
        });

        doc.on('error', (err) => {
            console.error('[PDF Export] PDFKit error:', err);
        });

        // === SIMPLE HEADER ===
        doc.fontSize(20).text('INCIDENT REPORT', { align: 'center' });
        doc.fontSize(12).text(`Ticket: ${safeString(ticket.ticketNo)}`, { align: 'center' });
        doc.moveDown();

        // === BASIC INFO ===
        doc.fontSize(14).text('Basic Information', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);

        doc.text(`Event: ${safeString(ticket.eventName)}`);
        doc.text(`Type: ${safeString(ticket.type)}`);
        doc.text(`Status: ${safeString(ticket.status)}`);
        doc.text(`Priority: ${safeString(ticket.priority)}`);
        doc.text(`Location: ${safeString(ticket.location)}`);
        doc.text(`Date: ${ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : 'N/A'}`);
        doc.text(`Reporter: ${safeString(ticket.createdBy?.name)}`);
        doc.moveDown();

        // === DESCRIPTION ===
        doc.fontSize(14).text('Description', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);
        const description = safeString(ticket.description);
        if (description.length > 0) {
            // Split into chunks to avoid text wrapping issues
            const maxLength = 500;
            for (let i = 0; i < description.length; i += maxLength) {
                doc.text(description.substring(i, i + maxLength));
            }
        } else {
            doc.text('No description provided.');
        }
        doc.moveDown();

        // === MEDICAL REPORT ===
        if (ticket.medicalReport) {
            const m = ticket.medicalReport;
            doc.fontSize(14).text('Medical Report', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);

            doc.text(`Patient: ${safeString(m.patientGivenName)} ${safeString(m.patientSurname)}`);
            doc.text(`DOB: ${m.patientDob ? new Date(m.patientDob).toLocaleDateString() : 'N/A'}`);
            doc.text(`Gender: ${safeString(m.patientGender)}`);
            doc.text(`Role: ${safeString(m.patientRole)}`);
            doc.text(`Injury Type: ${safeString(m.injuryType)}`);
            doc.text(`License Action: ${safeString(m.licenseAction)}`);

            if (m.initialCondition) {
                doc.text(`Condition: ${safeString(m.initialCondition)}`);
            }
            if (m.treatmentGiven) {
                doc.text(`Treatment: ${safeString(m.treatmentGiven)}`);
            }
            doc.moveDown();
        }

        // === PIT GRID REPORT ===
        if (ticket.pitGridReport) {
            const p = ticket.pitGridReport;
            doc.fontSize(14).text('Pit & Grid Report', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);

            doc.text(`Car Number: ${safeString(p.carNumber)}`);
            doc.text(`Pit Number: ${safeString(p.pitNumber)}`);
            doc.text(`Session: ${safeString(p.sessionCategory)}`);
            doc.text(`Speed Limit: ${safeString(p.speedLimit)}`);
            doc.text(`Speed Recorded: ${safeString(p.speedRecorded)}`);

            const violations = [];
            if (p.drivingOnWhiteLine) violations.push('Driving on White Line');
            if (p.refueling) violations.push('Refueling Violation');
            if (p.excessMechanics) violations.push('Excess Mechanics');

            if (violations.length > 0) {
                doc.text(`Violations: ${violations.join(', ')}`);
            }
            doc.moveDown();
        }

        // === ACTIVITY LOG (Simplified) ===
        if (ticket.activityLogs && ticket.activityLogs.length > 0) {
            doc.fontSize(14).text('Activity Log', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(9);

            // Limit to prevent overflow
            const logsToShow = ticket.activityLogs.slice(0, 10);
            logsToShow.forEach((log, index) => {
                const date = log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A';
                const action = safeString(log.action).replace(/_/g, ' ');
                const actor = safeString(log.actor?.name) || 'System';

                doc.text(`${date} - ${action} by ${actor}`);

                // Add page break if needed
                if (index < logsToShow.length - 1 && doc.y > 700) {
                    doc.addPage();
                }
            });
            doc.moveDown();
        }

        // === VERIFICATION QR CODE ===
        const verifyUrl = `${process.env.FRONTEND_URL || 'https://incident-system.vercel.app'}/verify/${verifyToken}`;
        try {
            const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 150, margin: 1 });
            doc.fontSize(12).text('Verification', { underline: true });
            doc.moveDown(0.5);
            try {
                if (qrDataUrl) {
                    doc.image(qrDataUrl, { width: 100 });
                } else {
                    doc.text('(QR Code Generation Failed)');
                }
            } catch (imgError) {
                console.error('[PDF Export] QR Image Error:', imgError);
                doc.text('(QR Code Image Failed)');
            }
            doc.fontSize(8).text(`Token: ${verifyToken}`);
            doc.text(`Generated: ${new Date().toISOString()}`);
        } catch (qrError) {
            console.error('[PDF Export] QR generation error:', qrError);
            doc.fontSize(10).text(`Verification Token: ${verifyToken}`);
        }

        console.log('[PDF Export] Finalizing document');
        doc.end();

    } catch (error) {
        console.error("[PDF Export Error]:", error);
        console.error(error.stack);
        if (!res.headersSent) {
            res.status(500).json({ message: `Export failed: ${error.message}` });
        }
    }
};

// @desc    Export tickets to Excel
// @route   GET /api/tickets/export-excel
// @access  Private (Admin/COC)
const exportExcel = async (req, res) => {
    try {
        console.log('[Excel Export] Starting export');
        const { startDate, endDate } = req.query;

        // 1. Validation & Filter
        const where = {};
        if (startDate && endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            where.createdAt = {
                gte: new Date(startDate),
                lte: end
            };
        }

        // 2. Fetch Data
        const tickets = await prisma.ticket.findMany({
            where,
            include: {
                createdBy: true,
                medicalReport: true,
                pitGridReport: true
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`[Excel Export] Found ${tickets.length} tickets`);

        if (!tickets || tickets.length === 0) {
            return res.status(404).json({ message: 'No tickets found for the selected range.' });
        }

        // 3. Transform Data for Excel
        const data = tickets.map(t => ({
            'Ticket No': safeString(t.ticketNo),
            'Event': safeString(t.eventName),
            'Open Date': t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '',
            'Closed Date': t.closedAt ? new Date(t.closedAt).toLocaleDateString() : '-',
            'Type': safeString(t.type),
            'Status': safeString(t.status),
            'Priority': safeString(t.priority),
            'Reporter': safeString(t.createdBy?.name) || 'Unknown',
            'Description': safeString(t.description),
            'Assigned To': safeString(t.assignedToId) || 'Unassigned',

            // Medical Specifics
            'Patient Name': t.medicalReport
                ? `${safeString(t.medicalReport.patientGivenName)} ${safeString(t.medicalReport.patientSurname)}`.trim()
                : '',
            'Injury Type': safeString(t.medicalReport?.injuryType),
            'License Action': safeString(t.medicalReport?.licenseAction),

            // Pit Specifics
            'Car No': safeString(t.pitGridReport?.carNumber) || safeString(t.medicalReport?.carNumber),
            'Pit Violation': t.pitGridReport ? [
                t.pitGridReport.drivingOnWhiteLine ? 'White Line' : '',
                t.pitGridReport.refueling ? 'Refueling' : '',
                t.pitGridReport.excessMechanics ? 'Excess Mechanics' : ''
            ].filter(Boolean).join(', ') : ''
        }));

        // 4. Create Workbook
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Tickets');

        // 5. Generate Buffer (In-Memory)
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        console.log('[Excel Export] Buffer created, sending response');

        // 6. Send Response
        const fileName = `tickets_export_${Date.now()}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buffer.length);

        res.send(buffer);

    } catch (error) {
        console.error('[Excel Export Error]:', error);
        console.error(error.stack);
        res.status(500).json({ message: `Excel export failed: ${error.message}` });
    }
};

// @desc    Verify a report via QR token
// @route   GET /api/verify/:token
// @access  Public
const verifyReport = async (req, res) => {
    const { token } = req.params;

    try {
        const exportRecord = await prisma.ticketExport.findUnique({
            where: { verifyToken: token },
            include: { ticket: { include: { createdBy: { select: { name: true } } } } }
        });

        if (!exportRecord) {
            return res.status(404).json({ valid: false, message: 'Invalid or expired report token' });
        }

        res.json({
            valid: true,
            ticketNo: exportRecord.ticket.ticketNo,
            type: exportRecord.ticket.type,
            status: exportRecord.ticket.status,
            createdAt: exportRecord.ticket.createdAt,
            reporter: exportRecord.ticket.createdBy.name
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { exportPdf, exportExcel, verifyReport };
