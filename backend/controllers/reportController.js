const prisma = require('../prismaClient');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const xlsx = require('xlsx');

// === SAFE HELPERS ===
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

        console.log('[PDF Export] Ticket loaded, creating PDF with pdf-lib');

        const verifyToken = Math.random().toString(36).substring(2, 10).toUpperCase();

        // Create PDF using pdf-lib (different library than pdfkit)
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]); // A4 size
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const { width, height } = page.getSize();
        let yPosition = height - 50;

        // Helper to add text
        const addText = (text, size = 10, isBold = false) => {
            page.drawText(text, {
                x: 50,
                y: yPosition,
                size: size,
                font: isBold ? fontBold : font,
                color: rgb(0, 0, 0),
            });
            yPosition -= size + 5;
        };

        // === HEADER ===
        addText('INCIDENT REPORT', 20, true);
        addText(`Ticket: ${safeString(ticket.ticketNo)}`, 12);
        yPosition -= 10;

        // === BASIC INFO ===
        addText('BASIC INFORMATION', 14, true);
        addText(`Event: ${safeString(ticket.eventName)}`);
        addText(`Type: ${safeString(ticket.type)}`);
        addText(`Status: ${safeString(ticket.status)}`);
        addText(`Priority: ${safeString(ticket.priority)}`);
        addText(`Location: ${safeString(ticket.location)}`);
        addText(`Date: ${ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : 'N/A'}`);
        addText(`Reporter: ${safeString(ticket.createdBy?.name)}`);
        yPosition -= 10;

        // === DESCRIPTION ===
        addText('DESCRIPTION', 14, true);
        const description = safeString(ticket.description);
        if (description.length > 0) {
            // Split long text into lines
            const words = description.split(' ');
            let line = '';
            words.forEach(word => {
                if (line.length + word.length < 80) {
                    line += word + ' ';
                } else {
                    addText(line);
                    line = word + ' ';
                }
            });
            if (line) addText(line);
        } else {
            addText('No description provided.');
        }
        yPosition -= 10;

        // === MEDICAL REPORT ===
        if (ticket.medicalReport) {
            const m = ticket.medicalReport;
            addText('MEDICAL REPORT', 14, true);
            addText(`Patient: ${safeString(m.patientGivenName)} ${safeString(m.patientSurname)}`);
            addText(`DOB: ${m.patientDob ? new Date(m.patientDob).toLocaleDateString() : 'N/A'}`);
            addText(`Gender: ${safeString(m.patientGender)}`);
            addText(`Role: ${safeString(m.patientRole)}`);
            addText(`Injury Type: ${safeString(m.injuryType)}`);
            addText(`License Action: ${safeString(m.licenseAction)}`);
            if (m.motorsportId) addText(`Motorsport ID: ${safeString(m.motorsportId)}`);
            if (m.carNumber) addText(`Car Number: ${safeString(m.carNumber)}`);
            yPosition -= 10;
        }

        // === PIT GRID REPORT ===
        if (ticket.pitGridReport) {
            const p = ticket.pitGridReport;
            addText('PIT & GRID REPORT', 14, true);
            addText(`Car Number: ${safeString(p.carNumber)}`);
            addText(`Pit Number: ${safeString(p.pitNumber)}`);
            addText(`Session: ${safeString(p.sessionCategory)}`);
            yPosition -= 10;
        }

        // === VERIFICATION ===
        addText('VERIFICATION', 12, true);
        addText(`Token: ${verifyToken}`, 8);
        addText(`Generated: ${new Date().toISOString()}`, 8);

        // Save PDF
        const pdfBytes = await pdfDoc.save();

        console.log('[PDF Export] PDF created successfully');

        const fileName = `report-${safeString(ticket.ticketNo)}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', pdfBytes.length);
        res.send(Buffer.from(pdfBytes));

        // Save export record
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
