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
            margin: 50,
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

        // === COLORS ===
        const colors = {
            primary: '#047857',      // Emerald green
            primaryLight: '#D1FAE5', // Light emerald
            dark: '#1F2937',         // Dark gray
            medium: '#6B7280',       // Medium gray
            light: '#F3F4F6',        // Light gray
            border: '#E5E7EB',       // Border gray
            red: '#DC2626',          // Red for alerts
            redLight: '#FEE2E2'      // Light red
        };

        // === HEADER WITH LOGO AREA ===
        // Header background
        doc.rect(0, 0, 595.28, 120).fill(colors.primary);

        // Logo placeholder (white box)
        doc.rect(50, 30, 60, 60).fill('#FFFFFF');
        doc.fontSize(10).fillColor(colors.primary).text('SAMF', 65, 55, { width: 30, align: 'center' });

        // Title
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold')
            .text('INCIDENT REPORT', 130, 40);

        // Subtitle
        doc.fontSize(11).fillColor('#FFFFFF').font('Helvetica')
            .text('Saudi Automobile & Motorcycle Federation', 130, 70);

        // Ticket number badge
        doc.roundedRect(420, 40, 125, 35, 5).fill('#FFFFFF');
        doc.fontSize(10).fillColor(colors.medium).font('Helvetica')
            .text('TICKET NO.', 430, 48);
        doc.fontSize(14).fillColor(colors.primary).font('Helvetica-Bold')
            .text(safeString(ticket.ticketNo), 430, 63);

        // Status badge
        const statusColors = {
            'OPEN': '#10B981',
            'CLOSED': '#6B7280',
            'ESCALATED': '#F59E0B',
            'UNDER_REVIEW': '#3B82F6'
        };
        const statusColor = statusColors[ticket.status] || colors.medium;
        doc.roundedRect(420, 82, 125, 25, 5).fill(statusColor);
        doc.fontSize(11).fillColor('#FFFFFF').font('Helvetica-Bold')
            .text(safeString(ticket.status).replace(/_/g, ' '), 430, 90, { width: 105, align: 'center' });

        doc.moveDown(3);
        let yPos = 140;

        // === HELPER FUNCTIONS ===
        const safeNumber = (val, defaultVal = 0) => {
            if (typeof val === 'number' && !isNaN(val) && isFinite(val)) return val;
            return defaultVal;
        };

        const drawSection = (title, yPosition) => {
            const safeY = safeNumber(yPosition, 140);
            doc.fontSize(14).fillColor(colors.primary).font('Helvetica-Bold')
                .text(title.toUpperCase(), 50, safeY);
            doc.moveTo(50, safeY + 18).lineTo(545, safeY + 18)
                .strokeColor(colors.border).lineWidth(1).stroke();
            return safeY + 30;
        };

        const drawInfoBox = (label, value, x, y, width = 120) => {
            const safeX = safeNumber(x, 50);
            const safeY = safeNumber(y, 140);
            const safeWidth = safeNumber(width, 120);

            doc.fontSize(8).fillColor(colors.medium).font('Helvetica')
                .text(safeString(label).toUpperCase(), safeX, safeY);
            doc.fontSize(11).fillColor(colors.dark).font('Helvetica-Bold')
                .text(safeString(value), safeX, safeY + 12, { width: safeWidth, ellipsis: true });
        };

        const checkPageSpace = (needed) => {
            const safeNeeded = safeNumber(needed, 100);
            const currentY = safeNumber(doc.y, 140);
            if (currentY + safeNeeded > 750) {
                doc.addPage();
                return 50;
            }
            return currentY;
        };

        // === BASIC INFORMATION SECTION ===
        yPos = drawSection('Basic Information', yPos);

        // Info grid with background
        doc.roundedRect(50, yPos, 495, 90, 5).fill(colors.light).stroke();

        drawInfoBox('Event Name', ticket.eventName, 65, yPos + 15, 140);
        drawInfoBox('Type', ticket.type, 220, yPos + 15, 100);
        drawInfoBox('Priority', ticket.priority, 335, yPos + 15, 80);
        drawInfoBox('Location', ticket.location, 430, yPos + 15, 100);

        drawInfoBox('Date & Time', ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : 'N/A', 65, yPos + 50, 140);
        drawInfoBox('Reporter', ticket.createdBy?.name, 220, yPos + 50, 140);
        drawInfoBox('Contact', ticket.createdBy?.mobile || ticket.createdBy?.email, 375, yPos + 50, 155);

        yPos += 110;

        // === DESCRIPTION SECTION ===
        yPos = checkPageSpace(80);
        yPos = drawSection('Incident Description', yPos);

        doc.roundedRect(50, yPos, 495, 'auto').fillAndStroke(colors.light, colors.border);
        doc.fontSize(10).fillColor(colors.dark).font('Helvetica')
            .text(safeString(ticket.description) || 'No description provided.', 65, yPos + 15, {
                width: 465,
                align: 'left',
                lineGap: 3
            });

        yPos = doc.y + 15;

        // === MEDICAL REPORT SECTION ===
        if (ticket.medicalReport) {
            yPos = checkPageSpace(150);
            yPos = drawSection('Medical Report', yPos);

            const m = ticket.medicalReport;

            // Patient info box
            doc.roundedRect(50, yPos, 495, 70, 5).fill(colors.primaryLight).stroke();

            drawInfoBox('Patient Name', `${safeString(m.patientGivenName)} ${safeString(m.patientSurname)}`, 65, yPos + 15, 150);
            drawInfoBox('Date of Birth', m.patientDob ? new Date(m.patientDob).toLocaleDateString() : 'N/A', 230, yPos + 15, 100);
            drawInfoBox('Gender', m.patientGender, 345, yPos + 15, 80);
            drawInfoBox('Role', m.patientRole, 440, yPos + 15, 90);

            yPos += 80;

            // Clinical details
            doc.roundedRect(50, yPos, 495, 'auto').fillAndStroke(colors.light, colors.border);

            let clinicalY = yPos + 15;
            drawInfoBox('Injury Type', m.injuryType, 65, clinicalY, 200);
            drawInfoBox('Motorsport ID', m.motorsportId, 280, clinicalY, 120);
            drawInfoBox('Car Number', m.carNumber, 415, clinicalY, 115);

            clinicalY += 40;
            if (m.initialCondition) {
                doc.fontSize(8).fillColor(colors.medium).font('Helvetica').text('INITIAL CONDITION', 65, clinicalY);
                doc.fontSize(10).fillColor(colors.dark).font('Helvetica').text(safeString(m.initialCondition), 65, clinicalY + 12, { width: 465 });
                clinicalY += 35;
            }

            if (m.treatmentGiven) {
                doc.fontSize(8).fillColor(colors.medium).font('Helvetica').text('TREATMENT GIVEN', 65, clinicalY);
                doc.fontSize(10).fillColor(colors.dark).font('Helvetica').text(safeString(m.treatmentGiven), 65, clinicalY + 12, { width: 465 });
                clinicalY += 35;
            }

            yPos = clinicalY + 10;

            // License action alert
            if (m.licenseAction && m.licenseAction !== 'NONE' && m.licenseAction !== 'CLEAR') {
                doc.roundedRect(50, yPos, 495, 35, 5).fill(colors.redLight).stroke();
                doc.fontSize(12).fillColor(colors.red).font('Helvetica-Bold')
                    .text(`⚠ LICENSE ACTION: ${safeString(m.licenseAction).replace(/_/g, ' ')}`, 65, yPos + 12);
                yPos += 45;
            }
        }

        // === PIT & GRID REPORT SECTION ===
        if (ticket.pitGridReport) {
            yPos = checkPageSpace(120);
            yPos = drawSection('Pit & Grid Report', yPos);

            const p = ticket.pitGridReport;

            doc.roundedRect(50, yPos, 495, 70, 5).fill(colors.light).stroke();

            drawInfoBox('Car Number', p.carNumber, 65, yPos + 15, 100);
            drawInfoBox('Pit Number', p.pitNumber, 180, yPos + 15, 100);
            drawInfoBox('Session', p.sessionCategory, 295, yPos + 15, 120);
            drawInfoBox('Lap Number', p.lapNumber, 430, yPos + 15, 100);

            yPos += 80;

            // Speed info
            if (p.speedLimit || p.speedRecorded) {
                doc.roundedRect(50, yPos, 240, 50, 5).fill(colors.primaryLight).stroke();
                drawInfoBox('Speed Limit', p.speedLimit, 65, yPos + 15, 100);
                drawInfoBox('Speed Recorded', p.speedRecorded, 170, yPos + 15, 100);
                yPos += 60;
            }

            // Violations
            const violations = [];
            if (p.drivingOnWhiteLine) violations.push('Driving on White Line');
            if (p.refueling) violations.push('Refueling Violation');
            if (p.excessMechanics) violations.push('Excess Mechanics');
            if (p.driverChange) violations.push('Driver Change Violation');

            if (violations.length > 0) {
                doc.fontSize(10).fillColor(colors.medium).font('Helvetica').text('VIOLATIONS:', 50, yPos);
                yPos += 15;
                violations.forEach(v => {
                    doc.roundedRect(50, yPos, 200, 20, 3).fill(colors.redLight).stroke();
                    doc.fontSize(9).fillColor(colors.red).font('Helvetica-Bold').text(v, 60, yPos + 5);
                    yPos += 25;
                });
            }
        }

        // === ACTIVITY LOG SECTION ===
        if (ticket.activityLogs && ticket.activityLogs.length > 0) {
            yPos = checkPageSpace(100);
            yPos = drawSection('Activity Timeline', yPos);

            const logsToShow = ticket.activityLogs.slice(0, 10);
            logsToShow.forEach((log, index) => {
                yPos = checkPageSpace(35);

                const date = log.createdAt ? new Date(log.createdAt).toLocaleDateString() : 'N/A';
                const time = log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                const action = safeString(log.action).replace(/_/g, ' ');
                const actor = safeString(log.actor?.name) || 'System';

                // Timeline dot
                doc.circle(60, yPos + 10, 4).fill(colors.primary);

                // Date/Time
                doc.fontSize(8).fillColor(colors.medium).font('Helvetica')
                    .text(`${date} ${time}`, 75, yPos);

                // Action
                doc.fontSize(10).fillColor(colors.dark).font('Helvetica-Bold')
                    .text(action, 75, yPos + 12);

                // Actor
                doc.fontSize(9).fillColor(colors.medium).font('Helvetica')
                    .text(`by ${actor}`, 75, yPos + 25);

                yPos += 40;
            });
        }

        // === FOOTER WITH QR CODE ===
        yPos = checkPageSpace(120);
        doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor(colors.border).lineWidth(1).stroke();
        yPos += 15;

        doc.fontSize(12).fillColor(colors.primary).font('Helvetica-Bold')
            .text('REPORT VERIFICATION', 50, yPos);

        yPos += 20;

        // QR Code
        const verifyUrl = `${process.env.FRONTEND_URL || 'https://incident-system.vercel.app'}/verify/${verifyToken}`;
        try {
            const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 100, margin: 1 });
            doc.image(qrDataUrl, 50, yPos, { width: 80 });

            doc.fontSize(9).fillColor(colors.medium).font('Helvetica')
                .text('Scan to verify authenticity', 50, yPos + 85, { width: 80, align: 'center' });
        } catch (qrError) {
            console.error('[PDF Export] QR generation error:', qrError);
        }

        // Verification details
        doc.fontSize(10).fillColor(colors.dark).font('Helvetica-Bold')
            .text('Verification Token:', 150, yPos);
        doc.fontSize(12).fillColor(colors.primary).font('Helvetica-Bold')
            .text(verifyToken, 150, yPos + 15);

        doc.fontSize(9).fillColor(colors.medium).font('Helvetica')
            .text(`Generated: ${new Date().toLocaleString()}`, 150, yPos + 35);

        doc.fontSize(8).fillColor(colors.medium).font('Helvetica')
            .text('This is an official document generated by the SAMF Incident Management System.', 150, yPos + 55, { width: 395 });
        doc.text('Unauthorized modification or reproduction is prohibited.', 150, yPos + 68, { width: 395 });

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
